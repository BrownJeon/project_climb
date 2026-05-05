import { useEffect, useRef, useState } from 'react';
import { Btn } from './atoms';
import { geoApi } from '../api/geo';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const DAUM_POSTCODE_JS = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const DEFAULT_CENTER = [37.5665, 126.9780]; // 서울 시청
const DEFAULT_ZOOM = 13;

function loadScriptOnce(src) {
  if (window[`__loading_${src}`]) return window[`__loading_${src}`];
  const p = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
  window[`__loading_${src}`] = p;
  return p;
}

function loadLeafletCSS() {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

async function loadLeaflet() {
  loadLeafletCSS();
  if (!window.L) await loadScriptOnce(LEAFLET_JS);
  return window.L;
}

async function loadDaumPostcode() {
  if (!window.daum?.Postcode) await loadScriptOnce(DAUM_POSTCODE_JS);
  return window.daum.Postcode;
}

export default function MapPicker({ value, onChange, defaultQuery = '' }) {
  const containerRef = useRef(null);
  const postcodeRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [q, setQ] = useState(defaultQuery);

  // 외부에서 defaultQuery가 변경되면 검색 입력란을 따라가게 한다.
  useEffect(() => {
    setQ(defaultQuery);
  }, [defaultQuery]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [postcodeOpen, setPostcodeOpen] = useState(false);
  const [kakaoEnabled, setKakaoEnabled] = useState(true);

  useEffect(() => {
    geoApi.status().then((r) => setKakaoEnabled(!!r.data?.kakao_enabled)).catch(() => setKakaoEnabled(false));
  }, []);

  // 지도 초기화
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const initLat = value?.lat ?? DEFAULT_CENTER[0];
      const initLng = value?.lng ?? DEFAULT_CENTER[1];
      const map = L.map(containerRef.current).setView([initLat, initLng], DEFAULT_ZOOM);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map);
      const marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);
      mapRef.current = map; markerRef.current = marker;

      const onPick = (lat, lng) => {
        marker.setLatLng([lat, lng]);
        onChange?.({ address: value?.address || '', lat, lng });
      };
      map.on('click', (e) => onPick(e.latlng.lat, e.latlng.lng));
      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onPick(ll.lat, ll.lng);
      });
    });
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (value?.lat != null && value?.lng != null) {
      const ll = [value.lat, value.lng];
      markerRef.current.setLatLng(ll);
      mapRef.current.setView(ll, Math.max(mapRef.current.getZoom(), 15));
    }
  }, [value?.lat, value?.lng]);

  // 다음 우편번호 (도로명/지번 보조)
  useEffect(() => {
    if (!postcodeOpen) return;
    let active = true;
    loadDaumPostcode().then((Postcode) => {
      if (!active || !postcodeRef.current) return;
      postcodeRef.current.innerHTML = '';
      new Postcode({
        width: '100%', height: '100%',
        oncomplete: (data) => {
          const address = data.roadAddress || data.jibunAddress || data.address;
          setPostcodeOpen(false);
          onChange?.({ address, lat: value?.lat ?? null, lng: value?.lng ?? null });
        },
        onclose: () => setPostcodeOpen(false),
      }).embed(postcodeRef.current);
    });
    return () => { active = false; };
  }, [postcodeOpen]);

  async function doSearch(e) {
    e?.preventDefault?.();
    if (!q.trim() || searching) return;
    setSearching(true); setResults([]); setSearchError(null);
    try {
      const r = await geoApi.search(q.trim());
      setResults(r.data?.results || []);
      if (!r.data?.results?.length) setSearchError('검색 결과가 없습니다.');
    } catch (e) {
      setSearchError(e?.response?.data?.message || '검색 실패');
    } finally {
      setSearching(false);
    }
  }

  function pick(item) {
    const address = item.road_address_name || item.address_name;
    onChange?.({
      address, lat: item.lat, lng: item.lng,
      phone: item.phone || null,
    });
    setResults([]);
    setQ(item.place_name || item.address_name || '');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <form onSubmit={doSearch} style={{
        display: 'flex', gap: 6,
        padding: '8px 10px', background: 'var(--surface)',
        border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
      }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="장소·상호명·지명 검색 (예: 더클라임 강남)"
          style={{ flex: 1, border: 0, outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--ink-1)' }}
        />
        <button type="submit" disabled={!q.trim() || searching}
          style={{
            fontSize: 12, fontWeight: 700,
            color: q.trim() ? 'var(--primary)' : 'var(--ink-4)',
            padding: '0 6px',
          }}>
          {searching ? '검색…' : '검색'}
        </button>
      </form>

      {!kakaoEnabled && (
        <div style={{
          padding: '8px 10px', fontSize: 11, color: 'var(--ink-3)',
          background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)', lineHeight: 1.55,
        }}>
          상호·장소 검색은 카카오 Local API 키가 필요합니다.<br />
          backend/.env의 <code>KAKAO_REST_API_KEY</code>에 카카오 디벨로퍼스에서 발급한 REST API 키를 등록한 뒤 서버 재시작하세요.
          (없어도 아래 도로명/지번 검색은 사용 가능합니다.)
        </div>
      )}

      {searchError && (
        <div style={{ fontSize: 11, color: 'var(--danger)' }}>{searchError}</div>
      )}

      {results.length > 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)', maxHeight: 240, overflow: 'auto',
        }}>
          {results.map((item) => (
            <button key={item.id} type="button" onClick={() => pick(item)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px',
                borderBottom: '1px solid var(--line)', background: 'transparent',
              }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>{item.place_name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                {item.road_address_name || item.address_name}
                {item.category_name && <span style={{ marginLeft: 6, color: 'var(--ink-4)' }}>· {item.category_name.split('>').pop().trim()}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      <div>
        <Btn variant="ghost" size="sm" onClick={() => setPostcodeOpen((v) => !v)}>
          {postcodeOpen ? '도로명/지번 검색 닫기' : '도로명/지번으로 검색'}
        </Btn>
      </div>

      {postcodeOpen && (
        <div ref={postcodeRef} style={{
          width: '100%', height: 360,
          border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', overflow: 'hidden',
        }} />
      )}

      <div
        ref={containerRef}
        style={{
          width: '100%', height: 240,
          borderRadius: 'var(--r-sm)', overflow: 'hidden',
          border: '1px solid var(--line)',
        }}
      />
      <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>
        장소를 선택하면 주소·좌표·전화번호가 자동 입력됩니다. 영업시간·가격은 카카오 정책상 자동 가져오기가 막혀 있어 직접 입력해 주세요. 마커 드래그로 좌표 미세조정 가능.
      </div>
    </div>
  );
}

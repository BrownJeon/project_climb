import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { Chip, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import GymAddModal from '../components/modals/GymAddModal';
import GymCard from '../components/GymCard';
import { gymsApi } from '../api/gyms';
import { usersApi } from '../api/users';
import { climbLogsApi } from '../api/climbLogs';

export default function GymListPage() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [gyms, setGyms] = useState([]);
  const [filterChip, setFilterChip] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  async function handleDelete(g) {
    if (!confirm(`'${g.name}' 암장을 삭제할까요?\n해당 암장의 영상·문제·이용권 등 관련 데이터에 영향이 있을 수 있습니다.`)) return;
    try {
      await gymsApi.remove(g.id);
      setReloadTick((t) => t + 1);
    } catch (e) {
      alert(e?.response?.data?.message || '삭제 실패');
    }
  }
  const [coords, setCoords] = useState(null); // {lat, lng}
  const [coordsError, setCoordsError] = useState(null);
  const [filterMessage, setFilterMessage] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // 'near' 칩 처음 선택 시 위치 조회
  useEffect(() => {
    if (filterChip !== 'near') return;
    if (coords) return;
    if (!('geolocation' in navigator)) {
      setCoordsError('이 브라우저는 위치 정보를 지원하지 않습니다.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setCoordsError(null);
      },
      (err) => {
        setCoordsError(err.code === 1 ? '위치 권한이 거부되어 5km 필터를 사용할 수 없습니다.' : '위치를 가져올 수 없습니다.');
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 }
    );
  }, [filterChip, coords]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const params = {
        q: debouncedQ || undefined,
        include_summary: 'true',
        limit: 30,
      };
      setFilterMessage(null);

      if (filterChip === 'near') {
        if (!coords) return; // 위치 도착 대기
        params.lat = coords.lat;
        params.lng = coords.lng;
        params.radius = 5;
      } else if (filterChip === 'main') {
        try {
          const me = await usersApi.me();
          const ids = (me.data?.main_gyms || []).map((g) => g.id);
          if (ids.length === 0) {
            if (!cancelled) { setGyms([]); setFilterMessage('주 암장이 등록되어 있지 않습니다. 마이페이지에서 추가하세요.'); }
            return;
          }
          params.ids = ids.join(',');
        } catch {
          if (!cancelled) setFilterMessage('주 암장을 불러오지 못했습니다.');
          return;
        }
      } else if (filterChip === 'recent') {
        try {
          const r = await climbLogsApi.visitedGymsWithDetail(30);
          const gyms = r.data?.gyms || [];
          if (gyms.length === 0) {
            if (!cancelled) { setGyms([]); setFilterMessage('최근 방문한 암장 기록이 없습니다.'); }
          } else {
            if (!cancelled) setGyms(gyms);
          }
        } catch {
          if (!cancelled) setFilterMessage('방문 기록을 불러오지 못했습니다.');
        }
        return;
      }

      try {
        const r = await gymsApi.list(params);
        if (!cancelled) setGyms(r.data?.gyms || []);
      } catch {
        if (!cancelled) setGyms([]);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [debouncedQ, reloadTick, filterChip, coords]);

  const addBtn = (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={() => nav('/me')} aria-label="뒤로"
        style={{
          width: 36, height: 36, borderRadius: 'var(--r-pill)',
          display: 'grid', placeItems: 'center',
          color: 'var(--ink-2)', background: 'var(--surface-2)',
        }}>
        {I.chev(16, 'left')}
      </button>
      <button
        onClick={() => setAddOpen(true)}
        aria-label="새 암장 등록"
        style={{
          width: 36, height: 36, borderRadius: 'var(--r-pill)',
          display: 'grid', placeItems: 'center',
          color: 'var(--ink-2)', background: 'var(--surface-2)',
        }}
      >
        {I.plus(18)}
      </button>
    </div>
  );

  return (
    <>
      <TopBar title="암장 관리" right={addBtn} />

      <div style={{ padding: '12px 16px' }}>
        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 'var(--r-pill)',
        }}>
          <span style={{ color: 'var(--ink-4)' }}>{I.search(16)}</span>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="암장 이름 검색"
            style={{ flex: 1, border: 0, outline: 'none', fontSize: 14, background: 'transparent' }}
          />
        </div>

        {/* Quick filter chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <Chip active={filterChip === 'all'}     onClick={() => setFilterChip('all')}>전체</Chip>
          <Chip active={filterChip === 'near'}    onClick={() => setFilterChip('near')}    icon={I.pin(12)}>내 위치 5km</Chip>
          <Chip active={filterChip === 'recent'}  onClick={() => setFilterChip('recent')}>최근 방문</Chip>
          <Chip active={filterChip === 'main'}    onClick={() => setFilterChip('main')}>주 암장</Chip>
        </div>
        {filterChip === 'near' && coordsError && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--danger)' }}>{coordsError}</div>
        )}
        {filterChip === 'near' && !coords && !coordsError && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>현재 위치 확인 중...</div>
        )}
        {filterMessage && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-3)' }}>{filterMessage}</div>
        )}
      </div>

      <div style={{ padding: '4px 16px 16px', fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
        검색 결과 {gyms.length}
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {gyms.map((g) => (
          <GymCard
            key={g.id}
            gym={g}
            onClick={() => nav(`/gyms/${g.id}`)}
            onEdit={setEditTarget}
            onDelete={handleDelete}
          />
        ))}

        {gyms.length === 0 && (
          <div style={{ padding: '32px 0', color: 'var(--ink-3)', textAlign: 'center', fontSize: 13 }}>
            검색 결과가 없습니다.
          </div>
        )}
      </div>

      {addOpen && (
        <GymAddModal
          onClose={() => setAddOpen(false)}
          onSaved={(gym) => {
            setReloadTick((t) => t + 1);
            if (gym?.id) nav(`/gyms/${gym.id}`);
          }}
        />
      )}
      {editTarget && (
        <GymAddModal
          gym={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => setReloadTick((t) => t + 1)}
        />
      )}
    </>
  );
}

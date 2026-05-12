import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { Chip, ColorBadge } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { climbLogsApi } from '../api/climbLogs';
import { gymsApi } from '../api/gyms';
import GymSearchCombobox from '../components/GymSearchCombobox';
import { COLOR_KEYS, colorMeta } from '../utils/colors';
import { STYLE_KEYS, styleLabel } from '../utils/style';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
const PAGE_SIZE = 20;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function shiftDays(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }
function fmtDate(s) { return s ? s.slice(5) : ''; }

const RANGE_PRESETS = [
  ['1w',  '1주',  -7],
  ['4w',  '4주',  -28],
  ['3m',  '3개월', -90],
  ['1y',  '1년',  -365],
];

export default function RecordsPage() {
  const nav = useNavigate();
const [range, setRange] = useState({ key: '4w', from: shiftDays(-28), to: todayISO() });
  const [gymId, setGymId] = useState('');
  const [color, setColor] = useState('');
  const [level, setLevel] = useState('');
  const [style, setStyle] = useState('');
  const [page, setPage] = useState(0);

  const [gyms, setGyms] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    gymsApi.list({ limit: 50 }).then((r) => setGyms(r.data?.gyms || [])).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    climbLogsApi.listProblems({
      from: range.from, to: range.to,
      gym_id: gymId || undefined,
      color: color || undefined,
      level: level || undefined,
      style: style || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }).then((r) => {
      if (cancelled) return;
      setItems(r.data?.items || []);
      setTotal(r.data?.total || 0);
    }).catch(() => { if (!cancelled) { setItems([]); setTotal(0); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range.from, range.to, gymId, color, level, style, page]);

  function selectRange(key, days) { setRange({ key, from: shiftDays(days), to: todayISO() }); setPage(0); }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <>
      <TopBar title="문제" />

      {/* 필터 */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 암장 검색 (상단 단독 행) */}
        <GymSearchCombobox
          value={gymId}
          onChange={(id) => { setGymId(id || ''); setPage(0); }}
          gyms={gyms}
          placeholder="암장 검색 (전체)"
        />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGE_PRESETS.map(([k, l, d]) => (
            <Chip key={k} active={range.key === k} onClick={() => selectRange(k, d)}>{l}</Chip>
          ))}
          <Chip active={range.key === 'custom'} onClick={() => setRange({ ...range, key: 'custom' })}>직접</Chip>
        </div>
        {range.key === 'custom' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="date" value={range.from} onChange={(e) => { setRange({ ...range, from: e.target.value }); setPage(0); }}
              style={dateInputStyle} />
            <span style={{ alignSelf: 'center', color: 'var(--ink-3)' }}>~</span>
            <input type="date" value={range.to} onChange={(e) => { setRange({ ...range, to: e.target.value }); setPage(0); }}
              style={dateInputStyle} />
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <select value={style} onChange={(e) => { setStyle(e.target.value); setPage(0); }} style={selectStyle}>
            <option value="">벽 형태</option>
            <optgroup label="단일">
              {['slab','vertical','overhang','cave'].map((k) => <option key={k} value={k}>{styleLabel(k)}</option>)}
            </optgroup>
            <optgroup label="복합">
              {['slab_vertical','vertical_overhang','slab_overhang','overhang_cave'].map((k) => <option key={k} value={k}>{styleLabel(k)}</option>)}
            </optgroup>
            <option value="other">{styleLabel('other')}</option>
          </select>
          <select value={color} onChange={(e) => { setColor(e.target.value); setPage(0); }} style={selectStyle}>
            <option value="">난이도</option>
            {COLOR_KEYS.map((k) => <option key={k} value={k}>{colorMeta(k).kr} {colorMeta(k).label}</option>)}
          </select>
          <select value={level} onChange={(e) => { setLevel(e.target.value); setPage(0); }} style={selectStyle}>
            <option value="">V등급</option>
            {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding: '0 16px 4px', fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
        총 {total}건
      </div>

      {/* 항목 리스트 */}
      <div style={{ padding: '6px 16px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!loading && items.length === 0 && (
          <div style={{
            padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13,
            border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)',
          }}>
            조건에 맞는 기록이 없습니다.
          </div>
        )}
        {items.map((p) => {
          const cleared = p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0);
          const failed = p.failed_count != null ? Number(p.failed_count) : 0;
          const thumb = p.videos?.[0]?.ar_route?.thumbnail_url;
          return (
            <div key={p.id} onClick={() => nav(`/logs/${p.log_id}`)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') nav(`/logs/${p.log_id}`); }}
              style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)', padding: '10px 12px',
                display: 'flex', gap: 10, cursor: 'pointer', alignItems: 'center',
              }}>
              {thumb ? (
                <div style={{
                  width: 56, height: 80, flexShrink: 0,
                  borderRadius: 'var(--r-sm)', overflow: 'hidden',
                  background: `#000 center/cover no-repeat url("${thumb}")`,
                }} />
              ) : (
                <div style={{
                  width: 56, height: 80, flexShrink: 0,
                  borderRadius: 'var(--r-sm)', overflow: 'hidden',
                  background: `linear-gradient(155deg, ${colorMeta(p.color).dot}33 0%, ${colorMeta(p.color).dot}88 100%)`,
                  display: 'grid', placeItems: 'center',
                  color: 'rgba(255,255,255,.6)', fontSize: 18,
                }}>{I.flame(20)}</div>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <ColorBadge color={p.color} level={p.level} size="sm" />
                  {p.style && (
                    <span style={{
                      fontSize: 10.5, fontWeight: 600,
                      padding: '2px 7px', borderRadius: 'var(--r-pill)',
                      background: 'var(--surface-2)', color: 'var(--ink-3)',
                      border: '1px solid var(--line-2)',
                    }}>{styleLabel(p.style)}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span>{fmtDate(p.visited_at)}</span>
                  <span style={{ color: 'var(--ink-3)' }}>·</span>
                  <span>📍 {p.gym_name || '-'}</span>
                </div>
                <div style={{ fontSize: 11, display: 'flex', gap: 8, alignItems: 'center' }}>
                  {cleared > 0 && (
                    <span className="tabnum" style={{ color: 'var(--success)', fontWeight: 700 }}>
                      ✓ 완등 {cleared}
                    </span>
                  )}
                  {failed > 0 && (
                    <span className="tabnum" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                      ✗ 실패 {failed}
                    </span>
                  )}
                  {p.videos?.length > 0 && (
                    <span style={{ color: 'var(--ink-3)' }}>📹 {p.videos.length}</span>
                  )}
                  {p.photo_count > 0 && (
                    <span style={{ color: 'var(--ink-3)' }}>🖼 {p.photo_count}</span>
                  )}
                </div>
              </div>
              <span style={{ color: 'var(--ink-4)' }}>{I.chev(14)}</span>
            </div>
          );
        })}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '6px 12px', fontSize: 12, color: page === 0 ? 'var(--ink-4)' : 'var(--ink-2)' }}>
              이전
            </button>
            <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{page + 1} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ padding: '6px 12px', fontSize: 12, color: page >= totalPages - 1 ? 'var(--ink-4)' : 'var(--ink-2)' }}>
              다음
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const dateInputStyle = {
  flex: 1, padding: '8px 10px', fontSize: 12.5,
  borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
  background: 'var(--surface)', color: 'var(--ink-1)',
};
const selectStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
  background: 'var(--surface)', color: 'var(--ink-1)',
};

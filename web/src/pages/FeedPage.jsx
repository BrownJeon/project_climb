import { useEffect, useMemo, useState } from 'react';
import TopBar from '../components/TopBar';
import RouteCard from '../components/RouteCard';
import { Chip } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { routesApi } from '../api/routes';

const FILTERS = [
  ['all',    '전체'],
  ['v3',     'V3 이하'],
  ['v4',     'V4-V5'],
  ['v6',     'V6+'],
  ['recent', '최근 1주'],
];

function filterRoutes(routes, key) {
  if (key === 'all') return routes;
  if (key === 'recent') {
    const week = Date.now() - 7 * 86400 * 1000;
    return routes.filter((r) => new Date(r.created_at || r.date).getTime() >= week);
  }
  const lvNum = (lv) => parseInt(String(lv || 'V0').replace(/\D/g, ''), 10) || 0;
  return routes.filter((r) => {
    const n = lvNum(r.problem?.level || r.level);
    if (key === 'v3') return n <= 3;
    if (key === 'v4') return n >= 4 && n <= 5;
    if (key === 'v6') return n >= 6;
    return true;
  });
}

export default function FeedPage() {
  const [tab, setTab] = useState('feed');
  const [filter, setFilter] = useState('all');
  const [allRoutes, setAllRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    routesApi.list({ sort: 'latest', page: 1, limit: 30, mine: tab === 'mine' ? 'true' : undefined })
      .then((r) => setAllRoutes(r.data?.routes || []))
      .finally(() => setLoading(false));
  }, [tab]);

  const routes = useMemo(() => {
    const flat = allRoutes.map((r) => ({
      ...r,
      color: r.problem?.color || r.color,
      level: r.problem?.level || r.level,
      date: r.created_at || r.date,
      cleared: r.cleared ?? null,
      attempts: r.attempts ?? null,
      likes: r.like_count ?? r.likes ?? 0,
      bookmarks: r.bookmarks ?? 0,
    }));
    return filterRoutes(flat, filter);
  }, [allRoutes, filter]);

  const stats = useMemo(() => {
    // 이번 주 통계 — mock 형태로 routes에서 derive
    const week = Date.now() - 7 * 86400 * 1000;
    const recent = allRoutes.filter((r) => new Date(r.created_at || r.date).getTime() >= week);
    const cleared = recent.filter((r) => r.cleared).length;
    const visits = new Set(recent.map((r) => (r.created_at || r.date).slice(0, 10))).size;
    return { cleared, visits };
  }, [allRoutes]);

  const dayCells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - 6); // 7일 (월~일 가장 가까운 형태)
    const set = new Set(allRoutes.map((r) => (r.created_at || r.date || '').slice(0, 10)));
    const labels = ['일', '월', '화', '수', '목', '금', '토'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { label: labels[d.getDay()], active: set.has(iso) };
    });
  }, [allRoutes]);

  return (
    <>
      <TopBar
        brand
        right={<button style={{ padding: 8, color: 'var(--ink-2)' }} aria-label="알림">{I.bell(20)}</button>}
      />

      {/* Hero stats */}
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, oklch(58% 0.18 28) 100%)',
          color: '#fff', borderRadius: 'var(--r-md)', padding: '16px 18px',
        }}>
          <div style={{ fontSize: 11, opacity: .85, fontWeight: 600, letterSpacing: .4 }}>이번 주</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span className="tabnum" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{stats.cleared}</span>
            <span style={{ fontSize: 13, opacity: .9 }}>완등</span>
            <span style={{ margin: '0 6px', opacity: .4 }}>·</span>
            <span className="tabnum" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{stats.visits}</span>
            <span style={{ fontSize: 13, opacity: .9 }}>방문</span>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {dayCells.map((d, i) => (
              <div key={i} style={{ flex: 1 }}>
                <div style={{
                  height: 36, borderRadius: 6,
                  background: d.active ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.18)',
                }} />
                <div style={{ fontSize: 10, textAlign: 'center', marginTop: 4, opacity: .8 }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 18, padding: '10px 16px 4px', borderBottom: '1px solid var(--line)' }}>
        {[['feed', '피드'], ['mine', '내 영상']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            paddingBottom: 10, borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent',
            fontSize: 14, fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 16px 8px', overflowX: 'auto' }}>
        {FILTERS.map(([k, l]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</Chip>
        ))}
      </div>

      {/* Feed grid */}
      {loading ? (
        <div style={{ padding: 32, color: 'var(--ink-3)', textAlign: 'center' }}>불러오는 중...</div>
      ) : routes.length === 0 ? (
        <div style={{ padding: '40px 16px', color: 'var(--ink-3)', textAlign: 'center', fontSize: 13 }}>
          아직 기록한 영상이 없어요.<br />
          <span style={{ fontSize: 12, opacity: .7 }}>+ 버튼으로 첫 영상을 추가하세요.</span>
        </div>
      ) : (
        <div style={{ padding: '8px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {routes.map((r) => <RouteCard key={r.id} route={r} />)}
        </div>
      )}
    </>
  );
}

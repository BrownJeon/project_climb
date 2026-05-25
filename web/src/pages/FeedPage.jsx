import { useEffect, useMemo, useState } from 'react';
import TopBar from '../components/TopBar';
import RouteCard from '../components/RouteCard';
import { Chip } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { routesApi } from '../api/routes';
import { climbLogsApi } from '../api/climbLogs';
import { colorMeta } from '../utils/colors';
import { routineApi } from '../api/routine';
import { useNavigate } from 'react-router-dom';

// 이번 주 월요일~일요일 (KST 기준)
function getWeekRange(now = new Date()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=일, 1=월
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + monOffset);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const iso = (x) => {
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const dd = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { from: iso(mon), to: iso(sun), monday: mon };
}

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

function relativeDate(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff < 7) return `${diff}일 전`;
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`;
  if (diff < 365) return `${Math.floor(diff / 30)}개월 전`;
  return `${Math.floor(diff / 365)}년 전`;
}

export default function FeedPage() {
  const [tab, setTab] = useState('feed');
  const [filter, setFilter] = useState('all');
  const [allRoutes, setAllRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({ visits: 0, dates: [], total_cleared: 0, cleared_breakdown: [], training_by_category: {} });
  const [todayRoutines, setTodayRoutines] = useState([]);
  const [recentGyms, setRecentGyms] = useState([]);
  const week = useMemo(() => getWeekRange(), []);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    routesApi.list({ sort: 'latest', page: 1, limit: 30, mine: tab === 'mine' ? 'true' : undefined })
      .then((r) => setAllRoutes(r.data?.routes || []))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    climbLogsApi.summary(week.from, week.to)
      .then((r) => setSummary(r.data || { visits: 0, dates: [], total_cleared: 0, cleared_breakdown: [], training_by_category: {} }))
      .catch(() => {});
    routineApi.list().then((r) => {
      const dow = new Date().getDay();
      setTodayRoutines(r.data?.routines?.[dow]?.items || []);
    }).catch(() => {});
    climbLogsApi.visitedGymsWithDetail(8)
      .then((r) => setRecentGyms(r.data?.gyms || []))
      .catch(() => {});
  }, [week.from, week.to]);

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
      saved: r.isBookmarked ?? false,
    }));
    return filterRoutes(flat, filter);
  }, [allRoutes, filter]);



  const dayCells = useMemo(() => {
    const set = new Set(summary.dates || []);
    const labels = ['월', '화', '수', '목', '금', '토', '일'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(week.monday); d.setDate(week.monday.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${dd}`;
      return { label: labels[i], active: set.has(iso) };
    });
  }, [summary.dates, week.monday]);

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
          <div style={{ fontSize: 11, opacity: .85, fontWeight: 600, letterSpacing: .4 }}>
            이번 주 ({week.from.slice(5)} ~ {week.to.slice(5)})
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
            <span className="tabnum" style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1 }}>{summary.visits}</span>
            <span style={{ fontSize: 13, opacity: .9 }}>방문</span>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, fontSize: 12, opacity: .92, flexWrap: 'wrap' }}>
            <span>볼더링 <span className="tabnum" style={{ fontWeight: 700 }}>{summary.training_by_category?.bouldering ?? 0}</span></span>
            <span style={{ opacity: .5 }}>/</span>
            <span>지구력 <span className="tabnum" style={{ fontWeight: 700 }}>{summary.training_by_category?.endurance ?? 0}</span></span>
            <span style={{ opacity: .5 }}>/</span>
            <span>컨디셔닝 <span className="tabnum" style={{ fontWeight: 700 }}>{summary.training_by_category?.conditioning ?? 0}</span></span>
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

      {/* 최근 방문 암장 */}
      {recentGyms.length > 0 && (
        <div style={{ padding: '10px 0 4px' }}>
          <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)' }}>최근 방문 암장</span>
            <button
              onClick={() => navigate('/gyms')}
              style={{ fontSize: 11, color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              전체 보기 →
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {recentGyms.map((gym) => {
              const problems = gym.last_log_problems || [];
              const cleared = problems.filter((p) => p.cleared > 0);
              const totalCleared = problems.reduce((s, p) => s + p.cleared, 0);
              const totalAttempt = problems.reduce((s, p) => s + p.total, 0);
              return (
                <button
                  key={gym.id}
                  onClick={() => navigate(`/gyms/${gym.id}`)}
                  style={{
                    flexShrink: 0, width: 160,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)', padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--ink-1)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                  }}>
                    {gym.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                    {relativeDate(gym.last_visited_at)}
                    <span className="tabnum" style={{ marginLeft: 6 }}>· {gym.visit_count}회</span>
                  </span>

                  {/* 문제 기록 요약 */}
                  {totalAttempt > 0 ? (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {cleared.slice(0, 4).map((p) => {
                          const m = colorMeta(p.color);
                          return (
                            <span key={p.color} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 11, padding: '2px 7px', borderRadius: 'var(--r-pill)',
                              background: 'var(--surface-2)', border: '1px solid var(--line-2)',
                              color: 'var(--ink-2)',
                            }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.dot, flexShrink: 0 }} />
                              <span className="tabnum">{p.cleared}</span>
                            </span>
                          );
                        })}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }} className="tabnum">
                        완등 {totalCleared} / 시도 {totalAttempt}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>문제 기록 없음</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 오늘의 루틴 */}
      {todayRoutines.length > 0 && (
        <div style={{ padding: '0 16px 8px' }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)', overflow: 'hidden',
          }}>
            <button onClick={() => navigate('/routine')} style={{
              width: '100%', padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface-2)', borderBottom: '1px solid var(--line)',
              cursor: 'pointer',
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>오늘의 루틴</span>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>전체 보기 →</span>
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {todayRoutines.map((item, idx) => {
                const CATEGORIES = [['bouldering','볼더링'],['endurance','지구력'],['conditioning','컨디셔닝'],['general','기타'],['rest','휴식']];
                const catLabel = CATEGORIES.find(([k]) => k === item.category)?.[1] || item.category;
                return (
                  <div key={item.id} style={{
                    padding: '9px 14px', fontSize: 12.5, color: 'var(--ink-2)', fontWeight: 600,
                    borderBottom: idx < todayRoutines.length - 1 ? '1px solid var(--line)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: item.category === 'bouldering' ? 'var(--primary)'
                        : item.category === 'endurance' ? 'var(--success)'
                        : item.category === 'conditioning' ? 'var(--warn)'
                        : 'var(--ink-4)',
                    }} />
                    <span>{catLabel}</span>
                    {item.target_count && <span className="tabnum" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, marginLeft: 2 }}>목표 {item.target_count}회</span>}
                    {item.target_minutes && <span className="tabnum" style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, marginLeft: 2 }}>목표 {item.target_minutes}분</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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

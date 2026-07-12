import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import RouteCard from '../components/RouteCard';
import { Btn, Chip } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import GymAddModal from '../components/modals/GymAddModal';
import ClearedSummary from '../components/ClearedSummary';
import { gymsApi } from '../api/gyms';
import { routesApi } from '../api/routes';
import { climbLogsApi } from '../api/climbLogs';
import { gymSectorsApi } from '../api/gymSectors';

const DAY_LABELS_SHORT = ['일', '월', '화', '수', '목', '금', '토'];
const CAT_LABEL = { endurance: '지구력', conditioning: '컨디셔닝', general: '기타' };

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

function formatLogDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS_SHORT[d.getDay()]})`;
}

function formatSchedule(sched) {
  if (sched.frequency === 'weekly') return `매주 ${DAY_LABELS_SHORT[sched.day_of_week]}요일`;
  if (sched.frequency === 'biweekly') return `격주 ${DAY_LABELS_SHORT[sched.day_of_week]}요일`;
  if (sched.frequency === 'monthly') return `매월 ${sched.day_of_month}일`;
  if (sched.frequency === 'once') return `${sched.start_date || ''} (1회)`;
  return sched.frequency;
}

/* ───────── 달력 범위 선택기 ───────── */
function DateRangePicker({ from, to, onChange }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth() + 1);
  const [picking, setPicking] = useState('from'); // 'from' | 'to'
  const [tempFrom, setTempFrom] = useState(from || null);
  const [tempTo, setTempTo] = useState(to || null);

  const grid = useMemo(() => {
    const first = new Date(calYear, calMonth - 1, 1);
    const last = new Date(calYear, calMonth, 0).getDate();
    const cells = [];
    for (let i = 0; i < first.getDay(); i++) cells.push(null);
    for (let d = 1; d <= last; d++) cells.push(d);
    return cells;
  }, [calYear, calMonth]);

  function shiftCal(dir) {
    let m = calMonth + dir, y = calYear;
    if (m === 0) { m = 12; y--; }
    if (m === 13) { m = 1; y++; }
    setCalYear(y); setCalMonth(m);
  }

  function handleDay(d) {
    const date = ymd(calYear, calMonth, d);
    if (picking === 'from') {
      setTempFrom(date);
      setTempTo(null);
      setPicking('to');
    } else {
      if (date < tempFrom) {
        setTempFrom(date);
        setTempTo(tempFrom);
      } else {
        setTempTo(date);
      }
      setPicking('from');
    }
  }

  function isFrom(d) { return tempFrom === ymd(calYear, calMonth, d); }
  function isTo(d) { return tempTo === ymd(calYear, calMonth, d); }
  function isInRange(d) {
    if (!tempFrom || !tempTo) return false;
    const date = ymd(calYear, calMonth, d);
    return date > tempFrom && date < tempTo;
  }
  function isToday(d) {
    return d === today.getDate() && calMonth === today.getMonth() + 1 && calYear === today.getFullYear();
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
      {/* 안내 문구 */}
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 8, textAlign: 'center' }}>
        {picking === 'from' ? '시작 날짜를 선택하세요' : `${tempFrom} 부터 종료 날짜를 선택하세요`}
      </div>

      {/* 월 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <button onClick={() => shiftCal(-1)} style={{ padding: 4, color: 'var(--ink-3)' }}>{I.chev(14, 'left')}</button>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{calYear}년 {calMonth}월</span>
        <button onClick={() => shiftCal(1)} style={{ padding: 4, color: 'var(--ink-3)' }}>{I.chev(14)}</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DAY_LABELS_SHORT.map((l, i) => (
          <div key={l} style={{
            textAlign: 'center', fontSize: 10, fontWeight: 600,
            color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--c-blue)' : 'var(--ink-4)',
          }}>{l}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;
          const sel = isFrom(d) || isTo(d);
          const inRange = isInRange(d);
          const tod = isToday(d);
          return (
            <button
              key={i}
              onClick={() => handleDay(d)}
              style={{
                aspectRatio: '1', fontSize: 12, fontWeight: sel ? 700 : tod ? 600 : 400,
                borderRadius: sel ? 'var(--r-sm)' : inRange ? 0 : 'var(--r-sm)',
                background: sel ? 'var(--primary)' : inRange ? 'var(--primary-soft)' : tod ? 'var(--surface-2)' : 'transparent',
                color: sel ? '#fff' : 'var(--ink-1)',
              }}
            >
              {d}
            </button>
          );
        })}
      </div>

      {/* 선택된 범위 표시 + 적용 버튼 */}
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>
          {tempFrom && tempTo
            ? `${tempFrom} ~ ${tempTo}`
            : tempFrom
            ? `${tempFrom} ~`
            : '날짜를 선택하세요'}
        </span>
        {tempFrom && tempTo && (
          <button
            onClick={() => onChange(tempFrom, tempTo)}
            style={{
              fontSize: 12, fontWeight: 700, padding: '5px 14px',
              borderRadius: 'var(--r-pill)', background: 'var(--primary)', color: '#fff',
              cursor: 'pointer',
            }}
          >검색</button>
        )}
        {(tempFrom || tempTo) && (
          <button
            onClick={() => { setTempFrom(null); setTempTo(null); setPicking('from'); }}
            style={{ fontSize: 11, color: 'var(--ink-4)', padding: '4px 8px' }}
          >초기화</button>
        )}
      </div>
    </div>
  );
}

/* ───────── 메인 페이지 ───────── */
export default function GymDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [gym, setGym] = useState(null);
  const [tab, setTab] = useState('logs');
  const [editOpen, setEditOpen] = useState(false);

  // 운동기록 탭
  const [logsData, setLogsData] = useState({ logs: [], total: 0, period: null });
  const [logsLoading, setLogsLoading] = useState(false);
  const [view, setView] = useState('all');       // 'all' | 'custom'
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);
  const [appliedFrom, setAppliedFrom] = useState(null);
  const [appliedTo, setAppliedTo] = useState(null);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // 영상 탭
  const [routes, setRoutes] = useState([]);

  // 섹터 탭 상태
  const [sectors, setSectors] = useState([]);
  const [newSectorName, setNewSectorName] = useState('');
  const [editingSectorId, setEditingSectorId] = useState(null);
  const [editingSectorName, setEditingSectorName] = useState('');
  const [resetYear, setResetYear] = useState(new Date().getFullYear());
  const [resetMonth, setResetMonth] = useState(new Date().getMonth() + 1);
  const [resets, setResets] = useState([]);
  const [selectedResetDate, setSelectedResetDate] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [newSchedFrequency, setNewSchedFrequency] = useState('weekly');
  const [newSchedDayOfWeek, setNewSchedDayOfWeek] = useState(1);       // 1=월요일
  const [newSchedDayOfMonth, setNewSchedDayOfMonth] = useState(1);
  const [newSchedStartDate, setNewSchedStartDate] = useState('');
  const [newSchedSectorId, setNewSchedSectorId] = useState('');
  const [newSchedNote, setNewSchedNote] = useState('');

  // 통계 탭 상태
  const [statsPeriod, setStatsPeriod] = useState('month1'); // 'all' | 'month1' | 'month3' | 'custom'
  const [statsFrom, setStatsFrom] = useState(null);
  const [statsTo, setStatsTo] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsSectorId, setStatsSectorId] = useState('');

  const backBtn = (
    <button onClick={() => nav(-1)} aria-label="뒤로"
      style={{ width: 36, height: 36, borderRadius: 'var(--r-pill)', display: 'grid', placeItems: 'center', color: 'var(--ink-2)', background: 'var(--surface-2)' }}>
      {I.chev(16, 'left')}
    </button>
  );

  async function handleDeleteGym() {
    if (!confirm(`'${gym.name}' 암장을 삭제할까요?`)) return;
    try { await gymsApi.remove(id); nav('/gyms'); }
    catch (e) { alert(e?.response?.data?.message || '삭제 실패'); }
  }

  useEffect(() => {
    gymsApi.get(id).then((r) => setGym(r.data)).catch(() => setGym(null));
  }, [id]);

  useEffect(() => {
    if (tab !== 'logs') return;
    if (view === 'custom' && !appliedFrom) return; // 범위 미지정 시 대기
    setLogsLoading(true);
    const params = view === 'custom'
      ? { from: appliedFrom, to: appliedTo, page, limit: LIMIT }
      : { view: 'all', page, limit: LIMIT };
    climbLogsApi.byGym(id, params)
      .then((r) => setLogsData({ logs: r.data?.logs || [], total: r.data?.total || 0, period: r.data?.period || null }))
      .catch(() => setLogsData({ logs: [], total: 0, period: null }))
      .finally(() => setLogsLoading(false));
  }, [id, tab, view, appliedFrom, appliedTo, page]);

  useEffect(() => {
    if (tab !== 'routes') return;
    routesApi.list({ gym_id: id, sort: 'latest', limit: 20 })
      .then((r) => setRoutes(r.data?.routes || []))
      .catch(() => {});
  }, [id, tab]);

  useEffect(() => {
    gymSectorsApi.list(id).then((r) => setSectors(r.data || [])).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (tab !== 'sectors') return;
    gymSectorsApi.listResets(id, { year: resetYear, month: resetMonth })
      .then((r) => setResets(r.data || []))
      .catch(() => {});
  }, [id, tab, resetYear, resetMonth]);

  useEffect(() => {
    if (tab !== 'sectors') return;
    gymSectorsApi.listSchedules(id).then((r) => setSchedules(r.data || [])).catch(() => {});
  }, [id, tab]);

  useEffect(() => {
    if (tab !== 'stats') return;
    setStatsLoading(true);
    const today = new Date();
    let from = null, to = null;
    if (statsPeriod === 'month1') {
      const d = new Date(today); d.setMonth(d.getMonth() - 1);
      from = d.toISOString().slice(0, 10);
      to = today.toISOString().slice(0, 10);
    } else if (statsPeriod === 'month3') {
      const d = new Date(today); d.setMonth(d.getMonth() - 3);
      from = d.toISOString().slice(0, 10);
      to = today.toISOString().slice(0, 10);
    } else if (statsPeriod === 'custom') {
      from = statsFrom; to = statsTo;
      if (!from || !to) { setStatsLoading(false); return; }
    }
    const params = { gym_id: id, ...(from ? { from, to } : {}), ...(statsSectorId ? { sector_id: statsSectorId } : {}) };
    climbLogsApi.summary(params)
      .then((r) => setStatsData(r.data))
      .catch(() => setStatsData(null))
      .finally(() => setStatsLoading(false));
  }, [id, tab, statsPeriod, statsFrom, statsTo, statsSectorId]);

  function handleViewChange(v) {
    setView(v);
    setPage(1);
    if (v !== 'custom') { setAppliedFrom(null); setAppliedTo(null); }
  }

  function applyCustomRange(f, t) {
    setAppliedFrom(f);
    setAppliedTo(t);
    setPage(1);
  }

  async function handleAddSector() {
    if (!newSectorName.trim()) return;
    try {
      await gymSectorsApi.create(id, { name: newSectorName.trim() });
      setNewSectorName('');
      gymSectorsApi.list(id).then((r) => setSectors(r.data || [])).catch(() => {});
    } catch (e) { alert('추가 실패'); }
  }

  async function handleUpdateSector(sectorId) {
    if (!editingSectorName.trim()) return;
    try {
      await gymSectorsApi.update(id, sectorId, { name: editingSectorName.trim() });
      setEditingSectorId(null);
      gymSectorsApi.list(id).then((r) => setSectors(r.data || [])).catch(() => {});
    } catch (e) { alert('수정 실패'); }
  }

  async function handleDeleteSector(sectorId) {
    if (!confirm('섹터를 삭제할까요?')) return;
    try {
      await gymSectorsApi.remove(id, sectorId);
      gymSectorsApi.list(id).then((r) => setSectors(r.data || [])).catch(() => {});
    } catch (e) { alert('삭제 실패'); }
  }

  async function handleAddSchedule() {
    if (!newSchedFrequency) return;
    if ((newSchedFrequency === 'weekly' || newSchedFrequency === 'biweekly') && newSchedDayOfWeek === '') return;
    if (newSchedFrequency === 'biweekly' && !newSchedStartDate) {
      alert('격주 주기는 시작 날짜(앵커)가 필요합니다.');
      return;
    }
    if (newSchedFrequency === 'monthly' && !newSchedDayOfMonth) return;
    if (newSchedFrequency === 'once' && !newSchedStartDate) {
      alert('날짜를 선택해주세요.');
      return;
    }
    try {
      await gymSectorsApi.createSchedule(id, {
        frequency: newSchedFrequency,
        day_of_week: (newSchedFrequency === 'weekly' || newSchedFrequency === 'biweekly') ? Number(newSchedDayOfWeek) : undefined,
        day_of_month: newSchedFrequency === 'monthly' ? Number(newSchedDayOfMonth) : undefined,
        start_date: newSchedStartDate || undefined,
        sector_id: newSchedSectorId ? Number(newSchedSectorId) : undefined,
        note: newSchedNote || undefined,
      });
      setAddingSchedule(false);
      setNewSchedFrequency('weekly'); setNewSchedDayOfWeek(1); setNewSchedDayOfMonth(1);
      setNewSchedStartDate(''); setNewSchedSectorId(''); setNewSchedNote('');
      gymSectorsApi.listSchedules(id).then((r) => setSchedules(r.data || [])).catch(() => {});
      // 달력도 갱신
      gymSectorsApi.listResets(id, { year: resetYear, month: resetMonth })
        .then((r) => setResets(r.data || [])).catch(() => {});
    } catch (e) { alert(e?.response?.data?.message || '추가 실패'); }
  }

  async function handleDeleteSchedule(scheduleId) {
    if (!confirm('교체 주기를 삭제할까요?')) return;
    try {
      await gymSectorsApi.deleteSchedule(id, scheduleId);
      gymSectorsApi.listSchedules(id).then((r) => setSchedules(r.data || [])).catch(() => {});
      gymSectorsApi.listResets(id, { year: resetYear, month: resetMonth })
        .then((r) => setResets(r.data || [])).catch(() => {});
    } catch (e) { alert('삭제 실패'); }
  }

  if (gym === null) {
    return (<><TopBar right={backBtn} /><div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)' }}>암장을 찾을 수 없습니다</div></>);
  }

  const totalPages = Math.ceil(logsData.total / LIMIT);

  return (
    <>
      <TopBar right={backBtn} />

      {/* 헤더 */}
      <div style={{ padding: '16px', background: 'var(--surface)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -.4, flex: 1, minWidth: 0 }}>{gym.name}</div>
          <button onClick={() => setEditOpen(true)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', padding: '5px 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)' }}>수정</button>
          <button onClick={handleDeleteGym} style={{ fontSize: 12, fontWeight: 600, color: 'var(--danger)', padding: '5px 10px', borderRadius: 'var(--r-pill)', border: '1px solid var(--line-2)', background: 'var(--surface)' }}>삭제</button>
        </div>
        {gym.address && <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{gym.address}</div>}
        {gym.hours && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{I.clock(13)} {gym.hours}</div>}
        {gym.price_info && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>💴 {gym.price_info}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="ghost" size="sm" icon={I.pin(13)}>지도 보기</Btn>
          <Btn variant="soft" size="sm" icon={I.star(13, true)}>주 암장</Btn>
        </div>
      </div>

      {/* 상단 탭 */}
      <div style={{ display: 'flex', gap: 18, padding: '0 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)', position: 'sticky', top: 54, zIndex: 4 }}>
        {[['logs', '운동기록'], ['routes', `영상 (${routes.length})`], ['sectors', '섹터 관리'], ['stats', '통계']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: '12px 0', borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent', fontSize: 13, fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)' }}>{l}</button>
        ))}
      </div>

      {/* 운동기록 탭 */}
      {tab === 'logs' && (
        <div style={{ padding: '12px 16px 24px' }}>

          {/* 기간 필터 칩 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {[['all', '전체'], ['custom', '기간설정']].map(([v, l]) => (
              <Chip key={v} active={view === v} onClick={() => handleViewChange(v)}>{l}</Chip>
            ))}
          </div>

          {/* 달력 범위 선택기 */}
          {view === 'custom' && (
            <div style={{ marginBottom: 12 }}>
              <DateRangePicker
                from={customFrom}
                to={customTo}
                onChange={(f, t) => {
                  setCustomFrom(f);
                  setCustomTo(t);
                  applyCustomRange(f, t);
                }}
              />
              {appliedFrom && appliedTo && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>
                  검색 중: <b style={{ color: 'var(--ink-1)' }}>{appliedFrom} ~ {appliedTo}</b>
                </div>
              )}
            </div>
          )}

          {/* 기록 목록 */}
          {view === 'custom' && !appliedFrom ? (
            <div style={{ background: 'var(--surface)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)', padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
              날짜 범위를 선택하고 검색하세요
            </div>
          ) : logsLoading ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>로딩 중...</div>
          ) : logsData.logs.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)', padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>기록이 없습니다</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {logsData.logs.map((log) => {
                const totalCleared = (log.problems || []).reduce((s, p) =>
                  s + (p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0)), 0);
                const nonBouldering = (log.training_sessions || []).filter((s) => s.category !== 'bouldering');
                return (
                  <div key={log.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{formatLogDate(log.visited_at)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {totalCleared > 0 && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>{totalCleared}완등</span>
                        )}
                        {log.duration_minutes != null && (
                          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>⏱ {log.duration_minutes}분</span>
                        )}
                      </div>
                    </div>
                    {(log.gym_pass || log.used_day_pass) && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {I.ticket(11)}
                        {log.gym_pass
                          ? `${log.gym_pass.label || (log.gym_pass.pass_type === 'period' ? '정기권' : '횟수권')}${log.gym_pass.pass_type === 'count' ? ` (잔여 ${log.gym_pass.remaining_count}회)` : ''}`
                          : '일일이용권'}
                      </div>
                    )}
                    {log.problems?.length > 0 && <ClearedSummary problems={log.problems} />}
                    {nonBouldering.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {nonBouldering.map((s) => (
                          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{CAT_LABEL[s.category] || s.category}</span>
                            {s.items?.[0] && <span style={{ color: 'var(--ink-2)' }}>{s.items[0].exercise_name}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {log.memo && (
                      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)' }}>
                        <span style={{ color: 'var(--ink-4)', marginRight: 4 }}>메모</span>{log.memo}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이징 */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 16, flexWrap: 'wrap' }}>
              {(() => {
                const btnStyle = (active) => ({
                  minWidth: 32, height: 32, borderRadius: 'var(--r-sm)',
                  fontSize: 13, fontWeight: active ? 700 : 400,
                  background: active ? 'var(--primary)' : 'var(--surface-2)',
                  color: active ? '#fff' : 'var(--ink-2)',
                  border: active ? 'none' : '1px solid var(--line)',
                  cursor: active ? 'default' : 'pointer',
                });
                const cur = page;
                const pages = [];
                if (totalPages <= 5) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  const set = new Set([1, totalPages, cur, cur - 1, cur + 1]
                    .filter((n) => n >= 1 && n <= totalPages));
                  [...set].sort((a, b) => a - b).forEach((n, i, arr) => {
                    if (i > 0 && n - arr[i - 1] > 1) pages.push('…');
                    pages.push(n);
                  });
                }
                return pages.map((p, i) =>
                  p === '…'
                    ? <span key={`e${i}`} style={{ fontSize: 12, color: 'var(--ink-4)', padding: '0 2px' }}>…</span>
                    : <button key={p} className="tabnum" onClick={() => setPage(p)} style={btnStyle(p === cur)}>{p}</button>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 영상 탭 */}
      {tab === 'routes' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px 6px', fontSize: 12 }}>
            <span style={{ color: 'var(--ink-3)' }}>정렬: <b style={{ color: 'var(--ink-1)' }}>최신순</b></span>
          </div>
          {routes.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>등록된 영상이 없습니다.</div>
          ) : (
            <div style={{ padding: '4px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {routes.map((r) => (
                <RouteCard key={r.id} route={{
                  id: r.id, color: r.problem?.color, level: r.problem?.level,
                  thumbnail_url: r.thumbnail_url, date: r.created_at,
                  cleared: r.cleared, attempts: r.attempts,
                  likes: r.like_count ?? 0, bookmarks: r.bookmarks ?? 0, saved: r.isBookmarked ?? false,
                }} />
              ))}
            </div>
          )}
        </>
      )}

      {/* 섹터 관리 탭 */}
      {tab === 'sectors' && (
        <div style={{ padding: '12px 16px 24px' }}>
          {/* ── 섹터 목록 ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>섹터 목록</div>
            {sectors.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--ink-4)', padding: '12px 0' }}>등록된 섹터가 없습니다.</div>
            )}
            {sectors.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                {editingSectorId === s.id ? (
                  <>
                    <input
                      value={editingSectorName}
                      onChange={(e) => setEditingSectorName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateSector(s.id); if (e.key === 'Escape') setEditingSectorId(null); }}
                      style={{ flex: 1, padding: '5px 8px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--primary)' }}
                      autoFocus
                    />
                    <button onClick={() => handleUpdateSector(s.id)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', padding: '4px 10px' }}>저장</button>
                    <button onClick={() => setEditingSectorId(null)} style={{ fontSize: 12, color: 'var(--ink-4)', padding: '4px 8px' }}>취소</button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{s.name}</span>
                    <button onClick={() => { setEditingSectorId(s.id); setEditingSectorName(s.name); }}
                      style={{ fontSize: 12, color: 'var(--ink-3)', padding: '4px 8px' }}>수정</button>
                    <button onClick={() => handleDeleteSector(s.id)}
                      style={{ fontSize: 12, color: 'var(--danger)', padding: '4px 8px' }}>삭제</button>
                  </>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                value={newSectorName}
                onChange={(e) => setNewSectorName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSector(); }}
                placeholder="새 섹터 이름 (예: A벽, 슬랩존)"
                style={{ flex: 1, padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}
              />
              <button onClick={handleAddSector} style={{ fontSize: 13, fontWeight: 700, padding: '8px 14px', borderRadius: 'var(--r-sm)', background: 'var(--primary)', color: '#fff' }}>추가</button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', marginBottom: 16 }} />

          {/* ── 교체 주기 ── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>문제 세팅주기</div>

            {schedules.length === 0 && !addingSchedule && (
              <div style={{ fontSize: 12, color: 'var(--ink-4)', padding: '8px 0' }}>등록된 주기가 없습니다.</div>
            )}

            {schedules.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{formatSchedule(s)}</span>
                  {s.sector
                    ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--primary)', marginLeft: 8, padding: '1px 7px', background: 'var(--primary-soft)', borderRadius: 'var(--r-pill)' }}>{s.sector.name}</span>
                    : <span style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 8 }}>전체</span>
                  }
                  {s.note && <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>{s.note}</div>}
                </div>
                <button onClick={() => handleDeleteSchedule(s.id)} style={{ fontSize: 11, color: 'var(--danger)', padding: '2px 8px', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)' }}>삭제</button>
              </div>
            ))}

            {addingSchedule ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px', marginTop: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* 주기 선택 */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>주기</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['weekly','매주'],['biweekly','격주'],['monthly','매월'],['once','직접입력']].map(([v,l]) => (
                        <button key={v} onClick={() => setNewSchedFrequency(v)}
                          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, borderRadius: 'var(--r-pill)',
                            background: newSchedFrequency === v ? 'var(--primary)' : 'var(--surface-2)',
                            color: newSchedFrequency === v ? '#fff' : 'var(--ink-2)',
                            border: newSchedFrequency === v ? 'none' : '1px solid var(--line)' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 매주/격주: 요일 선택 */}
                  {(newSchedFrequency === 'weekly' || newSchedFrequency === 'biweekly') && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>요일</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {['일','월','화','수','목','금','토'].map((l, i) => (
                          <button key={i} onClick={() => setNewSchedDayOfWeek(i)}
                            style={{ width: 36, height: 36, fontSize: 12, fontWeight: 600, borderRadius: '50%',
                              background: newSchedDayOfWeek === i ? 'var(--primary)' : 'var(--surface-2)',
                              color: newSchedDayOfWeek === i ? '#fff' : i === 0 ? 'var(--danger)' : i === 6 ? 'var(--c-blue)' : 'var(--ink-2)',
                              border: newSchedDayOfWeek === i ? 'none' : '1px solid var(--line)' }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 격주: 시작 날짜 (앵커) */}
                  {newSchedFrequency === 'biweekly' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>첫 번째 교체 날짜 <span style={{ color: 'var(--danger)' }}>*</span></div>
                      <input type="date" value={newSchedStartDate} onChange={(e) => setNewSchedStartDate(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>격주 계산의 기준이 됩니다</div>
                    </div>
                  )}

                  {/* 직접입력: 날짜 선택 */}
                  {newSchedFrequency === 'once' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>날짜 <span style={{ color: 'var(--danger)' }}>*</span></div>
                      <input type="date" value={newSchedStartDate} onChange={(e) => setNewSchedStartDate(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
                    </div>
                  )}

                  {/* 매월: 날짜 선택 */}
                  {newSchedFrequency === 'monthly' && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>매월 몇 일</div>
                      <select value={newSchedDayOfMonth} onChange={(e) => setNewSchedDayOfMonth(Number(e.target.value))}
                        style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                        {Array.from({length: 28}, (_, i) => i + 1).map(d => (
                          <option key={d} value={d}>{d}일</option>
                        ))}
                      </select>
                      <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 4 }}>29~31일은 월에 따라 표시되지 않을 수 있어 28일 이내를 권장합니다</div>
                    </div>
                  )}

                  {/* 섹터 선택 */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>섹터 (선택)</div>
                    <select value={newSchedSectorId} onChange={(e) => setNewSchedSectorId(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                      <option value="">전체 (섹터 지정 안 함)</option>
                      {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  {/* 메모 */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>메모 (선택)</div>
                    <input value={newSchedNote} onChange={(e) => setNewSchedNote(e.target.value)}
                      placeholder="예: A벽 세팅 교체"
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleAddSchedule}
                      style={{ flex: 1, padding: '9px', fontSize: 13, fontWeight: 700, background: 'var(--primary)', color: '#fff', borderRadius: 'var(--r-sm)' }}>
                      등록
                    </button>
                    <button onClick={() => setAddingSchedule(false)}
                      style={{ padding: '9px 16px', fontSize: 13, color: 'var(--ink-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                      취소
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingSchedule(true)}
                style={{ marginTop: 10, fontSize: 13, fontWeight: 600, padding: '8px 14px', borderRadius: 'var(--r-sm)', border: '1px dashed var(--line-2)', width: '100%', color: 'var(--ink-3)' }}>
                + 주기 추가
              </button>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--line)', marginBottom: 16 }} />

          {/* ── 문제 교체 달력 ── */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>문제 교체 달력</div>

            {/* 월 네비게이션 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => {
                let m = resetMonth - 1, y = resetYear;
                if (m === 0) { m = 12; y--; }
                setResetYear(y); setResetMonth(m); setSelectedResetDate(null);
              }} style={{ padding: '4px 10px', fontSize: 13, color: 'var(--ink-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>‹</button>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{resetYear}년 {resetMonth}월</span>
              <button onClick={() => {
                let m = resetMonth + 1, y = resetYear;
                if (m === 13) { m = 1; y++; }
                setResetYear(y); setResetMonth(m); setSelectedResetDate(null);
              }} style={{ padding: '4px 10px', fontSize: 13, color: 'var(--ink-3)', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>›</button>
            </div>

            {/* 달력 그리드 */}
            {(() => {
              const firstDay = new Date(resetYear, resetMonth - 1, 1).getDay();
              const lastDate = new Date(resetYear, resetMonth, 0).getDate();
              // 날짜 → 해당 날 resets 배열로 맵핑
              const resetMap = {};
              resets.forEach(r => {
                if (!resetMap[r.reset_date]) resetMap[r.reset_date] = [];
                resetMap[r.reset_date].push(r);
              });
              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(null);
              for (let d = 1; d <= lastDate; d++) cells.push(d);

              return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
                    {DAY_LABELS_SHORT.map((l, i) => (
                      <div key={l} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--c-blue)' : 'var(--ink-4)' }}>{l}</div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                    {cells.map((d, i) => {
                      if (!d) return <div key={i} />;
                      const dateStr = ymd(resetYear, resetMonth, d);
                      const dayResets = resetMap[dateStr] || [];
                      const hasReset = dayResets.length > 0;
                      const isSelected = selectedResetDate === dateStr;
                      return (
                        <button key={i}
                          onClick={() => setSelectedResetDate(isSelected ? null : dateStr)}
                          style={{
                            minHeight: 40, fontSize: 11, position: 'relative',
                            borderRadius: 'var(--r-sm)', padding: '3px 2px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            background: isSelected ? 'var(--primary)' : hasReset ? 'var(--primary-soft)' : 'transparent',
                            color: isSelected ? '#fff' : 'var(--ink-1)',
                          }}>
                          <span style={{ fontWeight: hasReset ? 700 : 400 }}>{d}</span>
                          {hasReset && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, width: '100%' }}>
                              {dayResets.slice(0, 2).map((r, ri) => (
                                <span key={ri} style={{
                                  fontSize: 8, lineHeight: 1.2, fontWeight: 600,
                                  color: isSelected ? 'rgba(255,255,255,0.9)' : 'var(--primary)',
                                  maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                  padding: '0 2px',
                                }}>
                                  {r.sector?.name || '전체'}
                                </span>
                              ))}
                              {dayResets.length > 2 && (
                                <span style={{ fontSize: 7, color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--ink-4)' }}>+{dayResets.length - 2}</span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* 선택된 날짜 상세 */}
            {selectedResetDate && (() => {
              const dayResets = resets.filter(r => r.reset_date === selectedResetDate);
              return (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>{selectedResetDate} 교체 예정</div>
                  {dayResets.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>해당 날짜 교체 없음</div>
                  ) : dayResets.map((r, ri) => (
                    <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                        {r.sector?.name || '전체'}
                      </span>
                      <span style={{ color: 'var(--ink-3)' }}>{formatSchedule({ frequency: r.frequency, day_of_week: new Date(r.reset_date + 'T00:00:00').getDay(), day_of_month: new Date(r.reset_date + 'T00:00:00').getDate() })}</span>
                      {r.note && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>— {r.note}</span>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* 이번 달 전체 교체 일정 */}
            {resets.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 6 }}>{resetMonth}월 교체 일정</div>
                {resets.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--line)', fontSize: 12 }}>
                    <span style={{ color: 'var(--ink-3)', minWidth: 44 }}>{r.reset_date.slice(5)}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                      {r.sector?.name || '전체'}
                    </span>
                    <span style={{ color: 'var(--ink-4)', flex: 1, fontSize: 11 }}>{r.note || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 통계 탭 */}
      {tab === 'stats' && (
        <div style={{ padding: '12px 16px 24px' }}>
          {/* 기간 필터 칩 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {[['all', '전체'], ['month1', '1개월'], ['month3', '3개월'], ['custom', '직접 선택']].map(([v, l]) => (
              <Chip key={v} active={statsPeriod === v} onClick={() => setStatsPeriod(v)}>{l}</Chip>
            ))}
          </div>

          {/* 섹터 필터 */}
          {sectors.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <select value={statsSectorId} onChange={(e) => setStatsSectorId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                <option value="">전체 섹터</option>
                {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {/* 직접 선택 시 범위 picker */}
          {statsPeriod === 'custom' && (
            <div style={{ marginBottom: 14 }}>
              <DateRangePicker
                from={statsFrom} to={statsTo}
                onChange={(f, t) => { setStatsFrom(f); setStatsTo(t); }}
              />
            </div>
          )}

          {statsLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>로딩 중...</div>
          ) : !statsData ? (
            <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>기간을 선택하세요</div>
          ) : (
            <>
              {/* 요약 카드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[['방문 횟수', statsData.visits], ['총 완등', statsData.total_cleared]].map(([label, val]) => (
                  <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink-1)' }}>{val ?? 0}</div>
                  </div>
                ))}
              </div>

              {/* 색상별 완등 분포 */}
              {statsData.breakdown?.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>색상별 완등</div>
                  {(() => {
                    const byColor = {};
                    (statsData.cleared_breakdown || statsData.breakdown || []).forEach(b => {
                      if (!byColor[b.color]) byColor[b.color] = { color: b.color, count: 0 };
                      byColor[b.color].count += (b.cleared_count ?? b.count ?? 0);
                    });
                    const items = Object.values(byColor).filter(b => b.count > 0).sort((a, b) => b.count - a.count);
                    const max = items[0]?.count || 1;
                    const COLOR_KR = { red: '빨강', orange: '주황', yellow: '노랑', green: '초록', blue: '파랑', navy: '남색', pink: '핑크', purple: '보라', black: '검정', white: '하양', gray: '회색' };
                    const COLOR_HEX = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e', blue: '#3b82f6', navy: '#1d4ed8', pink: '#ec4899', purple: '#a855f7', black: '#1f2937', white: '#e5e7eb', gray: '#6b7280' };
                    return items.map(b => (
                      <div key={b.color} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLOR_HEX[b.color] || '#999', display: 'inline-block', border: b.color === 'white' ? '1px solid #ccc' : 'none' }} />
                            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{COLOR_KR[b.color] || b.color}</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-1)' }}>{b.count}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(b.count / max) * 100}%`, background: COLOR_HEX[b.color] || '#999', borderRadius: 3, opacity: b.color === 'white' ? 0.5 : 1 }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* 섹터별 완등 분포 (전체 섹터 조회 시에만) */}
              {!statsSectorId && statsData.sector_breakdown?.length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>섹터별 완등</div>
                  {(() => {
                    const items = statsData.sector_breakdown;
                    const max = items[0]?.count || 1;
                    return items.map(s => (
                      <div key={s.id} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{s.name}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{s.count}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(s.count / max) * 100}%`, background: 'var(--primary)', borderRadius: 3 }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* 난이도별 완등 분포 */}
              {statsData.cleared_by_level && Object.keys(statsData.cleared_by_level).length > 0 && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 10 }}>V등급별 완등</div>
                  {(() => {
                    const items = Object.entries(statsData.cleared_by_level)
                      .filter(([, v]) => v > 0)
                      .sort(([a], [b]) => {
                        const numA = parseInt(a.replace('V', '')) || 0;
                        const numB = parseInt(b.replace('V', '')) || 0;
                        return numA - numB;
                      });
                    const max = Math.max(...items.map(([, v]) => v), 1);
                    return items.map(([level, count]) => (
                      <div key={level} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{level}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>{count}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: 'var(--primary)', borderRadius: 3 }} />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {editOpen && (
        <GymAddModal
          gym={gym}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            if (updated) setGym(updated);
            else gymsApi.get(id).then((r) => setGym(r.data)).catch(() => {});
          }}
        />
      )}
    </>
  );
}

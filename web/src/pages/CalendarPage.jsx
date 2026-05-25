import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { I } from '../components/atoms/Icons';
import { climbLogsApi } from '../api/climbLogs';
import ClearedSummary from '../components/ClearedSummary';
import RecordActionMenu from '../components/RecordActionMenu';
import RecordEditModal from '../components/modals/RecordEditModal';

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAT_LABEL = { endurance: '지구력', conditioning: '컨디셔닝', general: '기타' };

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [dotDates, setDotDates] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [logs, setLogs] = useState([]);          // 선택 날짜 기록
  const [logsLoading, setLogsLoading] = useState(false);
  const [monthLogs, setMonthLogs] = useState([]);  // 월 전체 기록
  const [monthLoading, setMonthLoading] = useState(false);
  const [editLog, setEditLog] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    climbLogsApi.monthDates(year, month).then((r) => {
      setDotDates(new Set(r.data?.dates || []));
    }).catch(() => {});
  }, [year, month]);

  useEffect(() => {
    const lastDay = new Date(year, month, 0).getDate();
    const from = `${year}-${pad(month)}-01`;
    const to = `${year}-${pad(month)}-${pad(lastDay)}`;
    setMonthLoading(true);
    climbLogsApi.byRange(from, to, { limit: 50 })
      .then((r) => setMonthLogs(r.data?.logs || []))
      .catch(() => setMonthLogs([]))
      .finally(() => setMonthLoading(false));
  }, [year, month]);

  const grid = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0).getDate();
    const startDow = first.getDay();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= last; d++) cells.push(d);
    return cells;
  }, [year, month]);

  function shiftMonth(dir) {
    let m = month + dir, y = year;
    if (m === 0) { m = 12; y--; }
    if (m === 13) { m = 1; y++; }
    setYear(y); setMonth(m);
    setSelected(null);
  }

  function handleDateClick(date) {
    if (selected === date) {
      setSelected(null);
      return;
    }
    setSelected(date);
    setLogs([]);
    setLogsLoading(true);
    climbLogsApi.byDate(date)
      .then((r) => setLogs(r.data?.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLogsLoading(false));
  }

  async function handleAdjustProblem(logId, problemId, field, delta) {
    const prevSnapshot = logs;
    const target = (prevSnapshot.find((l) => l.id === logId)?.problems || []).find((p) => p.id === problemId);
    if (!target) return;
    const cur = Number(target[field] != null ? target[field] : (field === 'cleared_count' && target.is_cleared ? 1 : 0));
    const next = Math.max(0, cur + delta);
    if (next === cur) return;
    setLogs((prev) => prev.map((l) => l.id !== logId ? l : ({
      ...l,
      problems: (l.problems || []).map((p) => {
        if (p.id !== problemId) return p;
        return { ...p, [field]: next, ...(field === 'cleared_count' ? { is_cleared: next > 0 } : {}) };
      }),
    })));
    try {
      await climbLogsApi.updateProblem(logId, problemId, { [field]: next });
    } catch (e) {
      setLogs(prevSnapshot);
      alert(e?.response?.data?.message || e.message || '갱신 실패');
    }
  }

  async function handleDelete(log) {
    if (!confirm('이 기록을 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    try {
      await climbLogsApi.remove(log.id);
      setLogs((prev) => prev.filter((l) => l.id !== log.id));
      setMonthLogs((prev) => prev.filter((l) => l.id !== log.id));
      setDotDates((prev) => {
        const next = new Set(prev);
        if (logs.filter((l) => l.id !== log.id).length === 0) next.delete(selected);
        return next;
      });
    } catch (e) { alert(e.message || '삭제 실패'); }
  }

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  const selectedD = selected ? Number(selected.split('-')[2]) : null;
  const selectedDate = selected ? new Date(selected + 'T00:00:00') : null;
  const dayName = selectedDate ? DAY_LABELS[selectedDate.getDay()] : '';
  const totalCleared = logs.reduce((acc, l) =>
    acc + (l.problems || []).reduce((s, p) =>
      s + (p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0)), 0), 0);

  return (
    <>
      <TopBar />

      {/* Month header */}
      <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <button onClick={() => shiftMonth(-1)} style={{ padding: 6, color: 'var(--ink-3)' }}>{I.chev(16, 'left')}</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{year}년 {month}월</div>
        <button onClick={() => shiftMonth(1)} style={{ padding: 6, color: 'var(--ink-3)' }}>{I.chev(16)}</button>
      </div>

      {/* Week labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 12px 4px' }}>
        {DAY_LABELS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600,
            color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--c-blue)' : 'var(--ink-3)',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: '4px 12px', display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;
          const date = ymd(year, month, d);
          const has = dotDates.has(date);
          const todayMark = isToday(d);
          const isSelected = selected === date;
          return (
            <button key={i} onClick={() => handleDateClick(date)} style={{
              aspectRatio: '1', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r-sm)', position: 'relative',
              background: isSelected ? 'var(--primary)' : todayMark ? 'var(--primary-soft)' : 'transparent',
              color: isSelected ? '#fff' : 'var(--ink-1)',
              fontSize: 14, fontWeight: (todayMark || isSelected) ? 700 : 500,
            }}>
              <span className="tabnum">{d}</span>
              {has && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--primary)',
                  marginTop: 2,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* 월 전체 기록 (날짜 미선택 시) */}
      {!selected && (
        <div style={{ padding: '12px 16px 24px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 10 }}>
            {month}월 전체 기록
          </div>
          {monthLoading ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: 16 }}>로딩 중...</div>
          ) : monthLogs.length === 0 ? (
            <div style={{
              background: 'var(--surface)', border: '1px dashed var(--line-2)',
              borderRadius: 'var(--r-md)', padding: 20, textAlign: 'center',
              fontSize: 12.5, color: 'var(--ink-3)',
            }}>이번 달 기록이 없습니다</div>
          ) : monthLogs.map((log) => {
            const d = new Date((log.visited_at || '') + 'T00:00:00');
            const dateLabel = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
            const logCleared = (log.problems || []).reduce((s, p) =>
              s + (p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0)), 0);
            return (
              <div key={log.id} style={{
                background: 'var(--surface)', border: '1px solid var(--line)',
                borderRadius: 'var(--r-md)', padding: '12px 14px', marginBottom: 8,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <button
                    onClick={() => handleDateClick(log.visited_at)}
                    style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}
                  >{dateLabel}</button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {logCleared > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)', background: 'var(--primary-soft)', color: 'var(--primary)' }}>{logCleared}완등</span>
                    )}
                    <div onClick={(e) => e.stopPropagation()}>
                      <RecordActionMenu
                        onEdit={() => setEditLog(log)}
                        onDelete={() => handleDelete(log)}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{log.gym_name}</div>
                {(log.gym_pass || log.used_day_pass) && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {I.ticket(11)}
                    {log.gym_pass
                      ? `${log.gym_pass.label || (log.gym_pass.pass_type === 'period' ? '정기권' : '횟수권')}${log.gym_pass.pass_type === 'count' ? ` (잔여 ${log.gym_pass.remaining_count}회)` : ''}`
                      : '일일이용권'}
                  </div>
                )}
                {log.problems?.length > 0 && (
                  <ClearedSummary problems={log.problems} />
                )}
                {(log.training_sessions || []).filter((s) => s.category !== 'bouldering').map((s) => (
                  <div key={s.id} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)', background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{CAT_LABEL[s.category] || s.category}</span>
                    {s.items?.[0] && <span style={{ color: 'var(--ink-2)' }}>{s.items[0].exercise_name}</span>}
                  </div>
                ))}
                {log.memo && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--ink-3)' }}>
                    <span style={{ color: 'var(--ink-4)', marginRight: 4 }}>메모</span>{log.memo}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 선택된 날짜 기록 — 인라인 편집 */}
      {selected && (
        <div style={{ padding: '12px 16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              {month}월 {selectedD}일 ({dayName})
              {totalCleared > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 700,
                  padding: '2px 8px', borderRadius: 'var(--r-pill)',
                  background: 'var(--primary-soft)', color: 'var(--primary)',
                }}>{totalCleared}완등</span>
              )}
            </span>
            <button
              onClick={() => navigate(`/calendar/${selected}`)}
              style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}
            >전체보기 {I.chev(12)}</button>
          </div>

          {logsLoading ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: 16 }}>로딩 중...</div>
          ) : logs.length === 0 ? (
            <div style={{
              background: 'var(--surface)', border: '1px dashed var(--line-2)',
              borderRadius: 'var(--r-md)', padding: 20, textAlign: 'center',
              fontSize: 12.5, color: 'var(--ink-3)',
            }}>기록이 없습니다</div>
          ) : logs.map((log) => (
            <div key={log.id} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', padding: '12px 14px',
              marginBottom: 8,
            }}>
              {/* 암장명 + 액션 메뉴 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{log.gym_name}</div>
                <div onClick={(e) => e.stopPropagation()}>
                  <RecordActionMenu
                    onEdit={() => setEditLog(log)}
                    onDelete={() => handleDelete(log)}
                  />
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

              {/* 문제 편집 */}
              {log.problems?.length > 0 && (
                <ClearedSummary
                  problems={log.problems}
                  editable
                  onAdjust={(pid, field, delta) => handleAdjustProblem(log.id, pid, field, delta)}
                />
              )}

              {/* 훈련 세션 (볼더링 외) */}
              {(log.training_sessions || []).filter((s) => s.category !== 'bouldering').map((s) => (
                <div key={s.id} style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 'var(--r-pill)',
                    background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line-2)',
                  }}>{CAT_LABEL[s.category] || s.category}</span>
                  {s.items?.[0] && <span style={{ color: 'var(--ink-2)' }}>{s.items[0].exercise_name}</span>}
                </div>
              ))}

              {/* 메모 */}
              {log.memo && (
                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-3)' }}>
                  <span style={{ color: 'var(--ink-4)', marginRight: 4 }}>메모</span>{log.memo}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editLog && (
        <RecordEditModal
          kind="climb_log"
          logId={editLog.id}
          initial={{
            memo: editLog.memo, date: editLog.visited_at,
            duration_minutes: editLog.duration_minutes,
            start_time: editLog.start_time, end_time: editLog.end_time,
            problems: editLog.problems,
            training_sessions: editLog.training_sessions,
            gym_id: editLog.gym_id,
          }}
          onSubmit={async ({ memo, date, duration_minutes, start_time, end_time }) => {
            await climbLogsApi.update(editLog.id, { memo, visited_at: date, duration_minutes, start_time, end_time });
            if (selected) climbLogsApi.byDate(selected).then((r) => setLogs(r.data?.logs || [])).catch(() => {});
            const lastDay = new Date(year, month, 0).getDate();
            climbLogsApi.byRange(`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(lastDay)}`, { limit: 50 })
              .then((r) => setMonthLogs(r.data?.logs || [])).catch(() => {});
          }}
          onChanged={() => {
            if (selected) climbLogsApi.byDate(selected).then((r) => setLogs(r.data?.logs || [])).catch(() => {});
            const lastDay = new Date(year, month, 0).getDate();
            climbLogsApi.byRange(`${year}-${pad(month)}-01`, `${year}-${pad(month)}-${pad(lastDay)}`, { limit: 50 })
              .then((r) => setMonthLogs(r.data?.logs || [])).catch(() => {});
          }}
          onClose={() => setEditLog(null)}
        />
      )}
    </>
  );
}

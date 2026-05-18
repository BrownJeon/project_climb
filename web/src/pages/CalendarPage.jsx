import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { Btn, ColorBadge, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { climbLogsApi } from '../api/climbLogs';
import RecordActionMenu from '../components/RecordActionMenu';
import RecordEditModal from '../components/modals/RecordEditModal';
import ClearedSummary from '../components/ClearedSummary';

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selected, setSelected] = useState(today.getDate());
  const [dotDates, setDotDates] = useState(new Set());
  const [logs, setLogs] = useState([]);
  const [editLog, setEditLog] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    climbLogsApi.monthDates(year, month).then((r) => {
      setDotDates(new Set(r.data?.dates || []));
    }).catch(() => {});
  }, [year, month, reloadTick]);

  useEffect(() => {
    const date = ymd(year, month, selected);
    climbLogsApi.byDate(date).then((r) => setLogs(r.data?.logs || [])).catch(() => {});
  }, [year, month, selected, reloadTick]);

  async function handleDeleteLog(log) {
    if (!confirm('이 기록을 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    try {
      await climbLogsApi.remove(log.id);
      setReloadTick((t) => t + 1);
    } catch (e) {
      alert(e.message || '삭제 실패');
    }
  }

  // 인라인 +/- — 낙관적 갱신, 실패 시 롤백
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
      setLogs(prevSnapshot); // 롤백
      alert(e?.response?.data?.message || e.message || '갱신 실패');
    }
  }

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
    setYear(y); setMonth(m); setSelected(1);
  }

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  const selectedDate = new Date(year, month - 1, selected);
  const dayName = DAY_LABELS[selectedDate.getDay()];
  // 신규: cleared_count 합산. 없는 row(레거시)는 is_cleared로 fallback.
  const totalCleared = logs.reduce((acc, l) => acc + (l.problems || []).reduce((s, p) =>
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
          const sel = selected === d;
          const todayMark = isToday(d);
          return (
            <button key={i} onClick={() => {
              if (selected === d) navigate(`/calendar/${date}`);
              else setSelected(d);
            }} style={{
              aspectRatio: '1', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r-sm)', position: 'relative',
              background: sel ? 'var(--ink-1)' : todayMark ? 'var(--primary-soft)' : 'transparent',
              color: sel ? 'var(--surface)' : 'var(--ink-1)',
              fontSize: 14, fontWeight: sel || todayMark ? 700 : 500,
            }}>
              <span className="tabnum">{d}</span>
              {has && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: sel ? 'var(--surface)' : 'var(--primary)',
                  marginTop: 2,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{month}월 {selected}일 ({dayName}) 기록</div>
        {totalCleared > 0 && <Pill tone="primary">{totalCleared}완등</Pill>}
      </div>

      <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {logs.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px dashed var(--line-2)',
            borderRadius: 'var(--r-md)', padding: 20, textAlign: 'center',
            fontSize: 12.5, color: 'var(--ink-3)',
          }}>
            기록이 없습니다
          </div>
        ) : logs.map((log) => (
          <div key={log.id}
            onClick={() => navigate(`/logs/${log.id}`)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/logs/${log.id}`); }}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', cursor: 'pointer',
            }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{log.gym_name}</div>
                {(log.gym_pass || log.used_day_pass) && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {I.ticket(11)}
                    {log.gym_pass
                      ? `${log.gym_pass.label || (log.gym_pass.pass_type === 'period' ? '정기권' : '횟수권')}${log.gym_pass.pass_type === 'count' ? ` (잔여 ${log.gym_pass.remaining_count}회)` : ''}`
                      : '일일이용권'}
                  </div>
                )}
                {log.problems?.length > 0 && (
                  <div style={{ marginTop: 8, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                    <ClearedSummary
                      problems={log.problems}
                      editable
                      onAdjust={(pid, field, delta) => handleAdjustProblem(log.id, pid, field, delta)}
                    />
                  </div>
                )}
                {(log.training_sessions || []).filter((s) => s.category !== 'bouldering').length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                    {(log.training_sessions || []).filter((s) => s.category !== 'bouldering').map((s) => (
                      <TrainingSessionRow key={s.id} session={s} />
                    ))}
                  </div>
                )}
              </div>
              <RecordActionMenu
                onEdit={() => setEditLog(log)}
                onDelete={() => handleDeleteLog(log)}
              />
            </div>

            {log.memo && (
              <div style={{ padding: '10px 14px', fontSize: 12.5, color: 'var(--ink-2)' }}>
                <span style={{ color: 'var(--ink-4)', fontSize: 11, marginRight: 6 }}>메모</span>
                {log.memo}
              </div>
            )}
          </div>
        ))}
      </div>

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
            setReloadTick((t) => t + 1);
          }}
          onChanged={() => setReloadTick((t) => t + 1)}
          onClose={() => setEditLog(null)}
        />
      )}
    </>
  );
}

const CAT_LABEL = { endurance: '지구력', conditioning: '컨디셔닝', general: '기타' };

function TrainingSessionRow({ session }) {
  const it = session.items?.[0];
  const cat = session.category;
  const catLabel = CAT_LABEL[cat] || cat;

  let detail = null;
  if (cat === 'endurance' && it) {
    const m = (it.exercise_name || '').match(/\((5\.[\w.]+)\)/);
    const level = m ? m[1] : it.exercise_name;
    const cleared = it.sets != null ? it.sets >= 1 : false;
    const attempts = it.reps_or_seconds;
    detail = (
      <>
        <span style={{ fontWeight: 600 }}>{level}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '1px 6px',
          borderRadius: 'var(--r-pill)',
          background: cleared ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.10)',
          color: cleared ? 'var(--success)' : 'var(--danger)',
        }}>{cleared ? '완등' : '미완등'}</span>
        {attempts != null && <span style={{ color: 'var(--ink-3)' }}>{attempts}회 시도</span>}
      </>
    );
  } else if (cat === 'conditioning' && it) {
    detail = (
      <>
        <span style={{ fontWeight: 600 }}>{it.exercise_name}</span>
        {it.reps_or_seconds != null && (
          <span style={{ color: 'var(--ink-3)' }}>{it.reps_or_seconds}{it.metric_unit || ''}</span>
        )}
      </>
    );
  } else if (cat === 'general' && session.memo) {
    detail = <span style={{ color: 'var(--ink-3)' }}>{session.memo}</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' }}>
      <span style={{
        flexShrink: 0, fontSize: 11, fontWeight: 700,
        padding: '1px 7px', borderRadius: 'var(--r-pill)',
        background: 'var(--surface-2)', color: 'var(--ink-2)',
        border: '1px solid var(--line-2)',
      }}>{catLabel}</span>
      {detail}
    </div>
  );
}

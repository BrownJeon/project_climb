import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { ColorBadge, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { climbLogsApi } from '../api/climbLogs';
import RecordActionMenu from '../components/RecordActionMenu';
import RecordEditModal from '../components/modals/RecordEditModal';
import ClearedSummary from '../components/ClearedSummary';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CAT_LABEL = { endurance: '지구력', conditioning: '컨디셔닝', general: '기타' };

function formatHeader(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY_LABELS[d.getDay()]})`;
}

export default function CalendarDetailPage() {
  const { date } = useParams();
  const nav = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editLog, setEditLog] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setLoading(true);
    climbLogsApi.byDate(date)
      .then((r) => setLogs(r.data?.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [date, reloadTick]);

  async function handleDelete(log) {
    if (!confirm('이 기록을 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    try {
      await climbLogsApi.remove(log.id);
      setReloadTick((t) => t + 1);
    } catch (e) { alert(e.message || '삭제 실패'); }
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

  const totalCleared = logs.reduce((acc, l) => acc + (l.problems || []).reduce((s, p) =>
    s + (p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0)), 0), 0);

  const backBtn = (
    <button onClick={() => nav(-1)} aria-label="뒤로"
      style={{ padding: 6, color: 'var(--ink-3)' }}>
      {I.chev(16, 'left')}
    </button>
  );

  return (
    <>
      <TopBar right={backBtn} />

      <div style={{ padding: '14px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{formatHeader(date)}</div>
        {totalCleared > 0 && <Pill tone="primary">{totalCleared}완등</Pill>}
      </div>

      <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--ink-3)' }}>로딩 중...</div>
        ) : logs.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px dashed var(--line-2)',
            borderRadius: 'var(--r-md)', padding: 28, textAlign: 'center',
            fontSize: 13, color: 'var(--ink-3)',
          }}>
            이날 기록이 없습니다
          </div>
        ) : logs.map((log) => (
          <div key={log.id}
            onClick={() => nav(`/logs/${log.id}`)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') nav(`/logs/${log.id}`); }}
            style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', cursor: 'pointer',
            }}>
            <div style={{ padding: '12px 14px', borderBottom: (log.memo ? '1px solid var(--line)' : 'none'), display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{log.gym_name}</div>
                {(log.gym_pass || log.used_day_pass) && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {I.ticket(11)}
                    {log.gym_pass
                      ? `${log.gym_pass.label || (log.gym_pass.pass_type === 'period' ? '정기권' : '횟수권')}${log.gym_pass.pass_type === 'count' ? ` (잔여 ${log.gym_pass.remaining_count}회)` : ''}`
                      : '일일이용권'}
                  </div>
                )}
                {log.problems?.length > 0 && (
                  <div style={{ marginTop: 4, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
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
              <div onClick={(e) => e.stopPropagation()}>
                <RecordActionMenu
                  onEdit={() => setEditLog(log)}
                  onDelete={() => handleDelete(log)}
                />
              </div>
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
          onSubmit={async ({ memo, date: d, duration_minutes, start_time, end_time }) => {
            await climbLogsApi.update(editLog.id, { memo, visited_at: d, duration_minutes, start_time, end_time });
            setReloadTick((t) => t + 1);
          }}
          onChanged={() => setReloadTick((t) => t + 1)}
          onClose={() => setEditLog(null)}
        />
      )}
    </>
  );
}

function TrainingSessionRow({ session }) {
  const it = session.items?.[0];
  const cat = session.category;
  const catLabel = CAT_LABEL[cat] || cat;

  let detail = null;
  if (cat === 'endurance' && it) {
    const m = (it.exercise_name || '').match(/\((5\.[\w.]+)\)/);
    const level = m ? m[1] : it.exercise_name;
    const cleared = it.sets != null ? it.sets >= 1 : false;
    detail = (
      <>
        <span style={{ fontWeight: 600 }}>{level}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)',
          background: cleared ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.10)',
          color: cleared ? 'var(--success, #22c55e)' : 'var(--danger)',
        }}>{cleared ? '완등' : '미완등'}</span>
        {it.reps_or_seconds != null && <span style={{ color: 'var(--ink-3)' }}>{it.reps_or_seconds}회 시도</span>}
      </>
    );
  } else if (cat === 'conditioning' && it) {
    detail = (
      <>
        <span style={{ fontWeight: 600 }}>{it.exercise_name}</span>
        {it.reps_or_seconds != null && <span style={{ color: 'var(--ink-3)' }}>{it.reps_or_seconds}{it.metric_unit || ''}</span>}
      </>
    );
  } else if (cat === 'general' && session.memo) {
    detail = <span style={{ color: 'var(--ink-3)' }}>{session.memo}</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap' }}>
      <span style={{
        flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '1px 7px',
        borderRadius: 'var(--r-pill)', background: 'var(--surface-2)',
        color: 'var(--ink-2)', border: '1px solid var(--line-2)',
      }}>{catLabel}</span>
      {detail}
    </div>
  );
}

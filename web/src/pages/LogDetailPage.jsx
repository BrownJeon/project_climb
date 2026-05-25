import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { ColorBadge, Pill, Btn } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { climbLogsApi } from '../api/climbLogs';
import RecordEditModal from '../components/modals/RecordEditModal';
import { failureTagLabel, parseFailureTags } from '../utils/failureTags';
import { fmtDuration, normalizeTime } from '../components/TimeRangeField';

export default function LogDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [error, setError] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setError(null);
    climbLogsApi.byId(id)
      .then((r) => setLog(r.data))
      .catch((e) => setError(e.message || '기록을 불러오지 못했습니다.'));
  }, [id, reloadTick]);

  // 백그라운드 영상 업로드 완료 시 자동 갱신
  useEffect(() => {
    const handler = ({ detail }) => {
      if (String(detail.logId) === String(id)) setReloadTick((t) => t + 1);
    };
    window.addEventListener('theroute:videoUploaded', handler);
    return () => window.removeEventListener('theroute:videoUploaded', handler);
  }, [id]);

  async function handleDelete() {
    if (!confirm('이 기록을 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    try {
      await climbLogsApi.remove(id);
      navigate('/calendar');
    } catch (e) { alert(e.message || '삭제 실패'); }
  }

  if (error) {
    return (
      <>
        <TopBar />
        <div style={{ padding: 20, fontSize: 13, color: 'var(--danger)' }}>{error}</div>
      </>
    );
  }
  if (!log) return <><TopBar /><div style={{ padding: 20, color: 'var(--ink-3)' }}>로딩 중...</div></>;

  const totalCleared = (log.problems || []).reduce((s, p) =>
    s + (p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0)), 0);
  const totalFailed = (log.problems || []).reduce((s, p) =>
    s + (p.failed_count != null ? Number(p.failed_count) : (p.is_cleared ? 0 : 1)), 0);
  const startTime = normalizeTime(log.start_time);
  const endTime = normalizeTime(log.end_time);
  const timeLabel = startTime && endTime
    ? `${startTime} ~ ${endTime}${log.duration_minutes != null ? ` · ${fmtDuration(Number(log.duration_minutes))}` : ''}`
    : (log.duration_minutes != null ? fmtDuration(Number(log.duration_minutes)) : '');

  return (
    <>
      <TopBar
        right={
          <button onClick={() => navigate(-1)} aria-label="뒤로"
            style={{ padding: 6, color: 'var(--ink-3)' }}>
            {I.chev(16, 'left')}
          </button>
        }
      />

      {/* 헤더 */}
      <div style={{ padding: '14px 16px 8px' }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{log.gym_name}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>
          {log.visited_at}
        </div>
        {timeLabel && (
          <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-3)' }}>
            {I.clock ? I.clock(13) : '⏱'}
            {timeLabel}
          </div>
        )}
        {(log.gym_pass || log.used_day_pass) && (
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--ink-3)' }}>
            {I.ticket(13)}
            {log.gym_pass
              ? `${log.gym_pass.label || (log.gym_pass.pass_type === 'period' ? '정기권' : '횟수권')}${log.gym_pass.pass_type === 'count' ? ` (잔여 ${log.gym_pass.remaining_count}회)` : ''}`
              : '일일이용권'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <Pill tone="success">완등 {totalCleared}</Pill>
          <Pill tone="warn">실패 {totalFailed}</Pill>
        </div>
      </div>

      {/* 메모 */}
      {log.memo && (
        <div style={{ margin: '6px 16px 12px', padding: '12px 14px',
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)',
          fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'pre-wrap',
        }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 4, fontWeight: 600 }}>메모</div>
          {log.memo}
        </div>
      )}

      {/* 문제 목록 */}
      <div style={{ padding: '6px 16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
          등록된 문제 ({log.problems?.length || 0})
        </div>
        {(log.problems || []).map((p, i) => {
          const cleared = p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0);
          const failed = p.failed_count != null ? Number(p.failed_count) : (p.is_cleared ? 0 : 1);
          const videoUrl = p.video_url || p.videos?.[0]?.ar_route?.video_url || (p.ar_route?.video_url) || null;
          const thumbUrl = p.thumbnail_url || p.videos?.[0]?.ar_route?.thumbnail_url || (p.ar_route?.thumbnail_url) || null;
          return (
            <div key={p.id || i} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '10px 14px',
                borderBottom: videoUrl ? '1px solid var(--line)' : 'none',
              }}>
                <ColorBadge color={p.color} level={p.level} size="sm" />
                {cleared > 0 && (
                  <span className="tabnum" style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                    ✓ 완등 {cleared}
                  </span>
                )}
                {failed > 0 && (
                  <span className="tabnum" style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
                    ✗ 실패 {failed}
                  </span>
                )}
                {cleared === 0 && failed === 0 && (
                  <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {p.attempts || 1}회</span>
                )}
              </div>
              {videoUrl && (
                <video
                  src={videoUrl}
                  poster={thumbUrl || undefined}
                  controls
                  playsInline
                  preload="metadata"
                  style={{
                    width: '100%', display: 'block', background: '#000',
                    aspectRatio: '9 / 16', objectFit: 'contain',
                  }}
                />
              )}
              {(p.photos || []).map((ph) => (
                <PhotoAnalysis key={ph.id} photo={ph} />
              ))}
            </div>
          );
        })}
        {(!log.problems || log.problems.length === 0) && (
          <div style={{
            background: 'var(--surface)', border: '1px dashed var(--line-2)',
            borderRadius: 'var(--r-md)', padding: 20, textAlign: 'center',
            fontSize: 12.5, color: 'var(--ink-3)',
          }}>
            등록된 문제가 없습니다.
          </div>
        )}
      </div>

      {/* 훈련 기록 (지구력·컨디셔닝·기타) */}
      {(log.training_sessions || []).filter((s) => s.category !== 'bouldering').length > 0 && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
            훈련 기록 ({(log.training_sessions || []).filter((s) => s.category !== 'bouldering').length})
          </div>
          {(log.training_sessions || []).filter((s) => s.category !== 'bouldering').map((s) => (
            <TrainingSessionCard key={s.id} session={s} />
          ))}
        </div>
      )}

      {/* 액션 */}
      <div style={{ padding: '0 16px 24px', display: 'flex', gap: 8 }}>
        <Btn variant="primary" full onClick={() => setEditOpen(true)}>수정</Btn>
        <Btn variant="danger" full onClick={handleDelete}>삭제</Btn>
      </div>

      {editOpen && (
        <RecordEditModal
          kind="climb_log"
          logId={log.id}
          initial={{
            memo: log.memo, date: log.visited_at,
            duration_minutes: log.duration_minutes,
            start_time: log.start_time, end_time: log.end_time,
            problems: log.problems,
            training_sessions: log.training_sessions,
            gym_id: log.gym_id,
          }}
          onSubmit={async ({ memo, date, duration_minutes, start_time, end_time }) => {
            await climbLogsApi.update(log.id, { memo, visited_at: date, duration_minutes, start_time, end_time });
            setReloadTick((t) => t + 1);
          }}
          onChanged={() => setReloadTick((t) => t + 1)}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

const CAT_LABEL = { endurance: '지구력', conditioning: '컨디셔닝', general: '기타' };

function TrainingSessionCard({ session }) {
  const cat = session.category;
  const catLabel = CAT_LABEL[cat] || cat;
  const items = session.items || [];

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)',
      borderRadius: 'var(--r-md)', padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: items.length ? 8 : 0 }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-pill)',
          background: 'var(--surface-2)', color: 'var(--ink-2)', border: '1px solid var(--line-2)',
        }}>{catLabel}</span>
        {session.duration_minutes != null && (
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>⏱ {session.duration_minutes}분</span>
        )}
        {session.memo && (
          <span style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.memo}
          </span>
        )}
      </div>
      {items.map((it, i) => {
        let detail = null;
        if (cat === 'endurance') {
          const m = (it.exercise_name || '').match(/\((5\.[\w.]+)\)/);
          const level = m ? m[1] : it.exercise_name;
          const cleared = it.sets != null ? it.sets >= 1 : false;
          detail = (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, flexWrap: 'wrap', padding: '3px 0' }}>
              <span style={{ fontWeight: 600 }}>{level}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--r-pill)',
                background: cleared ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.10)',
                color: cleared ? 'var(--success, #22c55e)' : 'var(--danger)',
              }}>{cleared ? '완등' : '미완등'}</span>
              {it.reps_or_seconds != null && (
                <span style={{ color: 'var(--ink-3)' }}>{it.reps_or_seconds}회 시도</span>
              )}
            </div>
          );
        } else {
          detail = (
            <div key={i} style={{ fontSize: 12, color: 'var(--ink-2)', padding: '3px 0' }}>
              · {it.exercise_name}
              {it.sets && <> × {it.sets}세트</>}
              {it.reps_or_seconds != null && <> {it.reps_or_seconds}{it.metric_unit || ''}</>}
            </div>
          );
        }
        return detail;
      })}
    </div>
  );
}

function PhotoAnalysis({ photo }) {
  const ann = Array.isArray(photo.hold_annotations) ? photo.hold_annotations
    : (typeof photo.hold_annotations === 'string' ? (() => {
      try { return JSON.parse(photo.hold_annotations); } catch { return []; }
    })() : []);
  const tags = parseFailureTags(photo.failure_tags);
  return (
    <div style={{ borderTop: '1px solid var(--line)' }}>
      <div style={{ position: 'relative', background: '#000' }}>
        <img src={photo.photo_url} alt="문제 사진"
          style={{ width: '100%', display: 'block' }} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          {ann.map((a, i) => {
            const stroke = a.color || '#ef4444';
            const sw = a.stroke || 3;
            if (a.type === 'circle') {
              return <circle key={i} cx={`${a.x}%`} cy={`${a.y}%`} r={`${a.r}%`} fill="none" stroke={stroke} strokeWidth={sw} />;
            }
            if (a.type === 'rect') {
              return <rect key={i} x={`${a.x}%`} y={`${a.y}%`} width={`${a.w}%`} height={`${a.h}%`} fill="none" stroke={stroke} strokeWidth={sw} />;
            }
            return null;
          })}
        </svg>
      </div>
      {(tags.length > 0 || photo.failure_memo) && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {tags.map((t) => (
                <span key={t} style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '3px 9px', borderRadius: 'var(--r-pill)',
                  background: 'var(--surface-2)', color: 'var(--ink-2)',
                  border: '1px solid var(--line-2)',
                }}>{failureTagLabel(t)}</span>
              ))}
            </div>
          )}
          {photo.failure_memo && (
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'pre-wrap' }}>
              {photo.failure_memo}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

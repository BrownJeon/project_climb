import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { ColorBadge, Pill, Btn } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { climbLogsApi } from '../api/climbLogs';
import RecordEditModal from '../components/modals/RecordEditModal';

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

  const totalCleared = (log.problems || []).filter((p) => p.is_cleared).length;
  const totalFailed = (log.problems || []).filter((p) => !p.is_cleared).length;

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
        {(log.problems || []).map((p, i) => (
          <div key={p.id || i} style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px',
              borderBottom: p.ar_route ? '1px solid var(--line)' : 'none',
            }}>
              <ColorBadge color={p.color} level={p.level} size="sm" />
              {p.is_cleared
                ? <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>완등</span>
                : <span style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>실패</span>}
              <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {p.attempts || 1}회</span>
            </div>
            {p.ar_route?.video_url && (
              <video
                src={p.ar_route.video_url}
                poster={p.ar_route.thumbnail_url || undefined}
                controls
                playsInline
                preload="metadata"
                style={{
                  width: '100%', display: 'block', background: '#000',
                  aspectRatio: '9 / 13.5', objectFit: 'contain',
                }}
              />
            )}
          </div>
        ))}
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

      {/* 액션 */}
      <div style={{ padding: '0 16px 24px', display: 'flex', gap: 8 }}>
        <Btn variant="primary" full onClick={() => setEditOpen(true)}>수정</Btn>
        <Btn variant="danger" full onClick={handleDelete}>삭제</Btn>
      </div>

      {editOpen && (
        <RecordEditModal
          kind="climb_log"
          logId={log.id}
          initial={{ memo: log.memo, date: log.visited_at, duration_minutes: log.duration_minutes, problems: log.problems }}
          onSubmit={async ({ memo, date, duration_minutes }) => {
            await climbLogsApi.update(log.id, { memo, visited_at: date, duration_minutes });
            setReloadTick((t) => t + 1);
          }}
          onChanged={() => setReloadTick((t) => t + 1)}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

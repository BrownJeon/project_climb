import { useEffect, useState } from 'react';
import { useVideoUpload } from '../contexts/VideoUploadContext';

export default function VideoUploadToast() {
  const { tasks, removeTask, clearDone } = useVideoUpload();
  const [collapsed, setCollapsed] = useState(false);
  const [autoClearTimer, setAutoClearTimer] = useState(null);

  const active = tasks.filter((t) => t.status !== 'done' && t.status !== 'error');
  const finished = tasks.filter((t) => t.status === 'done' || t.status === 'error');

  // 모두 완료되면 5초 후 자동 제거
  useEffect(() => {
    if (tasks.length > 0 && active.length === 0) {
      const timer = setTimeout(() => clearDone(), 5000);
      setAutoClearTimer(timer);
      return () => clearTimeout(timer);
    }
    if (autoClearTimer) {
      clearTimeout(autoClearTimer);
      setAutoClearTimer(null);
    }
  }, [active.length, tasks.length]); // eslint-disable-line

  if (tasks.length === 0) return null;

  const doneCount = finished.filter((t) => t.status === 'done').length;
  const errorCount = finished.filter((t) => t.status === 'error').length;

  return (
    <div style={{
      position: 'fixed',
      bottom: 72,
      right: 12,
      zIndex: 200,
      width: 260,
      borderRadius: 'var(--r-md)',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      boxShadow: '0 4px 16px rgba(0,0,0,.15)',
      overflow: 'hidden',
      fontSize: 12,
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 10px',
        background: 'var(--surface-2)',
        borderBottom: '1px solid var(--line-2)',
        cursor: 'pointer',
      }} onClick={() => setCollapsed((c) => !c)}>
        <span style={{ fontSize: 13 }}>📹</span>
        <span style={{ flex: 1, fontWeight: 700, color: 'var(--ink-1)' }}>
          영상 처리
          {active.length > 0 && (
            <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 4 }}>
              ({active.length}개 진행 중)
            </span>
          )}
          {active.length === 0 && tasks.length > 0 && (
            <span style={{ fontWeight: 400, color: 'var(--success)', marginLeft: 4 }}>
              완료
            </span>
          )}
        </span>
        {errorCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: '1px 6px', borderRadius: 'var(--r-pill)',
            background: 'var(--danger)', color: '#fff',
          }}>{errorCount}개 실패</span>
        )}
        {doneCount > 0 && errorCount === 0 && active.length === 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            padding: '1px 6px', borderRadius: 'var(--r-pill)',
            background: 'var(--success)', color: '#fff',
          }}>{doneCount}개 완료</span>
        )}
        <span style={{ color: 'var(--ink-4)', fontSize: 11, marginLeft: 2 }}>
          {collapsed ? '▲' : '▼'}
        </span>
      </div>

      {/* 태스크 목록 */}
      {!collapsed && (
        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          {tasks.map((t) => (
            <div key={t.id} style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--line-2)',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StatusIcon status={t.status} />
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'var(--ink-2)',
                }} title={t.filename}>{t.filename}</span>
                {(t.status === 'done' || t.status === 'error') && (
                  <button type="button" onClick={() => removeTask(t.id)}
                    style={{ color: 'var(--ink-4)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
                )}
              </div>
              <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>{t.statusMsg}</div>
              {(t.status === 'uploading' || t.status === 'processing' || t.status === 'polling') && (
                <div style={{ height: 3, borderRadius: 2, background: 'var(--line-2)', overflow: 'hidden' }}>
                  {t.status === 'processing' || t.status === 'polling' ? (
                    // 서버 처리 중 — 인디케이터 애니메이션
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: 'var(--primary)',
                      width: '40%',
                      animation: 'progressPulse 1.5s ease-in-out infinite',
                    }} />
                  ) : (
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: 'var(--primary)',
                      width: `${Math.round((t.progress || 0) * 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }) {
  if (status === 'queued') return <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>⏳</span>;
  if (status === 'uploading') return <Spinner color="var(--primary)" />;
  if (status === 'processing' || status === 'polling') return <Spinner color="var(--success)" />;
  if (status === 'done') return <span style={{ color: 'var(--success)', fontSize: 13 }}>✓</span>;
  if (status === 'error') return <span style={{ color: 'var(--danger)', fontSize: 13 }}>✗</span>;
  return null;
}

function Spinner({ color }) {
  return (
    <span style={{
      display: 'inline-block',
      width: 12, height: 12,
      borderRadius: '50%',
      border: `2px solid ${color}33`,
      borderTopColor: color,
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

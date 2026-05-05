import { useMemo, useState } from 'react';
import { Btn, ColorBadge, Checkbox, Stepper } from '../atoms';
import { I } from '../atoms/Icons';
import { climbLogsApi } from '../../api/climbLogs';
import { COLOR_KEYS, colorMeta } from '../../utils/colors';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

/**
 * 기록 수정 모달.
 *  - climb_log:        memo, visited_at + 항목 (추가 / 완등 토글 / attempts / 영상 변경·제거 / 삭제) — 모두 [저장] 시 일괄 반영
 *  - training_session: memo, session_date, duration_minutes
 *
 * 저장 시 처리 순서:
 *   1) 기존 항목 삭제 → DELETE
 *   2) 신규 항목 추가 → POST (그리고 그 항목에 영상 첨부 시 video POST)
 *   3) 기존 항목 영상 변경/제거
 *   4) 기존 항목 attempts/is_cleared 변경 → PATCH
 *   5) 로그 본체 → onSubmit
 */
export default function RecordEditModal({ kind, logId, initial, onSubmit, onClose, onChanged }) {
  const [memo, setMemo] = useState(initial.memo || '');
  const [date, setDate] = useState(initial.date || '');
  const [duration, setDuration] = useState(initial.duration_minutes ?? '');
  const initialProblems = useMemo(() => (initial.problems || []).map((p) => ({
    ...p,
    _localKey: `id-${p.id}`,
    _origCleared: !!p.is_cleared,
    _origAttempts: Number(p.attempts || 1),
    _pendingDelete: false,
    _videoFile: null,
    _clearVideo: false,
    _isNew: false,
  })), [initial.problems]);
  const [problems, setProblems] = useState(initialProblems);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const dirty =
    memo !== (initial.memo || '') ||
    date !== (initial.date || '') ||
    String(duration) !== String(initial.duration_minutes ?? '') ||
    problems.some((p) =>
      p._isNew || p._pendingDelete || p._videoFile || p._clearVideo ||
      p.is_cleared !== p._origCleared ||
      Number(p.attempts || 1) !== p._origAttempts
    );

  function patchProblem(localKey, patch) {
    setProblems((arr) => arr.map((x) => x._localKey === localKey ? { ...x, ...patch } : x));
  }

  function addNewProblem() {
    setProblems((arr) => [...arr, {
      id: null,
      _localKey: `new-${Date.now()}-${Math.random()}`,
      _isNew: true,
      color: '', level: '',
      is_cleared: false,
      attempts: 1,
      _videoFile: null,
      _clearVideo: false,
      _pendingDelete: false,
      ar_route: null,
    }]);
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (kind === 'climb_log' && logId) {
        // 1) 기존 항목 삭제
        for (const p of problems.filter((x) => x._pendingDelete && x.id)) {
          await climbLogsApi.removeProblem(logId, p.id);
        }
        // 2) 신규 항목 추가 (필수: color 또는 level)
        for (const p of problems.filter((x) => x._isNew && !x._pendingDelete)) {
          if (!p.color && !p.level) continue;
          const r = await climbLogsApi.addProblem(logId, {
            color: p.color || null,
            level: p.level || null,
            is_cleared: !!p.is_cleared,
            attempts: Number(p.attempts || 1),
          });
          const newId = r.data?.id;
          if (newId && p._videoFile) {
            await climbLogsApi.uploadProblemVideo(logId, newId, p._videoFile);
          }
        }
        // 3) 기존 항목 영상 변경/제거
        for (const p of problems.filter((x) => !x._pendingDelete && !x._isNew && x.id)) {
          if (p._videoFile) {
            await climbLogsApi.uploadProblemVideo(logId, p.id, p._videoFile);
          } else if (p._clearVideo && p.ar_route) {
            await climbLogsApi.removeProblemVideo(logId, p.id);
          }
        }
        // 4) 기존 항목 attempts/is_cleared 변경
        for (const p of problems.filter((x) => !x._pendingDelete && !x._isNew && x.id)) {
          const updates = {};
          if (p.is_cleared !== p._origCleared) updates.is_cleared = p.is_cleared;
          if (Number(p.attempts || 1) !== p._origAttempts) updates.attempts = Number(p.attempts || 1);
          if (Object.keys(updates).length) {
            await climbLogsApi.updateProblem(logId, p.id, updates);
          }
        }
      }

      const payload = { memo, date };
      payload.duration_minutes = duration === '' ? null : Number(duration);
      await onSubmit(payload);
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          width: '100%', maxWidth: 480,
          borderTopLeftRadius: 'var(--r-lg)', borderTopRightRadius: 'var(--r-lg)',
          padding: 18, maxHeight: '85vh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>기록 수정</h3>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}>{I.x(18)}</button>
        </div>

        <label style={lbl}>날짜</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />

        <label style={lbl}>{kind === 'training_session' ? '훈련 시간(분)' : '운동 시간(분)'}</label>
        <input type="number" min="0" value={duration}
          onChange={(e) => setDuration(e.target.value)}
          placeholder="예: 60" style={inp} />

        <label style={lbl}>메모</label>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
          rows={3} placeholder="오늘의 운동 메모"
          style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />

        {kind === 'climb_log' && (
          <>
            <label style={lbl}>등록된 문제 ({problems.filter((p) => !p._pendingDelete).length})</label>
            <div style={{
              border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
              background: 'var(--surface-2)', padding: '4px 0',
            }}>
              {problems.length === 0 && (
                <div style={{ padding: '12px', fontSize: 12, color: 'var(--ink-4)', textAlign: 'center' }}>
                  아직 문제가 없습니다.
                </div>
              )}
              {problems.map((p, i) => (
                <ProblemRow
                  key={p._localKey}
                  problem={p}
                  isLast={i === problems.length - 1}
                  onPatch={(patch) => patchProblem(p._localKey, patch)}
                />
              ))}
            </div>
            <button
              onClick={addNewProblem}
              style={{
                marginTop: 8, width: '100%', padding: '10px',
                fontSize: 13, fontWeight: 600, color: 'var(--primary)',
                background: 'transparent',
                border: '1px dashed var(--primary)', borderRadius: 'var(--r-sm)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              {I.plus(14)} 문제 추가
            </button>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 6 }}>
              변경사항은 [저장] 클릭 시 적용됩니다.
            </div>
          </>
        )}

        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="ghost" full onClick={onClose}>취소</Btn>
          <Btn variant="primary" full disabled={saving || !dirty} onClick={handleSave}>
            {saving ? '저장 중...' : '저장'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function ProblemRow({ problem: p, isLast, onPatch }) {
  const fileInputId = `cp-video-${p._localKey}`;
  const hasExisting = !!p.ar_route && !p._clearVideo;
  const willUpload = !!p._videoFile;
  const willClear = p._clearVideo && !willUpload;

  if (p._pendingDelete) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px',
        borderBottom: isLast ? 'none' : '1px solid var(--line)',
        opacity: 0.55,
      }}>
        <ColorBadge color={p.color} level={p.level} size="sm" />
        <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>삭제 예정</span>
        <span style={{ flex: 1 }} />
        <button onClick={() => onPatch({ _pendingDelete: false })}
          style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>
          복원
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      padding: '10px 12px',
      borderBottom: isLast ? 'none' : '1px solid var(--line)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {p._isNew ? (
          <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>NEW</span>
        ) : (
          <ColorBadge color={p.color} level={p.level} size="sm" />
        )}
        <Checkbox
          checked={!!p.is_cleared}
          onClick={() => onPatch({ is_cleared: !p.is_cleared })}
          label="완등" tone="success"
        />
        {!p.is_cleared && (
          <span style={{ fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>실패</span>
        )}
        <span style={{ flex: 1 }} />
        <button onClick={() => onPatch({ _pendingDelete: true })}
          aria-label="항목 삭제"
          style={{ color: 'var(--ink-4)', padding: 4 }}>
          {I.trash(14)}
        </button>
      </div>

      {p._isNew && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <select value={p.color} onChange={(e) => onPatch({ color: e.target.value })}
            style={selectStyle}>
            <option value="">색상</option>
            {COLOR_KEYS.map((k) => <option key={k} value={k}>{colorMeta(k).kr} {colorMeta(k).label}</option>)}
          </select>
          <select value={p.level} onChange={(e) => onPatch({ level: e.target.value })}
            style={selectStyle}>
            <option value="">V등급</option>
            {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-3)' }}>
        <span>시도</span>
        <Stepper
          value={Number(p.attempts || 1)}
          onChange={(v) => onPatch({ attempts: v })}
          min={1}
        />
        <span>회</span>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        fontSize: 11, color: 'var(--ink-3)',
      }}>
        {willUpload ? (
          <>
            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{I.film(11)} 새 영상 첨부됨</span>
            <span style={{ color: 'var(--ink-4)' }}>
              {p._videoFile.name} ({Math.round(p._videoFile.size / 1024 / 1024 * 10) / 10}MB)
            </span>
            <button onClick={() => onPatch({ _videoFile: null })} style={linkBtnStyle('var(--ink-3)')}>취소</button>
          </>
        ) : willClear ? (
          <>
            <span style={{ color: 'var(--danger)', fontWeight: 600 }}>영상 제거 예정</span>
            <button onClick={() => onPatch({ _clearVideo: false })} style={linkBtnStyle('var(--ink-3)')}>취소</button>
          </>
        ) : hasExisting ? (
          <>
            <span style={{ color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {I.film(11)} 영상 있음
            </span>
            <label htmlFor={fileInputId} style={linkBtnStyle()}>변경</label>
            <button onClick={() => onPatch({ _clearVideo: true })} style={linkBtnStyle('var(--danger)')}>제거</button>
          </>
        ) : (
          <label htmlFor={fileInputId} style={linkBtnStyle()}>{I.film(11)} 영상 추가</label>
        )}
        <input
          id={fileInputId}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPatch({ _videoFile: f, _clearVideo: false });
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

const lbl = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', margin: '10px 0 6px' };
const inp = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface-2)', color: 'var(--ink-1)',
};
const selectStyle = {
  padding: '8px 10px', fontSize: 13,
  borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
  background: 'var(--surface)', color: 'var(--ink-1)',
};
function linkBtnStyle(color = 'var(--primary)') {
  return {
    fontSize: 11, color, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'underline',
    background: 'transparent', border: 'none', padding: 0,
    display: 'inline-flex', alignItems: 'center', gap: 3,
  };
}

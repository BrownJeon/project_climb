import { useEffect, useMemo, useState } from 'react';
import { Btn, ColorBadge } from '../atoms';
import { COLOR_KEYS, COLORS } from '../../utils/colors';
import { gymsApi } from '../../api/gyms';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

export default function ProblemAddModal({ gymId, onClose, onSaved }) {
  const [color, setColor] = useState('');
  const [level, setLevel] = useState('');
  const [userOverride, setUserOverride] = useState(false);
  const [problems, setProblems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // 동일 암장의 모든 problems 가져와서 클라이언트에서 색상별 V등급 추천
  useEffect(() => {
    if (!gymId) return;
    gymsApi.problems(gymId).then((r) => setProblems(r.data?.problems || [])).catch(() => {});
  }, [gymId]);

  const suggestedLevel = useMemo(() => {
    if (!color) return '';
    const same = problems.filter((p) => p.color === color && p.level);
    if (!same.length) return '';
    // 빈도 가장 높은 level 우선, 동률이면 최신
    const counts = {};
    same.forEach((p) => { counts[p.level] = (counts[p.level] || 0) + 1; });
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? best[0] : '';
  }, [color, problems]);

  // 색상 변경 시 자동 추천 적용 (사용자 override 전이면)
  useEffect(() => {
    if (!userOverride) setLevel(suggestedLevel || '');
  }, [suggestedLevel, userOverride]);

  const canSubmit = !!color && !!level;

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const res = await gymsApi.addProblem(gymId, { color, level });
      onSaved?.(res.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || '저장 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <div style={headerStyle}>
          <button onClick={submit} disabled={!canSubmit || submitting}
            style={{ fontSize: 14, fontWeight: 700, color: canSubmit ? 'var(--primary)' : 'var(--ink-4)' }}>
            {submitting ? '저장 중...' : '저장'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>새 문제 등록</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="색상" required>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {COLOR_KEYS.map((k) => (
                <button key={k} type="button"
                  onClick={() => { setColor(k); setUserOverride(false); }}
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: COLORS[k].dot,
                    border: color === k ? '2.5px solid var(--ink-1)' : '1.5px solid var(--line-2)',
                    cursor: 'pointer',
                  }} title={COLORS[k].label} />
              ))}
            </div>
          </Field>

          <Field label="V등급" required>
            <select value={level}
              onChange={(e) => { setLevel(e.target.value); setUserOverride(true); }}
              style={inputStyle}>
              <option value="">선택하세요</option>
              {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            {color && suggestedLevel && !userOverride && (
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                💡 동일 암장의 같은 색상 {suggestedLevel} 자동 추천 (수정 가능)
              </div>
            )}
            {color && !suggestedLevel && (
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                동일 암장에 같은 색상 등록 이력이 없어 직접 선택해주세요.
              </div>
            )}
          </Field>

          {(color || level) && (
            <div style={{
              padding: '10px 12px', background: 'var(--surface)', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 600 }}>미리보기</span>
              <ColorBadge color={color} level={level} />
            </div>
          )}

          <Btn full disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? '저장 중...' : '등록'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300,
};
const sheetStyle = {
  background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w)', maxHeight: '90%',
  borderRadius: '24px 24px 0 0', overflow: 'auto',
  display: 'flex', flexDirection: 'column',
  animation: 'sheetUp 280ms cubic-bezier(.32,.72,0,1)',
};
const headerStyle = {
  padding: '12px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'var(--surface)', borderBottom: '1px solid var(--line)',
  position: 'sticky', top: 0, zIndex: 2,
};
const errorStyle = { padding: '10px 16px', background: 'var(--danger)', color: '#fff', fontSize: 12 };
const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--ink-1)', outline: 'none',
};

function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

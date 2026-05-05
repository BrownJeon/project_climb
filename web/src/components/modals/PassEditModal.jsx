import { useState } from 'react';
import { Btn } from '../atoms';
import { passesApi } from '../../api/passes';

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function PassEditModal({ pass, onClose, onSaved }) {
  const isPeriod = pass.pass_type === 'period';

  const [label, setLabel] = useState(pass.label || '');
  const [startDate, setStartDate] = useState(pass.start_date || '');
  const [endDate, setEndDate] = useState(pass.end_date || '');
  const [totalCount, setTotalCount] = useState(pass.total_count ?? 0);
  const [remainingCount, setRemainingCount] = useState(pass.remaining_count ?? 0);
  const [hasExpiry, setHasExpiry] = useState(!!pass.end_date);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = isPeriod
    ? !!startDate && !!endDate
    : Number(totalCount) > 0 && Number(remainingCount) >= 0 && Number(remainingCount) <= Number(totalCount);

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const body = { label: label.trim() || null };
      if (isPeriod) {
        body.start_date = startDate;
        body.end_date = endDate;
      } else {
        body.total_count = Number(totalCount);
        body.remaining_count = Number(remainingCount);
        body.end_date = hasExpiry ? endDate : null;
      }
      const res = await passesApi.update(pass.id, body);
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
          <span style={{ fontSize: 15, fontWeight: 700 }}>이용권 수정</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            {pass.gym_name} · {isPeriod ? '정기권' : '횟수권'}
          </div>

          <Field label="라벨">
            <input value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder={isPeriod ? '예: 1개월권' : '예: 10회권'}
              style={inputStyle} />
          </Field>

          {isPeriod ? (
            <>
              <Field label="시작일" required>
                <input type="date" value={startDate || ''} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="만료일" required>
                <input type="date" value={endDate || ''} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
              </Field>
            </>
          ) : (
            <>
              <Field label="총 횟수" required>
                <input type="number" min={1} value={totalCount}
                  onChange={(e) => setTotalCount(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="잔여 횟수" required>
                <input type="number" min={0} max={totalCount} value={remainingCount}
                  onChange={(e) => setRemainingCount(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="만료일">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
                  <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
                  만료일 설정 (체크 안 하면 무기한)
                </label>
                {hasExpiry && (
                  <input type="date" value={endDate || ''}
                    min={todayISO()}
                    onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
                )}
              </Field>
            </>
          )}
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

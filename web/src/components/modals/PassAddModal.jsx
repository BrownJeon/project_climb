import { useEffect, useMemo, useState } from 'react';
import { Btn, RadioOpt } from '../atoms';
import { gymsApi } from '../../api/gyms';
import { passesApi } from '../../api/passes';
import useBackHandler from '../../native/useBackHandler';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function plusDaysISO(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function addMonthsISO(dateStr, months) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  // 만료일은 마지막 날 -1 (예: 1/15 시작 → 2/14 만료)
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const PERIOD_MONTHS = [
  [1, '1개월'],
  [3, '3개월'],
  [6, '6개월'],
];

export default function PassAddModal({ onClose, onSaved }) {
  useBackHandler(true, onClose);
  const [passType, setPassType] = useState('period'); // 'period' | 'count'
  const [gymId, setGymId] = useState('');
  const [gyms, setGyms] = useState([]);
  const [periodMonths, setPeriodMonths] = useState(1);
  const [startDate, setStartDate] = useState(todayISO());
  const [countLabel, setCountLabel] = useState('');
  const [totalCount, setTotalCount] = useState(10);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [countEndDate, setCountEndDate] = useState(plusDaysISO(30));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    gymsApi.list({ limit: 200 }).then((r) => setGyms(r.data?.gyms || [])).catch(() => {});
  }, []);

  const periodEndDate = useMemo(() => addMonthsISO(startDate, periodMonths), [startDate, periodMonths]);

  const canSubmit = !!gymId &&
    (passType === 'period'
      ? !!startDate && !!periodEndDate && !!periodMonths
      : Number(totalCount) > 0);

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const body = { gym_id: Number(gymId), pass_type: passType };
      if (passType === 'period') {
        body.start_date = startDate;
        body.end_date = periodEndDate;
        body.label = `${periodMonths}개월권`;
      } else {
        body.total_count = Number(totalCount);
        body.label = countLabel.trim() || null;
        if (hasExpiry && countEndDate) body.end_date = countEndDate;
      }
      const res = await passesApi.create(body);
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
          <span style={{ fontSize: 15, fontWeight: 700 }}>이용권 등록</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="유형" required>
            <div style={{ display: 'flex', gap: 8 }}>
              <RadioOpt checked={passType === 'period'} onClick={() => setPassType('period')} label="정기권" />
              <RadioOpt checked={passType === 'count'} onClick={() => setPassType('count')} label="횟수권" />
            </div>
          </Field>

          <Field label="암장 (브랜드 기준)" required>
            <select value={gymId} onChange={(e) => setGymId(e.target.value)} style={inputStyle}>
              <option value="">선택하세요</option>
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.brand || g.name}{g.branch ? ` · ${g.branch}` : ''}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
              이 이용권은 같은 브랜드의 모든 지점에서 사용됩니다.
            </div>
          </Field>

          {passType === 'period' ? (
            <>
              <Field label="기간" required>
                <select value={periodMonths} onChange={(e) => setPeriodMonths(Number(e.target.value))}
                  style={inputStyle}>
                  {PERIOD_MONTHS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="시작일" required>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="만료일 (자동)">
                <input type="date" value={periodEndDate} readOnly tabIndex={-1}
                  style={{ ...inputStyle, background: 'var(--surface-2)', color: 'var(--ink-2)', cursor: 'default' }} />
              </Field>
            </>
          ) : (
            <>
              <Field label="라벨 (선택)">
                <input value={countLabel} onChange={(e) => setCountLabel(e.target.value)}
                  placeholder="예: 10회권" style={inputStyle} />
              </Field>
              <Field label="총 횟수" required>
                <input type="number" min={1} value={totalCount}
                  onChange={(e) => setTotalCount(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="만료일">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-2)', marginBottom: 6 }}>
                  <input type="checkbox" checked={hasExpiry} onChange={(e) => setHasExpiry(e.target.checked)} />
                  만료일 설정 (체크 안 하면 무기한)
                </label>
                {hasExpiry && (
                  <input type="date" value={countEndDate}
                    min={todayISO()}
                    onChange={(e) => setCountEndDate(e.target.value)} style={inputStyle} />
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

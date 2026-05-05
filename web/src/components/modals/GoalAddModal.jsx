import { useState } from 'react';
import { Btn } from '../atoms';
import { trainingApi } from '../../api/training';
import { COLOR_KEYS, colorMeta } from '../../utils/colors';

const CATEGORIES = [
  ['bouldering',   '볼더링'],
  ['endurance',    '지구력'],
  ['conditioning', '컨디셔닝'],
  ['general',      '기타'],
];

const YDS_LEVELS = [
  '5.7', '5.8', '5.9',
  '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
];

/**
 * 카테고리별 측정 기준 매핑 (기존 metric_label / target_value / current_value 재사용):
 *   볼더링       : metric_label = V등급, target_value = 완등 개수, current_value = 현재 완등
 *   지구력       : metric_label = 5.x 등급
 *   컨디셔닝     : metric_label = 트레이닝 종목, target_value = 목표 횟수, current_value = 현재 횟수
 *   기타         : description = 자유 입력
 */
export default function GoalAddModal({ goal, onClose, onSaved, onDeleted }) {
  const isEdit = !!goal;
  const [title, setTitle] = useState(goal?.title || '');
  const [category, setCategory] = useState(goal?.category || 'bouldering');
  const [description, setDescription] = useState(goal?.description || '');
  const [metricLabel, setMetricLabel] = useState(goal?.metric_label || '');
  const [currentMetricLabel, setCurrentMetricLabel] = useState(goal?.current_metric_label || '');
  const [targetValue, setTargetValue] = useState(goal?.target_value ?? '');
  const [currentValue, setCurrentValue] = useState(goal?.current_value ?? '');
  const [targetDate, setTargetDate] = useState(goal?.target_date || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = !!title.trim() && !!category;

  function handleCategoryChange(next) {
    setCategory(next);
    // 카테고리 변경 시 잔여 값 정리 (사용자 혼선 방지)
    setMetricLabel('');
    setCurrentMetricLabel('');
    setTargetValue('');
    setCurrentValue('');
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      const body = {
        title: title.trim(), category,
        description: description.trim() || null,
        metric_label: metricLabel.trim() || null,
        current_metric_label: currentMetricLabel.trim() || null,
        target_value: targetValue !== '' && targetValue !== null ? Number(targetValue) : null,
        current_value: currentValue !== '' && currentValue !== null ? Number(currentValue) : null,
        target_date: targetDate || null,
      };
      const res = isEdit
        ? await trainingApi.updateGoal(goal.id, body)
        : await trainingApi.createGoal(body);
      onSaved?.(res.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || '저장 실패');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || submitting) return;
    if (!confirm('이 목표를 삭제하시겠어요? 되돌릴 수 없습니다.')) return;
    setError(null); setSubmitting(true);
    try {
      await trainingApi.deleteGoal(goal.id);
      onDeleted?.(goal.id);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || '삭제 실패');
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
          <span style={{ fontSize: 15, fontWeight: 700 }}>{isEdit ? '목표 수정' : '새 목표'}</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && <div style={errorStyle}>{error}</div>}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="목표 제목" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예: V5 완등하기" style={inputStyle} />
          </Field>
          <Field label="카테고리" required>
            <select value={category} onChange={(e) => handleCategoryChange(e.target.value)} style={inputStyle}>
              {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>

          {/* 카테고리별 측정 기준 */}
          {category === 'bouldering' && (
            <>
              <Field label="목표 난이도 (색깔)">
                <select value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} style={inputStyle}>
                  <option value="">선택</option>
                  {COLOR_KEYS.map((k) => {
                    const m = colorMeta(k);
                    return <option key={k} value={k}>{m.kr} {m.label}</option>;
                  })}
                </select>
              </Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="현재 완등 개수">
                  <input type="number" min="0" value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="목표 완등 개수">
                  <input type="number" min="0" value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {category === 'endurance' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Field label="현재 난이도 (5.x)">
                <select value={currentMetricLabel} onChange={(e) => setCurrentMetricLabel(e.target.value)} style={inputStyle}>
                  <option value="">선택</option>
                  {YDS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
              <Field label="목표 난이도 (5.x)">
                <select value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} style={inputStyle}>
                  <option value="">선택</option>
                  {YDS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
            </div>
          )}

          {category === 'conditioning' && (
            <>
              <Field label="트레이닝 종목">
                <input value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)}
                  placeholder="예: 푸시업 / 행오프 / 캠퍼스 보드"
                  style={inputStyle} />
              </Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="현재 횟수">
                  <input type="number" min="0" value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)} style={inputStyle} />
                </Field>
                <Field label="목표 횟수">
                  <input type="number" min="0" value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)} style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {category === 'general' && (
            <Field label="목표 내용 (자유 입력)">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                placeholder="자유롭게 목표 내용을 적어주세요"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
          )}

          {/* 기타 카테고리는 description을 본문으로 사용. 그 외 카테고리에서는 옵션 메모로 노출 */}
          {category !== 'general' && (
            <Field label="메모 (선택)">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                placeholder="간단한 설명 / 보조 메모"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
            </Field>
          )}

          <Field label="목표 마감일">
            <input type="date" value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)} style={inputStyle} />
          </Field>

          {isEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="danger" full disabled={submitting} onClick={handleDelete}>삭제</Btn>
              <Btn variant="primary" full disabled={!canSubmit || submitting} onClick={submit}>
                {submitting ? '저장 중...' : '저장'}
              </Btn>
            </div>
          ) : (
            <Btn full disabled={!canSubmit || submitting} onClick={submit}>
              {submitting ? '저장 중...' : '등록'}
            </Btn>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)' }}>
        {label}{required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

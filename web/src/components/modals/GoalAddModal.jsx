import { useEffect, useState } from 'react';
import { Btn } from '../atoms';
import { trainingApi } from '../../api/training';
import { gymsApi } from '../../api/gyms';
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
const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

/**
 * 카테고리별 측정 기준 매핑 (기존 metric_label / target_value / current_value 재사용):
 *   볼더링       : metric_label = V등급, target_value = 완등 개수, current_value = 현재 완등
 *   지구력       : metric_label = 5.x 등급
 *   컨디셔닝     : metric_label = 트레이닝 종목, target_value = 목표 횟수, current_value = 현재 횟수
 *   기타         : description = 자유 입력
 */
// 컨디셔닝용: metric_label "푸시업 (회)" → {base:'푸시업', unit:'count'}
function parseConditioningLabel(label) {
  if (!label) return { base: '', unit: 'count' };
  const m = label.match(/^(.*)\s*\((회|초)\)\s*$/);
  if (m) return { base: m[1].trim(), unit: m[2] === '초' ? 'time' : 'count' };
  return { base: label, unit: 'count' };
}

export default function GoalAddModal({ goal, onClose, onSaved, onDeleted }) {
  const isEdit = !!goal;
  const [title, setTitle] = useState(goal?.title || '');
  const [category, setCategory] = useState(goal?.category || 'bouldering');
  const [description, setDescription] = useState(goal?.description || '');
  const [metricLabel, setMetricLabel] = useState(goal?.metric_label || '');
  const [currentMetricLabel, setCurrentMetricLabel] = useState(goal?.current_metric_label || '');
  // DB DECIMAL → "1.00" 형태로 오므로 정수로 정리
  const intStr = (v) => (v == null || v === '') ? '' : String(parseInt(v, 10) || 0);
  const [targetValue, setTargetValue] = useState(intStr(goal?.target_value));
  const [currentValue, setCurrentValue] = useState(intStr(goal?.current_value));
  const [startDate, setStartDate] = useState(goal?.start_date || '');
  const [targetDate, setTargetDate] = useState(goal?.target_date || '');
  // 컨디셔닝 — 측정 단위(count=회, time=초). 종목명은 condBase로 분리 관리.
  const initCond = goal?.category === 'conditioning'
    ? parseConditioningLabel(goal?.metric_label)
    : { base: '', unit: 'count' };
  const [condBase, setCondBase] = useState(initCond.base);
  const [condUnit, setCondUnit] = useState(initCond.unit); // 'count' | 'time'
  // 기타 외 모든 카테고리는 자동 동기화 강제
  const autoSync = true;
  // 볼더링 — 암장/브랜드/V등급 한정
  // gymScope: 'all' | 'gym' | 'brand'
  const initScope = goal?.target_gym_id ? 'gym' : (goal?.target_brand ? 'brand' : 'all');
  const [gymScope, setGymScope] = useState(initScope);
  const [targetGymId, setTargetGymId] = useState(goal?.target_gym_id || '');
  const [targetBrand, setTargetBrand] = useState(goal?.target_brand || '');
  const [targetLevel, setTargetLevel] = useState(goal?.target_level || '');
  const [gyms, setGyms] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    gymsApi.list({ limit: 200 }).then((r) => setGyms(r.data?.gyms || [])).catch(() => {});
  }, []);

  // 자동 제목 제안 — 볼더링 한정
  function buildSuggestedTitle() {
    if (category !== 'bouldering') return '';
    const m = colorMeta(metricLabel);
    let scope = '';
    if (gymScope === 'gym' && targetGymId) {
      const g = gyms.find((x) => String(x.id) === String(targetGymId));
      if (g) scope = g.name;
    } else if (gymScope === 'brand' && targetBrand) {
      scope = targetBrand;
    }
    const parts = [];
    if (scope) parts.push(scope);
    if (metricLabel) parts.push(`${m.label || metricLabel}${m.kr || ''}`);
    if (targetLevel) parts.push(targetLevel);
    if (targetValue) parts.push(`${targetValue}개`);
    parts.push('클리어');
    return parts.join(' ');
  }
  const brandList = Array.from(new Set(gyms.map((g) => g.brand).filter(Boolean)));

  const canSubmit = !!title.trim() && !!category;

  function handleCategoryChange(next) {
    setCategory(next);
    // 카테고리 변경 시 잔여 값 정리 (사용자 혼선 방지)
    setMetricLabel('');
    setCurrentMetricLabel('');
    setTargetValue('');
    setCurrentValue('');
    setCondBase('');
    setCondUnit('count');
    setGymScope('all');
    setTargetGymId('');
    setTargetBrand('');
    setTargetLevel('');
  }

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);
    try {
      // conditioning: 종목 + 단위(회/초) 결합
      let outMetricLabel = metricLabel.trim() || null;
      if (category === 'conditioning') {
        const base = condBase.trim();
        outMetricLabel = base ? `${base} (${condUnit === 'time' ? '초' : '회'})` : null;
      }
      const body = {
        title: title.trim(), category,
        description: description.trim() || null,
        metric_label: outMetricLabel,
        current_metric_label: currentMetricLabel.trim() || null,
        target_value: targetValue !== '' && targetValue !== null ? Number(targetValue) : null,
        current_value: currentValue !== '' && currentValue !== null ? Number(currentValue) : null,
        start_date: startDate || null,
        target_date: targetDate || null,
        auto_sync: autoSync,
      };
      if (category === 'bouldering') {
        body.target_gym_id = gymScope === 'gym' && targetGymId ? Number(targetGymId) : null;
        body.target_brand = gymScope === 'brand' && targetBrand ? targetBrand : null;
        body.target_level = targetLevel || null;
      } else {
        body.target_gym_id = null; body.target_brand = null; body.target_level = null;
      }
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

          {category !== 'general' && (
            <div style={{
              padding: '8px 12px', borderRadius: 'var(--r-sm)',
              background: 'var(--primary-soft)', border: '1px solid var(--primary-line)',
              fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5,
            }}>
              {category === 'bouldering' && '같은 색상·V등급의 완등 횟수가 운동 기록에서 자동으로 합산됩니다.'}
              {category === 'endurance' && '같은 난이도의 지구력 완등 횟수(sets=1)가 운동 기록에서 자동으로 합산됩니다.'}
              {category === 'conditioning' && '같은 종목·단위의 운동 기록 최댓값이 자동으로 갱신됩니다.'}
            </div>
          )}

          {/* 카테고리별 측정 기준 */}
          {category === 'bouldering' && (
            <>
              <Field label="대상 암장">
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {[['all', '전체 암장'], ['gym', '특정 지점'], ['brand', '같은 브랜드']].map(([k, l]) => {
                    const active = gymScope === k;
                    return (
                      <button key={k} type="button" onClick={() => setGymScope(k)}
                        style={{
                          flex: 1, padding: '7px 10px', borderRadius: 'var(--r-sm)',
                          border: '1px solid ' + (active ? 'var(--primary)' : 'var(--line-2)'),
                          background: active ? 'var(--primary-soft)' : 'var(--surface)',
                          color: active ? 'var(--primary-ink)' : 'var(--ink-2)',
                          fontWeight: active ? 700 : 500, fontSize: 12,
                        }}>{l}</button>
                    );
                  })}
                </div>
                {gymScope === 'gym' && (
                  <select value={targetGymId} onChange={(e) => setTargetGymId(e.target.value)} style={inputStyle}>
                    <option value="">암장 선택</option>
                    {gyms.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.brand || g.name}{g.branch ? ` · ${g.branch}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {gymScope === 'brand' && (
                  <select value={targetBrand} onChange={(e) => setTargetBrand(e.target.value)} style={inputStyle}>
                    <option value="">브랜드 선택</option>
                    {brandList.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
              </Field>

              <Field label="목표 난이도 (색깔)">
                <select value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} style={inputStyle}>
                  <option value="">선택</option>
                  {COLOR_KEYS.map((k) => {
                    const m = colorMeta(k);
                    return <option key={k} value={k}>{m.kr} {m.label}</option>;
                  })}
                </select>
              </Field>
              <Field label="V등급 (선택)">
                <select value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)} style={inputStyle}>
                  <option value="">전체</option>
                  {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
                  비워두면 색상만 매칭. 같은 색상이라도 V등급이 다른 문제는 모두 합산됩니다.
                </div>
              </Field>

              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="현재 완등 개수">
                  <input type="number" min="0" step="1" inputMode="numeric" pattern="[0-9]*"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value.replace(/[^\d]/g, ''))}
                    style={inputStyle} />
                </Field>
                <Field label="목표 완등 개수">
                  <input type="number" min="0" step="1" inputMode="numeric" pattern="[0-9]*"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value.replace(/[^\d]/g, ''))}
                    style={inputStyle} />
                </Field>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>제안:</span>
                <span style={{ fontSize: 12, color: 'var(--ink-1)', fontWeight: 600 }}>
                  {buildSuggestedTitle()}
                </span>
                <button type="button" onClick={() => setTitle(buildSuggestedTitle())}
                  style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                    padding: '4px 9px', borderRadius: 'var(--r-pill)',
                    border: '1px solid var(--line-2)', background: 'var(--surface)',
                    color: 'var(--primary)',
                  }}>제목 자동 채우기</button>
              </div>
            </>
          )}

          {category === 'endurance' && (
            <>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="현재 난이도 (선택)">
                  <select value={currentMetricLabel} onChange={(e) => setCurrentMetricLabel(e.target.value)} style={inputStyle}>
                    <option value="">선택</option>
                    {YDS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field label="목표 난이도 (5.x)" required>
                  <select value={metricLabel} onChange={(e) => setMetricLabel(e.target.value)} style={inputStyle}>
                    <option value="">선택</option>
                    {YDS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label="현재 완등 횟수">
                  <input type="number" min="0" step="1" inputMode="numeric" pattern="[0-9]*"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="자동 집계"
                    style={{ ...inputStyle, color: 'var(--ink-3)' }} />
                </Field>
                <Field label="목표 완등 횟수">
                  <input type="number" min="1" step="1" inputMode="numeric" pattern="[0-9]*"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="예: 5"
                    style={inputStyle} />
                </Field>
              </div>
            </>
          )}

          {category === 'conditioning' && (
            <>
              <Field label="측정 유형">
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => setCondUnit('count')}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 'var(--r-sm)',
                      border: '1px solid ' + (condUnit === 'count' ? 'var(--primary)' : 'var(--line-2)'),
                      background: condUnit === 'count' ? 'var(--primary-soft)' : 'var(--surface)',
                      color: condUnit === 'count' ? 'var(--primary-ink)' : 'var(--ink-2)',
                      fontWeight: condUnit === 'count' ? 700 : 500, fontSize: 13,
                    }}>횟수 (회)</button>
                  <button type="button" onClick={() => setCondUnit('time')}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 'var(--r-sm)',
                      border: '1px solid ' + (condUnit === 'time' ? 'var(--primary)' : 'var(--line-2)'),
                      background: condUnit === 'time' ? 'var(--primary-soft)' : 'var(--surface)',
                      color: condUnit === 'time' ? 'var(--primary-ink)' : 'var(--ink-2)',
                      fontWeight: condUnit === 'time' ? 700 : 500, fontSize: 13,
                    }}>시간 (초)</button>
                </div>
              </Field>
              <Field label="트레이닝 종목">
                <input value={condBase} onChange={(e) => setCondBase(e.target.value)}
                  placeholder={condUnit === 'time' ? '예: 행오프 / 데드행 / 플랭크' : '예: 푸시업 / 풀업 / 캠퍼스 보드'}
                  style={inputStyle} />
              </Field>
              <div style={{ display: 'flex', gap: 8 }}>
                <Field label={condUnit === 'time' ? '현재 시간 (초)' : '현재 횟수 (회)'}>
                  <input type="number" min="0" step="1" inputMode="numeric" pattern="[0-9]*"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value.replace(/[^\d]/g, ''))}
                    style={inputStyle} />
                </Field>
                <Field label={condUnit === 'time' ? '목표 시간 (초)' : '목표 횟수 (회)'}>
                  <input type="number" min="0" step="1" inputMode="numeric" pattern="[0-9]*"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value.replace(/[^\d]/g, ''))}
                    style={inputStyle} />
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

          <div style={{ display: 'flex', gap: 8 }}>
            <Field label="시작 목표일">
              <input type="date" value={startDate}
                onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="목표 마감일">
              <input type="date" value={targetDate}
                min={startDate || undefined}
                onChange={(e) => setTargetDate(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          {isEdit ? (
            <Btn variant="danger" full disabled={submitting} onClick={handleDelete}>삭제</Btn>
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

import { COLOR_KEYS, colorMeta } from '../utils/colors';
import TimeRangeField from './TimeRangeField';

export const TRAINING_CATEGORIES = [
  ['bouldering',   '볼더링'],
  ['endurance',    '지구력'],
  ['conditioning', '컨디셔닝'],
  ['general',      '기타'],
];

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
const YDS_LEVELS = [
  '5.7', '5.8', '5.9',
  '5.10a', '5.10b', '5.10c', '5.10d',
  '5.11a', '5.11b', '5.11c', '5.11d',
];

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--ink-1)', outline: 'none',
};

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4 };

/**
 * 훈련 항목 측정 필드 (목표 등록과 동일 구성)
 * row 모델:
 *  { category, exercise_color, exercise_level,
 *    endurance_level, endurance_cleared, endurance_attempts,
 *    cond_unit, cond_base, value, duration_minutes, memo }
 *
 * onPatch(partial)로 부분 업데이트.
 */
export default function TrainingItemFields({ row, onPatch }) {
  const cat = row.category || 'general';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <div style={labelStyle}>카테고리</div>
        <select value={cat} onChange={(e) => onPatch({ category: e.target.value })}
          style={inputStyle}>
          {TRAINING_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {cat === 'bouldering' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={labelStyle}>색상</div>
              <select value={row.exercise_color || ''}
                onChange={(e) => onPatch({ exercise_color: e.target.value })} style={inputStyle}>
                <option value="">선택</option>
                {COLOR_KEYS.map((k) => {
                  const m = colorMeta(k);
                  return <option key={k} value={k}>{m.kr} {m.label}</option>;
                })}
              </select>
            </div>
            <div>
              <div style={labelStyle}>V등급</div>
              <select value={row.exercise_level || ''}
                onChange={(e) => onPatch({ exercise_level: e.target.value })} style={inputStyle}>
                <option value="">선택</option>
                {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div style={labelStyle}>완등 개수 (회)</div>
            <input type="number" min="0" step="1" inputMode="numeric"
              value={row.value ?? ''}
              onChange={(e) => onPatch({ value: e.target.value.replace(/[^\d]/g, '') })}
              style={inputStyle} />
          </div>
        </>
      )}

      {cat === 'endurance' && (
        <>
          <div>
            <div style={labelStyle}>난이도 (5.x)</div>
            <select value={row.endurance_level || ''}
              onChange={(e) => onPatch({ endurance_level: e.target.value })} style={inputStyle}>
              <option value="">선택</option>
              {YDS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>완등 여부</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['true', '완등 ✓'], ['false', '미완등']].map(([k, l]) => {
                const active = String(row.endurance_cleared ?? false) === k;
                const isCleared = k === 'true';
                return (
                  <button key={k} type="button"
                    onClick={() => onPatch({ endurance_cleared: isCleared })}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 'var(--r-sm)',
                      border: '1px solid ' + (active ? (isCleared ? 'var(--success)' : 'var(--danger)') : 'var(--line-2)'),
                      background: active ? (isCleared ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.10)') : 'var(--surface)',
                      color: active ? (isCleared ? 'var(--success)' : 'var(--danger)') : 'var(--ink-2)',
                      fontWeight: active ? 700 : 500, fontSize: 12,
                    }}>{l}</button>
                );
              })}
            </div>
          </div>
          <div>
            <div style={labelStyle}>시도 횟수 (회)</div>
            <input type="number" min="0" step="1" inputMode="numeric"
              value={row.endurance_attempts ?? ''}
              onChange={(e) => onPatch({ endurance_attempts: e.target.value.replace(/[^\d]/g, '') })}
              style={inputStyle} />
          </div>
        </>
      )}

      {cat === 'conditioning' && (
        <>
          <div>
            <div style={labelStyle}>측정 유형</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['count', '횟수 (회)'], ['time', '시간 (초)']].map(([k, l]) => {
                const active = (row.cond_unit || 'count') === k;
                return (
                  <button key={k} type="button" onClick={() => onPatch({ cond_unit: k })}
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
          </div>
          <div>
            <div style={labelStyle}>트레이닝 종목</div>
            <input value={row.cond_base || ''}
              onChange={(e) => onPatch({ cond_base: e.target.value })}
              placeholder={(row.cond_unit || 'count') === 'time' ? '예: 행오프 / 데드행' : '예: 푸시업 / 풀업'}
              style={inputStyle} />
          </div>
          <div>
            <div style={labelStyle}>{(row.cond_unit || 'count') === 'time' ? '값 (초)' : '값 (회)'}</div>
            <input type="number" min="0" step="1" inputMode="numeric"
              value={row.value ?? ''}
              onChange={(e) => onPatch({ value: e.target.value.replace(/[^\d]/g, '') })}
              style={inputStyle} />
          </div>
        </>
      )}

      {cat === 'general' && (
        <div>
          <div style={labelStyle}>내용 (자유 입력)</div>
          <textarea value={row.memo || ''}
            onChange={(e) => onPatch({ memo: e.target.value })} rows={3}
            placeholder="자유롭게 훈련 내용을 적어주세요"
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
      )}

      {cat !== 'general' && cat !== 'endurance' && (
        <div>
          <div style={labelStyle}>운동 시간 (시작 ~ 종료, 선택)</div>
          <TimeRangeField compact
            start={row.start_time} end={row.end_time}
            onChange={(p) => onPatch({
              start_time: p.start_time, end_time: p.end_time,
              duration_minutes: p.duration_minutes != null ? String(p.duration_minutes) : (row.duration_minutes ?? ''),
            })} />
        </div>
      )}
      {cat !== 'general' && (
        <div>
          <div style={labelStyle}>메모 (선택)</div>
          <input value={row.memo || ''}
            onChange={(e) => onPatch({ memo: e.target.value })}
            placeholder="간단한 메모"
            style={inputStyle} />
        </div>
      )}
    </div>
  );
}

/**
 * row → backend training[] 항목으로 변환
 */
export function rowToTrainingPayload(row) {
  const cat = row.category || 'general';
  const items = [];
  if (cat === 'bouldering' && (row.exercise_color || row.exercise_level)) {
    const m = colorMeta(row.exercise_color);
    items.push({
      exercise_name: `${m.label || row.exercise_color || ''}${m.kr || ''} ${row.exercise_level || ''}`.trim() || '볼더링',
      reps_or_seconds: row.value ? Number(row.value) : null,
      metric_unit: row.value ? '회' : null,
      notes: null,
    });
  } else if (cat === 'endurance' && row.endurance_level) {
    items.push({
      exercise_name: `지구력 등반 (${row.endurance_level})`,
      sets: row.endurance_cleared ? 1 : 0,
      reps_or_seconds: row.endurance_attempts ? Number(row.endurance_attempts) : null,
      metric_unit: '회',
      notes: null,
    });
  } else if (cat === 'conditioning' && row.cond_base) {
    items.push({
      exercise_name: row.cond_base,
      reps_or_seconds: row.value ? Number(row.value) : null,
      metric_unit: (row.cond_unit || 'count') === 'time' ? '초' : '회',
      notes: null,
    });
  }
  return {
    category: cat,
    duration_minutes: cat === 'endurance' ? null : (row.duration_minutes ? Number(row.duration_minutes) : null),
    start_time: cat === 'endurance' ? null : (row.start_time || null),
    end_time: cat === 'endurance' ? null : (row.end_time || null),
    memo: row.memo || null,
    items,
  };
}

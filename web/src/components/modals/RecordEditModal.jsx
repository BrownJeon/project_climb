import { useMemo, useState } from 'react';
import { Btn, ColorBadge } from '../atoms';
import { I } from '../atoms/Icons';
import { climbLogsApi } from '../../api/climbLogs';
import { trainingApi } from '../../api/training';
import { COLOR_KEYS, colorMeta, fmtRouteTitle } from '../../utils/colors';
import TrainingItemFields, { rowToTrainingPayload, TRAINING_CATEGORIES } from '../TrainingItemFields';
import TimeRangeField from '../TimeRangeField';
import VideoLinkPicker from './VideoLinkPicker';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

/**
 * 기록 수정 모달.
 *  - climb_log: 추가 모달과 동일한 카테고리 통합 entries[] 구성. 저장 시 증분 동기화.
 *  - training_session: TrainingPage 기록 탭에서 단일 훈련 세션 수정.
 */

// 기존 TrainingSessionItem → editor row (training_session 모드)
function itemsToTrainingRow(category, items, duration_minutes, memo, start_time, end_time) {
  const it = items?.[0];
  const row = {
    category: category || 'general',
    exercise_color: '', exercise_level: '',
    endurance_level: '',
    cond_unit: 'count', cond_base: '',
    value: '',
    duration_minutes: duration_minutes ?? '',
    start_time: start_time || '',
    end_time: end_time || '',
    memo: memo || '',
  };
  if (!it) return row;
  if (category === 'bouldering') {
    const m = (it.exercise_name || '').match(/(V\d+)/);
    if (m) row.exercise_level = m[1];
    row.value = it.reps_or_seconds != null ? String(it.reps_or_seconds) : '';
  } else if (category === 'endurance') {
    const m = (it.exercise_name || '').match(/\((5\.[\w.]+)\)/);
    if (m) row.endurance_level = m[1];
  } else if (category === 'conditioning') {
    row.cond_base = it.exercise_name || '';
    row.cond_unit = it.metric_unit === '초' ? 'time' : 'count';
    row.value = it.reps_or_seconds != null ? String(it.reps_or_seconds) : '';
  }
  return row;
}

// climb_log 수정용 entry 빌더
function problemToEntry(p) {
  const videos = (p.videos && p.videos.length)
    ? p.videos
    : (p.ar_route ? [{ id: p.ar_route_id || p.ar_route.id, ar_route: p.ar_route }] : []);
  const ar_routes = videos
    .filter((v) => v.ar_route)
    .map((v) => ({
      id: v.ar_route.id, title: v.ar_route.title,
      thumbnail_url: v.ar_route.thumbnail_url,
      color: v.ar_route.color, level: v.ar_route.level,
    }));
  const ar_route_ids = ar_routes.map((v) => v.id);
  return {
    _id: `cp-${p.id}`,
    _existingProblemId: p.id,
    _isNew: false,
    _pendingDelete: false,
    _origCleared: Number(p.cleared_count != null ? p.cleared_count : (p.is_cleared ? 1 : 0)),
    _origFailed: Number(p.failed_count != null ? p.failed_count : 0),
    _origVideoIds: [...ar_route_ids].sort().join(','),
    category: 'bouldering',
    color: p.color || '', level: p.level || '',
    cleared_count: p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0),
    failed_count: p.failed_count != null ? Number(p.failed_count) : 0,
    ar_route_ids, ar_routes,
    start_time: '', end_time: '', duration_minutes: '',
    endurance_level: '', cond_unit: 'count', cond_base: '', value: '', memo: '',
  };
}

function trainingSessionToEntry(s) {
  const base = itemsToTrainingRow(s.category, s.items, s.duration_minutes, s.memo, s.start_time, s.end_time);
  return {
    _id: `ts-${s.id}`,
    _existingTrainingId: s.id,
    _isNew: false,
    _pendingDelete: false,
    color: '', level: '',
    cleared_count: 0, failed_count: 0, ar_route_ids: [], ar_routes: [],
    ...base,
  };
}

export default function RecordEditModal({ kind, logId, initial, onSubmit, onClose, onChanged }) {
  const [memo, setMemo] = useState(initial.memo || '');
  const [date, setDate] = useState(initial.date || '');
  const [duration, setDuration] = useState(initial.duration_minutes ?? '');
  const [startTime, setStartTime] = useState(initial.start_time || '');
  const [endTime, setEndTime] = useState(initial.end_time || '');
  const [trainingRow, setTrainingRow] = useState(() =>
    kind === 'training_session'
      ? itemsToTrainingRow(initial.category, initial.items, initial.duration_minutes, initial.memo, initial.start_time, initial.end_time)
      : null
  );

  const initialEntries = useMemo(() => {
    if (kind !== 'climb_log') return [];
    const fromProblems = (initial.problems || []).map(problemToEntry);
    const fromTraining = (initial.training_sessions || []).map(trainingSessionToEntry);
    return [...fromProblems, ...fromTraining];
  }, [initial.problems, initial.training_sessions, kind]);
  const [entries, setEntries] = useState(initialEntries);
  const [pickerForRow, setPickerForRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const updateEntry = (id, patch) => setEntries((p) => p.map((r) => r._id === id ? { ...r, ...patch } : r));
  const removeEntry = (id) => setEntries((p) => p.map((r) => r._id === id ? { ...r, _pendingDelete: true } : r).filter((r) => !(r._isNew && r._pendingDelete)));
  const addEntry = (category = 'bouldering') => setEntries((p) => [...p, {
    _id: `new-${Date.now()}-${Math.random()}`,
    _isNew: true, _pendingDelete: false,
    category,
    color: '', level: '',
    cleared_count: 0, failed_count: 0,
    ar_route_ids: [], ar_routes: [],
    endurance_level: '',
    cond_unit: 'count', cond_base: '', value: '',
    start_time: '', end_time: '', duration_minutes: '',
    memo: '',
  }]);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      if (kind === 'climb_log' && logId) {
        // 1) 삭제 처리
        for (const e of entries.filter((x) => x._pendingDelete && !x._isNew)) {
          if (e._existingProblemId) await climbLogsApi.removeProblem(logId, e._existingProblemId);
          else if (e._existingTrainingId) await trainingApi.deleteSession(e._existingTrainingId);
        }
        // 2) 신규 추가
        for (const e of entries.filter((x) => x._isNew && !x._pendingDelete)) {
          if (e.category === 'bouldering') {
            if (!e.color && !e.level) continue;
            await climbLogsApi.addProblem(logId, {
              color: e.color || null, level: e.level || null,
              cleared_count: Number(e.cleared_count) || 0,
              failed_count: Number(e.failed_count) || 0,
              ar_route_ids: Array.isArray(e.ar_route_ids) ? e.ar_route_ids : [],
            });
          } else {
            const conv = rowToTrainingPayload(e);
            await trainingApi.createSession({
              session_date: date, category: conv.category,
              gym_id: initial.gym_id || null,
              duration_minutes: conv.duration_minutes,
              start_time: conv.start_time, end_time: conv.end_time,
              memo: conv.memo, items: conv.items,
            });
          }
        }
        // 3) 기존 항목 수정
        for (const e of entries.filter((x) => !x._isNew && !x._pendingDelete)) {
          if (e._existingProblemId) {
            const cc = Number(e.cleared_count) || 0;
            const fc = Number(e.failed_count) || 0;
            const newVid = [...(e.ar_route_ids || [])].sort().join(',');
            const updates = {};
            if (cc !== e._origCleared) updates.cleared_count = cc;
            if (fc !== e._origFailed) updates.failed_count = fc;
            const videosChanged = newVid !== e._origVideoIds;
            if (Object.keys(updates).length || videosChanged) {
              await climbLogsApi.updateProblem(logId, e._existingProblemId, {
                ...updates,
                ...(videosChanged ? { ar_route_ids: e.ar_route_ids || [] } : {}),
              });
            }
          } else if (e._existingTrainingId) {
            const conv = rowToTrainingPayload(e);
            await trainingApi.updateSession(e._existingTrainingId, {
              category: conv.category,
              session_date: date,
              duration_minutes: conv.duration_minutes,
              start_time: conv.start_time, end_time: conv.end_time,
              memo: conv.memo, items: conv.items,
            });
          }
        }
      }

      const payload = { memo, date };
      payload.duration_minutes = duration === '' ? null : Number(duration);
      payload.start_time = startTime || null;
      payload.end_time = endTime || null;
      if (kind === 'training_session' && trainingRow) {
        const conv = rowToTrainingPayload(trainingRow);
        payload.category = conv.category;
        payload.items = conv.items;
        if (conv.duration_minutes != null) payload.duration_minutes = conv.duration_minutes;
        if (conv.start_time) payload.start_time = conv.start_time;
        if (conv.end_time) payload.end_time = conv.end_time;
        if (conv.memo) payload.memo = conv.memo;
      }
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
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--surface)', width: '100%', maxWidth: 480,
        borderTopLeftRadius: 'var(--r-lg)', borderTopRightRadius: 'var(--r-lg)',
        padding: 18, maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>기록 수정</h3>
          <button onClick={onClose} style={{ color: 'var(--ink-3)' }}>{I.x(18)}</button>
        </div>

        <label style={lbl}>날짜</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />

        {kind === 'training_session' && trainingRow ? (
          <div style={{ marginTop: 6 }}>
            <TrainingItemFields row={trainingRow} onPatch={(patch) => setTrainingRow((r) => ({ ...r, ...patch }))} />
          </div>
        ) : (
          <>
            <label style={lbl}>운동 시간 (시작 ~ 종료)</label>
            <TimeRangeField compact
              start={startTime} end={endTime}
              onChange={(p) => {
                setStartTime(p.start_time || '');
                setEndTime(p.end_time || '');
                setDuration(p.duration_minutes != null ? String(p.duration_minutes) : '');
              }} />

            <label style={lbl}>소요 시간 (분)</label>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="시작·종료 시간이 없을 때 직접 입력"
              style={inp}
            />

            <label style={lbl}>메모</label>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
              rows={3} placeholder="오늘의 운동 메모"
              style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} />
          </>
        )}

        {kind === 'climb_log' && (
          <>
            <label style={lbl}>카테고리 항목 ({entries.filter((e) => !e._pendingDelete).length})</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.filter((e) => !e._pendingDelete).length === 0 && (
                <div style={{
                  background: 'var(--surface-2)', border: '1px dashed var(--line-2)',
                  borderRadius: 'var(--r-md)', padding: '14px',
                  fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center',
                }}>
                  볼더링·지구력·컨디셔닝·기타 항목을 추가하세요.
                </div>
              )}
              {entries.filter((e) => !e._pendingDelete).map((e) => {
                const cat = e.category || 'bouldering';
                return (
                  <div key={e._id} style={{
                    background: 'var(--surface-2)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-md)', padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <select value={cat}
                        disabled={!e._isNew}
                        onChange={(ev) => updateEntry(e._id, { category: ev.target.value })}
                        style={{
                          padding: '6px 10px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--r-pill)',
                          border: '1px solid var(--primary-line)',
                          background: e._isNew ? 'var(--primary-soft)' : 'var(--surface)',
                          color: 'var(--primary-ink)',
                        }}>
                        {TRAINING_CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      {cat === 'bouldering' && (e.color || e.level) && (
                        <ColorBadge color={e.color} level={e.level} size="sm" />
                      )}
                      <span style={{ flex: 1 }} />
                      <button onClick={() => removeEntry(e._id)} style={{ color: 'var(--ink-4)' }} aria-label="제거">{I.x(16)}</button>
                    </div>

                    {cat === 'bouldering' ? (
                      <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <select value={e.color}
                            disabled={!e._isNew}
                            onChange={(ev) => updateEntry(e._id, { color: ev.target.value })}
                            style={selectStyle}>
                            <option value="">색상</option>
                            {COLOR_KEYS.map((k) => <option key={k} value={k}>{colorMeta(k).kr} {colorMeta(k).label}</option>)}
                          </select>
                          <select value={e.level}
                            disabled={!e._isNew}
                            onChange={(ev) => updateEntry(e._id, { level: ev.target.value })}
                            style={selectStyle}>
                            <option value="">V등급</option>
                            {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                        {(e.color || e.level) && (
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
                            자동 제목: {fmtRouteTitle(e.color, e.level)}
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>완등 (개)</div>
                            <input type="number" min="0" step="1" inputMode="numeric"
                              value={e.cleared_count ?? 0}
                              onChange={(ev) => updateEntry(e._id, { cleared_count: ev.target.value.replace(/[^\d]/g, '') || 0 })}
                              style={selectStyle} />
                          </div>
                          <div>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>실패 (개)</div>
                            <input type="number" min="0" step="1" inputMode="numeric"
                              value={e.failed_count ?? 0}
                              onChange={(ev) => updateEntry(e._id, { failed_count: ev.target.value.replace(/[^\d]/g, '') || 0 })}
                              style={selectStyle} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>연결된 영상 ({(e.ar_route_ids || []).length})</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {(e.ar_routes || []).map((vid) => (
                              <span key={vid.id} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                fontSize: 11, padding: '4px 9px', borderRadius: 'var(--r-pill)',
                                background: 'var(--primary-soft)', color: 'var(--ink-1)',
                                border: '1px solid var(--primary-line)', fontWeight: 600,
                              }}>
                                📹 {vid.title || `#${vid.id}`}
                                <button type="button" onClick={() => updateEntry(e._id, {
                                  ar_route_ids: (e.ar_route_ids || []).filter((x) => x !== vid.id),
                                  ar_routes: (e.ar_routes || []).filter((x) => x.id !== vid.id),
                                })} style={{ marginLeft: 2, color: 'var(--ink-3)' }}>×</button>
                              </span>
                            ))}
                            <button type="button" onClick={() => setPickerForRow(e._id)}
                              style={{
                                fontSize: 11, fontWeight: 600,
                                padding: '4px 9px', borderRadius: 'var(--r-pill)',
                                border: '1px dashed var(--line-2)', background: 'var(--surface)',
                                color: 'var(--primary)',
                              }}>+ 영상 연결</button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <TrainingItemFields row={e} onPatch={(patch) => updateEntry(e._id, patch)} />
                    )}
                  </div>
                );
              })}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {TRAINING_CATEGORIES.map(([k, l]) => (
                  <Btn key={k} variant="ghost" size="sm" onClick={() => addEntry(k)}>+ {l}</Btn>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
                기존 항목의 카테고리·색·등급은 변경 불가. 변경이 필요하면 삭제 후 새로 추가하세요.
              </div>
            </div>
          </>
        )}

        {error && <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Btn variant="primary" full disabled={saving} onClick={handleSave}>
            {saving ? '저장 중...' : '저장'}
          </Btn>
          <Btn variant="ghost" full onClick={onClose}>취소</Btn>
        </div>
      </div>

      {pickerForRow && (() => {
        const a = entries.find((x) => x._id === pickerForRow);
        return (
          <VideoLinkPicker
            defaultColor={a?.color || ''}
            defaultLevel={a?.level || ''}
            onPick={(r) => {
              const ids = a?.ar_route_ids || [];
              if (!ids.includes(r.id)) {
                const list = a?.ar_routes || [];
                updateEntry(pickerForRow, {
                  ar_route_ids: [...ids, r.id],
                  ar_routes: [...list, { id: r.id, title: r.title, thumbnail_url: r.thumbnail_url, color: r.color || r.problem?.color, level: r.level || r.problem?.level }],
                });
              }
              setPickerForRow(null);
            }}
            onClose={() => setPickerForRow(null)}
          />
        );
      })()}
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
  width: '100%', padding: '8px 10px', fontSize: 13,
  borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
  background: 'var(--surface)', color: 'var(--ink-1)',
};

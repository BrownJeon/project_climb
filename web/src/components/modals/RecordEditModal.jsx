import { useEffect, useMemo, useRef, useState } from 'react';
import { Btn, ColorBadge } from '../atoms';
import { I } from '../atoms/Icons';
import { climbLogsApi } from '../../api/climbLogs';
import { trainingApi } from '../../api/training';
import { COLOR_KEYS, colorMeta, fmtRouteTitle } from '../../utils/colors';
import { STYLE_KEYS, styleMeta } from '../../utils/style';
import TrainingItemFields, { rowToTrainingPayload, TRAINING_CATEGORIES } from '../TrainingItemFields';
import TimeRangeField from '../TimeRangeField';
import ProblemPhotoModal from './ProblemPhotoModal';
import { useVideoUpload } from '../../contexts/VideoUploadContext';

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
    endurance_cleared: false,
    endurance_attempts: '',
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
    row.endurance_cleared = it.sets != null ? it.sets >= 1 : false;
    row.endurance_attempts = it.reps_or_seconds != null ? String(it.reps_or_seconds) : '';
  } else if (category === 'conditioning') {
    row.cond_base = it.exercise_name || '';
    row.cond_unit = it.metric_unit === '초' ? 'time' : 'count';
    row.value = it.reps_or_seconds != null ? String(it.reps_or_seconds) : '';
  }
  return row;
}

// climb_log 수정용 entry 빌더
function problemToEntry(p) {
  return {
    _id: `cp-${p.id}`,
    _existingProblemId: p.id,
    _isNew: false,
    _pendingDelete: false,
    _origCleared: Number(p.cleared_count != null ? p.cleared_count : (p.is_cleared ? 1 : 0)),
    _origFailed: Number(p.failed_count != null ? p.failed_count : 0),
    _origStyle: p.style || '',
    category: 'bouldering',
    color: p.color || '', level: p.level || '', style: p.style || '',
    cleared_count: p.cleared_count != null ? Number(p.cleared_count) : (p.is_cleared ? 1 : 0),
    failed_count: p.failed_count != null ? Number(p.failed_count) : 0,
    ar_route_ids: [], ar_routes: [],
    personal_videos: (p.personal_videos || []).map((v) => ({ ...v })),
    _pendingVideoFiles: [],
    photos: p.photos || [],
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
  const [photoTarget, setPhotoTarget] = useState(null); // { entryId, cpId, photo? }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const videoFileRef = useRef(null);
  const [uploadTargetRow, setUploadTargetRow] = useState(null);
  const { addTask } = useVideoUpload();

  // 완료된 영상 업로드를 모달 personal_videos 배열에 반영
  useEffect(() => {
    const handler = ({ detail }) => {
      const { cpId, pvId, video_url, thumbnail_url } = detail;
      setEntries((prev) => prev.map((entry) => {
        if (Number(entry._existingProblemId) !== Number(cpId)) return entry;
        const exists = (entry.personal_videos || []).some((v) => v.id === pvId);
        if (exists) {
          return {
            ...entry,
            personal_videos: entry.personal_videos.map((v) =>
              v.id === pvId ? { ...v, video_url, thumbnail_url, video_status: 'ready' } : v
            ),
          };
        }
        return {
          ...entry,
          personal_videos: [...(entry.personal_videos || []), { id: pvId, video_url, thumbnail_url, video_status: 'ready' }],
        };
      }));
    };
    window.addEventListener('theroute:videoUploaded', handler);
    return () => window.removeEventListener('theroute:videoUploaded', handler);
  }, []);

  const updateEntry = (id, patch) => setEntries((p) => p.map((r) => r._id === id ? { ...r, ...patch } : r));
  const removeEntry = (id) => setEntries((p) => p.map((r) => r._id === id ? { ...r, _pendingDelete: true } : r).filter((r) => !(r._isNew && r._pendingDelete)));
  const addEntry = (category = 'bouldering') => setEntries((p) => [...p, {
    _id: `new-${Date.now()}-${Math.random()}`,
    _isNew: true, _pendingDelete: false,
    category,
    color: '', level: '', style: '',
    cleared_count: 0, failed_count: 0,
    ar_route_ids: [], ar_routes: [],
    personal_videos: [],
    _pendingVideoFiles: [],
    endurance_level: '',
    endurance_cleared: false,
    endurance_attempts: '',
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
            const res = await climbLogsApi.addProblem(logId, {
              color: e.color || null, level: e.level || null,
              style: e.style || null,
              cleared_count: Number(e.cleared_count) || 0,
              failed_count: Number(e.failed_count) || 0,
              ar_route_ids: Array.isArray(e.ar_route_ids) ? e.ar_route_ids : [],
            });
            if (e._pendingVideoFiles?.length) {
              const newCpId = res.data?.problem?.id || res.data?.id;
              if (newCpId) {
                for (const file of e._pendingVideoFiles) {
                  addTask({ logId, cpId: newCpId, file });
                }
              }
            }
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
            const updates = {};
            if (cc !== e._origCleared) updates.cleared_count = cc;
            if (fc !== e._origFailed) updates.failed_count = fc;
            if ((e.style || '') !== (e._origStyle || '')) updates.style = e.style || null;
            // 영상은 별도 uploadProblemVideo로 관리하므로 제외
            if (Object.keys(updates).length) {
              await climbLogsApi.updateProblem(logId, e._existingProblemId, updates);
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
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>벽 형태</div>
                          <select value={e.style || ''} onChange={(ev) => updateEntry(e._id, { style: ev.target.value })}
                            style={selectStyle}>
                            <option value="">선택 안 함</option>
                            <optgroup label="단일">
                              {['slab','vertical','overhang','cave'].map((k) => <option key={k} value={k}>{styleMeta(k).label}</option>)}
                            </optgroup>
                            <optgroup label="복합">
                              {['slab_vertical','vertical_overhang','slab_overhang','overhang_cave'].map((k) => <option key={k} value={k}>{styleMeta(k).label}</option>)}
                            </optgroup>
                            <option value="other">{styleMeta('other').label}</option>
                          </select>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <CountStepper
                            label="완등 (개)"
                            tone="success"
                            value={Number(e.cleared_count) || 0}
                            onChange={(v) => updateEntry(e._id, { cleared_count: v })}
                          />
                          <CountStepper
                            label="실패 (개)"
                            tone="danger"
                            value={Number(e.failed_count) || 0}
                            onChange={(v) => updateEntry(e._id, { failed_count: v })}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                            영상 ({(e.personal_videos || []).length + (e._pendingVideoFiles || []).length}개)
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            {/* 저장된 영상 썸네일 */}
                            {(e.personal_videos || []).map((v) => (
                              <div key={v.id} style={{
                                position: 'relative', width: 52, height: 72,
                                borderRadius: 'var(--r-sm)', overflow: 'hidden',
                                background: '#000', flexShrink: 0,
                              }}>
                                {v.thumbnail_url
                                  ? <img src={v.thumbnail_url} alt="영상" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,.6)', fontSize: 18 }}>▶</div>
                                }
                                {v.video_status === 'processing' && (
                                  <div style={{
                                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)',
                                    display: 'grid', placeItems: 'center',
                                  }}>
                                    <span style={{
                                      width: 16, height: 16, borderRadius: '50%',
                                      border: '2px solid rgba(255,255,255,.3)',
                                      borderTopColor: '#fff',
                                      animation: 'spin 0.7s linear infinite',
                                      display: 'inline-block',
                                    }} />
                                  </div>
                                )}
                                {e._existingProblemId && v.video_status !== 'processing' && (
                                  <button type="button"
                                    onClick={async () => {
                                      try {
                                        await climbLogsApi.deletePersonalVideo(logId, e._existingProblemId, v.id);
                                        updateEntry(e._id, { personal_videos: e.personal_videos.filter((pv) => pv.id !== v.id) });
                                        onChanged?.();
                                      } catch {}
                                    }}
                                    style={{
                                      position: 'absolute', top: 2, right: 2,
                                      width: 16, height: 16, borderRadius: '50%',
                                      background: 'rgba(0,0,0,.65)', color: '#fff',
                                      fontSize: 9, fontWeight: 700,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>✕</button>
                                )}
                              </div>
                            ))}
                            {/* 신규 문제용 대기 파일 */}
                            {(e._pendingVideoFiles || []).map((f, fi) => (
                              <div key={fi} style={{
                                width: 52, height: 72, borderRadius: 'var(--r-sm)',
                                background: 'var(--primary-soft)', border: '1px solid var(--primary-line)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', gap: 3, padding: '4px 2px',
                                position: 'relative', flexShrink: 0,
                              }}>
                                <span style={{ fontSize: 16 }}>📹</span>
                                <span style={{
                                  fontSize: 9, color: 'var(--primary-ink)',
                                  overflow: 'hidden', textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap', width: '100%', textAlign: 'center',
                                  padding: '0 2px',
                                }}>{f.name}</span>
                                <button type="button"
                                  onClick={() => updateEntry(e._id, {
                                    _pendingVideoFiles: e._pendingVideoFiles.filter((_, i) => i !== fi),
                                  })}
                                  style={{
                                    position: 'absolute', top: 2, right: 2,
                                    width: 14, height: 14, borderRadius: '50%',
                                    background: 'var(--primary-line)', color: 'var(--primary-ink)',
                                    fontSize: 8, fontWeight: 700,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}>✕</button>
                              </div>
                            ))}
                            {/* + 영상 추가 버튼 */}
                            <button type="button"
                              onClick={() => { setUploadTargetRow(e._id); videoFileRef.current?.click(); }}
                              style={{
                                width: 52, height: 72,
                                fontSize: 11, fontWeight: 600, color: 'var(--primary)',
                                borderRadius: 'var(--r-sm)',
                                border: '1px dashed var(--line-2)', background: 'var(--surface)',
                                cursor: 'pointer', flexShrink: 0,
                              }}>+ 영상</button>
                          </div>
                        </div>

                        {/* 사진 분석 — 기존 항목만 (id 필요) */}
                        {e._existingProblemId && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>문제 사진 ({(e.photos || []).length})</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {(e.photos || []).map((ph) => (
                                <button key={ph.id} type="button"
                                  onClick={() => setPhotoTarget({ entryId: e._id, cpId: e._existingProblemId, photo: ph })}
                                  style={{
                                    width: 56, height: 56, padding: 0, borderRadius: 'var(--r-sm)',
                                    overflow: 'hidden', border: '1px solid var(--line)',
                                    background: `#000 center/cover no-repeat url("${ph.photo_url}")`,
                                    cursor: 'pointer', position: 'relative',
                                  }}>
                                  {(ph.failure_tags || ph.failure_memo) && (
                                    <span style={{
                                      position: 'absolute', bottom: 2, right: 2,
                                      fontSize: 9, padding: '1px 4px', borderRadius: 'var(--r-pill)',
                                      background: 'var(--danger)', color: '#fff', fontWeight: 700,
                                    }}>분석</span>
                                  )}
                                </button>
                              ))}
                              <button type="button"
                                onClick={() => setPhotoTarget({ entryId: e._id, cpId: e._existingProblemId, photo: null })}
                                style={{
                                  width: 56, height: 56,
                                  fontSize: 11, fontWeight: 600, color: 'var(--primary)',
                                  borderRadius: 'var(--r-sm)',
                                  border: '1px dashed var(--line-2)', background: 'var(--surface)',
                                  cursor: 'pointer',
                                }}>+ 사진</button>
                            </div>
                          </div>
                        )}
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

        <input ref={videoFileRef} type="file" accept="video/*" style={{ display: 'none' }}
          onChange={(ev) => {
            const file = ev.target.files?.[0];
            ev.target.value = '';
            if (!file || !uploadTargetRow) return;
            if (!file.type.startsWith('video/')) { alert('영상 파일만 업로드 가능합니다.'); return; }
            const rowId = uploadTargetRow;
            setUploadTargetRow(null);
            const entry = entries.find((x) => x._id === rowId);
            if (!entry) return;

            if (entry._existingProblemId && logId) {
              // 기존 문제: 즉시 업로드 큐에 추가 (백그라운드 처리)
              addTask({ logId, cpId: entry._existingProblemId, file });
            } else {
              // 신규 문제: 저장 후 일괄 업로드
              updateEntry(rowId, { _pendingVideoFiles: [...(entry._pendingVideoFiles || []), file] });
            }
          }}
        />
      </div>

      {photoTarget && (
        <ProblemPhotoModal
          logId={logId}
          cpId={photoTarget.cpId}
          photo={photoTarget.photo}
          onSaved={(saved) => {
            updateEntry(photoTarget.entryId, {
              photos: photoTarget.photo
                ? (entries.find((x) => x._id === photoTarget.entryId)?.photos || []).map((ph) => ph.id === saved.id ? saved : ph)
                : [...(entries.find((x) => x._id === photoTarget.entryId)?.photos || []), saved],
            });
          }}
          onDeleted={(photoId) => {
            updateEntry(photoTarget.entryId, {
              photos: (entries.find((x) => x._id === photoTarget.entryId)?.photos || []).filter((ph) => ph.id !== photoId),
            });
          }}
          onClose={() => setPhotoTarget(null)}
        />
      )}
    </div>
  );
}

function CountStepper({ label, tone, value, onChange }) {
  const color = tone === 'success' ? 'var(--success)' : 'var(--danger)';
  const set = (v) => onChange(Math.max(0, v));
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '2px 4px', borderRadius: 'var(--r-sm)',
        border: '1px solid var(--line)', background: 'var(--surface)',
        minWidth: 0,
      }}>
        <button type="button" onClick={() => set(value - 1)} disabled={value <= 0}
          aria-label="감소"
          style={{
            flexShrink: 0,
            width: 24, height: 24, borderRadius: '50%',
            border: 'none', background: 'var(--surface-2)',
            color: value <= 0 ? 'var(--ink-4)' : 'var(--ink-2)',
            fontSize: 14, fontWeight: 700, lineHeight: 1,
            cursor: value <= 0 ? 'not-allowed' : 'pointer',
          }}>−</button>
        <input type="number" min="0" step="1" inputMode="numeric"
          value={value}
          onChange={(e) => set(Number(e.target.value.replace(/[^\d]/g, '')) || 0)}
          style={{
            flex: 1, minWidth: 0, width: '100%',
            padding: '4px 0', fontSize: 13, fontWeight: 700,
            border: 'none', outline: 'none', background: 'transparent',
            color, textAlign: 'center',
          }} />
        <button type="button" onClick={() => set(value + 1)}
          aria-label="증가"
          style={{
            flexShrink: 0,
            width: 24, height: 24, borderRadius: '50%',
            border: 'none', background: color, color: '#fff',
            fontSize: 14, fontWeight: 700, lineHeight: 1, cursor: 'pointer',
          }}>+</button>
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
  width: '100%', padding: '8px 10px', fontSize: 13,
  borderRadius: 'var(--r-sm)', border: '1px solid var(--line)',
  background: 'var(--surface)', color: 'var(--ink-1)',
};

import { useEffect, useRef, useState } from 'react';
import { Btn, ColorBadge, RadioOpt, Checkbox, Stepper, Pill } from '../atoms';
import { I } from '../atoms/Icons';
import { COLOR_KEYS, colorMeta, fmtRouteTitle } from '../../utils/colors';
import { gymsApi } from '../../api/gyms';
import { gymSectorsApi } from '../../api/gymSectors';
import { passesApi } from '../../api/passes';
import { sessionsApi } from '../../api/sessions';
import { climbLogsApi } from '../../api/climbLogs';
import TrainingItemFields, { rowToTrainingPayload, TRAINING_CATEGORIES } from '../TrainingItemFields';
import TimeRangeField from '../TimeRangeField';
import VideoLinkPicker from './VideoLinkPicker';
import VideoChip from '../VideoChip';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function SessionAddModal({ mode = 'full', initialPrefill = {}, onClose, onSaved }) {
  const [visitedAt, setVisitedAt] = useState(initialPrefill.visited_at || todayISO());
  const [gymId, setGymId] = useState(initialPrefill.gym_id || '');
  const [gyms, setGyms] = useState([]);
  const [memo, setMemo] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [passKind, setPassKind] = useState('');     // 'period' | 'count' | 'day'
  const [passId, setPassId] = useState('');
  const [periodPasses, setPeriodPasses] = useState([]);
  const [countPasses, setCountPasses] = useState([]);
  const [sectors, setSectors] = useState([]);

  const [entries, setEntries] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [pickerForRow, setPickerForRow] = useState(null);

  useEffect(() => {
    gymsApi.list({ limit: 50 }).then((r) => setGyms(r.data?.gyms || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!gymId) { setPeriodPasses([]); setCountPasses([]); setSectors([]); return; }
    Promise.all([
      passesApi.list({ gym_id: gymId, status: 'active', pass_type: 'period' }),
      passesApi.list({ gym_id: gymId, status: 'active', pass_type: 'count' }),
      gymSectorsApi.list(gymId),
    ]).then(([p, c, s]) => {
      setPeriodPasses(p.data?.passes || []);
      setCountPasses(c.data?.passes || []);
      setSectors(s.data?.data || []);
    }).catch(() => {});
    setPassKind(''); setPassId('');
  }, [gymId]);

  const canSubmit = !!visitedAt && !!gymId && !!passKind &&
    (passKind === 'day' || !!passId);

  // 항목 헬퍼 (카테고리별 통합 row)
  const addEntry = (category = 'bouldering') => setEntries((p) => [...p, {
    _id: Date.now() + Math.random(),
    category,
    // 볼더링
    color: '', level: '', sector_id: null,
    cleared_count: 0, failed_count: 0,
    ar_route_ids: [], ar_routes: [],
    pendingPhotos: [], // { file: File, preview: string }
    // 지구력
    endurance_level: '',
    // 컨디셔닝
    cond_unit: 'count', cond_base: '',
    value: '',
    // 공통
    start_time: '', end_time: '', duration_minutes: '',
    memo: '',
  }]);
  const removeEntry = (id) => setEntries((p) => p.filter((r) => r._id !== id));
  const updateEntry = (id, patch) => setEntries((p) => p.map((r) => r._id === id ? { ...r, ...patch } : r));

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);

    const boulderingRows = entries.filter((r) => r.category === 'bouldering');
    const trainingRows = entries.filter((r) => r.category !== 'bouldering');

    const payload = {
      visited_at: visitedAt,
      gym_id: gymId,
      memo: memo || '',
      duration_minutes: durationMinutes === '' ? null : Number(durationMinutes),
      start_time: startTime || null,
      end_time: endTime || null,
      attempts: boulderingRows.map((a) => {
        const row = {
          cleared_count: Number(a.cleared_count) || 0,
          failed_count: Number(a.failed_count) || 0,
          is_cleared: (Number(a.cleared_count) || 0) > 0,
          attempts: 1,
          video_mode: 'none',
        };
        if (a.color || a.level) row.new_problem = {
          color: a.color || null,
          level: a.level || null,
          sector_id: a.sector_id || null,
          section_name: sectors.find(s => Number(s.id) === a.sector_id)?.name || null,
        };
        if (Array.isArray(a.ar_route_ids) && a.ar_route_ids.length) row.ar_route_ids = a.ar_route_ids;
        return row;
      }),
      training: trainingRows.map((t) => rowToTrainingPayload(t)),
    };

    if (passKind === 'day') payload.used_day_pass = true;
    else if (passId) payload.gym_pass_id = passId;

    const filesIndexed = {};

    try {
      const res = await sessionsApi.create({ ...payload, files: filesIndexed });

      // 사진 업로드 (best-effort: 실패해도 세션 저장은 유지)
      const logId = res.data?.climb_log_id;
      const problemIds = res.data?.problem_ids || [];
      for (let i = 0; i < boulderingRows.length; i++) {
        const photos = boulderingRows[i].pendingPhotos || [];
        const cpId = problemIds[i];
        if (!logId || !cpId || !photos.length) continue;
        for (const { file } of photos) {
          await climbLogsApi.uploadProblemPhoto(logId, cpId, file, {}).catch(() => {});
        }
      }

      onSaved?.(res.data);
      onClose();
    } catch (e) {
      setError(e?.message || '저장 실패');
    } finally {
      setSubmitting(false);
    }
  }

  // ────────────────────────────── Render ──────────────────────────────
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 300,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)', width: '100%', maxWidth: 'var(--max-w)', maxHeight: '90%',
          borderRadius: '24px 24px 0 0', overflow: 'auto',
          display: 'flex', flexDirection: 'column',
          animation: 'sheetUp 280ms cubic-bezier(.32,.72,0,1)',
        }}
      >
        {/* Sticky header */}
        <div style={{
          padding: '12px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface)', borderBottom: '1px solid var(--line)',
          position: 'sticky', top: 0, zIndex: 2,
        }}>
          <button
            onClick={submit} disabled={!canSubmit || submitting}
            style={{ fontSize: 14, fontWeight: 700, color: canSubmit ? 'var(--primary)' : 'var(--ink-4)' }}
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>운동 기록 추가</span>
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
        </div>

        {error && (
          <div style={{ padding: '10px 16px', background: 'var(--danger)', color: '#fff', fontSize: 12 }}>{error}</div>
        )}

        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── 기본 ── */}
          <div>
            <SectionLabel>기본</SectionLabel>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              <FieldDate label="날짜" value={visitedAt} onChange={setVisitedAt} />
              <GymCombobox
                label="암장"
                value={gymId}
                onChange={setGymId}
                gyms={gyms}
              />

              {/* 이용권 */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>이용권<span style={{ color: 'var(--danger)' }}>*</span></span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <RadioOpt
                    label="정기권"
                    sub={periodPasses.length === 0
                      ? '해당 암장 정기권 없음'
                      : periodPasses.find((p) => String(p.id) === String(passId))
                        ? `${periodPasses.find((p) => String(p.id) === String(passId)).label} (~${periodPasses.find((p) => String(p.id) === String(passId)).end_date})`
                        : '선택'}
                    checked={passKind === 'period'}
                    disabled={periodPasses.length === 0}
                    onClick={() => { setPassKind('period'); setPassId(periodPasses[0]?.id || ''); }}
                  />
                  {passKind === 'period' && periodPasses.length > 1 && (
                    <select value={passId} onChange={(e) => setPassId(e.target.value)} style={{ marginLeft: 25, padding: 6, fontSize: 12 }}>
                      {periodPasses.map((p) => (
                        <option key={p.id} value={p.id}>{p.label} (~{p.end_date}, {p.days_remaining}일 남음)</option>
                      ))}
                    </select>
                  )}

                  <RadioOpt
                    label="횟수권"
                    sub={countPasses.length === 0
                      ? '해당 암장 횟수권 없음'
                      : countPasses.find((p) => String(p.id) === String(passId))
                        ? `${countPasses.find((p) => String(p.id) === String(passId)).label} (잔여 ${countPasses.find((p) => String(p.id) === String(passId)).remaining_count}회)`
                        : '선택'}
                    checked={passKind === 'count'}
                    disabled={countPasses.length === 0}
                    onClick={() => { setPassKind('count'); setPassId(countPasses[0]?.id || ''); }}
                  />
                  {passKind === 'count' && countPasses.length > 1 && (
                    <select value={passId} onChange={(e) => setPassId(e.target.value)} style={{ marginLeft: 25, padding: 6, fontSize: 12 }}>
                      {countPasses.map((p) => (
                        <option key={p.id} value={p.id}>{p.label} (잔여 {p.remaining_count}회{p.end_date ? `, ~${p.end_date}` : ''})</option>
                      ))}
                    </select>
                  )}

                  <RadioOpt
                    label="일일이용권"
                    sub="1회용"
                    checked={passKind === 'day'}
                    onClick={() => setPassKind('day')}
                  />
                </div>
              </div>

              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
                <TimeRangeField
                  start={startTime} end={endTime}
                  onChange={(p) => {
                    setStartTime(p.start_time || '');
                    setEndTime(p.end_time || '');
                    setDurationMinutes(p.duration_minutes != null ? String(p.duration_minutes) : '');
                  }}
                  label="운동 시간 (시작 ~ 종료)" />
              </div>
              <FieldText label="메모" value={memo} onChange={setMemo} placeholder="(선택) 한 줄 메모" isLast />
            </div>
          </div>

          {/* ── 카테고리 항목 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionLabel inline>카테고리 항목</SectionLabel>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{entries.length}개</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.length === 0 && (
                <div style={{
                  background: 'var(--surface)', border: '1px dashed var(--line-2)',
                  borderRadius: 'var(--r-md)', padding: '14px',
                  fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center',
                }}>
                  볼더링·지구력·컨디셔닝·기타 항목을 추가하세요.
                </div>
              )}
              {entries.map((e) => {
                const cat = e.category || 'bouldering';
                const catLabel = (TRAINING_CATEGORIES.find(([k]) => k === cat) || ['', cat])[1];
                return (
                  <div key={e._id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <select value={cat} onChange={(ev) => updateEntry(e._id, { category: ev.target.value })}
                        style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, borderRadius: 'var(--r-pill)', border: '1px solid var(--primary-line)', background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}>
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
                          <select value={e.color} onChange={(ev) => updateEntry(e._id, { color: ev.target.value })}
                            style={{ padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                            <option value="">색상</option>
                            {COLOR_KEYS.map((k) => <option key={k} value={k}>{colorMeta(k).kr} {colorMeta(k).label}</option>)}
                          </select>
                          <select value={e.level} onChange={(ev) => updateEntry(e._id, { level: ev.target.value })}
                            style={{ padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                            <option value="">V등급</option>
                            {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>

                        {(e.color || e.level) && (
                          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
                            자동 제목: {fmtRouteTitle(e.color, e.level)}
                          </div>
                        )}

                        {sectors.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4 }}>섹터</div>
                            <select
                              value={e.sector_id || ''}
                              onChange={(ev) => updateEntry(e._id, { sector_id: ev.target.value ? Number(ev.target.value) : null })}
                              style={{ width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}
                            >
                              <option value="">섹터 선택 안 함</option>
                              {sectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <CountStepper
                            label="완등 (개)" tone="success"
                            value={Number(e.cleared_count) || 0}
                            onChange={(v) => updateEntry(e._id, { cleared_count: v })}
                          />
                          <CountStepper
                            label="실패 (개)" tone="danger"
                            value={Number(e.failed_count) || 0}
                            onChange={(v) => updateEntry(e._id, { failed_count: v })}
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>연결된 영상 ({(e.ar_route_ids || []).length})</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {(e.ar_routes || []).map((vid) => (
                              <VideoChip key={vid.id}
                                id={vid.id} title={vid.title}
                                thumbnail_url={vid.thumbnail_url}
                                color={vid.color || e.color}
                                level={vid.level || e.level}
                                onRemove={() => updateEntry(e._id, {
                                  ar_route_ids: (e.ar_route_ids || []).filter((x) => x !== vid.id),
                                  ar_routes: (e.ar_routes || []).filter((x) => x.id !== vid.id),
                                })}
                              />
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

                        {/* 사진 첨부 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>사진 ({(e.pendingPhotos || []).length})</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(e.pendingPhotos || []).map((p, fi) => (
                              <div key={fi} style={{ position: 'relative', width: 40, height: 56, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)', flexShrink: 0 }}>
                                <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                <button
                                  type="button"
                                  onClick={() => {
                                    URL.revokeObjectURL(p.preview);
                                    updateEntry(e._id, { pendingPhotos: (e.pendingPhotos || []).filter((_, i) => i !== fi) });
                                  }}
                                  style={{
                                    position: 'absolute', top: 1, right: 1,
                                    width: 14, height: 14, borderRadius: '50%',
                                    background: 'rgba(0,0,0,.65)', color: '#fff',
                                    fontSize: 9, lineHeight: '14px', textAlign: 'center',
                                    border: 'none', cursor: 'pointer', padding: 0,
                                  }}>×</button>
                              </div>
                            ))}
                            <label style={{
                              fontSize: 11, fontWeight: 600,
                              padding: '4px 9px', borderRadius: 'var(--r-pill)',
                              border: '1px dashed var(--line-2)', background: 'var(--surface)',
                              color: 'var(--ink-3)', cursor: 'pointer', whiteSpace: 'nowrap',
                            }}>
                              <input type="file" accept="image/*" multiple
                                onChange={(ev) => {
                                  const files = Array.from(ev.target.files || []);
                                  if (!files.length) return;
                                  const newPhotos = files.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
                                  updateEntry(e._id, { pendingPhotos: [...(e.pendingPhotos || []), ...newPhotos] });
                                  ev.target.value = '';
                                }}
                                style={{ display: 'none' }} />
                              + 사진
                            </label>
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
            </div>
          </div>

          <div style={{ height: 8 }} />
        </div>
      </div>

      <style>{`
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

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

// ────────────────────── Sub primitives (handoff Field) ──────────────────────
function SectionLabel({ children, inline }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: 'var(--ink-3)',
      letterSpacing: .4, marginBottom: inline ? 0 : 8,
    }}>{children}</div>
  );
}

function FieldDate({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', width: 60 }}>{label}</span>
      <input type="date" value={value} onChange={(e) => onChange?.(e.target.value)}
        style={{ flex: 1, fontSize: 13.5, color: 'var(--ink-1)', fontWeight: 600, border: 0, background: 'transparent', padding: 0 }} />
    </div>
  );
}

function gymLabel(g) {
  return (g.brand || g.name || '') + (g.branch ? ` · ${g.branch}` : '');
}

function GymCombobox({ label, value, onChange, gyms }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // 외부에서 value 변경 시 query 동기화
  useEffect(() => {
    if (!value) { setQuery(''); return; }
    const g = gyms.find((x) => String(x.id) === String(value));
    if (g) setQuery(gymLabel(g));
  }, [value, gyms]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (!wrapRef.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matched = gyms.filter((g) => {
    if (!q) return true;
    const hay = `${g.brand || ''} ${g.branch || ''} ${g.name || ''}`.toLowerCase();
    return hay.includes(q);
  });

  function pick(g) {
    onChange?.(g.id);
    setQuery(gymLabel(g));
    setOpen(false);
  }

  function clear() {
    onChange?.('');
    setQuery('');
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{
      display: 'flex', alignItems: 'center', padding: '12px 14px',
      borderBottom: '1px solid var(--line)', position: 'relative',
    }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', width: 60 }}>{label}<span style={{ color: 'var(--danger)' }}>*</span></span>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); if (value) onChange?.(''); }}
        onFocus={() => setOpen(true)}
        placeholder="암장명 또는 지점 입력"
        style={{ flex: 1, fontSize: 13.5, fontWeight: 600, border: 0, background: 'transparent', padding: 0, color: 'var(--ink-1)' }}
      />
      {value && (
        <button type="button" onClick={clear} aria-label="선택 해제"
          style={{ color: 'var(--ink-4)', padding: 4, marginRight: 2 }}>
          {I.x(14)}
        </button>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="목록 열기"
        style={{ color: 'var(--ink-3)', padding: 4 }}>
        {I.chev(14, open ? 'up' : 'down')}
      </button>
      {open && (
        <div role="listbox" style={{
          position: 'absolute', left: 14, right: 14, top: 'calc(100% - 1px)',
          maxHeight: 220, overflowY: 'auto', zIndex: 20,
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)', boxShadow: '0 8px 24px rgba(0,0,0,.08)',
        }}>
          {matched.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-4)' }}>
              일치하는 암장이 없습니다.
            </div>
          ) : matched.map((g) => (
            <button key={g.id} type="button" onClick={() => pick(g)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 12px', fontSize: 13,
                background: String(g.id) === String(value) ? 'var(--surface-2)' : 'transparent',
                color: 'var(--ink-1)', border: 0, borderBottom: '1px solid var(--line)',
                cursor: 'pointer',
              }}>
              <span style={{ fontWeight: 700 }}>{g.brand || g.name}</span>
              {g.branch && <span style={{ color: 'var(--ink-3)', marginLeft: 4 }}>· {g.branch}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', width: 60 }}>{label}<span style={{ color: 'var(--danger)' }}>*</span></span>
      <select value={value} onChange={(e) => onChange?.(e.target.value)}
        style={{ flex: 1, fontSize: 13.5, fontWeight: 600, border: 0, background: 'transparent', padding: 0 }}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FieldNumber({ label, value, onChange, placeholder, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', width: 60 }}>{label}</span>
      <input type="number" min="0" value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, fontSize: 13.5, fontWeight: value ? 600 : 500, color: value ? 'var(--ink-1)' : 'var(--ink-4)', border: 0, background: 'transparent', padding: 0 }} />
    </div>
  );
}

function FieldText({ label, value, onChange, placeholder, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', width: 60 }}>{label}</span>
      <input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, fontSize: 13.5, fontWeight: value ? 600 : 500, color: value ? 'var(--ink-1)' : 'var(--ink-4)', border: 0, background: 'transparent', padding: 0 }} />
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

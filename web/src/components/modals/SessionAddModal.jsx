import { useEffect, useState } from 'react';
import { Btn, ColorBadge, RadioOpt, Checkbox, Stepper, Pill } from '../atoms';
import { I } from '../atoms/Icons';
import { COLOR_KEYS, colorMeta, fmtRouteTitle } from '../../utils/colors';
import { gymsApi } from '../../api/gyms';
import { passesApi } from '../../api/passes';
import { sessionsApi } from '../../api/sessions';

const V_LEVELS = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12'];
const TRAINING_CATS = [
  ['endurance',    '지구력'],
  ['conditioning', '컨디셔닝'],
  ['bouldering',   '볼더링'],
];

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function SessionAddModal({ mode = 'full', initialPrefill = {}, onClose, onSaved }) {
  const [visitedAt, setVisitedAt] = useState(initialPrefill.visited_at || todayISO());
  const [gymId, setGymId] = useState(initialPrefill.gym_id || '');
  const [gyms, setGyms] = useState([]);
  const [memo, setMemo] = useState('');
  const [passKind, setPassKind] = useState('');     // 'period' | 'count' | 'day'
  const [passId, setPassId] = useState('');
  const [periodPasses, setPeriodPasses] = useState([]);
  const [countPasses, setCountPasses] = useState([]);

  const [attempts, setAttempts] = useState([]);
  const [training, setTraining] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    gymsApi.list({ limit: 50 }).then((r) => setGyms(r.data?.gyms || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!gymId) { setPeriodPasses([]); setCountPasses([]); return; }
    Promise.all([
      passesApi.list({ gym_id: gymId, status: 'active', pass_type: 'period' }),
      passesApi.list({ gym_id: gymId, status: 'active', pass_type: 'count' }),
    ]).then(([p, c]) => {
      setPeriodPasses(p.data?.passes || []);
      setCountPasses(c.data?.passes || []);
    }).catch(() => {});
    setPassKind(''); setPassId('');
  }, [gymId]);

  const canSubmit = !!visitedAt && !!gymId && !!passKind &&
    (passKind === 'day' || !!passId) &&
    (attempts.length > 0 || training.length > 0 || true /* 단순 방문도 허용 */);

  // 행 헬퍼
  const addAttemptRow = () => setAttempts((p) => [...p, {
    _id: Date.now() + Math.random(),
    color: '', level: '', is_cleared: false, attempts: 1, video_mode: 'none',
  }]);
  const removeAttemptRow = (id) => setAttempts((p) => p.filter((r) => r._id !== id));
  const updateAttemptRow = (id, patch) => setAttempts((p) => p.map((r) => r._id === id ? { ...r, ...patch } : r));

  const addTrainingRow = () => setTraining((p) => [...p, {
    _id: Date.now() + Math.random(),
    category: 'endurance', duration_minutes: '', items: [], memo: '',
  }]);
  const removeTrainingRow = (id) => setTraining((p) => p.filter((r) => r._id !== id));
  const updateTrainingRow = (id, patch) => setTraining((p) => p.map((r) => r._id === id ? { ...r, ...patch } : r));

  async function submit() {
    if (!canSubmit || submitting) return;
    setError(null); setSubmitting(true);

    const payload = {
      visited_at: visitedAt,
      gym_id: gymId,
      memo: memo || '',
      attempts: attempts.map((a) => {
        const row = {
          is_cleared: !!a.is_cleared,
          attempts: Number(a.attempts) || 1,
          video_mode: a.video_mode || 'none',
        };
        if (a.color || a.level) row.new_problem = { color: a.color || null, level: a.level || null };
        return row;
      }),
      training: training.map((t) => ({
        category: t.category,
        duration_minutes: t.duration_minutes ? Number(t.duration_minutes) : null,
        memo: t.memo || null,
        items: [], // 항목 입력 UI는 추후 확장 — 현재는 카테고리/시간만
      })),
    };

    if (passKind === 'day') payload.used_day_pass = true;
    else if (passId) payload.gym_pass_id = passId;

    const filesIndexed = {};
    attempts.forEach((a, idx) => { if (a.video_mode === 'upload' && a.file) filesIndexed[idx] = a.file; });

    try {
      const res = await sessionsApi.create({ ...payload, files: filesIndexed });
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
          <button onClick={onClose} style={{ fontSize: 14, color: 'var(--ink-3)' }}>취소</button>
          <span style={{ fontSize: 15, fontWeight: 700 }}>운동 기록 추가</span>
          <button
            onClick={submit} disabled={!canSubmit || submitting}
            style={{ fontSize: 14, fontWeight: 700, color: canSubmit ? 'var(--primary)' : 'var(--ink-4)' }}
          >
            {submitting ? '저장 중...' : '저장'}
          </button>
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
              <FieldSelect
                label="암장"
                value={gymId} onChange={setGymId}
                options={[{ value: '', label: '선택' }, ...gyms.map((g) => ({ value: g.id, label: g.name }))]}
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

              <FieldText label="메모" value={memo} onChange={setMemo} placeholder="(선택) 한 줄 메모" isLast />
            </div>
          </div>

          {/* ── 완등·시도 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionLabel inline>완등·시도</SectionLabel>
              <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{attempts.length}개</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attempts.map((a) => (
                <div key={a._id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    {a.color || a.level
                      ? <ColorBadge color={a.color} level={a.level} size="sm" />
                      : <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>색·등급 선택</span>}
                    <span style={{ flex: 1 }} />
                    <button onClick={() => removeAttemptRow(a._id)} style={{ color: 'var(--ink-4)' }} aria-label="제거">{I.x(16)}</button>
                  </div>

                  {/* 색·등급 inline picker */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    <select value={a.color} onChange={(e) => updateAttemptRow(a._id, { color: e.target.value })}
                      style={{ padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                      <option value="">색상</option>
                      {COLOR_KEYS.map((k) => <option key={k} value={k}>{colorMeta(k).kr} {colorMeta(k).label}</option>)}
                    </select>
                    <select value={a.level} onChange={(e) => updateAttemptRow(a._id, { level: e.target.value })}
                      style={{ padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                      <option value="">V등급</option>
                      {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  {(a.color || a.level) && (
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
                      자동 제목: {fmtRouteTitle(a.color, a.level)}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
                    <Checkbox
                      checked={a.is_cleared}
                      onClick={() => updateAttemptRow(a._id, { is_cleared: !a.is_cleared })}
                      label="완등" tone="success"
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <span style={{ color: 'var(--ink-3)' }}>시도</span>
                      <Stepper value={a.attempts} onChange={(v) => updateAttemptRow(a._id, { attempts: v })} min={1} />
                      <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>회</span>
                    </div>
                  </div>

                  {/* 영상 옵션 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <RadioOpt mini label="영상 없음"     checked={a.video_mode === 'none'}   onClick={() => updateAttemptRow(a._id, { video_mode: 'none', file: null })} />
                    <RadioOpt mini label="새로 업로드"   checked={a.video_mode === 'upload'} onClick={() => updateAttemptRow(a._id, { video_mode: 'upload' })}
                      sub={a.file ? `${a.file.name} (${Math.round(a.file.size / 1024 / 1024)}MB)` : null} />
                    {a.video_mode === 'upload' && (
                      <input type="file" accept="video/*" onChange={(e) => updateAttemptRow(a._id, { file: e.target.files?.[0] })}
                        style={{ marginLeft: 25, fontSize: 12 }} />
                    )}
                  </div>
                </div>
              ))}
              <Btn variant="ghost" full icon={I.plus(14)} onClick={addAttemptRow}>완등·시도 추가</Btn>
            </div>
          </div>

          {/* ── 훈련 ── */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <SectionLabel inline>훈련</SectionLabel>
              <button onClick={addTrainingRow} style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>+ 추가</button>
            </div>
            {training.length === 0 ? (
              <div style={{
                background: 'var(--surface)', border: '1px dashed var(--line-2)',
                borderRadius: 'var(--r-md)', padding: '14px',
                fontSize: 12.5, color: 'var(--ink-3)', textAlign: 'center',
              }}>
                훈련 항목을 추가하면 분석에 반영됩니다.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {training.map((t) => (
                  <div key={t._id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Pill tone="primary">
                        {TRAINING_CATS.find(([k]) => k === t.category)?.[1] || t.category}
                      </Pill>
                      <span style={{ flex: 1 }} />
                      <button onClick={() => removeTrainingRow(t._id)} style={{ color: 'var(--ink-4)' }} aria-label="제거">{I.x(16)}</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <select value={t.category} onChange={(e) => updateTrainingRow(t._id, { category: e.target.value })}
                        style={{ padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
                        {TRAINING_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                      <input type="number" placeholder="시간(분)" value={t.duration_minutes}
                        onChange={(e) => updateTrainingRow(t._id, { duration_minutes: e.target.value })}
                        style={{ padding: '8px 10px', fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
                    </div>
                    <input placeholder="메모" value={t.memo}
                      onChange={(e) => updateTrainingRow(t._id, { memo: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', marginTop: 8, fontSize: 13, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ height: 8 }} />
        </div>
      </div>

      <style>{`
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
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

function FieldText({ label, value, onChange, placeholder, isLast }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: isLast ? 'none' : '1px solid var(--line)' }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)', width: 60 }}>{label}</span>
      <input value={value} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder}
        style={{ flex: 1, fontSize: 13.5, fontWeight: value ? 600 : 500, color: value ? 'var(--ink-1)' : 'var(--ink-4)', border: 0, background: 'transparent', padding: 0 }} />
    </div>
  );
}

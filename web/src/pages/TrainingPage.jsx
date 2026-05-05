import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { Btn, Chip, Checkbox, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import GoalAddModal from '../components/modals/GoalAddModal';
import { trainingApi, analyzeStream } from '../api/training';
import { climbLogsApi } from '../api/climbLogs';
import { useSessionAddModal } from '../contexts/SessionAddModalContext';
import RecordActionMenu from '../components/RecordActionMenu';
import RecordEditModal from '../components/modals/RecordEditModal';
import ClearedSummary from '../components/ClearedSummary';
import { colorMeta } from '../utils/colors';

const PERSPECTIVE_OPTIONS = [
  { key: 'strength_weakness', label: '약점·강점' },
  { key: 'trend',             label: '진행 추세' },
  { key: 'next_week_plan',    label: '다음 1주 추천 메뉴' },
  { key: 'injury_risk',       label: '부상 리스크' },
];

const RANGE_PRESETS = [
  ['1w',  '1주',  -7],
  ['4w',  '최근 4주', -28],
  ['3m',  '3개월', -90],
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function shiftDays(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

const CATEGORY_KO = { bouldering: '볼더링', endurance: '지구력', conditioning: '컨디셔닝', general: '기타' };

export default function TrainingPage() {
  const [tab, setTab] = useState('goals');
  const [goalAddOpen, setGoalAddOpen] = useState(false);
  const [goalsReloadTick, setGoalsReloadTick] = useState(0);
  const { open } = useSessionAddModal();

  function handleAdd() {
    if (tab === 'goals') setGoalAddOpen(true);
    else if (tab === 'records') open({ mode: 'training' });
  }

  const showAddBtn = tab !== 'analysis';
  const addBtn = showAddBtn ? (
    <button onClick={handleAdd} aria-label="추가"
      style={{
        width: 36, height: 36, borderRadius: 'var(--r-pill)',
        display: 'grid', placeItems: 'center',
        color: 'var(--ink-2)', background: 'var(--surface-2)',
      }}>
      {I.plus(18)}
    </button>
  ) : null;

  return (
    <>
      <TopBar right={addBtn} />

      <div style={{ display: 'flex', gap: 18, padding: '0 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        {[['goals', '목표'], ['records', '기록'], ['analysis', '분석']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '12px 0', borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent',
            fontSize: 13, fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'goals' && <GoalsTab reloadTick={goalsReloadTick} />}
      {tab === 'records' && <RecordsTab />}
      {tab === 'analysis' && <AnalysisTab />}

      {goalAddOpen && (
        <GoalAddModal
          onClose={() => setGoalAddOpen(false)}
          onSaved={() => setGoalsReloadTick((t) => t + 1)}
        />
      )}
    </>
  );
}

function GoalsTab({ reloadTick = 0 }) {
  const [goals, setGoals] = useState([]);
  const [editGoal, setEditGoal] = useState(null);
  const refresh = () => trainingApi.goals().then((r) => setGoals(r.data?.goals || [])).catch(() => {});
  useEffect(() => { refresh(); }, [reloadTick]);

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
        진행 중 ({goals.filter((g) => g.status === 'in_progress').length})
      </div>
      {goals.filter((g) => g.status === 'in_progress').map((g) => (
        <div key={g.id}
          onClick={() => setEditGoal(g)}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditGoal(g); }}
          style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)', padding: '14px', cursor: 'pointer',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🎯 {g.title}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· {CATEGORY_KO[g.category] || g.category}</span>
          </div>
          {g.target_date && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
              마감: {g.target_date}
            </div>
          )}
          {g.category === 'bouldering' && (g.metric_label || g.target_value != null) && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
              {g.metric_label && (() => {
                const m = colorMeta(g.metric_label);
                return <>난이도 <b>{m.kr} {m.label}</b> · </>;
              })()}
              완등 <b className="tabnum">{g.current_value || 0}</b> / <b className="tabnum">{g.target_value || 0}</b>
            </div>
          )}
          {g.category === 'endurance' && (g.metric_label || g.current_metric_label) && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
              난이도 <b>{g.current_metric_label || '-'}</b> → <b>{g.metric_label || '-'}</b>
            </div>
          )}
          {g.category === 'conditioning' && (g.metric_label || g.target_value != null) && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
              {g.metric_label && <><b>{g.metric_label}</b> · </>}
              <span className="tabnum">{g.current_value || 0}</span> / <span className="tabnum">{g.target_value || 0}</span> 회
            </div>
          )}
          {g.category === 'general' && g.description && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
              {g.description}
            </div>
          )}
          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${g.progress_percent || 0}%`, background: 'var(--primary)', transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--ink-3)' }}>{g.category !== 'general' ? (g.description || '') : ''}</span>
            <span className="tabnum" style={{ color: 'var(--ink-1)', fontWeight: 700 }}>{g.progress_percent || 0}%</span>
          </div>
        </div>
      ))}

      {editGoal && (
        <GoalAddModal
          goal={editGoal}
          onClose={() => setEditGoal(null)}
          onSaved={() => { setEditGoal(null); refresh(); }}
          onDeleted={() => { setEditGoal(null); refresh(); }}
        />
      )}
    </div>
  );
}

function RecordsTab() {
  const [data, setData] = useState({ sessions: [], summary: null });
  const [reloadTick, setReloadTick] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    trainingApi.sessions().then((r) => setData({
      sessions: r.data?.sessions || [],
      summary: r.data?.summary || null,
    })).catch(() => {});
  }, [reloadTick]);

  async function handleDelete(s) {
    const isSynth = !!s.synthetic_from_climb_log_id;
    const msg = isSynth
      ? '이 기록은 클라이밍 기록(캘린더)과 연동되어 있습니다. 원본을 삭제하시겠습니까? 되돌릴 수 없습니다.'
      : '이 훈련 세션을 삭제하시겠어요? 되돌릴 수 없습니다.';
    if (!confirm(msg)) return;
    try {
      if (isSynth) await climbLogsApi.remove(s.synthetic_from_climb_log_id);
      else await trainingApi.deleteSession(s.id);
      setReloadTick((t) => t + 1);
    } catch (e) { alert(e.message || '삭제 실패'); }
  }

  async function submitEdit(payload) {
    const t = editTarget;
    if (!t) return;
    if (t.synthetic_from_climb_log_id) {
      await climbLogsApi.update(t.synthetic_from_climb_log_id, {
        memo: payload.memo, visited_at: payload.date,
        duration_minutes: payload.duration_minutes,
      });
    } else {
      await trainingApi.updateSession(t.id, {
        memo: payload.memo, session_date: payload.date,
        duration_minutes: payload.duration_minutes,
      });
    }
    setReloadTick((tk) => tk + 1);
  }

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.summary && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)', padding: '14px',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>이번 주 요약</div>
          {Object.entries(data.summary.by_category || {}).map(([cat, v]) => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
              <span style={{ color: 'var(--ink-2)' }}>{CATEGORY_KO[cat] || cat}</span>
              <span className="tabnum" style={{ color: 'var(--ink-3)', fontSize: 12 }}>{v.count}회 · {Math.round(v.minutes / 60 * 10) / 10}시간</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 6, borderTop: '1px solid var(--line)', fontSize: 13, fontWeight: 700 }}>
            <span>합계</span>
            <span className="tabnum">{data.summary.total?.count || 0}세션 · {Math.round((data.summary.total?.minutes || 0) / 60 * 10) / 10}시간</span>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>최근 세션</div>

      {data.sessions.length === 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px dashed var(--line-2)',
          borderRadius: 'var(--r-md)', padding: 20, textAlign: 'center',
          fontSize: 12.5, color: 'var(--ink-3)',
        }}>
          우측 상단 ➕ 또는 하단 ➕ 으로 운동 기록을 추가하세요.
        </div>
      )}

      {data.sessions.map((s, idx) => {
        const targetLogId = s.synthetic_from_climb_log_id;
        const clickable = !!targetLogId;
        return (
        <div key={s.id || `synth-${idx}`}
          onClick={clickable ? () => navigate(`/logs/${targetLogId}`) : undefined}
          role={clickable ? 'button' : undefined}
          tabIndex={clickable ? 0 : undefined}
          onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') navigate(`/logs/${targetLogId}`); } : undefined}
          style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)', padding: '14px',
            cursor: clickable ? 'pointer' : 'default',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{s.session_date}</span>
              <Pill tone={s.synthetic_from_climb_log_id ? 'primary' : 'neutral'}>
                {CATEGORY_KO[s.category] || s.category}{s.synthetic_from_climb_log_id ? ' · 자동' : ''}
              </Pill>
            </div>
            <RecordActionMenu
              onEdit={() => setEditTarget(s)}
              onDelete={() => handleDelete(s)}
            />
          </div>
          {s.synthetic_from_climb_log_id ? (
            <>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 6 }}>
                📍 {s.gym_name}
              </div>
              {s.problems?.length > 0 && <ClearedSummary problems={s.problems} />}
              {s.memo && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>메모: {s.memo}</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>
                {s.duration_minutes != null && <>⏱ {s.duration_minutes}분</>}
                {s.gym_name && <> · 📍 {s.gym_name}</>}
              </div>
              {(s.items || []).map((it, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', padding: '2px 0' }}>
                  · {it.exercise_name}
                  {it.sets && <> × {it.sets}세트</>}
                </div>
              ))}
              {s.memo && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>메모: {s.memo}</div>}
            </>
          )}
        </div>
        );
      })}

      {editTarget && (
        <RecordEditModal
          kind={editTarget.synthetic_from_climb_log_id ? 'climb_log' : 'training_session'}
          logId={editTarget.synthetic_from_climb_log_id || undefined}
          initial={{
            memo: editTarget.memo,
            date: editTarget.session_date,
            duration_minutes: editTarget.duration_minutes,
            problems: editTarget.problems,
          }}
          onSubmit={submitEdit}
          onChanged={() => setReloadTick((t) => t + 1)}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

function AnalysisTab() {
  const [range, setRange] = useState({ key: '4w', from: shiftDays(-28), to: todayISO() });
  const [perspectives, setPerspectives] = useState(['strength_weakness', 'trend', 'next_week_plan']);
  const [extra, setExtra] = useState('');
  const [stage, setStage] = useState('idle');
  const [result, setResult] = useState('');
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    trainingApi.analyses({ limit: 10 }).then((r) => setHistory(r.data?.analyses || [])).catch(() => {});
  }, []);

  function selectRange(key, days) {
    setRange({ key, from: shiftDays(days), to: todayISO() });
  }
  function togglePerspective(k) {
    setPerspectives((prev) => prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k]);
  }

  async function runAnalyze() {
    setError(null); setResult(''); setStage('meta');
    try {
      for await (const ev of analyzeStream({ from: range.from, to: range.to, perspectives, extra_prompt: extra })) {
        if (ev.event === 'meta-ready') setStage('analysis');
        else if (ev.event === 'chunk') setResult((p) => p + (ev.data?.delta || ''));
        else if (ev.event === 'done') setStage('done');
        else if (ev.event === 'error') { setStage('error'); setError(ev.data?.message); }
      }
      const r = await trainingApi.analyses({ limit: 10 });
      setHistory(r.data?.analyses || []);
    } catch (e) {
      setStage('error');
      setError(e.message || '분석 실패');
    }
  }

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 분석 요청 카드 */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)', padding: '14px',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>분석 요청</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {RANGE_PRESETS.map(([k, l, d]) => (
            <Chip key={k} active={range.key === k} onClick={() => selectRange(k, d)}>{l}</Chip>
          ))}
          <Chip active={range.key === 'custom'} onClick={() => setRange({ ...range, key: 'custom' })}>직접</Chip>
        </div>
        {range.key === 'custom' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
            <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })}
              style={{ padding: '6px 10px', fontSize: 12, borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {PERSPECTIVE_OPTIONS.map((p) => (
            <Checkbox
              key={p.key}
              checked={perspectives.includes(p.key)}
              onClick={() => togglePerspective(p.key)}
              label={p.label}
            />
          ))}
        </div>
        <Btn variant="accent" full icon={I.sparkles(15)}
          disabled={stage === 'meta' || stage === 'analysis'} onClick={runAnalyze}>
          {stage === 'meta' ? '메타 프롬프트 생성 중...'
            : stage === 'analysis' ? '분석 응답 수신 중...'
              : 'AI 분석 요청'}
        </Btn>
        {error && <div style={{ marginTop: 8, color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
      </div>

      {/* 분석 결과 카드 (있을 때) */}
      {(result || stage === 'done') && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)', padding: '14px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>분석 결과</div>
            {stage === 'done' && <Pill tone="success">완료</Pill>}
            {(stage === 'meta' || stage === 'analysis') && <Pill tone="warn">진행 중</Pill>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10 }}>
            engine: claude-cli · 2단계 파이프라인
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {result || '...'}
          </div>
        </div>
      )}

      {/* 과거 분석 */}
      {history.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', marginTop: 4 }}>과거 분석 ({history.length})</div>
          {history.map((h) => (
            <div key={h.id} style={{
              background: 'var(--surface)', border: '1px solid var(--line)',
              borderRadius: 'var(--r-md)', padding: '12px 14px',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{h.from} ~ {h.to}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                {h.duration_ms}ms · 템플릿 {h.template?.key || '-'} v{h.template?.version || '?'}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

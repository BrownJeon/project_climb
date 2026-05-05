import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import { Btn, Chip, Checkbox, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { trainingApi, analyzeStream } from '../api/training';
import { useSessionAddModal } from '../contexts/SessionAddModalContext';

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

const CATEGORY_KO = { bouldering: '볼더링', endurance: '지구력', conditioning: '컨디셔닝' };

export default function TrainingPage() {
  const [tab, setTab] = useState('goals');
  const { open } = useSessionAddModal();

  return (
    <>
      <TopBar title="훈련" />

      <div style={{ display: 'flex', gap: 18, padding: '0 16px', borderBottom: '1px solid var(--line)', background: 'var(--surface)' }}>
        {[['goals', '목표'], ['records', '기록'], ['analysis', '분석']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '12px 0', borderBottom: tab === k ? '2px solid var(--ink-1)' : '2px solid transparent',
            fontSize: 13, fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--ink-1)' : 'var(--ink-3)',
          }}>{l}</button>
        ))}
      </div>

      {tab === 'goals' && <GoalsTab />}
      {tab === 'records' && <RecordsTab onAdd={() => open({ mode: 'training' })} />}
      {tab === 'analysis' && <AnalysisTab />}
    </>
  );
}

function GoalsTab() {
  const [goals, setGoals] = useState([]);
  const refresh = () => trainingApi.goals().then((r) => setGoals(r.data?.goals || [])).catch(() => {});
  useEffect(() => { refresh(); }, []);

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>
        진행 중 ({goals.filter((g) => g.status === 'in_progress').length})
      </div>
      {goals.filter((g) => g.status === 'in_progress').map((g) => (
        <div key={g.id} style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)', padding: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>🎯 {g.title}</span>
          </div>
          {g.target_date && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 8 }}>
              마감: {g.target_date}
            </div>
          )}
          {g.metric_label && (
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 8 }}>
              측정 단위: {g.metric_label} · 현재 <b className="tabnum">{g.current_value || 0}</b> → 목표 <b className="tabnum">{g.target_value || 0}</b>
            </div>
          )}
          <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${g.progress_percent || 0}%`, background: 'var(--primary)', transition: 'width .3s' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span style={{ color: 'var(--ink-3)' }}>{g.description || ''}</span>
            <span className="tabnum" style={{ color: 'var(--ink-1)', fontWeight: 700 }}>{g.progress_percent || 0}%</span>
          </div>
        </div>
      ))}
      <Btn variant="ghost" full icon={I.plus(15)}>새 목표</Btn>
    </div>
  );
}

function RecordsTab({ onAdd }) {
  const [data, setData] = useState({ sessions: [], summary: null });

  useEffect(() => {
    trainingApi.sessions().then((r) => setData({
      sessions: r.data?.sessions || [],
      summary: r.data?.summary || null,
    })).catch(() => {});
  }, []);

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 600 }}>최근 세션</div>
        <Btn variant="ghost" size="sm" icon={I.plus(13)} onClick={onAdd}>운동 기록</Btn>
      </div>

      {data.sessions.length === 0 && (
        <div style={{
          background: 'var(--surface)', border: '1px dashed var(--line-2)',
          borderRadius: 'var(--r-md)', padding: 20, textAlign: 'center',
          fontSize: 12.5, color: 'var(--ink-3)',
        }}>
          하단 ➕ 또는 위 버튼으로 운동 기록을 추가하세요.
        </div>
      )}

      {data.sessions.map((s, idx) => (
        <div key={s.id || `synth-${idx}`} style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)', padding: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{s.session_date}</span>
            <Pill tone={s.synthetic_from_climb_log_id ? 'primary' : 'neutral'}>
              {CATEGORY_KO[s.category] || s.category}{s.synthetic_from_climb_log_id ? ' · 자동' : ''}
            </Pill>
          </div>
          {s.synthetic_from_climb_log_id ? (
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              {s.gym_name} · {(s.items || []).length}항목
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>
                {s.duration_minutes != null && <>⏱ {s.duration_minutes}분</>}
                {s.gym_name && <> · 📍 {s.gym_name}</>}
              </div>
              {(s.items || []).map((it, i) => (
                <div key={i} style={{ fontSize: 12.5, color: 'var(--ink-2)', padding: '2px 0' }}>
                  · {it.exercise_name} <span className="tabnum">{it.reps_or_seconds}{it.metric_unit || ''}</span>
                  {it.sets && <> × {it.sets}세트</>}
                </div>
              ))}
              {s.memo && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>메모: {s.memo}</div>}
            </>
          )}
        </div>
      ))}
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

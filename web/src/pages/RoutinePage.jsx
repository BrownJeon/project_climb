import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import { Btn } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { routineApi } from '../api/routine';
import { trainingApi } from '../api/training';
import { climbLogsApi } from '../api/climbLogs';
import { COLOR_KEYS, colorMeta } from '../utils/colors';

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const CATEGORIES = [
  ['bouldering',   '볼더링'],
  ['endurance',    '지구력'],
  ['conditioning', '컨디셔닝'],
  ['general',      '기타'],
  ['rest',         '휴식'],
];
const V_LEVELS = ['V1','V2','V3','V4','V5','V6','V7','V8','V9','V10','V11','V12'];
const YDS_LEVELS = ['5.7','5.8','5.9','5.10a','5.10b','5.10c','5.10d','5.11a','5.11b','5.11c','5.11d'];
const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0];

function getMondayISO() {
  const d = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
function getSundayISO() {
  const d = new Date(getMondayISO());
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export default function RoutinePage() {
  const [routines, setRoutines] = useState([]);
  const [weekSessions, setWeekSessions] = useState([]);
  const [weekClimbs, setWeekClimbs] = useState(null);
  const [editingDay, setEditingDay] = useState(null); // null = 조회 모드, dow = 편집 중
  const [addingDay, setAddingDay] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);
  const today = new Date().getDay();

  useEffect(() => {
    routineApi.list().then((r) => setRoutines(r.data?.routines || [])).catch(() => {});
    const from = getMondayISO(), to = getSundayISO();
    trainingApi.sessions({ from, to }).then((r) => setWeekSessions(r.data?.sessions || [])).catch(() => {});
    climbLogsApi.summary(from, to).then((r) => setWeekClimbs(r.data)).catch(() => {});
  }, [reloadTick]);

  async function handleDelete(id) {
    if (!confirm('이 루틴 항목을 삭제하시겠어요?')) return;
    try { await routineApi.remove(id); setReloadTick((t) => t + 1); }
    catch (e) { alert(e.message || '삭제 실패'); }
  }

  function getAchievement(item) {
    if (item.category === 'rest') return null;
    if (item.category === 'bouldering') {
      const cleared = weekClimbs?.total_cleared || 0;
      const target = item.target_count || 0;
      if (!target) return null;
      return { current: cleared, target, pct: Math.min(100, Math.round((cleared / target) * 100)) };
    }
    const minutes = weekSessions
      .filter((s) => s.category === item.category)
      .reduce((acc, s) => acc + (s.duration_minutes || 0), 0);
    const target = item.target_minutes || 0;
    if (!target) return null;
    return { current: minutes, target, pct: Math.min(100, Math.round((minutes / target) * 100)), unit: '분' };
  }

  function itemDesc(item) {
    const cat = item.category;
    if (cat === 'bouldering') {
      const cm = item.target_color ? colorMeta(item.target_color) : null;
      const parts = [];
      if (cm) parts.push(`${cm.kr} ${cm.label}`);
      if (item.label) parts.push(item.label);
      if (item.target_count) parts.push(`목표 ${item.target_count}회`);
      return parts.join(' · ');
    }
    if (cat === 'endurance') {
      const parts = [];
      if (item.label) parts.push(item.label);
      if (item.target_count) parts.push(`주 ${item.target_count}회`);
      return parts.join(' · ');
    }
    if (cat === 'conditioning') {
      const unit = item.cond_unit === 'time' ? '초' : '회';
      const val = item.cond_unit === 'time' ? item.target_minutes : item.target_count;
      const parts = [];
      if (item.label) parts.push(item.label);
      if (val != null) parts.push(`목표 ${val}${unit}`);
      return parts.join(' · ');
    }
    return item.label || '';
  }

  function toggleEdit(dow) {
    if (editingDay === dow) { setEditingDay(null); setAddingDay(null); setEditingItemId(null); }
    else { setEditingDay(dow); setAddingDay(null); setEditingItemId(null); }
  }

  return (
    <>
      <TopBar title="루틴" />
      <div style={{ padding: '8px 16px 4px', fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 600 }}>
        이번 주 {getMondayISO()} ~ {getSundayISO()}
      </div>

      <div style={{ padding: '4px 16px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {WEEK_DAYS.map((dow) => {
          const items = routines[dow]?.items || [];
          const isToday = dow === today;
          const isEditing = editingDay === dow;
          const isAdding = addingDay === dow;

          return (
            <div key={dow} style={{
              background: 'var(--surface)',
              border: '1px solid ' + (isToday ? 'var(--primary)' : 'var(--line)'),
              borderRadius: 'var(--r-md)', overflow: 'hidden',
            }}>
              {/* 요일 헤더 */}
              <div style={{
                padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: isToday ? 'var(--primary-soft)' : 'var(--surface-2)',
                borderBottom: items.length || isAdding ? '1px solid var(--line)' : 'none',
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isToday ? 'var(--primary-ink)' : 'var(--ink-1)' }}>
                  {DOW_LABELS[dow]}{isToday && <span style={{ fontSize: 10.5, marginLeft: 5, opacity: .7 }}>오늘</span>}
                </span>
                <button onClick={() => toggleEdit(dow)}
                  style={{
                    fontSize: 11.5, fontWeight: 700, padding: '4px 10px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid ' + (isEditing ? 'var(--primary)' : 'var(--line-2)'),
                    background: isEditing ? 'var(--primary-soft)' : 'var(--surface)',
                    color: isEditing ? 'var(--primary)' : 'var(--ink-3)',
                  }}>
                  {isEditing ? '완료' : '편집'}
                </button>
              </div>

              {/* 루틴 항목 */}
              {items.length === 0 && !isAdding && (
                <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-4)', textAlign: 'center' }}>
                  {isEditing ? '항목이 없습니다. 아래 추가 버튼을 눌러 루틴을 등록하세요.' : '루틴 없음'}
                </div>
              )}

              {items.map((item, idx) => {
                const ach = getAchievement(item);
                const catLabel = CATEGORIES.find(([k]) => k === item.category)?.[1] || item.category;
                const desc = itemDesc(item);
                const isEditingThis = editingItemId === item.id;
                return (
                  <div key={item.id} style={{
                    padding: '10px 14px',
                    borderBottom: idx < items.length - 1 || isAdding || isEditing ? '1px solid var(--line)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{catLabel}</div>
                        {desc && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{desc}</div>}
                      </div>
                      {!isEditing && ach && (
                        <span className="tabnum" style={{
                          fontSize: 12, fontWeight: 700, flexShrink: 0,
                          color: ach.pct >= 100 ? 'var(--success)' : ach.pct >= 50 ? 'var(--primary)' : 'var(--ink-3)',
                        }}>{ach.pct}%</span>
                      )}
                      {isEditing && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            onClick={() => setEditingItemId(isEditingThis ? null : item.id)}
                            style={{ color: isEditingThis ? 'var(--primary)' : 'var(--ink-3)', padding: 4 }}>
                            {I.pencil(13)}
                          </button>
                          <button onClick={() => handleDelete(item.id)}
                            style={{ color: 'var(--danger)', padding: 4 }}>
                            {I.trash(13)}
                          </button>
                        </div>
                      )}
                    </div>
                    {!isEditing && ach && (
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-2)', overflow: 'hidden', marginTop: 6 }}>
                        <div style={{
                          width: `${ach.pct}%`, height: '100%', borderRadius: 2, transition: 'width .4s',
                          background: ach.pct >= 100 ? 'var(--success)' : 'var(--primary)',
                        }} />
                      </div>
                    )}
                    {isEditing && isEditingThis && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                        <EditRoutineForm
                          item={item}
                          onSaved={() => { setEditingItemId(null); setReloadTick((t) => t + 1); }}
                          onCancel={() => setEditingItemId(null)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 편집 모드: 항목 추가 */}
              {isEditing && (
                <div style={{ padding: '10px 14px', borderTop: items.length ? '1px solid var(--line)' : 'none' }}>
                  {isAdding
                    ? <AddRoutineForm
                        day={dow}
                        onSaved={() => { setAddingDay(null); setReloadTick((t) => t + 1); }}
                        onCancel={() => setAddingDay(null)}
                      />
                    : (
                      <button onClick={() => setAddingDay(dow)} style={{
                        width: '100%', padding: '10px', borderRadius: 'var(--r-sm)',
                        border: '1px dashed var(--line-2)', color: 'var(--primary)',
                        fontSize: 13, fontWeight: 600, background: 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                        {I.plus(14)} 항목 추가
                      </button>
                    )
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function AddRoutineForm({ day, onSaved, onCancel }) {
  const [category, setCategory] = useState('bouldering');
  const [targetColor, setTargetColor] = useState('');
  const [vLevel, setVLevel] = useState('');
  const [boulderCount, setBoulderCount] = useState('');
  const [ydsLevel, setYdsLevel] = useState('');
  const [enduranceCount, setEnduranceCount] = useState('');
  const [condUnit, setCondUnit] = useState('count');
  const [condBase, setCondBase] = useState('');
  const [condValue, setCondValue] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);

  function reset() {
    setTargetColor(''); setVLevel(''); setBoulderCount('');
    setYdsLevel(''); setEnduranceCount('');
    setCondBase(''); setCondValue(''); setMemo('');
  }

  async function save() {
    setSaving(true);
    try {
      const body = { day_of_week: day, category };
      if (category === 'bouldering') {
        body.target_color = targetColor || null;
        body.label = vLevel || null;
        body.target_count = boulderCount !== '' ? Number(boulderCount) : null;
      } else if (category === 'endurance') {
        body.label = ydsLevel || null;
        body.target_count = enduranceCount !== '' ? Number(enduranceCount) : null;
      } else if (category === 'conditioning') {
        body.label = condBase.trim() || null;
        body.cond_unit = condUnit;
        if (condUnit === 'count') body.target_count = condValue !== '' ? Number(condValue) : null;
        else body.target_minutes = condValue !== '' ? Number(condValue) : null;
      } else if (category === 'general') {
        body.label = memo.trim() || null;
      }
      await routineApi.create(body);
      onSaved();
    } catch (e) { alert(e.message || '저장 실패'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={lbl}>카테고리</div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); reset(); }} style={inp}>
          {CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      {category === 'bouldering' && (<>
        <div><div style={lbl}>목표 색상</div>
          <select value={targetColor} onChange={(e) => setTargetColor(e.target.value)} style={inp}>
            <option value="">전체</option>
            {COLOR_KEYS.map((k) => { const m = colorMeta(k); return <option key={k} value={k}>{m.kr} {m.label}</option>; })}
          </select>
        </div>
        <div><div style={lbl}>V등급 (선택)</div>
          <select value={vLevel} onChange={(e) => setVLevel(e.target.value)} style={inp}>
            <option value="">전체</option>
            {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div><div style={lbl}>목표 완등 횟수 (회)</div>
          <input type="number" min="1" inputMode="numeric" value={boulderCount}
            onChange={(e) => setBoulderCount(e.target.value)} style={inp} />
        </div>
      </>)}
      {category === 'endurance' && (<>
        <div><div style={lbl}>목표 난이도 (5.x)</div>
          <select value={ydsLevel} onChange={(e) => setYdsLevel(e.target.value)} style={inp}>
            <option value="">선택</option>
            {YDS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div><div style={lbl}>주간 목표 횟수 (회)</div>
          <input type="number" min="1" inputMode="numeric" value={enduranceCount}
            onChange={(e) => setEnduranceCount(e.target.value)} style={inp} />
        </div>
      </>)}
      {category === 'conditioning' && (<>
        <div><div style={lbl}>측정 유형</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['count','횟수 (회)'],['time','시간 (초)']].map(([k,l]) => (
              <button key={k} type="button" onClick={() => setCondUnit(k)} style={{
                flex:1, padding:'9px 12px', borderRadius:'var(--r-sm)', fontSize:13,
                border:'1px solid '+(condUnit===k?'var(--primary)':'var(--line-2)'),
                background:condUnit===k?'var(--primary-soft)':'var(--surface)',
                color:condUnit===k?'var(--primary-ink)':'var(--ink-2)',
                fontWeight:condUnit===k?700:500,
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div><div style={lbl}>트레이닝 종목</div>
          <input value={condBase} onChange={(e) => setCondBase(e.target.value)}
            placeholder={condUnit==='time'?'예: 행오프 / 데드행':'예: 푸시업 / 풀업'} style={inp} />
        </div>
        <div><div style={lbl}>{condUnit==='time'?'목표 시간 (초)':'목표 횟수 (회)'}</div>
          <input type="number" min="1" inputMode="numeric" value={condValue}
            onChange={(e) => setCondValue(e.target.value)} style={inp} />
        </div>
      </>)}
      {category === 'general' && (
        <div><div style={lbl}>내용</div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2}
            placeholder="자유롭게 입력" style={{...inp, resize:'vertical', fontFamily:'inherit'}} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" full disabled={saving} onClick={save}>{saving ? '저장 중...' : '저장'}</Btn>
        <Btn variant="ghost" full onClick={onCancel}>취소</Btn>
      </div>
    </div>
  );
}

function EditRoutineForm({ item, onSaved, onCancel }) {
  const [targetColor, setTargetColor] = useState(item.target_color || '');
  const [vLevel, setVLevel] = useState(item.category === 'bouldering' ? (item.label || '') : '');
  const [boulderCount, setBoulderCount] = useState(item.category === 'bouldering' ? (item.target_count != null ? String(item.target_count) : '') : '');
  const [ydsLevel, setYdsLevel] = useState(item.category === 'endurance' ? (item.label || '') : '');
  const [enduranceCount, setEnduranceCount] = useState(item.category === 'endurance' ? (item.target_count != null ? String(item.target_count) : '') : '');
  const [condUnit, setCondUnit] = useState(item.cond_unit || 'count');
  const [condBase, setCondBase] = useState(item.category === 'conditioning' ? (item.label || '') : '');
  const [condValue, setCondValue] = useState(item.category === 'conditioning' ? String(item.cond_unit === 'time' ? (item.target_minutes ?? '') : (item.target_count ?? '')) : '');
  const [memo, setMemo] = useState(item.category === 'general' ? (item.label || '') : '');
  const [saving, setSaving] = useState(false);
  const category = item.category;

  async function save() {
    setSaving(true);
    try {
      const body = {};
      if (category === 'bouldering') {
        body.target_color = targetColor || null;
        body.label = vLevel || null;
        body.target_count = boulderCount !== '' ? Number(boulderCount) : null;
      } else if (category === 'endurance') {
        body.label = ydsLevel || null;
        body.target_count = enduranceCount !== '' ? Number(enduranceCount) : null;
      } else if (category === 'conditioning') {
        body.label = condBase.trim() || null;
        body.cond_unit = condUnit;
        if (condUnit === 'count') { body.target_count = condValue !== '' ? Number(condValue) : null; body.target_minutes = null; }
        else { body.target_minutes = condValue !== '' ? Number(condValue) : null; body.target_count = null; }
      } else if (category === 'general') {
        body.label = memo.trim() || null;
      }
      await routineApi.update(item.id, body);
      onSaved();
    } catch (e) { alert(e.message || '저장 실패'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {category === 'bouldering' && (<>
        <div><div style={lbl}>목표 색상</div>
          <select value={targetColor} onChange={(e) => setTargetColor(e.target.value)} style={inp}>
            <option value="">전체</option>
            {COLOR_KEYS.map((k) => { const m = colorMeta(k); return <option key={k} value={k}>{m.kr} {m.label}</option>; })}
          </select>
        </div>
        <div><div style={lbl}>V등급 (선택)</div>
          <select value={vLevel} onChange={(e) => setVLevel(e.target.value)} style={inp}>
            <option value="">전체</option>
            {V_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div><div style={lbl}>목표 완등 횟수 (회)</div>
          <input type="number" min="1" inputMode="numeric" value={boulderCount}
            onChange={(e) => setBoulderCount(e.target.value)} style={inp} />
        </div>
      </>)}
      {category === 'endurance' && (<>
        <div><div style={lbl}>목표 난이도 (5.x)</div>
          <select value={ydsLevel} onChange={(e) => setYdsLevel(e.target.value)} style={inp}>
            <option value="">선택</option>
            {YDS_LEVELS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div><div style={lbl}>주간 목표 횟수 (회)</div>
          <input type="number" min="1" inputMode="numeric" value={enduranceCount}
            onChange={(e) => setEnduranceCount(e.target.value)} style={inp} />
        </div>
      </>)}
      {category === 'conditioning' && (<>
        <div><div style={lbl}>측정 유형</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['count','횟수 (회)'],['time','시간 (초)']].map(([k,l]) => (
              <button key={k} type="button" onClick={() => setCondUnit(k)} style={{
                flex:1, padding:'9px 12px', borderRadius:'var(--r-sm)', fontSize:13,
                border:'1px solid '+(condUnit===k?'var(--primary)':'var(--line-2)'),
                background:condUnit===k?'var(--primary-soft)':'var(--surface)',
                color:condUnit===k?'var(--primary-ink)':'var(--ink-2)',
                fontWeight:condUnit===k?700:500,
              }}>{l}</button>
            ))}
          </div>
        </div>
        <div><div style={lbl}>트레이닝 종목</div>
          <input value={condBase} onChange={(e) => setCondBase(e.target.value)}
            placeholder={condUnit==='time'?'예: 행오프 / 데드행':'예: 푸시업 / 풀업'} style={inp} />
        </div>
        <div><div style={lbl}>{condUnit==='time'?'목표 시간 (초)':'목표 횟수 (회)'}</div>
          <input type="number" min="1" inputMode="numeric" value={condValue}
            onChange={(e) => setCondValue(e.target.value)} style={inp} />
        </div>
      </>)}
      {category === 'general' && (
        <div><div style={lbl}>내용</div>
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2}
            placeholder="자유롭게 입력" style={{...inp, resize:'vertical', fontFamily:'inherit'}} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="primary" full disabled={saving} onClick={save}>{saving ? '저장 중...' : '저장'}</Btn>
        <Btn variant="ghost" full onClick={onCancel}>취소</Btn>
      </div>
    </div>
  );
}

const lbl = { fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', marginBottom: 4 };
const inp = {
  width: '100%', padding: '9px 12px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--ink-1)', outline: 'none',
};

import { useEffect, useMemo, useState } from 'react';
import TopBar from '../components/TopBar';
import { Btn, ColorBadge, Pill } from '../components/atoms';
import { I } from '../components/atoms/Icons';
import { climbLogsApi } from '../api/climbLogs';
import { useSessionAddModal } from '../contexts/SessionAddModalContext';

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selected, setSelected] = useState(today.getDate());
  const [dotDates, setDotDates] = useState(new Set());
  const [logs, setLogs] = useState([]);
  const { open } = useSessionAddModal();

  useEffect(() => {
    climbLogsApi.monthDates(year, month).then((r) => {
      setDotDates(new Set(r.data?.dates || []));
    }).catch(() => {});
  }, [year, month]);

  useEffect(() => {
    const date = ymd(year, month, selected);
    climbLogsApi.byDate(date).then((r) => setLogs(r.data?.logs || [])).catch(() => {});
  }, [year, month, selected]);

  const grid = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0).getDate();
    const startDow = first.getDay();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= last; d++) cells.push(d);
    return cells;
  }, [year, month]);

  function shiftMonth(dir) {
    let m = month + dir, y = year;
    if (m === 0) { m = 12; y--; }
    if (m === 13) { m = 1; y++; }
    setYear(y); setMonth(m); setSelected(1);
  }

  const isToday = (d) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear();

  const selectedDate = new Date(year, month - 1, selected);
  const dayName = DAY_LABELS[selectedDate.getDay()];
  const totalCleared = logs.reduce((acc, l) => acc + (l.problems || []).filter((p) => p.is_cleared).length, 0);

  return (
    <>
      <TopBar title="캘린더" />

      {/* Month header */}
      <div style={{ padding: '14px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <button onClick={() => shiftMonth(-1)} style={{ padding: 6, color: 'var(--ink-3)' }}>{I.chev(16, 'left')}</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{year}년 {month}월</div>
        <button onClick={() => shiftMonth(1)} style={{ padding: 6, color: 'var(--ink-3)' }}>{I.chev(16)}</button>
      </div>

      {/* Week labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 12px 4px' }}>
        {DAY_LABELS.map((d, i) => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, fontWeight: 600,
            color: i === 0 ? 'var(--danger)' : i === 6 ? 'var(--c-blue)' : 'var(--ink-3)',
          }}>{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: '4px 12px', display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {grid.map((d, i) => {
          if (!d) return <div key={i} />;
          const date = ymd(year, month, d);
          const has = dotDates.has(date);
          const sel = selected === d;
          const todayMark = isToday(d);
          return (
            <button key={i} onClick={() => setSelected(d)} style={{
              aspectRatio: '1', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 'var(--r-sm)', position: 'relative',
              background: sel ? 'var(--ink-1)' : todayMark ? 'var(--primary-soft)' : 'transparent',
              color: sel ? 'var(--surface)' : 'var(--ink-1)',
              fontSize: 14, fontWeight: sel || todayMark ? 700 : 500,
            }}>
              <span className="tabnum">{d}</span>
              {has && (
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: sel ? 'var(--surface)' : 'var(--primary)',
                  marginTop: 2,
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day panel */}
      <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{month}월 {selected}일 ({dayName}) 기록</div>
        {totalCleared > 0 && <Pill tone="primary">{totalCleared}완등</Pill>}
      </div>

      <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {logs.length === 0 ? (
          <div style={{
            background: 'var(--surface)', border: '1px dashed var(--line-2)',
            borderRadius: 'var(--r-md)', padding: 20, textAlign: 'center',
            fontSize: 12.5, color: 'var(--ink-3)',
          }}>
            기록이 없습니다
          </div>
        ) : logs.map((log) => (
          <div key={log.id} style={{
            background: 'var(--surface)', border: '1px solid var(--line)',
            borderRadius: 'var(--r-md)', overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{log.gym_name}</div>
                {(log.gym_pass || log.used_day_pass) && (
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {I.ticket(11)}
                    {log.gym_pass
                      ? `${log.gym_pass.label || (log.gym_pass.pass_type === 'period' ? '정기권' : '횟수권')}${log.gym_pass.pass_type === 'count' ? ` (잔여 ${log.gym_pass.remaining_count}회)` : ''}`
                      : '일일이용권'}
                  </div>
                )}
              </div>
              <button style={{ color: 'var(--ink-4)' }}>{I.more(18)}</button>
            </div>

            {log.memo && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', fontSize: 12.5, color: 'var(--ink-2)' }}>
                <span style={{ color: 'var(--ink-4)', fontSize: 11, marginRight: 6 }}>메모</span>
                {log.memo}
              </div>
            )}

            {(log.problems?.length > 0) && (
              <div style={{ padding: '8px 14px 12px' }}>
                {log.problems.map((p, i) => (
                  <div key={p.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                    borderBottom: i < log.problems.length - 1 ? '1px solid var(--line)' : 'none',
                  }}>
                    <ColorBadge color={p.color} level={p.level} size="sm" />
                    {p.is_cleared
                      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>{I.check(12)} 완등</span>
                      : <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>도전 중</span>}
                    <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>· {p.attempts || 1}회</span>
                    {p.ar_route && <span style={{ marginLeft: 'auto', color: 'var(--primary)' }}>{I.film(13)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 16px 16px' }}>
        <Btn variant="ghost" full icon={I.plus(15)}
          onClick={() => open({ initialPrefill: { visited_at: ymd(year, month, selected) } })}>
          기록 추가
        </Btn>
      </div>
    </>
  );
}

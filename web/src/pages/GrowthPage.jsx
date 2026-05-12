import { useEffect, useState } from 'react';
import TopBar from '../components/TopBar';
import { Chip, ColorBadge } from '../components/atoms';
import { climbLogsApi } from '../api/climbLogs';
import { trainingApi } from '../api/training';
import { colorMeta, COLOR_KEYS } from '../utils/colors';
import { styleLabel } from '../utils/style';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function shiftDays(n) { return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10); }

const RANGES = [
  ['1m', '이번 달', shiftDays(-30)],
  ['3m', '3개월',   shiftDays(-90)],
  ['6m', '6개월',   shiftDays(-180)],
  ['1y', '1년',     shiftDays(-365)],
];

function calcStreak(visitDates = []) {
  const set = new Set(visitDates);
  const today = todayISO();
  let streak = 0;
  let cur = today;
  while (set.has(cur)) {
    streak++;
    const d = new Date(cur);
    d.setDate(d.getDate() - 1);
    cur = d.toISOString().slice(0, 10);
  }
  return streak;
}

export default function GrowthPage() {
  const [rangeKey, setRangeKey] = useState('1m');
  const [summary, setSummary] = useState(null);
  const [goals, setGoals] = useState([]);
  const [styleStats, setStyleStats] = useState([]);

  const from = RANGES.find(([k]) => k === rangeKey)?.[2] || shiftDays(-30);
  const to = todayISO();

  useEffect(() => {
    climbLogsApi.summary(from, to).then((r) => setSummary(r.data)).catch(() => {});
    trainingApi.goals().then((r) => setGoals(r.data?.goals || [])).catch(() => {});
    climbLogsApi.listProblems({ from, to, limit: 200 }).then((r) => {
      const items = r.data?.items || [];
      const map = {};
      items.forEach((p) => {
        const k = p.style || 'none';
        if (!map[k]) map[k] = { cleared: 0, failed: 0 };
        map[k].cleared += Number(p.cleared_count ?? (p.is_cleared ? 1 : 0));
        map[k].failed += Number(p.failed_count ?? 0);
      });
      setStyleStats(Object.entries(map).map(([style, v]) => ({ style, ...v }))
        .sort((a, b) => (b.cleared + b.failed) - (a.cleared + a.failed)));
    }).catch(() => {});
  }, [from]);

  const streak = calcStreak(summary?.dates || []);
  const breakdown = summary?.breakdown || summary?.cleared_breakdown || [];
  const maxCleared = Math.max(1, ...breakdown.map((b) => b.count || 0));
  const inProgressGoals = goals.filter((g) => g.status === 'in_progress');

  return (
    <>
      <TopBar title="성장" />
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 80 }}>

        {/* 기간 선택 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map(([k, l]) => (
            <Chip key={k} active={rangeKey === k} onClick={() => setRangeKey(k)}>{l}</Chip>
          ))}
        </div>

        {/* 요약 카드 */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-md)', padding: '14px',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
        }}>
          {[
            { label: '방문', value: summary?.visits ?? '-', unit: '회' },
            { label: '완등', value: summary?.total_cleared ?? '-', unit: '개', color: 'var(--success)' },
            { label: '실패', value: summary?.total_failed ?? '-', unit: '개', color: 'var(--danger)' },
            { label: '연속', value: streak, unit: '일', color: streak >= 3 ? 'var(--primary)' : undefined },
          ].map(({ label, value, unit, color }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div className="tabnum" style={{ fontSize: 22, fontWeight: 700, color: color || 'var(--ink-1)', lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{label} ({unit})</div>
            </div>
          ))}
        </div>

        {/* 난이도별 완등 분포 */}
        {breakdown.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>난이도별 완등</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {breakdown.map((b) => {
                const m = colorMeta(b.color);
                const pct = Math.round((b.count / maxCleared) * 100);
                return (
                  <div key={`${b.color}-${b.level}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, flexShrink: 0 }}>
                      <ColorBadge color={b.color} level={b.level} size="sm" />
                    </div>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: m.dot, borderRadius: 4, transition: 'width .4s' }} />
                    </div>
                    <span className="tabnum" style={{ fontSize: 11, color: 'var(--ink-3)', width: 28, textAlign: 'right' }}>{b.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 벽 형태 통계 */}
        {styleStats.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>벽 형태별</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {styleStats.map(({ style, cleared, failed }) => (
                <div key={style} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, width: 90, flexShrink: 0, color: 'var(--ink-2)' }}>
                    {style === 'none' ? '미지정' : styleLabel(style)}
                  </span>
                  <span className="tabnum" style={{ fontSize: 11.5, color: 'var(--success)', fontWeight: 600 }}>완등 {cleared}</span>
                  {failed > 0 && <span className="tabnum" style={{ fontSize: 11.5, color: 'var(--danger)', fontWeight: 600 }}>실패 {failed}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 목표 진행률 요약 */}
        {inProgressGoals.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-3)', marginBottom: 10 }}>
              진행 중 목표 ({inProgressGoals.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {inProgressGoals.map((g) => (
                <div key={g.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-1)' }}>{g.title}</span>
                    <span className="tabnum" style={{ fontSize: 12, color: 'var(--ink-3)', fontWeight: 700 }}>{g.progress_percent || 0}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface-2)', overflow: 'hidden' }}>
                    <div style={{ width: `${g.progress_percent || 0}%`, height: '100%', background: 'var(--primary)', borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                  {g.target_date && (
                    <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 3 }}>마감 {g.target_date}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!summary && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>로딩 중...</div>
        )}
      </div>
    </>
  );
}

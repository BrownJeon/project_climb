/**
 * 시작/종료 시각(HH:MM)을 입력 받아 소요 시간(분)을 자동 계산해 표시.
 * onChange({start_time, end_time, duration_minutes}) — duration은 둘 다 유효할 때만 number, 아니면 null.
 */
function hmToMin(hm) {
  const normalized = normalizeTime(hm);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]); const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function normalizeTime(hm) {
  if (!hm) return '';
  const m = String(hm).trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return '';
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return '';
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function diffMin(start, end) {
  const s = hmToMin(start); const e = hmToMin(end);
  if (s == null || e == null) return null;
  let d = e - s;
  if (d < 0) d += 24 * 60;
  return d;
}
function fmtDuration(min) {
  if (min == null) return '';
  const h = Math.floor(min / 60); const m = min % 60;
  if (h && m) return `${h}시간 ${m}분`;
  if (h) return `${h}시간`;
  return `${m}분`;
}

const inputStyle = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid var(--line)', borderRadius: 'var(--r-sm)',
  background: 'var(--surface)', color: 'var(--ink-1)', outline: 'none',
};

export default function TimeRangeField({ start, end, onChange, label = '운동 시간', compact = false }) {
  const startValue = normalizeTime(start);
  const endValue = normalizeTime(end);
  const dur = diffMin(startValue, endValue);

  function update(patch) {
    const next = { start_time: startValue, end_time: endValue, ...patch };
    next.start_time = normalizeTime(next.start_time);
    next.end_time = normalizeTime(next.end_time);
    const d = diffMin(next.start_time, next.end_time);
    onChange?.({
      start_time: next.start_time || null,
      end_time: next.end_time || null,
      duration_minutes: d,
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {!compact && (
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)' }}>{label}</label>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="time" value={startValue}
          onChange={(e) => update({ start_time: e.target.value })}
          style={{ ...inputStyle, flex: 1 }} />
        <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>~</span>
        <input type="time" value={endValue}
          onChange={(e) => update({ end_time: e.target.value })}
          style={{ ...inputStyle, flex: 1 }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        {dur != null
          ? <>소요 시간: <b className="tabnum">{fmtDuration(dur)}</b> ({dur}분)</>
          : '시작·종료 시간을 입력하면 소요 시간이 자동 계산됩니다.'}
      </div>
    </div>
  );
}

export { diffMin, fmtDuration, normalizeTime };

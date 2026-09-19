// HH:MM ↔ 분 변환 + 두 시각의 소요 분 계산 (자정 넘는 경우 +24h)
function hmToMin(hm) {
  const normalized = normalizeTime(hm);
  if (!normalized) return null;
  const m = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]); const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return h * 60 + mm;
}

function normalizeTime(hm) {
  if (!hm || typeof hm !== 'string') return null;
  const m = hm.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]); const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * 두 시각으로 소요 분 계산. 둘 다 유효하지 않으면 null 반환.
 * end < start 이면 자정 넘는 운동으로 간주해 +24h 처리.
 */
function computeDurationMinutes(start, end) {
  const s = hmToMin(start); const e = hmToMin(end);
  if (s == null || e == null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

module.exports = { hmToMin, computeDurationMinutes, normalizeTime };

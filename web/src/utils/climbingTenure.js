/**
 * formatTenure('2024-03-05') → "2년 2개월차 (792일)"
 */
export function formatTenure(startedAt, today = new Date()) {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  const days = Math.floor((today - start) / 86400000);
  if (days < 0) return null;
  if (days < 30) return `${days}일차`;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years === 0) return `${months}개월차 (${days}일)`;
  return `${years}년 ${months}개월차 (${days}일)`;
}

export function formatDateKR(d) {
  if (!d) return '';
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

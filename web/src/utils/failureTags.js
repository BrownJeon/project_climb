export const FAILURE_TAGS = [
  ['footwork',   '발 위치/스밀링 실패'],
  ['balance',    '밸런스/코어'],
  ['reach',      '리치 부족/손잡기'],
  ['grip',       '홀드 그립력 부족'],
  ['power',      '동적 파워 부족'],
  ['reading',    '루트 리딩 오판'],
  ['other',      '기타'],
];

export function failureTagLabel(key) {
  return (FAILURE_TAGS.find(([k]) => k === key) || [key, key])[1];
}

export function parseFailureTags(s) {
  if (!s) return [];
  return String(s).split(',').map((x) => x.trim()).filter(Boolean);
}

export function joinFailureTags(arr) {
  return (arr || []).join(',');
}

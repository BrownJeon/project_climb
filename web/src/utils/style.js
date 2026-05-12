// 볼더링 문제 카테고리(벽 형태) — 단일 + 복합
export const STYLE_KEYS = [
  // 단일
  'slab', 'vertical', 'overhang', 'cave',
  // 복합
  'slab_vertical', 'vertical_overhang', 'slab_overhang', 'overhang_cave',
  // 기타
  'other',
];

const STYLE_META = {
  // 단일
  slab:             { label: '슬랩',          emoji: '◢' },
  vertical:         { label: '직벽',          emoji: '▮' },
  overhang:         { label: '오버행',         emoji: '◣' },
  cave:             { label: '동굴',          emoji: '⊓' },
  // 복합
  slab_vertical:    { label: '슬랩+직벽',     emoji: '◢▮' },
  vertical_overhang:{ label: '직벽+오버행',   emoji: '▮◣' },
  slab_overhang:    { label: '슬랩+오버행',   emoji: '◢◣' },
  overhang_cave:    { label: '오버행+동굴',   emoji: '◣⊓' },
  // 기타
  other:            { label: '기타',          emoji: '·' },
};

export function styleMeta(key) {
  return STYLE_META[key] || { label: key || '', emoji: '·' };
}

export function styleLabel(key) {
  return STYLE_META[key]?.label || key || '';
}

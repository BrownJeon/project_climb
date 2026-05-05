// 핸드오프 data.js의 COLORS 매핑
export const COLORS = {
  red:    { dot: '#e84a4a', label: '빨강', kr: '🔴' },
  orange: { dot: '#f08736', label: '주황', kr: '🟠' },
  yellow: { dot: '#f3c94a', label: '노랑', kr: '🟡' },
  green:  { dot: '#4aa760', label: '초록', kr: '🟢' },
  blue:   { dot: '#4a86e8', label: '파랑', kr: '🔵' },
  navy:   { dot: '#2b3e7a', label: '남색', kr: '🟦' },
  pink:   { dot: '#e88ab8', label: '핑크', kr: '🌸' },
  purple: { dot: '#8b5cb8', label: '보라', kr: '🟣' },
  black:  { dot: '#1a1a1a', label: '검정', kr: '⚫' },
  white:  { dot: '#f7f7f5', label: '흰색', kr: '⚪' },
  gray:   { dot: '#8c8c88', label: '회색', kr: '⬛' },
};

export const COLOR_KEYS = Object.keys(COLORS);

export function colorMeta(key) {
  return COLORS[key] || { dot: '#999', label: key || '', kr: '' };
}

// "노랑🟡 (V3)" 형식 — handoff fmt() 1:1
export function fmtRouteTitle(color, level) {
  const m = colorMeta(color);
  return `${m.label}${m.kr || ''}${level ? ` (${level})` : ''}`;
}

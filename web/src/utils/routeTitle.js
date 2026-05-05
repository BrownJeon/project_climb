import { fmtRouteTitle } from './colors';

// 기존 명명 호환 — formatRouteTitle({ color, level }) → "노랑🟡 (V3)"
export function formatRouteTitle({ color, level } = {}) {
  return fmtRouteTitle(color, level);
}

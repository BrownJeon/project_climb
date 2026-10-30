#!/usr/bin/env node
/**
 * 더 루트 앱 아이콘 생성기 — T009.
 *
 * 🔴 도안은 이 파일 상단 상수(BRAND·ON_BRAND·HOLDS·ROUTE·STROKE)가 **단일 진실**이다.
 *    산출된 PNG·XML 을 손으로 고치지 말 것 — 다음 실행에서 덮어써진다.
 *    사용자 데모 승인으로 도안이 바뀌면 상수만 고치고 다시 실행한 뒤 APK 를 재빌드한다(네이티브 변경 → 재설치 필요).
 *
 * 왜 mobile/scripts 에 있나: sharp 는 네이티브 모듈이라 ext4 작업 디렉터리에만 설치된다.
 * sync-local.sh 가 mobile/scripts/ 를 작업 디렉터리로 보내므로, 거기서 실행하면 형제 node_modules 에서
 * sharp 가 경로 조작 없이 해결된다. NFS 는 noexec 이라 NFS 위에서는 실행할 수 없다.
 *
 * 실행(산출물은 소스 쪽 경로에 직접 쓴다 — 역동기화가 필요 없다):
 *   bash <저장소>/mobile/scripts/sync-local.sh
 *   cd ~/.node-local/theroute-mobile        # 또는 $THEROUTE_APK_WORK
 *   node scripts/gen-app-icons.mjs --android <저장소>/mobile/android/app/src/main/res --web <저장소>/web/public
 * 두 옵션은 독립이다 — 하나만 줘도 된다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// ── 도안 (108x108 적응형 좌표계) — 사용자 승인 데모 v1 결정 D1 B · D3 B (2026-10-30 22:43) ──────────
// 정본: docs/demo/T009-android-apk-v1.html 의 ICONS.B, docs/web-design/T009-android-apk-guide.md §2-1. 값을 그대로 옮겼다.
// 적응형 아이콘은 108x108 중 안쪽 72x72(중심 54,54 기준 ±36)만 항상 보이고, 바깥은 런처가 모양에 따라 잘라 낸다.
// 검증 조건(가이드): 모든 홀드가 중심에서 반지름 33(안전 원 66dp) 안 — 가장 먼 (46,78) 은 거리 25.3 + r 6.5 = 31.8.
/** 아이콘 배경 = web/src/styles/tokens.css 의 primary 토큰(oklch(67% 0.18 38))의 sRGB 근사. 이 값의 유일한 정의다. */
const BRAND = '#EE6438';
const ON_BRAND = '#FFFFFF';
/** 루트 선: 아래에서 위로 지그재그로 오르는 선. */
const ROUTE = 'M46,78 L62,56 L48,32';
/** 홀드 3점: 시작·중간·끝(완등, 가장 크다). */
const HOLDS = [
  { x: 46, y: 78, r: 6.5 },
  { x: 62, y: 56, r: 5.5 },
  { x: 48, y: 32, r: 7.5 },
];
const STROKE = 5;

/** 원을 path 로 — vector drawable 에는 <circle> 이 없다. */
function circlePath({ x, y, r }) {
  return `M${x - r},${y} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
}

// ── Android vector drawable ─────────────────────────────────────────────────
function vectorDrawable() {
  const holds = HOLDS.map((h) => `    <path android:pathData="${circlePath(h)}" android:fillColor="${ON_BRAND}" />`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- 생성물: mobile/scripts/gen-app-icons.mjs. 손으로 고치지 말 것. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:pathData="${ROUTE}"
        android:strokeColor="${ON_BRAND}"
        android:strokeWidth="${STROKE}"
        android:strokeLineCap="round"
        android:strokeLineJoin="round" />
${holds}
</vector>
`;
}

function adaptiveIcon() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- 생성물: mobile/scripts/gen-app-icons.mjs. 손으로 고치지 말 것. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_theroute_foreground" />
    <monochrome android:drawable="@drawable/ic_theroute_monochrome" />
</adaptive-icon>
`;
}

function backgroundColorRes() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- 생성물: mobile/scripts/gen-app-icons.mjs. 손으로 고치지 말 것. -->
<resources>
    <color name="ic_launcher_background">${BRAND}</color>
</resources>
`;
}

// ── 래스터용 SVG ────────────────────────────────────────────────────────────
/**
 * shape: 'round' = 원(레거시 ic_launcher_round) · 'square' = 둥근 사각(레거시 ic_launcher·파비콘)
 *        · 'full' = 모서리를 자르지 않은 꽉 찬 사각(apple-touch-icon — iOS 가 직접 둥글게 자르므로 투명 모서리가 없어야 한다).
 */
function artSvg(shape) {
  const bg = shape === 'round'
    ? `<circle cx="54" cy="54" r="54" fill="${BRAND}" />`
    : shape === 'full'
      ? `<rect width="108" height="108" fill="${BRAND}" />`
      : `<rect width="108" height="108" rx="20" fill="${BRAND}" />`;
  const holds = HOLDS.map((h) => `<circle cx="${h.x}" cy="${h.y}" r="${h.r}" fill="${ON_BRAND}" />`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">`
    + bg
    + `<path d="${ROUTE}" fill="none" stroke="${ON_BRAND}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" />`
    + holds
    + `</svg>`;
}

async function png(shape, size, outPath) {
  await sharp(Buffer.from(artSvg(shape))).resize(size, size).png().toFile(outPath);
}

// ── 실행 ────────────────────────────────────────────────────────────────────
/** 적응형 아이콘을 못 쓰는 API 25 이하용 레거시 런처 아이콘 밀도. */
const DENSITIES = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];

function argOf(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function writeAndroid(res) {
  await mkdir(join(res, 'drawable'), { recursive: true });
  await mkdir(join(res, 'values'), { recursive: true });
  await mkdir(join(res, 'mipmap-anydpi-v26'), { recursive: true });

  // 🔴 전경 이름을 ic_theroute_* 로 분리한다 — Capacitor 템플릿의
  //    drawable-v24/ic_launcher_foreground.xml 이 ic_launcher_foreground 라는 같은 이름을 덮는다.
  await writeFile(join(res, 'drawable', 'ic_theroute_foreground.xml'), vectorDrawable());
  await writeFile(join(res, 'drawable', 'ic_theroute_monochrome.xml'), vectorDrawable());
  await writeFile(join(res, 'values', 'ic_launcher_background.xml'), backgroundColorRes());
  await writeFile(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIcon());
  await writeFile(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIcon());

  for (const [dir, size] of DENSITIES) {
    await mkdir(join(res, dir), { recursive: true });
    await png('square', size, join(res, dir, 'ic_launcher.png'));
    await png('round', size, join(res, dir, 'ic_launcher_round.png'));
  }
  console.log(`[icons] android → ${res}`);
}

async function writeWeb(pub) {
  await mkdir(pub, { recursive: true });
  await writeFile(join(pub, 'favicon.svg'), artSvg('square'));
  await png('square', 32, join(pub, 'favicon-32.png'));
  await png('full', 180, join(pub, 'apple-touch-icon.png'));
  console.log(`[icons] web → ${pub}`);
}

const androidRes = argOf('--android');
const webPublic = argOf('--web');
if (!androidRes && !webPublic) {
  console.error('사용법: node scripts/gen-app-icons.mjs [--android <res경로>] [--web <public경로>]');
  process.exit(1);
}
if (androidRes) await writeAndroid(androidRes);
if (webPublic) await writeWeb(webPublic);

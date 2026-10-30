/**
 * Capacitor 런타임 브리지 — 웹 코드가 네이티브(Android 앱) 기능을 만지는 **유일한 경로** (T009).
 *
 * `@capacitor/*` 를 import 하지 않는다: 앱은 운영 웹(server.url)을 그대로 로드한다 —
 * **같은 번들이 폰 앱과 PC·모바일 브라우저에 함께 나간다.** 네이티브 패키지를 import 하면 웹 사용자도
 * 그 코드를 받고, 플러그인이 빠진 환경에서는 모듈 최상위에서 터진다. 그래서 여기서는
 * **앱 WebView 에 Capacitor 가 주입하는 window.Capacitor 전역만** 본다.
 *
 * 규칙: 브리지·플러그인이 없으면 조용히 아무 일도 안 한다. 모든 함수가 웹에서는 no-op / false / null 을
 * 돌려주고, 호출부는 그 값으로 웹 동작으로 갈라진다.
 *
 * ⚠ 여기의 앱 판별은 **화면·동작 분기용**이다. window.Capacitor 는 누구나 흉내 낼 수 있으므로
 *   서버 권한 판단의 근거가 되지 않는다(서버는 PKCE challenge·1회용 코드로만 판단한다).
 */

/** 앱이 로드하는 운영 주소. 퓨니코드 — mobile/capacitor.config.ts 의 server.url 과 같은 값. */
export const APP_ORIGIN = 'https://climb.xn--lh0b87pnudm10a4vd.com';
/** 앱 intent-filter(theroute://auth)·서버 appAuthCodes.js 의 딥링크와 같은 값. */
export const AUTH_DEEP_LINK_SCHEME = 'theroute:';

const AUTH_CODE_RE = /^[0-9a-f]{64}$/;
/** 딥링크 주소 길이 상한 — 로그인 콜백은 100자 안팎이다. 지나치게 긴 값은 받지 않는다(StockInvest 이식). */
const MAX_APP_URL_LENGTH = 2048;

export function getBridge() {
  if (typeof window === 'undefined') return null;
  return window.Capacitor || null;
}

export function isNativeApp() {
  const b = getBridge();
  try {
    return !!b && typeof b.isNativePlatform === 'function' && b.isNativePlatform() === true;
  } catch {
    return false;
  }
}

/** 앱일 때만 플러그인 프록시를 꺼낸다. 없으면 null. */
function getPlugin(name) {
  if (!isNativeApp()) return null;
  const plugins = getBridge().Plugins;
  return (plugins && plugins[name]) || null;
}

function fn(plugin, method) {
  return plugin && typeof plugin[method] === 'function' ? plugin[method].bind(plugin) : null;
}

function toAppUrl(raw) {
  return typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_APP_URL_LENGTH ? raw : null;
}

/**
 * Custom Tab(외부 브라우저)으로 연다. **출처가 APP_ORIGIN 과 정확히 같은 https 주소만**(사용자 정보 없는) 연다 —
 * 상대 경로는 APP_ORIGIN 기준으로 푼다. `//evil.example` 같은 값도 다른 출처로 풀려 거부된다.
 * 앱이 아니거나 플러그인이 없거나 다른 출처이거나 실패하면 false — 호출부가 일반 이동으로 폴백한다.
 */
export async function openExternal(url) {
  const open = fn(getPlugin('Browser'), 'open');
  if (!open) return false;
  let target;
  try {
    const u = new URL(url, APP_ORIGIN);
    if (u.protocol !== 'https:' || u.username || u.password || u.origin !== APP_ORIGIN) return false;
    target = u.toString();
  } catch {
    return false;
  }
  try {
    await open({ url: target });
    return true;
  } catch {
    return false;
  }
}

/** 로그인이 끝나면 떠 있는 Custom Tab 을 닫는다. 부가 동작이라 실패해도 무시한다. */
export async function closeExternal() {
  const close = fn(getPlugin('Browser'), 'close');
  if (!close) return;
  try {
    await close();
  } catch {
    // 이미 닫혔거나(singleTask 복귀가 먼저 정리) 열린 적이 없다 — 사용자가 할 일이 없다.
    // (@capacitor/browser 문서는 close() 를 Web·iOS 전용이라 적었다 — 안 닫혀도 앱이 앞에 오면서 창은 뒤로 밀린다.)
  }
}

/**
 * theroute://auth/callback?… 인지 판정하고 URL 객체를 돌려준다.
 *
 * 🔴 함정: 커스텀 스킴은 WHATWG URL 의 "특수 스킴"이 아니라서 new URL('theroute://auth/callback') 의
 *    auth 는 **host** 로, pathname 은 `/callback` 으로 파싱된다.
 *    (주의: 이 주석 안에 별표 두 개 바로 뒤 슬래시를 쓰면 블록 주석이 거기서 닫힌다 — 09-18 계획서 원문의 함정.)
 *    pathname.includes('auth/callback') 으로 찾으면 영원히 못 찾는다(TheMeal 실기기에서 로그인이
 *    통째로 죽었던 원인) — 그래서 host 와 path 를 따로 본다.
 */
function parseAuthCallback(rawUrl) {
  const s = toAppUrl(rawUrl);
  if (s === null) return null;
  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  if (url.protocol !== AUTH_DEEP_LINK_SCHEME) return null;
  if (url.host !== 'auth') return null;
  if (url.pathname !== '/callback' && url.pathname !== '/callback/') return null;
  return url;
}

/** 딥링크에서 로그인 코드(소문자 hex 64자)를 꺼낸다. 로그인 딥링크가 아니거나 형식이 틀리면 null. */
export function authCodeFromDeepLink(rawUrl) {
  const url = parseAuthCallback(rawUrl);
  if (!url) return null;
  const code = url.searchParams.get('code');
  return code !== null && AUTH_CODE_RE.test(code) ? code : null;
}

/** 딥링크에 실린 오류(?error=…&msg=…, 예: 제공자에서 취소). 없으면 null. */
export function authErrorFromDeepLink(rawUrl) {
  const url = parseAuthCallback(rawUrl);
  if (!url) return null;
  const error = url.searchParams.get('error');
  if (error === null || error === '') return null;
  return { error, msg: url.searchParams.get('msg') || '' };
}

/** addListener 결과(핸들 또는 Promise<핸들>)를 받아, 해제가 먼저 불렸으면 등록 완료 즉시 지운다. */
function trackListener(result, isDisposed, setRemove) {
  Promise.resolve(result).then((h) => {
    const remove = h && typeof h.remove === 'function' ? () => h.remove() : null;
    if (isDisposed()) {
      if (remove) {
        try { Promise.resolve(remove()).catch(() => {}); } catch { /* 이미 해제됨 */ }
      }
    } else {
      setRemove(remove);
    }
  }).catch(() => {});
}

/**
 * 로그인 딥링크 구독 + **콜드 스타트 보정**.
 *
 * ⚠️ 앱이 꺼져 있다가 딥링크로 깨어나면 웹이 뜨기 전에 appUrlOpen 이 지나간다. Capacitor App 플러그인은
 *    그 이벤트를 보관했다가 첫 리스너에 주기도 하고, getLaunchUrl() 도 같은 주소를 준다.
 *    즉 **같은 주소가 두 번 올 수 있고**, getLaunchUrl() 은 WebView 가 새로고침돼도 계속 같은 옛 주소를
 *    준다. 코드는 1회용이므로 **중복 처리는 호출부(native/appLogin.js)가 막는다.**
 *
 * @param {(url: string, meta: {source: 'open'|'launch'}) => void} handler
 * @returns {() => void} 구독 해제. 브리지가 없으면 아무것도 안 하는 함수.
 */
export function onAuthDeepLink(handler) {
  const app = getPlugin('App');
  if (!app) return () => {};

  let disposed = false;
  let removeListener = null;

  const addListener = fn(app, 'addListener');
  if (addListener) {
    try {
      const result = addListener('appUrlOpen', (data) => {
        const url = toAppUrl(data && data.url);
        if (!disposed && url !== null) handler(url, { source: 'open' });
      });
      trackListener(result, () => disposed, (r) => { removeListener = r; });
    } catch {
      // 리스너 등록 실패 — 콜드 스타트 보정만 남는다.
    }
  }

  const getLaunchUrl = fn(app, 'getLaunchUrl');
  if (getLaunchUrl) {
    Promise.resolve()
      .then(() => getLaunchUrl())
      .then((launch) => {
        const url = toAppUrl(launch && launch.url);
        if (!disposed && url !== null) handler(url, { source: 'launch' });
      })
      .catch(() => {});
  }

  return () => {
    disposed = true;
    if (removeListener) {
      try { Promise.resolve(removeListener()).catch(() => {}); } catch { /* 무시 */ }
      removeListener = null;
    }
  };
}

/**
 * 하드웨어 뒤로가기. 🔴 리스너를 하나라도 등록하면 Capacitor 의 기본 동작(WebView goBack)이 **꺼진다** —
 * 그래서 등록한 쪽(native/backStack.js handleNativeBack)이 모달 닫기·뒤로·종료를 전부 책임진다.
 * @param {(data: {canGoBack?: boolean}) => void} handler
 */
export function onBackButton(handler) {
  const addListener = fn(getPlugin('App'), 'addListener');
  if (!addListener) return () => {};
  let disposed = false;
  let removeListener = null;
  try {
    const result = addListener('backButton', (data) => { if (!disposed) handler(data || {}); });
    trackListener(result, () => disposed, (r) => { removeListener = r; });
  } catch {
    return () => {};
  }
  return () => {
    disposed = true;
    if (removeListener) {
      try { Promise.resolve(removeListener()).catch(() => {}); } catch { /* 무시 */ }
      removeListener = null;
    }
  };
}

/** 앱 종료(루트에서 뒤로가기). 웹에서는 아무 일도 없다. */
export async function exitApp() {
  const exit = fn(getPlugin('App'), 'exitApp');
  if (!exit) return false;
  try {
    await exit();
    return true;
  } catch {
    return false;
  }
}

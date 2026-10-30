/**
 * 앱 로그인 — Custom Tab 시작(PKCE)부터 딥링크를 로그인 상태로 바꾸는 마지막 한 칸까지 (T009).
 *
 * 흐름 (개정 2026-10-30 §3):
 *   [Google/GitHub로 계속하기] → startAppLogin(provider)
 *     → verifier(32바이트 base64url, 43자)·challenge(S256) 생성 → verifier 를 **WebView localStorage**
 *       `theroute_app_pkce` 에 {verifier, provider, createdAt} 로 보관
 *     → Custom Tab 으로 `${APP_ORIGIN}/api/auth/app-start?provider=…&challenge=…` 를 연다
 *   → (서버) 제공자 로그인 → theroute://auth/callback?code=<64hex>
 *   → 딥링크 수신 → Custom Tab 닫기 → 보관한 verifier 를 **꺼내면서 지운다**(교환 성공·실패 무관)
 *     → POST /api/auth/app-exchange {code, verifier} → JWT → login(token)(토큰 저장 + /auth/me) → 홈으로 replace.
 *
 * 왜 PKCE 인가: 다른 앱도 theroute:// 를 등록할 수 있어 딥링크의 code 만으로는 가로채기를 막지 못한다.
 * verifier 는 이 WebView 밖으로 나가지 않고(URL·로그·서버 저장 없음, 교환 요청 본문으로 한 번), 서버는 challenge 만 안다.
 * 왜 localStorage 인가(sessionStorage 아님): Custom Tab 이 떠 있는 동안 안드로이드가 앱 프로세스를 죽이면
 * sessionStorage 는 사라진다. 10분 TTL 과 "교환 시도 때 삭제"로 수명을 묶는다.
 *
 * 같은 딥링크가 여러 번 온다 — 콜드 스타트에서 appUrlOpen(보관 이벤트, source 'open')과 getLaunchUrl()
 * (source 'launch')이 같은 주소를 주고, getLaunchUrl() 은 **WebView 새로고침 뒤에도** 옛 주소를 계속 준다.
 *  · 코드 딥링크: 코드는 1회용이라 출처와 무관하게 한 번만 처리한다(메모리 Set + sessionStorage 지문).
 *  · 오류 딥링크(?error=): 같은 취소를 두 번 하면 **두 번 다 알려야** 한다(매번 똑같은 문자열이다).
 *    그래서 open 출처는 걸러내지 않고, launch 출처(콜드 스타트 이중 전달·새로고침 재전달)만 거른다.
 *  · sessionStorage 에는 주소 원문이 아니라 FNV-1a 32비트 지문만 남긴다(코드 원문을 저장소에 두지 않는다).
 *  · 옛 launch 코드가 실패했는데 **이미 로그인돼 있으면** 조용히 넘긴다 — 멀쩡히 쓰는 사람에게
 *    "로그인 시간이 지났습니다" 알림을 띄우지 않는다. 사용자가 방금 누른 로그인(open)의 실패는 항상 알린다.
 *
 * 사용자 문구는 승인 데모 v1 §4 "제안 v1" 열 그대로다(D4, 마침표 포함). 바꾸려면 데모 재승인.
 *
 * 이 파일은 React 를 import 하지 않는다 — 의존성은 전부 주입받는다(Node 단위 테스트가 실제 파일을 읽는다).
 */
import { APP_ORIGIN, authCodeFromDeepLink, authErrorFromDeepLink, isNativeApp, openExternal } from './bridge.js';

export const HANDLED_KEY = 'theroute_app_login_handled';
export const HANDLED_MAX = 20;

/** PKCE verifier 보관 키(WebView localStorage) — 개정 §3-2. */
export const PKCE_KEY = 'theroute_app_pkce';
/** verifier 수명 — 서버 표시 쿠키(10분)와 같다. */
export const PKCE_TTL_MS = 10 * 60 * 1000;
/** 개정 §3-1 — verifier·challenge 모두 base64url 43자. */
export const PKCE_RE = /^[A-Za-z0-9_-]{43}$/;
/** 서버 app-start 화이트리스트와 같은 값. */
export const APP_LOGIN_PROVIDERS = Object.freeze(['google', 'github']);
/**
 * 기기가 Custom Tab 의 302 스킴 이동을 막으면 true 로 바꿔 웹 배포만으로 "앱으로 돌아가기" 버튼 페이지로
 * 전환한다(스펙 §7 폴백 — APK 재빌드 불필요). 기본 false.
 */
export const APP_START_FALLBACK = false;
/** 이중 탭 방지 — 직전 시작이 진행 중이거나 이 시간 안에 Custom Tab 을 열었으면 새 흐름을 만들지 않는다. */
export const START_GUARD_MS = 2000;
/**
 * 진행 중 표시의 최대 수명(Reviewer 2라운드 L-2). Browser.open() 이 끝내 응답하지 않으면 진행 중 표시가 앱 종료까지 남아
 * 이후 탭이 전부 조용히 무시된다. 이 시간이 지나면 진행 중 표시를 낡은 것으로 보고 새 시작을 허용한다.
 */
export const START_INFLIGHT_MAX_MS = 10000;
/**
 * launch 로 처리한 오류 딥링크의 "이중 전달 대기" 수명(Reviewer 2라운드 L-1). 콜드 스타트에 launch 만 오고 보관된 open 이
 * 오지 않으면 그 지문이 남아 같은 페이지의 다음 사용자 취소 한 번을 삼킨다. 이 시간이 지나면 이중 전달로 보지 않는다.
 */
export const LAUNCH_ECHO_TTL_MS = 3000;

/** 승인 데모 v1 §4 문구(D4). */
export const MESSAGES = Object.freeze({
  cancelled: '로그인을 취소했습니다.',
  expired: '로그인 시간이 지났습니다. 다시 로그인해 주세요.',
  network: '서버에 연결하지 못했습니다. 다시 로그인해 주세요.',
  failed: '로그인에 실패했습니다. 다시 시도해 주세요.',
});

// ── PKCE ──────────────────────────────────────────────────────────────────

function b64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function webCrypto(cryptoImpl) {
  const c = cryptoImpl || (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined);
  if (!c || typeof c.getRandomValues !== 'function' || !c.subtle || typeof c.subtle.digest !== 'function') {
    // 비보안 컨텍스트(http)·구형 WebView — 앱은 https 운영 주소를 로드하므로 정상 경로에서는 오지 않는다.
    throw new Error('Web Crypto 를 쓸 수 없습니다');
  }
  return c;
}

/** RFC 7636 S256 — base64url(SHA-256(ascii(verifier))). verifier 형식이 틀리면 던진다. */
export async function pkceChallenge(verifier, cryptoImpl) {
  if (typeof verifier !== 'string' || !PKCE_RE.test(verifier)) throw new Error('verifier 형식이 올바르지 않습니다');
  const c = webCrypto(cryptoImpl);
  const digest = await c.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** verifier = 32바이트 무작위의 base64url(43자), challenge = S256(verifier). Web Crypto 가 없으면 던진다. */
export async function createPkcePair(cryptoImpl) {
  const c = webCrypto(cryptoImpl);
  const raw = new Uint8Array(32);
  c.getRandomValues(raw);
  const verifier = b64url(raw);
  return { verifier, challenge: await pkceChallenge(verifier, c) };
}

// ── verifier 보관 ─────────────────────────────────────────────────────────
// localStorage 가 막힌 WebView 를 위해 메모리에도 둔다(같은 프로세스 동안은 그걸로 돌아온다).
// 꺼낼 때는 둘 다 지운다.

let memoryPending = null;
/**
 * 이중 탭 방지 상태.
 *  · currentStart: 진행 중인 시작 { token, at } — 없으면 null. token 으로 "아직 내 시작이 현재인가"를 가린다
 *    (낡은 시작이 START_INFLIGHT_MAX_MS 뒤 새 시작에 밀린 다음 늦게 끝나도 새 시작의 verifier·상태를 건드리지 않게).
 *  · lastOpenedAt: 마지막으로 Custom Tab 을 연 시각.
 */
let currentStart = null;
let lastOpenedAt = -Infinity;

/** 시작 보호를 모두 푼다 — 로그인 딥링크가 왔을 때(로그인 창이 끝났다). */
function releaseStartGuard() {
  currentStart = null;
  lastOpenedAt = -Infinity;
}

export function defaultLocalStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function defaultSessionStorage() {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** 시작 직전에 verifier 를 보관한다. 이전 대기 건은 덮어쓴다(마지막으로 연 Custom Tab 과 짝). */
export function savePendingLogin(storage, { verifier, provider }, now = Date.now()) {
  const entry = { verifier, provider, createdAt: now };
  memoryPending = entry;
  try {
    if (storage) storage.setItem(PKCE_KEY, JSON.stringify(entry));
  } catch (e) {
    // 저장소가 막혀 있어도 메모리 값으로 돌아온다(프로세스가 죽지 않는 한) — 조용히 삼키지 않고 남긴다.
    console.warn('[native-login] verifier 저장 실패 — 메모리로만 보관합니다', e && e.name);
  }
}

/** 대기 중인 로그인을 버린다(Custom Tab 열기 실패 등). */
export function clearPendingLogin(storage) {
  memoryPending = null;
  try {
    if (storage) storage.removeItem(PKCE_KEY);
  } catch {
    // 저장소 접근 실패 — 남은 값은 TTL 로 무효가 된다.
  }
}

/**
 * 딥링크와 짝지을 verifier 를 **꺼내면서 지운다**(두 번째 호출은 null). 10분 지났거나·미래 시각이거나·형식이 다르면 null.
 * @returns {{verifier: string, provider: string} | null}
 */
export function takePendingVerifier(storage, now = Date.now()) {
  let entry = memoryPending;
  memoryPending = null;
  try {
    if (!entry && storage) {
      const raw = storage.getItem(PKCE_KEY);
      entry = raw ? JSON.parse(raw) : null;
    }
  } catch {
    entry = null; // 깨진 값 — 아래에서 지운다
  }
  try {
    if (storage) storage.removeItem(PKCE_KEY);
  } catch {
    // 저장소 접근 실패 — 메모리 값만 본다
  }
  if (!entry || typeof entry !== 'object') return null;
  const { verifier, provider, createdAt } = entry;
  if (typeof verifier !== 'string' || !PKCE_RE.test(verifier)) return null;
  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) return null;
  if (now < createdAt || now - createdAt > PKCE_TTL_MS) return null;
  return { verifier, provider: typeof provider === 'string' ? provider : '' };
}

// ── 시작 ──────────────────────────────────────────────────────────────────

/** Custom Tab 으로 열 app-start 절대 주소. */
export function buildAppStartUrl(provider, challenge, { origin = APP_ORIGIN, fallback = false } = {}) {
  const qs = new URLSearchParams({ provider, challenge });
  if (fallback) qs.set('fallback', '1');
  return `${origin}/api/auth/app-start?${qs.toString()}`;
}

/**
 * 앱 로그인 시작. Custom Tab 을 열었으면(또는 직전 시작이 아직 진행 중이라 이번 탭을 무시했으면) true.
 * false 면(앱 아님·모르는 provider·Web Crypto 없음·Custom Tab 열기 실패) 호출부가 기존 웹 이동으로 폴백한다.
 * 실패하면 방금 보관한 verifier 를 지운다(진행 중인 로그인이 없다).
 *
 * 이중 탭 방지: 버튼을 연달아 누르면 두 번째 시작이 verifier 를 덮어써 첫 Custom Tab 의 로그인이 실패한다.
 * 그래서 시작이 진행 중이거나 START_GUARD_MS 안에 Custom Tab 을 열었으면 새 흐름을 만들지 않고 true 를 돌려준다.
 * 로그인 딥링크(성공·오류)가 오면 이 보호를 바로 푼다 — 취소 직후 다시 누르면 곧바로 열린다.
 * 진행 중 표시는 START_INFLIGHT_MAX_MS 가 지나면 낡은 것으로 본다(open() 이 영영 응답하지 않는 경우의 탈출구).
 * 그렇게 밀려난 낡은 시작이 나중에 끝나면 상태·verifier 를 건드리지 않고 true 를 돌려준다
 * (false 를 돌려주면 그 옛 탭의 호출부가 뒤늦게 웹 이동으로 폴백해 새 로그인을 깨뜨린다).
 *
 * @param {'google'|'github'} provider
 * @param {object} [deps] 시험용 주입 — isNative, open, storage, cryptoImpl, now, fallback
 */
export async function startAppLogin(provider, deps = {}) {
  const {
    isNative = isNativeApp,
    open = openExternal,
    storage = defaultLocalStorage(),
    cryptoImpl,
    now = Date.now,
    fallback = APP_START_FALLBACK,
  } = deps;
  if (!isNative()) return false;
  if (!APP_LOGIN_PROVIDERS.includes(provider)) return false;
  const t = now();
  const inFlight = currentStart !== null && t - currentStart.at < START_INFLIGHT_MAX_MS;
  if (inFlight || t - lastOpenedAt < START_GUARD_MS) return true; // 이미 처리 중

  const me = { token: {}, at: t };
  currentStart = me;
  const isCurrent = () => currentStart === me;
  try {
    let pair;
    try {
      pair = await createPkcePair(cryptoImpl);
    } catch (e) {
      if (!isCurrent()) return true;
      console.warn('[native-login] PKCE 생성 실패 — 웹 이동으로 폴백합니다', e && e.message);
      return false;
    }
    if (!isCurrent()) return true; // 그새 밀려났다 — 새 시작의 verifier 를 덮어쓰지 않는다
    savePendingLogin(storage, { verifier: pair.verifier, provider }, now());

    let opened = false;
    try {
      opened = (await open(buildAppStartUrl(provider, pair.challenge, { fallback }))) === true;
    } catch {
      opened = false;
    }
    if (!isCurrent()) return true; // 밀려났거나 딥링크가 보호를 풀었다 — 상태를 건드리지 않는다
    if (opened) lastOpenedAt = now();
    else clearPendingLogin(storage);
    return opened;
  } finally {
    if (isCurrent()) currentStart = null;
  }
}

// ── 교환 실패 분류 ────────────────────────────────────────────────────────

/**
 * app-exchange 요청이 거절된 값(axios 응답 인터셉터가 reject 한 것)을 사용자 문구가 붙은 Error 로 바꾼다.
 *  · 서버가 JSON 으로 답함(`data` 키 있음 — 프로젝트 규약 {success,data,message}): `httpStatus` 401 이면 `expired`, 그 밖 `failed`
 *  · 서버에 닿지 못함(인터셉터 대체 객체 {success,message} — `data` 키 없음 · 시간 초과 · 프록시 HTML 등 객체 아님): `network`
 * `httpStatus` 는 api/auth.js 의 appExchange 가 transformResponse 로 응답 본문에 실어 준다.
 * @returns {Error & {kind: 'expired'|'failed'|'network', httpStatus?: number}}
 */
export function toExchangeError(rejected) {
  let kind = 'network';
  let httpStatus;
  if (rejected && typeof rejected === 'object' && 'data' in rejected) {
    httpStatus = typeof rejected.httpStatus === 'number' ? rejected.httpStatus : undefined;
    kind = httpStatus === 401 ? 'expired' : 'failed';
  }
  const err = new Error(MESSAGES[kind]);
  err.kind = kind;
  if (httpStatus !== undefined) err.httpStatus = httpStatus;
  return err;
}

/** 교환 실패를 사용자 문구로. kind 가 없는(예상 밖) 오류는 `failed` 문구. */
export function exchangeErrorMessage(e) {
  const kind = e && typeof e === 'object' ? e.kind : undefined;
  return (typeof kind === 'string' && Object.prototype.hasOwnProperty.call(MESSAGES, kind)) ? MESSAGES[kind] : MESSAGES.failed;
}

// ── 딥링크 → 로그인 ──────────────────────────────────────────────────────

/** 처리한 딥링크 기록용 짧은 지문(FNV-1a 32비트) — 코드 원문을 저장소에 남기지 않으려는 것. 보안 경계가 아니라 중복 제거용. */
export function fingerprint(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function readHandled(storage) {
  try {
    const raw = storage && storage.getItem(HANDLED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string' && /^[0-9a-f]{8}$/.test(s)) : [];
  } catch {
    return [];
  }
}

function writeHandled(storage, fp) {
  try {
    if (!storage) return;
    const next = readHandled(storage).filter((s) => s !== fp);
    next.push(fp);
    storage.setItem(HANDLED_KEY, JSON.stringify(next.slice(-HANDLED_MAX)));
  } catch {
    // 저장소가 막힌 WebView — 메모리 Set 만으로 한 페이지 안 중복은 막힌다.
  }
}

/** 제공자에서 취소 등 서버가 실어 보낸 오류를 사용자 문구로. */
export function describeAuthError({ error, msg } = {}) {
  const text = `${error || ''} ${msg || ''}`;
  if (/access_denied|cancel/i.test(text)) return MESSAGES.cancelled;
  return MESSAGES.failed;
}

/**
 * @param {object} deps
 * @param {(code: string, verifier: string) => Promise<string>} deps.exchange  코드+verifier → JWT (실패 시 toExchangeError 형태로 throw)
 * @param {(token: string) => Promise<boolean>} deps.login  토큰 저장 + 사용자 조회, 성공 여부
 * @param {(path: string, opts?: object) => void} deps.navigate
 * @param {(msg: string) => void} deps.notify
 * @param {() => Promise<void>} [deps.closeExternal]
 * @param {() => boolean} [deps.hasToken]
 * @param {Storage|null} [deps.storage]      중복 기록용(sessionStorage) — 지문만 저장
 * @param {Storage|null} [deps.pkceStorage]  verifier 보관소(localStorage) — 기본 window.localStorage
 * @param {() => number} [deps.now]
 * @returns {(url: string, meta?: {source?: 'open'|'launch'}) => Promise<'ignored'|'duplicate'|'error-link'|'failed'|'silent'|'ok'>}
 */
export function createAppLoginHandler(deps) {
  const {
    exchange, login, navigate, notify,
    closeExternal = async () => {},
    hasToken = () => false,
    storage = null,
    pkceStorage = defaultLocalStorage(),
    now = Date.now,
  } = deps;
  const seenCodes = new Set();
  /**
   * 이 페이지에서 launch 출처로 처리한 오류 딥링크 지문 → 처리 시각. 같은 주소가 LAUNCH_ECHO_TTL_MS 안에 open 으로
   * 한 번 더 오면(콜드 스타트 이중 전달) 그 한 번만 거른다. 그 뒤에 오는 open 은 사용자의 새 취소로 보고 처리한다.
   */
  const launchEchoes = new Map();

  async function safeClose() {
    try { await closeExternal(); } catch { /* 부가 동작 */ }
  }

  /** 처리할지 판정. false 면 duplicate. */
  function admit(url, code, source) {
    const fp = fingerprint(url);
    if (code) {
      // 코드는 1회용 — 출처 무관 한 번만.
      if (seenCodes.has(fp) || readHandled(storage).includes(fp)) return false;
      seenCodes.add(fp);
      writeHandled(storage, fp);
      return true;
    }
    if (source === 'launch') {
      // 콜드 스타트 이중 전달(open 이 먼저 처리)·새로고침 재전달은 거른다.
      if (readHandled(storage).includes(fp)) return false;
      writeHandled(storage, fp);
      launchEchoes.set(fp, now());
      return true;
    }
    // open: 같은 취소를 반복해도 매번 알린다. 단 launch 가 방금(LAUNCH_ECHO_TTL_MS 안) 처리한 콜드 스타트 이중 전달 한 번은 거른다.
    if (launchEchoes.has(fp)) {
      const at = launchEchoes.get(fp);
      launchEchoes.delete(fp);
      const age = now() - at;
      if (age >= 0 && age < LAUNCH_ECHO_TTL_MS) return false;
    }
    writeHandled(storage, fp); // 뒤이어 오는 launch(같은 콜드 스타트·새로고침)가 거르도록 기록
    return true;
  }

  return async function handleAuthDeepLink(url, meta = {}) {
    const source = meta && meta.source === 'launch' ? 'launch' : 'open';
    const code = authCodeFromDeepLink(url);
    const err = code ? null : authErrorFromDeepLink(url);
    if (!code && !err) return 'ignored'; // 로그인과 무관한 딥링크

    if (!admit(url, code, source)) return 'duplicate';
    releaseStartGuard(); // 로그인 창이 끝났다 — 이중 탭 보호(진행 중 표시 포함)를 푼다

    await safeClose();

    if (err) {
      // verifier 는 지우지 않는다 — 계약상 삭제 시점은 "교환 시도"이고, 남은 값은 다음 시작이 덮거나 TTL 로 무효가 된다.
      notify(describeAuthError(err));
      if (!hasToken()) navigate('/login', { replace: true });
      return 'error-link';
    }

    // 🔴 교환 **전에** 꺼내면서 지운다 — 성공·실패 무관하게 이 시도로 소모된다(개정 §3-2).
    const pending = takePendingVerifier(pkceStorage, now());
    if (!pending) {
      if (source === 'launch' && hasToken()) return 'silent';
      notify(MESSAGES.expired);
      if (!hasToken()) navigate('/login', { replace: true });
      return 'failed';
    }

    let token;
    try {
      token = await exchange(code, pending.verifier);
    } catch (e) {
      if (source === 'launch' && hasToken()) return 'silent';
      notify(exchangeErrorMessage(e));
      if (!hasToken()) navigate('/login', { replace: true });
      return 'failed';
    }

    let ok = false;
    try {
      ok = (await login(token)) !== false;
    } catch {
      ok = false;
    }
    if (!ok) {
      notify(MESSAGES.failed);
      navigate('/login', { replace: true });
      return 'failed';
    }
    navigate('/', { replace: true });
    return 'ok';
  };
}

/** 시험 전용 — 모듈 메모리(대기 verifier·이중 탭 보호) 초기화. */
export function __resetAppLoginForTest() {
  memoryPending = null;
  releaseStartGuard();
}

/**
 * 앱(Android APK) 로그인용 60초 1회용 코드 저장소 + PKCE(S256) + 표시 쿠키 헬퍼 — T009.
 *
 * 왜 코드인가: Google 은 WebView 안 OAuth 를 막는다. 그래서 앱은 Custom Tab(외부 브라우저)으로
 * 로그인하고, 서버가 로그인 끝에 앱 스킴 theroute://auth/callback 으로 돌려보낸다. 그런데 Custom Tab 과
 * 앱 WebView 는 저장소(localStorage·쿠키)를 공유하지 않으므로 토큰을 어떻게든 앱에 넘겨야 한다.
 * 딥링크 URL 에 JWT(30일 유효)를 그대로 실으면 기록·가로채기 한 번에 계정이 넘어간다 —
 * 그래서 딥링크에는 60초·1회용·추측 불가(256bit) 코드만 싣고, 앱 WebView 가
 * POST /api/auth/app-exchange 로 코드를 JWT 로 바꾼다.
 *
 * 왜 PKCE 인가(개정 2026-10-30 §3): theroute:// 스킴은 기기의 다른 앱도 등록할 수 있어 딥링크에 실린
 * 코드가 가로채질 수 있다. 앱 WebView 는 로그인 시작 때 만든 verifier 를 WebView 밖으로 내보내지 않고
 * challenge = S256(verifier) 만 서버에 보낸다(표시 쿠키에 실려 콜백까지 운반된다). 서버는 코드를 발급할 때
 * challenge 를 함께 묶어 두고, 교환 때 verifier 를 받아 S256 을 다시 계산해 대조한다 —
 * 코드만 가로챈 쪽은 verifier 가 없어 교환하지 못한다.
 *
 * 메모리 Map 인 이유: pm2 단일 프로세스(theroute-api)이고 코드 수명이 60초라, 재시작으로 잃는 것은
 * "진행 중이던 로그인 1건"뿐이다(사용자는 다시 누르면 된다). DB 테이블을 만들 이유가 없다.
 *
 * 🔴 코드·토큰·verifier 원문을 로그에 남기지 않는다(호출부 포함).
 */
const crypto = require('crypto');

/** 서버가 만드는 코드 모양 — 소문자 hex 64자(32바이트). 이 밖의 입력은 형식 오류(400). */
const APP_AUTH_CODE_RE = /^[0-9a-f]{64}$/;
/**
 * PKCE verifier·challenge 형식 — 둘 다 패딩 없는 base64url 43자.
 * RFC 7636 §4.1 은 verifier 43~128자를 허용하지만, 이 앱의 클라이언트(web/src/native/appLogin.js)는
 * 항상 32바이트 무작위의 base64url(43자)만 만든다. 받아들이는 형식을 실제로 만드는 형식 하나로 좁힌다.
 */
const PKCE_RE = /^[A-Za-z0-9_-]{43}$/;
/** Custom Tab 에만 심는 "이 로그인은 앱에서 시작됐다" 표시 쿠키. */
const APP_LOGIN_COOKIE = 'route_app_login';
const APP_LOGIN_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;
/** 앱 intent-filter(mobile/android/app/src/main/AndroidManifest.xml)와 같은 값. */
const APP_DEEP_LINK_BASE = 'theroute://auth/callback';
const APP_AUTH_PROVIDERS = Object.freeze(['google', 'github']);

function isPkceVerifier(v) {
  return typeof v === 'string' && PKCE_RE.test(v);
}

function isPkceChallenge(v) {
  return typeof v === 'string' && PKCE_RE.test(v);
}

/** S256(verifier) = base64url(SHA-256(ascii(verifier))), 패딩 없음(RFC 7636 §4.2). */
function pkceChallengeOf(verifier) {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

/** 길이가 같을 때만 상수 시간 비교. 길이가 다르면 false(형식 검사를 통과한 값끼리는 항상 43자다). */
function safeEqualAscii(a, b) {
  const ba = Buffer.from(a, 'ascii');
  const bb = Buffer.from(b, 'ascii');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * @param {object} [opts]
 * @param {number} [opts.ttlMs=60000]        코드 수명
 * @param {() => number} [opts.now=Date.now] 시계 — 테스트에서 시간을 주입한다
 * @param {number} [opts.maxEntries=500]     상한(발급 폭주 시 메모리 보호) — 넘으면 오래된 것부터 버린다
 */
function createAppAuthCodeStore({ ttlMs = 60 * 1000, now = Date.now, maxEntries = 500 } = {}) {
  // 0 이하·소수·NaN 이면 아래 issue() 의 "오래된 것 버리기" while 이 끝나지 않는다(빈 Map 에서 삭제 불가) → 생성 시 거부.
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new RangeError('maxEntries must be a positive integer');
  /** code → { token, challenge, expiresAt }. Map 은 삽입 순서를 지키므로 첫 항목이 가장 오래된 것이다. */
  const codes = new Map();

  function sweep() {
    const t = now();
    for (const [code, entry] of codes) {
      if (entry.expiresAt <= t) codes.delete(code);
    }
  }

  /**
   * 토큰과 PKCE challenge 를 맡기고 1회용 코드를 돌려준다. 토큰 검증(서명·만료)은 호출부 책임이다.
   * challenge 형식이 틀리면 던진다 — 호출부(콜백 핸들러)는 이것을 오류 딥링크로 바꾼다.
   */
  function issue({ token, challenge } = {}) {
    if (typeof token !== 'string' || token === '') throw new Error('token required');
    if (!isPkceChallenge(challenge)) throw new Error('valid PKCE challenge required');
    sweep();
    while (codes.size >= maxEntries) {
      codes.delete(codes.keys().next().value);
    }
    const code = crypto.randomBytes(32).toString('hex');
    codes.set(code, { token, challenge, expiresAt: now() + ttlMs });
    return code;
  }

  /**
   * 코드를 verifier 로 꺼낸다.
   * - 형식 오류(code 64hex 아님 · verifier 43자 base64url 아님)면 저장소를 건드리지 않고 'malformed'.
   * - 형식이 맞으면 **맞든 틀리든 만료됐든 그 자리에서 항목을 지운다**(1회용) — 그다음 판정한다.
   *   verifier 가 틀린 시도도 코드를 태운다: 가로챈 쪽이 verifier 를 추측해 여러 번 두드릴 수 없게.
   * 'unknown'|'expired'|'mismatch' 는 서버 로그용 구분이며, 응답에서는 전부 같은 401 로 수렴한다.
   * @returns {{status:'ok', token:string} | {status:'malformed'|'unknown'|'expired'|'mismatch'}}
   */
  function consume(code, verifier) {
    if (typeof code !== 'string' || !APP_AUTH_CODE_RE.test(code)) return { status: 'malformed' };
    if (!isPkceVerifier(verifier)) return { status: 'malformed' };
    // 미지의 코드에서도 같은 해시를 계산한다(분기별 처리량 차이를 줄인다).
    const presented = pkceChallengeOf(verifier);
    const entry = codes.get(code);
    codes.delete(code);
    if (!entry) return { status: 'unknown' };
    if (entry.expiresAt <= now()) return { status: 'expired' };
    if (!safeEqualAscii(presented, entry.challenge)) return { status: 'mismatch' };
    return { status: 'ok', token: entry.token };
  }

  return { issue, consume, size: () => codes.size, ttlMs };
}

/** theroute://auth/callback?code=… / ?error=…&msg=… — 빈 값은 싣지 않는다. */
function buildAppDeepLink(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v !== '') qs.set(k, v);
  }
  return `${APP_DEEP_LINK_BASE}?${qs.toString()}`;
}

/** cookie-parser 없이 한 개 값만 읽는다(이 앱에 쿠키는 이것 하나뿐이다). 같은 이름이 여럿이면 첫 번째. */
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (typeof header !== 'string' || header === '') return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/*
 * 표시 쿠키 값 인코딩 — `<모드>.<challenge>`
 *   n.<43자>  일반(302 딥링크)
 *   f.<43자>  fallback(앱으로 돌아가기 버튼 HTML)
 * 엄격 파싱: 이 정규식에 정확히 맞지 않으면 "앱 로그인이 아님"(null) — 콜백 핸들러는 next() 한다.
 * challenge 는 공개값(verifier 의 해시)이라 쿠키에 실어도 비밀이 새지 않는다. HttpOnly 라 JS 로도 못 읽는다.
 */
const APP_LOGIN_COOKIE_VALUE_RE = /^([nf])\.([A-Za-z0-9_-]{43})$/;

function encodeAppLoginCookie({ challenge, fallback = false }) {
  if (!isPkceChallenge(challenge)) throw new Error('valid PKCE challenge required');
  return `${fallback ? 'f' : 'n'}.${challenge}`;
}

/** @returns {{challenge:string, fallback:boolean} | null} */
function parseAppLoginCookie(raw) {
  if (typeof raw !== 'string') return null;
  const m = APP_LOGIN_COOKIE_VALUE_RE.exec(raw);
  if (!m) return null;
  return { fallback: m[1] === 'f', challenge: m[2] };
}

// SameSite=Lax 여야 OAuth 제공자에서 돌아오는 최상위 GET 네비게이션에 쿠키가 실린다.
const APP_LOGIN_COOKIE_OPTIONS = Object.freeze({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });

/** @param {{challenge:string, fallback?:boolean}} mark */
function setAppLoginCookie(res, mark) {
  res.cookie(APP_LOGIN_COOKIE, encodeAppLoginCookie(mark), {
    ...APP_LOGIN_COOKIE_OPTIONS,
    maxAge: APP_LOGIN_COOKIE_MAX_AGE_MS,
  });
}

function clearAppLoginCookie(res) {
  res.clearCookie(APP_LOGIN_COOKIE, { ...APP_LOGIN_COOKIE_OPTIONS });
}

/** 프로세스 공용 저장소 — 라우트(교환)와 콜백 핸들러(발급)가 같은 인스턴스를 쓴다. */
const appAuthCodes = createAppAuthCodeStore();

module.exports = {
  APP_AUTH_CODE_RE,
  APP_AUTH_PROVIDERS,
  APP_DEEP_LINK_BASE,
  APP_LOGIN_COOKIE,
  APP_LOGIN_COOKIE_MAX_AGE_MS,
  PKCE_RE,
  appAuthCodes,
  buildAppDeepLink,
  clearAppLoginCookie,
  createAppAuthCodeStore,
  encodeAppLoginCookie,
  isPkceChallenge,
  isPkceVerifier,
  parseAppLoginCookie,
  pkceChallengeOf,
  readCookie,
  setAppLoginCookie,
};

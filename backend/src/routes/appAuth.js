/**
 * 앱(Android APK) 로그인 라우트 핸들러 — T009 (PKCE S256 포함, 개정 2026-10-30 §3).
 *
 * routes/auth.js 가 이 둘을 마운트한다. 🔴 마운트는 공용 OAuth 라우터(`router.use('/', oauthRouter)`)
 * 보다 **앞**이어야 한다 — 뒤에 두면 GET /app-start 가 공용 라우터의 GET /:provider 에 먼저 잡혀
 * "Unknown OAuth provider" 404 가 된다.
 *
 * 흐름 전체 설명: routes/appOAuthCallback.js 머리말.
 * 🔴 코드·토큰·verifier 원문을 로그에 남기지 않는다.
 */
const {
  APP_AUTH_PROVIDERS,
  appAuthCodes,
  isPkceChallenge,
  setAppLoginCookie,
} = require('../services/appAuthCodes');

/** 교환 실패(불일치·만료·미지·재사용)의 유일한 응답 문구 — 원인을 구별해 알려주지 않는다. */
const EXCHANGE_INVALID_MESSAGE = '로그인 코드가 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요';

/** 프로젝트 규약: { success, data, message } */
function fail(res, status, message) {
  return res.status(status).json({ success: false, data: null, message });
}
function ok(res, data) {
  return res.status(200).json({ success: true, data, message: '' });
}

/**
 * GET /api/auth/app-start?provider=google|github&challenge=<43자>[&fallback=1]
 *
 * 앱이 Custom Tab 으로 여는 주소. "이 로그인은 앱에서 시작됐다"는 표시 쿠키(challenge 포함)를
 * Custom Tab 에 심고 기존 OAuth 시작점으로 넘긴다. 쿠키는 HttpOnly·Secure·SameSite=Lax·path /·10분.
 */
function appStartHandler(req, res) {
  const q = req.query || {};
  res.set('Cache-Control', 'no-store');
  const provider = typeof q.provider === 'string' ? q.provider : '';
  if (!APP_AUTH_PROVIDERS.includes(provider)) {
    return fail(res, 400, '지원하지 않는 로그인 방식입니다');
  }
  if (!isPkceChallenge(q.challenge)) {
    return fail(res, 400, '앱 로그인 요청 형식이 올바르지 않습니다');
  }
  setAppLoginCookie(res, { challenge: q.challenge, fallback: q.fallback === '1' });
  res.set('Referrer-Policy', 'no-referrer');
  return res.redirect(302, `/api/auth/${provider}`);
}

/**
 * POST /api/auth/app-exchange  { code, verifier }  →  { token }
 *
 * 딥링크로 받은 60초 1회용 코드를 verifier 와 함께 JWT 로 바꾼다.
 * - 형식 오류 → 400 (저장소는 건드리지 않는다)
 * - 형식이 맞으면 코드는 맞든 틀리든 한 번 보면 지운다 → 실패는 전부 같은 401 본문
 *
 * @param {object} [deps] 테스트 주입용
 * @param {{consume:(code:unknown, verifier:unknown)=>{status:string, token?:string}}} [deps.store]
 */
function createAppExchangeHandler({ store = appAuthCodes } = {}) {
  return function appExchangeHandler(req, res) {
    res.set('Cache-Control', 'no-store');
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = store.consume(body.code, body.verifier);
    if (result.status === 'malformed') {
      return fail(res, 400, '로그인 요청 형식이 올바르지 않습니다');
    }
    if (result.status !== 'ok') {
      // 서버 로그에는 원인 구분(unknown|expired|mismatch)만 — 코드·verifier 원문은 남기지 않는다.
      console.warn(`[app-auth] 코드 교환 실패 (${result.status})`);
      return fail(res, 401, EXCHANGE_INVALID_MESSAGE);
    }
    return ok(res, { token: result.token });
  };
}

const appExchangeHandler = createAppExchangeHandler();

module.exports = {
  EXCHANGE_INVALID_MESSAGE,
  appExchangeHandler,
  appStartHandler,
  createAppExchangeHandler,
};

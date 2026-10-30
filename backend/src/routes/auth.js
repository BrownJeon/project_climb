const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const { register, login, me, refreshToken, findOrCreateUser } = require('../controllers/authController');
const { createOAuthRouter } = require('@workspace/auth-oauth/adapters/express');
const { appStartHandler, appExchangeHandler } = require('./appAuth');

const JWT_SECRET  = process.env.JWT_SECRET  || 'theroute-dev-secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '30d';

const router = Router();

// ─── 이메일/비밀번호 인증 ─────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login',    login);
router.get('/me',        authenticate, me);
router.post('/refresh',  refreshToken);

// ─── 앱(Android APK) 로그인 — T009 (PKCE S256) ───────────────────────────────
// 🔴 공용 OAuth 라우터(router.use('/', oauthRouter))보다 **앞**에 둔다. 뒤에 두면
//    GET /app-start 가 공용 라우터의 GET /:provider 에 먼저 잡혀 "Unknown OAuth provider" 404 가 된다.
// 🔴 공용 패키지(@workspace/auth-oauth, 여러 프로젝트 공용)는 수정하지 않는다 — TheRoute 전용 라우트로만 붙인다.
// 흐름 전체 설명: routes/appOAuthCallback.js 머리말.
router.get('/app-start', appStartHandler);
router.post('/app-exchange', appExchangeHandler);

// ─── OAuth (Google / GitHub) ──────────────────────────────────────────────────
const OAUTH_ENABLED = {
  ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { github: { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET } }
    : {}),
};

const callbackBase = process.env.OAUTH_CALLBACK_BASE || 'http://localhost:3100';
const frontendUrl  = process.env.FRONTEND_URL        || callbackBase;

const oauthRouter = createOAuthRouter({
  providers:        OAUTH_ENABLED,
  jwtSecret:        JWT_SECRET,
  jwtExpires:       JWT_EXPIRES,
  callbackBaseUrl:  callbackBase,
  frontendUrl,
  findOrCreateUser,
});
router.use('/', oauthRouter);

if (Object.keys(OAUTH_ENABLED).length > 0) {
  console.log(`[auth] OAuth 활성화: ${Object.keys(OAUTH_ENABLED).join(', ')}`);
} else {
  console.log('[auth] OAuth 비활성화 (GOOGLE_CLIENT_ID / GITHUB_CLIENT_ID 미설정)');
}

module.exports = router;

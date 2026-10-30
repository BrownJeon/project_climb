/**
 * 앱 로그인 복귀 핸들러 — GET /oauth/callback · GET /login?error= (T009, PKCE 개정 2026-10-30 §3).
 *
 * backend/src/index.js 에서 **dist 정적 서빙 뒤 · SPA 폴백 앞**에 붙는다.
 * 🔴 SPA 폴백 정규식은 건드리지 않는다 — 이 핸들러가 처리하지 않는 요청은 전부 next() 로
 *    흘려 보내 **웹 로그인 흐름은 한 글자도 바뀌지 않는다.**
 *
 * 흐름
 * 1. 앱 WebView 가 verifier·challenge 를 만들고(verifier 는 WebView 밖으로 나가지 않는다),
 *    Custom Tab 으로 /api/auth/app-start?provider=google&challenge=<43자> 를 연다
 *    → 표시 쿠키(route_app_login = n.<challenge> | f.<challenge>)를 심고 공용 OAuth 라우터로 302.
 * 2. 공용 라우터(@workspace/auth-oauth, 무수정)가 성공 시 /oauth/callback?token=<JWT> 로,
 *    실패 시 /login?error=…&msg=… 로 302 한다.
 *    🔴 실패는 /oauth/callback 이 아니라 「/login」 으로 온다 — 그래서 /login 도 여기서 받는다.
 *    (주의: 이 블록 주석 안에 별표 두 개 바로 뒤 슬래시를 쓰면 주석이 거기서 닫힌다 — 09-18 계획 원문의 잠복 결함)
 *    받지 않으면 사용자가 제공자에서 "취소"했을 때 Custom Tab 안에 웹 로그인 화면이 떠 있고
 *    앱으로는 영영 돌아가지 않는다.
 * 3. 표시 쿠키가 형식에 맞으면(= 앱에서 시작한 로그인) 여기서 가로챈다:
 *    · 유효 JWT → 60초 1회용 코드 발급(쿠키의 challenge 와 묶음) → 쿠키 삭제 → 302 theroute://auth/callback?code=…
 *    · 무효 JWT / 토큰 없음 / error → 쿠키 삭제 → 302 theroute://auth/callback?error=…
 *    쿠키가 없거나 형식이 다르면 next() — 일반 브라우저의 웹 로그인은 기존 OAuthCallbackPage 가 그대로 처리한다.
 * 4. 앱이 POST /api/auth/app-exchange { code, verifier } 로 교환한다(routes/appAuth.js).
 * 5. 폴백: Custom Tab 이 스킴 302 를 막는 기기를 대비해, 쿠키가 f.(app-start 에 fallback=1)
 *    이거나 이 요청에 ?fallback=1 이 있으면 302 대신 "앱으로 돌아가기" 버튼 HTML 을 준다.
 *    웹 배포만으로 앱의 app-start 주소에 &fallback=1 을 붙여 전환할 수 있다(APK 재빌드 불필요).
 *
 * 🔴 딥링크에는 JWT 를 싣지 않는다. 🔴 코드·토큰 원문을 로그에 남기지 않는다.
 */
const jwt = require('jsonwebtoken');
const {
  APP_LOGIN_COOKIE,
  appAuthCodes,
  buildAppDeepLink,
  clearAppLoginCookie,
  parseAppLoginCookie,
  readCookie,
} = require('../services/appAuthCodes');

// routes/auth.js 와 **같은 표현**을 쓴다. 폴백 일원화는 별도 과제(agent-vault board Todo)이며
// 여기서 다른 값을 쓰면 서명/검증이 어긋나 앱 로그인만 조용히 깨진다.
const JWT_SECRET = process.env.JWT_SECRET || 'theroute-dev-secret';

/** 딥링크 error 값은 식별자 모양만 싣는다. 그 밖(공백·기호·긴 문자열)은 oauth_failed 로 수렴. */
const ERROR_CODE_RE = /^[A-Za-z0-9_]{1,64}$/;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstString(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** 제어문자를 지우고 100자로 자른다(URLSearchParams 가 인코딩한다). */
function cleanMsg(v) {
  // eslint-disable-next-line no-control-regex
  return firstString(v).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 100);
}

/*
 * ── "앱으로 돌아가기" 폴백 페이지 ──────────────────────────────────────────────
 * 승인 데모 docs/demo/T009-android-apk-v1.html §3 "제안 v1"(사용자 승인 2026-10-30 22:43) ·
 * 설계 가이드 docs/web-design/T009-android-apk-guide.md §0(색 표)·§2-3(큰 주 버튼)·§2-4(구조·문구).
 * 문구·모양이 바뀌면 이 함수 하나만 고친다.
 * 이 페이지는 web/dist 밖의 독립 HTML 이라 CSS 변수(web/src/styles/tokens.css)를 읽지 못한다 →
 * 가이드 §0 표의 값을 그대로 복사하고 CSS 주석에 대응 토큰 이름을 적는다.
 * 외부 글꼴·외부 요청 없음(시스템 글꼴). CSP 는 인라인 스타일만 허용한다(스크립트 없음).
 */
const FALLBACK_PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'";

/** 302 가 막히는 기기용 — 사용자가 직접 누르는 스킴 링크(사용자 제스처라 Custom Tab 이 허용한다). 성공·실패 모두 같은 버튼. */
function renderFallbackPage(deepLink, isError) {
  const href = escapeHtml(deepLink);
  const msg = isError ? '로그인을 완료하지 못했습니다.' : '로그인이 완료되었습니다.';
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>더 루트</title>
<style>
html,body{margin:0;height:100%}
body{background:#f6f5f3;color:#131313;font-family:-apple-system,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif}
/* 배경 --bg #f6f5f3 · 글자 --ink-1 #131313 */
main{min-height:100%;display:grid;place-items:center;text-align:center;padding:24px;box-sizing:border-box}
.appname{font-size:13px;font-weight:600;color:#6b6b68;margin:0 0 14px;letter-spacing:-0.1px}
/* 앱 이름 --ink-3 #6b6b68 */
h1{font-size:16px;font-weight:600;color:#131313;margin:0;word-break:keep-all}
.cta{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:52px;min-width:200px;padding:0 28px;margin-top:22px;border-radius:10px;background:#ee6438;background:oklch(67% 0.18 38);color:#fff;font-size:19px;font-weight:700;letter-spacing:-0.2px;text-decoration:none}
/* 배경 --primary: 첫 줄 sRGB 근사(oklch 미지원 엔진용) · 둘째 줄 원값 / 모서리 --r-sm 10px / 흰 글자 19px 700(대비 3.2:1 이라 큰 글자 기준) */
.cta:active{filter:brightness(.94)}
.cta:focus-visible{outline:3px solid #9d2800;outline-offset:2px}
/* 포커스 테두리 --primary-ink 근사 #9d2800 */
</style></head>
<body><main><div>
<p class="appname">더 루트</p>
<h1>${escapeHtml(msg)}</h1>
<a class="cta" href="${href}">앱으로 돌아가기</a>
</div></main></body></html>`;
}

/**
 * @param {object} [deps] 테스트 주입용
 * @param {string} [deps.jwtSecret]
 * @param {{issue:(arg:{token:string, challenge:string})=>string}} [deps.store]
 */
function createAppOAuthCallbackHandler({ jwtSecret = JWT_SECRET, store = appAuthCodes } = {}) {
  return function appOAuthCallback(req, res, next) {
    if (req.method !== 'GET') return next();

    const query = req.query || {};
    const isCallback = req.path === '/oauth/callback';
    const errorParam = firstString(query.error);
    const isLoginError = req.path === '/login' && errorParam !== '';
    if (!isCallback && !isLoginError) return next();

    const mark = parseAppLoginCookie(readCookie(req, APP_LOGIN_COOKIE));
    if (!mark) return next(); // 쿠키 없음·형식 다름 = 웹 로그인 — 기존 흐름 그대로

    // 여기부터는 "앱에서 시작한 로그인의 끝". 성공이든 실패든 표시 쿠키는 한 번 쓰고 버린다
    // (남겨 두면 10분 안에 같은 폰 브라우저에서 한 웹 로그인까지 앱으로 끌려간다).
    clearAppLoginCookie(res);
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');

    let deepLink;
    let isError = true;
    const token = isCallback ? firstString(query.token) : '';
    if (token !== '') {
      let verified = false;
      try {
        jwt.verify(token, jwtSecret);
        verified = true;
      } catch {
        console.warn('[app-auth] 앱 로그인 콜백 — 토큰 검증 실패');
        deepLink = buildAppDeepLink({ error: 'invalid_token' });
      }
      if (verified) {
        try {
          deepLink = buildAppDeepLink({ code: store.issue({ token, challenge: mark.challenge }) });
          isError = false;
          console.log('[app-auth] 앱 로그인 코드 발급 (60초·1회용, PKCE)');
        } catch (e) {
          // challenge 를 코드에 묶지 못하면 코드를 발급하지 않는다(개정 §3-2 ③).
          console.warn(`[app-auth] 앱 로그인 코드 발급 실패: ${e && e.message ? e.message : 'unknown'}`);
          deepLink = buildAppDeepLink({ error: 'app_login_invalid' });
        }
      }
    } else {
      const errorCode = ERROR_CODE_RE.test(errorParam) ? errorParam : (errorParam ? 'oauth_failed' : 'no_token');
      deepLink = buildAppDeepLink({ error: errorCode, msg: cleanMsg(query.msg) });
      console.warn(`[app-auth] 앱 로그인 실패 복귀 (${isCallback ? 'callback' : 'login'})`);
    }

    const wantFallback = mark.fallback || firstString(query.fallback) === '1';
    if (wantFallback) {
      res.set('Content-Security-Policy', FALLBACK_PAGE_CSP);
      return res.status(200).type('html').send(renderFallbackPage(deepLink, isError));
    }
    return res.redirect(302, deepLink);
  };
}

module.exports = { createAppOAuthCallbackHandler, renderFallbackPage };

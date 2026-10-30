const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const {
  APP_LOGIN_COOKIE,
  createAppAuthCodeStore,
  pkceChallengeOf,
} = require('../src/services/appAuthCodes');
const { createAppOAuthCallbackHandler, renderFallbackPage } = require('../src/routes/appOAuthCallback');

const SECRET = 'test-secret';
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function fakeReq({ path, query = {}, cookie = null, method = 'GET' }) {
  return { method, path, query, headers: cookie ? { cookie } : {} };
}

function fakeRes() {
  return {
    cleared: [], headers: {}, statusCode: 200, body: null, redirected: null, contentType: null,
    clearCookie(name) { this.cleared.push(name); return this; },
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    type(t) { this.contentType = t; return this; },
    send(b) { this.body = b; return this; },
    redirect(code, url) { this.statusCode = code; this.redirected = url; return this; },
  };
}

function setup() {
  const store = createAppAuthCodeStore();
  const handler = createAppOAuthCallbackHandler({ jwtSecret: SECRET, store });
  function run(reqOpts) {
    const req = fakeReq(reqOpts);
    const res = fakeRes();
    let nexted = false;
    handler(req, res, () => { nexted = true; });
    return { res, nexted };
  }
  return { store, run };
}

const APP_COOKIE = `${APP_LOGIN_COOKIE}=n.${RFC_CHALLENGE}`;
const FALLBACK_COOKIE = `${APP_LOGIN_COOKIE}=f.${RFC_CHALLENGE}`;

function assertUntouched({ res, nexted }) {
  assert.strictEqual(nexted, true);
  assert.strictEqual(res.redirected, null);
  assert.strictEqual(res.body, null);
  assert.deepStrictEqual(res.cleared, []);
  assert.deepStrictEqual(res.headers, {});
}

// ─── 웹 로그인 회귀 (개정 §3-3) ────────────────────────────────────────────────

test('회귀: 표시 쿠키 없이 /oauth/callback?token= 은 next() — 웹 로그인 흐름 그대로', () => {
  const { run, store } = setup();
  const token = jwt.sign({ id: 1 }, SECRET);
  assertUntouched(run({ path: '/oauth/callback', query: { token } }));
  assert.strictEqual(store.size(), 0);
});

test('회귀: 표시 쿠키 없이 /login, /login?error= 은 next()', () => {
  const { run } = setup();
  assertUntouched(run({ path: '/login', query: {} }));
  assertUntouched(run({ path: '/login', query: { error: 'oauth_failed', msg: 'x' } }));
});

test('회귀: 다른 쿠키만 있으면 next()', () => {
  const { run } = setup();
  const token = jwt.sign({ id: 1 }, SECRET);
  assertUntouched(run({ path: '/oauth/callback', query: { token }, cookie: 'theme=dark; sid=abc' }));
});

test('표시 쿠키 형식이 다르면(옛 값 1·fallback·challenge 손상) next() — 코드 발급 없음', () => {
  const { run, store } = setup();
  const token = jwt.sign({ id: 1 }, SECRET);
  for (const v of ['1', 'fallback', 'n.short', `x.${RFC_CHALLENGE}`, `n.${RFC_CHALLENGE}=`, '']) {
    assertUntouched(run({ path: '/oauth/callback', query: { token }, cookie: `${APP_LOGIN_COOKIE}=${v}` }));
  }
  assert.strictEqual(store.size(), 0);
});

test('GET 이 아니면 next()', () => {
  const { run } = setup();
  assertUntouched(run({ method: 'POST', path: '/oauth/callback', query: {}, cookie: APP_COOKIE }));
  assertUntouched(run({ method: 'HEAD', path: '/oauth/callback', query: {}, cookie: APP_COOKIE }));
});

test('error 없는 /login 은 쿠키가 있어도 웹 로그인 화면 — next()', () => {
  const { run } = setup();
  assertUntouched(run({ path: '/login', query: {}, cookie: APP_COOKIE }));
});

test('다른 경로는 next()', () => {
  const { run } = setup();
  assertUntouched(run({ path: '/oauth/callback/extra', query: { token: 'x' }, cookie: APP_COOKIE }));
  assertUntouched(run({ path: '/', query: {}, cookie: APP_COOKIE }));
});

// ─── 앱 로그인 가로채기 ───────────────────────────────────────────────────────

test('쿠키 + 유효 JWT 면 challenge 에 묶인 1회용 코드를 실은 딥링크로 302 하고 쿠키를 지운다', () => {
  const { run, store } = setup();
  const token = jwt.sign({ id: 1 }, SECRET);
  const { res, nexted } = run({ path: '/oauth/callback', query: { token }, cookie: APP_COOKIE });
  assert.strictEqual(nexted, false);
  assert.strictEqual(res.statusCode, 302);
  const m = /^theroute:\/\/auth\/callback\?code=([0-9a-f]{64})$/.exec(res.redirected);
  assert.ok(m, res.redirected);
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
  assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  assert.strictEqual(res.headers['Referrer-Policy'], 'no-referrer');
  assert.ok(!res.redirected.includes(token), '딥링크에 JWT 를 실으면 안 된다');
  // 쿠키의 challenge 와 결속됐는지: RFC verifier 로만 교환된다
  assert.strictEqual(store.consume(m[1], crypto.randomBytes(32).toString('base64url')).status, 'mismatch');
  const { res: res2 } = run({ path: '/oauth/callback', query: { token }, cookie: APP_COOKIE });
  const code2 = /code=([0-9a-f]{64})$/.exec(res2.redirected)[1];
  assert.deepStrictEqual(store.consume(code2, RFC_VERIFIER), { status: 'ok', token });
});

test('쿠키가 있어도 JWT 가 무효면 invalid_token 딥링크이고 코드를 만들지 않는다', () => {
  const { run, store } = setup();
  const token = jwt.sign({ id: 1 }, 'other-secret');
  const { res } = run({ path: '/oauth/callback', query: { token }, cookie: APP_COOKIE });
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=invalid_token');
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
  assert.strictEqual(store.size(), 0);
});

test('만료된 JWT 도 invalid_token', () => {
  const { run } = setup();
  const token = jwt.sign({ id: 1, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
  const { res } = run({ path: '/oauth/callback', query: { token }, cookie: APP_COOKIE });
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=invalid_token');
});

test('토큰이 아예 없으면 no_token 딥링크다', () => {
  const { run } = setup();
  const { res } = run({ path: '/oauth/callback', query: {}, cookie: APP_COOKIE });
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=no_token');
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
});

test('저장소가 challenge 를 거부하면 코드를 발급하지 않고 오류 딥링크로 보낸다', () => {
  const handler = createAppOAuthCallbackHandler({
    jwtSecret: SECRET,
    store: { issue() { throw new Error('valid PKCE challenge required'); } },
  });
  const res = fakeRes();
  handler(fakeReq({ path: '/oauth/callback', query: { token: jwt.sign({ id: 1 }, SECRET) }, cookie: APP_COOKIE }), res, () => {
    assert.fail('next 를 부르면 안 된다');
  });
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=app_login_invalid');
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
});

test('공용 라우터가 실패로 보내는 /login?error= 도 가로채 앱으로 돌려보낸다', () => {
  const { run } = setup();
  const { res, nexted } = run({
    path: '/login',
    query: { error: 'access_denied', msg: 'user cancelled' },
    cookie: APP_COOKIE,
  });
  assert.strictEqual(nexted, false);
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=access_denied&msg=user+cancelled');
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
});

test('식별자 모양이 아닌 error 는 oauth_failed 로, msg 는 제어문자 제거·100자', () => {
  const { run } = setup();
  const { res } = run({
    path: '/login',
    query: { error: 'bad value&x=1', msg: `a\r\nb${'z'.repeat(200)}` },
    cookie: APP_COOKIE,
  });
  const u = new URL(res.redirected);
  assert.strictEqual(u.searchParams.get('error'), 'oauth_failed');
  assert.strictEqual(u.searchParams.get('msg').length, 100);
  assert.ok(!/[\r\n]/.test(u.searchParams.get('msg')));
  assert.strictEqual(u.searchParams.get('x'), null);
});

test('fallback 쿠키면 302 대신 앱으로 돌아가기 버튼 HTML 을 준다', () => {
  const { run } = setup();
  const token = jwt.sign({ id: 1 }, SECRET);
  const { res } = run({ path: '/oauth/callback', query: { token }, cookie: FALLBACK_COOKIE });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.contentType, 'html');
  assert.strictEqual(res.redirected, null);
  assert.match(res.body, /theroute:\/\/auth\/callback\?code=[0-9a-f]{64}/);
  assert.match(res.body, /앱으로 돌아가기/);
  assert.ok(!res.body.includes(token));
  assert.strictEqual(res.headers['Content-Security-Policy'], "default-src 'none'; style-src 'unsafe-inline'");
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
});

test('요청의 ?fallback=1 로도 폴백 페이지가 된다', () => {
  const { run } = setup();
  const { res } = run({ path: '/login', query: { error: 'access_denied', fallback: '1' }, cookie: APP_COOKIE });
  assert.strictEqual(res.statusCode, 200);
  assert.match(res.body, /로그인을 완료하지 못했습니다/);
});

test('오류 메시지는 HTML 로 이스케이프된다', () => {
  const { run } = setup();
  const { res } = run({
    path: '/login',
    query: { error: 'bad', msg: '<script>alert(1)</script>"\'', fallback: '1' },
    cookie: APP_COOKIE,
  });
  assert.ok(!res.body.includes('<script>alert(1)</script>'));
  const href = /<a class="cta" href="([^"]*)">/.exec(res.body)[1];
  assert.ok(href.startsWith('theroute://auth/callback?error=bad&amp;msg='), href);
  assert.ok(!/[<>"']/.test(href), href);
});

test('폴백 페이지 = 승인 데모 v1 구조: 앱 이름 → 상황 한 줄(h1) → 큰 버튼 하나, 성공·실패 같은 버튼', () => {
  const ok = renderFallbackPage('theroute://auth/callback?code=' + 'a'.repeat(64), false);
  const err = renderFallbackPage('theroute://auth/callback?error=access_denied', true);
  for (const [html, msg] of [[ok, '로그인이 완료되었습니다.'], [err, '로그인을 완료하지 못했습니다.']]) {
    assert.match(html, /<title>더 루트<\/title>/);
    assert.match(html, /<meta name="referrer" content="no-referrer">/);
    const body = html.slice(html.indexOf('<body>'));
    const iName = body.indexOf('<p class="appname">더 루트</p>');
    const iMsg = body.indexOf(`<h1>${msg}</h1>`);
    const iBtn = body.indexOf('<a class="cta" href="theroute://auth/callback?');
    assert.ok(iName > 0 && iMsg > iName && iBtn > iMsg, `${iName} ${iMsg} ${iBtn}`);
    assert.strictEqual((body.match(/<a /g) || []).length, 1, '버튼(링크)은 하나');
    assert.match(body, />앱으로 돌아가기<\/a>/);
    // 가이드 §0·§2-3 값
    for (const v of ['background:#f6f5f3', 'color:#131313', 'color:#6b6b68', 'background:#ee6438;background:oklch(67% 0.18 38)',
      'min-height:52px', 'min-width:200px', 'font-size:19px', 'font-weight:700', 'border-radius:10px',
      'outline:3px solid #9d2800', 'filter:brightness(.94)']) {
      assert.ok(html.includes(v), `${v} 없음`);
    }
  }
});

test('폴백 페이지는 외부 요청·스크립트가 없다(CSP default-src none 과 맞물림)', () => {
  const html = renderFallbackPage('theroute://auth/callback?error=x', true);
  assert.ok(!/https?:\/\//i.test(html), '외부 URL 이 있으면 안 된다');
  assert.ok(!/<script|<link|<img|@import|url\(|javascript:/i.test(html));
});

test('폴백 버튼 href 는 항상 theroute://auth/callback? 로 시작한다(javascript: 등 불가)', () => {
  const { run } = setup();
  const token = jwt.sign({ id: 1 }, SECRET);
  const cases = [
    { path: '/oauth/callback', query: { token }, cookie: FALLBACK_COOKIE },
    { path: '/oauth/callback', query: { token: 'bad' }, cookie: FALLBACK_COOKIE },
    { path: '/login', query: { error: 'javascript:alert(1)', msg: 'javascript:alert(1)' }, cookie: FALLBACK_COOKIE },
  ];
  for (const c of cases) {
    const { res } = run(c);
    const href = /<a class="cta" href="([^"]*)">/.exec(res.body)[1];
    assert.ok(href.startsWith('theroute://auth/callback?'), href);
    assert.ok(!/^javascript:/i.test(href));
  }
});

test('renderFallbackPage 는 href 를 이스케이프한다', () => {
  const html = renderFallbackPage('theroute://auth/callback?error=x&msg="><img>', true);
  assert.ok(!html.includes('"><img>'));
  assert.ok(html.includes('&amp;msg=&quot;&gt;&lt;img&gt;'));
});

test('가로채기 로그에 토큰·코드 원문이 없다', (t) => {
  const { run } = setup();
  const logs = [];
  t.mock.method(console, 'log', (...a) => logs.push(a.join(' ')));
  t.mock.method(console, 'warn', (...a) => logs.push(a.join(' ')));
  const token = jwt.sign({ id: 1 }, SECRET);
  const { res } = run({ path: '/oauth/callback', query: { token }, cookie: APP_COOKIE });
  const code = /code=([0-9a-f]{64})$/.exec(res.redirected)[1];
  const all = logs.join('\n');
  assert.ok(logs.length > 0);
  for (const s of [token, code, RFC_CHALLENGE]) assert.ok(!all.includes(s));
});

test('pkce 결속 대조: RFC 벡터 challenge 는 RFC verifier 의 S256 이다', () => {
  assert.strictEqual(pkceChallengeOf(RFC_VERIFIER), RFC_CHALLENGE);
});

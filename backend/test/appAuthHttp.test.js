/**
 * 실제 express 로 묶어 본 앱 로그인 흐름 시험 — T009.
 *
 * 127.0.0.1 의 임시 포트에 시험 전용 앱을 띄운다(운영·DB·외부 네트워크 접속 없음).
 * - /api/auth 에는 **실제 routes/auth.js** 를 붙인다(공용 OAuth 라우터 포함, OAuth 자격증명 없음 → 503).
 *   requiring 만으로는 DB 에 접속하지 않는다(Sequelize 는 쿼리 때 접속).
 * - index.js 와 같은 순서로 콜백 가로채기 → SPA 폴백(가짜 index.html)을 붙인다.
 * index.js 자체는 bootstrap() 에서 DB 접속·listen 을 하므로 require 하지 않고, 마운트 순서는 소스 검사로 본다.
 */
process.env.JWT_SECRET = 'http-test-secret';
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GITHUB_CLIENT_ID;
delete process.env.GITHUB_CLIENT_SECRET;

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const jwt = require('jsonwebtoken');
const { APP_LOGIN_COOKIE } = require('../src/services/appAuthCodes');
const { createAppOAuthCallbackHandler } = require('../src/routes/appOAuthCallback');

const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const SPA_BODY = '<!doctype html><title>spa</title>';

let server;
let base;
let logs = [];
const origLog = console.log;
const origWarn = console.warn;

before(async () => {
  console.log = (...a) => logs.push(a.join(' '));
  console.warn = (...a) => logs.push(a.join(' '));
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.get(['/oauth/callback', '/login'], createAppOAuthCallbackHandler());
  app.get(/^\/(?!api|uploads|health).*$/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(SPA_BODY);
  });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  console.log = origLog;
  console.warn = origWarn;
  await new Promise((resolve) => server.close(resolve));
});

const get = (p, headers = {}) => fetch(base + p, { redirect: 'manual', headers });
const post = (p, body) => fetch(base + p, {
  method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
});

test('app-start 는 공용 /:provider 에 먹히지 않고 쿠키+302 를 준다(마운트 순서 실동작)', async () => {
  const r = await get(`/api/auth/app-start?provider=google&challenge=${RFC_CHALLENGE}`);
  assert.strictEqual(r.status, 302);
  assert.strictEqual(r.headers.get('location'), '/api/auth/google');
  assert.strictEqual(r.headers.get('cache-control'), 'no-store');
  assert.strictEqual(r.headers.get('referrer-policy'), 'no-referrer'); // L-2 ①
  const sc = r.headers.get('set-cookie');
  assert.ok(sc.startsWith(`${APP_LOGIN_COOKIE}=n.${RFC_CHALLENGE};`), sc);
  for (const attr of ['Max-Age=600', 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax']) {
    assert.ok(sc.includes(attr), `${attr} 없음: ${sc}`);
  }
});

test('app-start 형식 오류는 400 {success,data,message}', async () => {
  const r = await get('/api/auth/app-start?provider=google');
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.headers.get('set-cookie'), null);
  const b = await r.json();
  assert.deepStrictEqual(Object.keys(b).sort(), ['data', 'message', 'success']);
  assert.strictEqual(b.success, false);
});

test('기존 공용 라우터 경로는 그대로 공용 라우터가 처리한다(자격증명 없음 → 503)', async () => {
  const r = await get('/api/auth/google');
  assert.strictEqual(r.status, 503);
});

test('전체 흐름: app-start 쿠키 → 콜백 가로채기 → 딥링크 코드 → app-exchange(RFC verifier) → 토큰', async () => {
  const logFrom = logs.length; // L-1: 이 흐름에서 나온 로그만 따로 본다(배열은 비우지 않는다)
  const start = await get(`/api/auth/app-start?provider=google&challenge=${RFC_CHALLENGE}`);
  const cookie = start.headers.get('set-cookie').split(';')[0];
  const token = jwt.sign({ userId: 7, email: 'a@b.c' }, 'http-test-secret', { expiresIn: '30d' });

  const cb = await get(`/oauth/callback?token=${encodeURIComponent(token)}`, { cookie });
  assert.strictEqual(cb.status, 302);
  const loc = cb.headers.get('location');
  const m = /^theroute:\/\/auth\/callback\?code=([0-9a-f]{64})$/.exec(loc);
  assert.ok(m, loc);
  assert.strictEqual(cb.headers.get('cache-control'), 'no-store');
  assert.strictEqual(cb.headers.get('referrer-policy'), 'no-referrer');
  const cleared = cb.headers.get('set-cookie');
  assert.ok(cleared.startsWith(`${APP_LOGIN_COOKIE}=;`), cleared);
  assert.ok(/Expires=Thu, 01 Jan 1970/.test(cleared), cleared);
  assert.ok(cleared.includes('Path=/'), cleared);
  for (const attr of ['HttpOnly', 'Secure', 'SameSite=Lax']) { // L-2 ②
    assert.ok(cleared.includes(attr), `삭제 헤더에 ${attr} 없음: ${cleared}`);
  }

  const ex = await post('/api/auth/app-exchange', { code: m[1], verifier: RFC_VERIFIER });
  assert.strictEqual(ex.status, 200);
  assert.strictEqual(ex.headers.get('cache-control'), 'no-store');
  assert.deepStrictEqual(await ex.json(), { success: true, data: { token }, message: '' });

  const again = await post('/api/auth/app-exchange', { code: m[1], verifier: RFC_VERIFIER });
  assert.strictEqual(again.status, 401);
  assert.strictEqual((await again.json()).success, false);

  // L-1: 실제 흐름의 로그를 잡아 원문이 없는지 본다(빈 배열로 통과하지 않게 내용이 있는지도 단언).
  const flowLogs = logs.slice(logFrom);
  const all = flowLogs.join('\n');
  assert.ok(flowLogs.some((l) => l.includes('[app-auth] 앱 로그인 코드 발급')), all);
  assert.ok(flowLogs.some((l) => l.includes('[app-auth] 코드 교환 실패 (unknown)')), all);
  for (const s of [token, m[1], RFC_VERIFIER, RFC_CHALLENGE]) {
    assert.ok(!all.includes(s), '로그에 원문이 있다');
  }
});

test('가로챈 코드를 다른 verifier 로 교환하면 401, 그 뒤 정당한 verifier 도 401(소각)', async () => {
  const token = jwt.sign({ userId: 7 }, 'http-test-secret');
  const cb = await get(`/oauth/callback?token=${encodeURIComponent(token)}`, {
    cookie: `${APP_LOGIN_COOKIE}=n.${RFC_CHALLENGE}`,
  });
  const code = /code=([0-9a-f]{64})$/.exec(cb.headers.get('location'))[1];
  const attacker = await post('/api/auth/app-exchange', { code, verifier: 'A'.repeat(43) });
  const legit = await post('/api/auth/app-exchange', { code, verifier: RFC_VERIFIER });
  const b1 = await attacker.json();
  const b2 = await legit.json();
  assert.strictEqual(attacker.status, 401);
  assert.strictEqual(legit.status, 401);
  assert.deepStrictEqual(b1, b2, '실패 본문은 원인과 무관하게 같다');
});

test('app-exchange 형식 오류는 400', async () => {
  const r = await post('/api/auth/app-exchange', { code: 'x', verifier: RFC_VERIFIER });
  assert.strictEqual(r.status, 400);
  assert.strictEqual(r.headers.get('cache-control'), 'no-store'); // L-2 ③
});

test('회귀: 표시 쿠키 없는 /oauth/callback·/login 은 SPA 가 그대로 받는다', async () => {
  const logFrom = logs.length;
  const token = jwt.sign({ userId: 7 }, 'http-test-secret');
  for (const p of [`/oauth/callback?token=${encodeURIComponent(token)}`, '/login', '/login?error=oauth_failed&msg=x']) {
    const r = await get(p);
    assert.strictEqual(r.status, 200, p);
    assert.strictEqual(r.headers.get('set-cookie'), null, p);
    assert.strictEqual(await r.text(), SPA_BODY, p);
  }
  assert.ok(!logs.slice(logFrom).some((l) => l.includes('[app-auth]')), '쿠키 없는 요청에서 [app-auth] 로그가 나오면 안 된다');
});

test('로그 전체(시험 파일 시작부터 누적, 비우지 않음)에 토큰·코드·verifier 원문이 없다', () => {
  // L-1: before() 에서만 초기화한다. 앞 시험들의 앱 로그인 로그가 실제로 쌓였는지 먼저 확인한다.
  assert.ok(logs.filter((l) => l.includes('[app-auth]')).length >= 3, logs.join('\n'));
  const all = logs.join('\n');
  assert.ok(!all.includes(RFC_VERIFIER));
  assert.ok(!/[0-9a-f]{64}/.test(all));
  assert.ok(!/eyJ[A-Za-z0-9_-]+\./.test(all));
});

// ─── 마운트 순서 소스 검사 ────────────────────────────────────────────────────

test('routes/auth.js: app-start·app-exchange 가 공용 oauthRouter 마운트보다 앞이다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/routes/auth.js'), 'utf8');
  // 주석 속 같은 문자열에 걸리지 않게 줄 첫머리의 실제 코드만 찾는다.
  const at = (re) => { const m = re.exec(src); return m ? m.index : -1; };
  const iStart = at(/^router\.get\('\/app-start', appStartHandler\);/m);
  const iEx = at(/^router\.post\('\/app-exchange', appExchangeHandler\);/m);
  const iOauth = at(/^router\.use\('\/', oauthRouter\);/m);
  assert.ok(iStart > 0 && iEx > 0 && iOauth > 0);
  assert.ok(iStart < iOauth && iEx < iOauth);
});

test('index.js: 가로채기는 express.static 뒤·SPA 폴백 앞이고 SPA 폴백 정규식은 그대로다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/index.js'), 'utf8');
  const at = (re) => { const m = re.exec(src); return m ? m.index : -1; };
  const iStatic = at(/^ {2}app\.use\(express\.static\(distDir, \{ index: false \}\)\);/m);
  const iHook = at(/^ {2}app\.get\(\['\/oauth\/callback', '\/login'\], require\('\.\/routes\/appOAuthCallback'\)\.createAppOAuthCallbackHandler\(\)\);/m);
  const iSpa = src.indexOf("  app.get(/^\\/(?!api|uploads|health).*$/, (_req, res) => {");
  assert.ok(iStatic > 0 && iHook > 0 && iSpa > 0, `${iStatic} ${iHook} ${iSpa}`);
  assert.ok(iStatic < iHook && iHook < iSpa);
  assert.strictEqual(src.split('createAppOAuthCallbackHandler').length - 1, 1, '마운트는 한 번만');
});

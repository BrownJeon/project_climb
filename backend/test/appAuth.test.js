const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const {
  APP_LOGIN_COOKIE,
  appAuthCodes,
  createAppAuthCodeStore,
  pkceChallengeOf,
} = require('../src/services/appAuthCodes');
const {
  EXCHANGE_INVALID_MESSAGE,
  appStartHandler,
  appExchangeHandler,
  createAppExchangeHandler,
} = require('../src/routes/appAuth');

const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function newPair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: pkceChallengeOf(verifier) };
}

/** express Response 중 이 핸들러들이 쓰는 부분만 흉내 낸다. */
function fakeRes() {
  return {
    cookies: {}, cleared: [], headers: {}, statusCode: 200, body: null, redirected: null,
    cookie(name, value, opts) { this.cookies[name] = { value, opts }; return this; },
    clearCookie(name) { this.cleared.push(name); return this; },
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    redirect(code, url) { this.statusCode = code; this.redirected = url; return this; },
  };
}

// ─── app-start ────────────────────────────────────────────────────────────────

test('app-start 는 challenge 를 실은 표시 쿠키를 심고 기존 OAuth 시작점으로 302 한다', () => {
  const res = fakeRes();
  appStartHandler({ query: { provider: 'google', challenge: RFC_CHALLENGE } }, res);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.redirected, '/api/auth/google');
  const c = res.cookies[APP_LOGIN_COOKIE];
  assert.strictEqual(c.value, `n.${RFC_CHALLENGE}`);
  assert.strictEqual(c.opts.httpOnly, true);
  assert.strictEqual(c.opts.secure, true);
  assert.strictEqual(c.opts.sameSite, 'lax');
  assert.strictEqual(c.opts.path, '/');
  assert.strictEqual(c.opts.maxAge, 10 * 60 * 1000);
  assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  assert.strictEqual(res.headers['Referrer-Policy'], 'no-referrer');
});

test('app-start 에 fallback=1 이면 쿠키가 f. 모드다 (그 밖의 값은 일반)', () => {
  const res = fakeRes();
  appStartHandler({ query: { provider: 'github', challenge: RFC_CHALLENGE, fallback: '1' } }, res);
  assert.strictEqual(res.redirected, '/api/auth/github');
  assert.strictEqual(res.cookies[APP_LOGIN_COOKIE].value, `f.${RFC_CHALLENGE}`);
  const res2 = fakeRes();
  appStartHandler({ query: { provider: 'github', challenge: RFC_CHALLENGE, fallback: 'true' } }, res2);
  assert.strictEqual(res2.cookies[APP_LOGIN_COOKIE].value, `n.${RFC_CHALLENGE}`);
});

test('app-start 는 화이트리스트 밖 provider 를 400 으로 막는다', () => {
  for (const provider of ['kakao', '', undefined, '../admin', ['google'], 'app-start']) {
    const res = fakeRes();
    appStartHandler({ query: { provider, challenge: RFC_CHALLENGE } }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.deepStrictEqual(Object.keys(res.body).sort(), ['data', 'message', 'success']);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.data, null);
    assert.strictEqual(res.redirected, null);
    assert.deepStrictEqual(res.cookies, {});
  }
});

test('app-start 는 challenge 가 없거나 형식이 틀리면 400 이고 쿠키를 심지 않는다', () => {
  for (const challenge of [undefined, '', 'short', 'a'.repeat(44), `${'a'.repeat(42)}=`, [RFC_CHALLENGE], `${'a'.repeat(42)};`]) {
    const res = fakeRes();
    appStartHandler({ query: { provider: 'google', challenge } }, res);
    assert.strictEqual(res.statusCode, 400, String(challenge));
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.redirected, null);
    assert.deepStrictEqual(res.cookies, {});
  }
});

test('app-start 는 query 가 없어도 죽지 않는다', () => {
  const res = fakeRes();
  appStartHandler({}, res);
  assert.strictEqual(res.statusCode, 400);
});

// ─── app-exchange ─────────────────────────────────────────────────────────────

test('app-exchange 는 유효한 code+verifier 를 토큰으로 바꾼다 (RFC 벡터)', () => {
  const code = appAuthCodes.issue({ token: 'jwt.for.exchange', challenge: RFC_CHALLENGE });
  const res = fakeRes();
  appExchangeHandler({ body: { code, verifier: RFC_VERIFIER } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true, data: { token: 'jwt.for.exchange' }, message: '' });
  assert.strictEqual(res.headers['Cache-Control'], 'no-store');
});

test('app-exchange 실패(재사용·불일치·만료·미지)는 모두 같은 401 본문이다', () => {
  let now = 1_000;
  const store = createAppAuthCodeStore({ ttlMs: 60_000, now: () => now });
  const handler = createAppExchangeHandler({ store });
  const bodies = [];
  const call = (body) => { const res = fakeRes(); handler({ body }, res); return res; };

  // 재사용
  const p1 = newPair();
  const c1 = store.issue({ token: 't1', challenge: p1.challenge });
  assert.strictEqual(call({ code: c1, verifier: p1.verifier }).statusCode, 200);
  const reuse = call({ code: c1, verifier: p1.verifier });
  bodies.push(reuse);

  // verifier 불일치 → 소각 → 올바른 verifier 로 다시 보내도 401
  const p2 = newPair();
  const c2 = store.issue({ token: 't2', challenge: p2.challenge });
  bodies.push(call({ code: c2, verifier: newPair().verifier }));
  bodies.push(call({ code: c2, verifier: p2.verifier }));

  // 만료
  const p3 = newPair();
  const c3 = store.issue({ token: 't3', challenge: p3.challenge });
  now += 60_001;
  bodies.push(call({ code: c3, verifier: p3.verifier }));

  // 미지의 코드
  bodies.push(call({ code: 'f'.repeat(64), verifier: newPair().verifier }));

  for (const res of bodies) {
    assert.strictEqual(res.statusCode, 401);
    assert.deepStrictEqual(res.body, { success: false, data: null, message: EXCHANGE_INVALID_MESSAGE });
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  }
});

test('app-exchange 실패 응답과 로그에 code·verifier·token 원문이 없다', (t) => {
  const store = createAppAuthCodeStore();
  const handler = createAppExchangeHandler({ store });
  const p = newPair();
  const code = store.issue({ token: 'secret.jwt.value', challenge: p.challenge });
  const wrong = newPair().verifier;
  const logs = [];
  t.mock.method(console, 'warn', (...a) => logs.push(a.join(' ')));
  t.mock.method(console, 'log', (...a) => logs.push(a.join(' ')));
  const res = fakeRes();
  handler({ body: { code, verifier: wrong } }, res);
  const all = JSON.stringify(res.body) + logs.join('\n');
  for (const s of [code, wrong, p.verifier, 'secret.jwt.value']) assert.ok(!all.includes(s));
  assert.ok(logs.some((l) => l.includes('mismatch')), '서버 로그에는 원인 구분이 남는다');
});

test('app-exchange 는 형식 오류를 400 으로 막고 코드를 태우지 않는다', () => {
  const store = createAppAuthCodeStore();
  const handler = createAppExchangeHandler({ store });
  const p = newPair();
  const code = store.issue({ token: 't', challenge: p.challenge });
  for (const body of [
    { code: 'not-a-code', verifier: p.verifier },
    { code, verifier: 'short' },
    { code },
    { verifier: p.verifier },
    { code: [code], verifier: p.verifier },
    { code, verifier: { $ne: 1 } },
  ]) {
    const res = fakeRes();
    handler({ body }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.data, null);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  }
  const res = fakeRes();
  handler({ body: { code, verifier: p.verifier } }, res);
  assert.strictEqual(res.statusCode, 200);
});

test('app-exchange 는 body 가 없거나 객체가 아니어도 죽지 않는다', () => {
  for (const req of [{}, { body: null }, { body: 'code=abc' }]) {
    const res = fakeRes();
    appExchangeHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
  }
});

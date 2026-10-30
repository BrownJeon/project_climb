const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const {
  APP_AUTH_CODE_RE,
  APP_AUTH_PROVIDERS,
  APP_LOGIN_COOKIE,
  PKCE_RE,
  buildAppDeepLink,
  createAppAuthCodeStore,
  encodeAppLoginCookie,
  parseAppLoginCookie,
  pkceChallengeOf,
  readCookie,
} = require('../src/services/appAuthCodes');

// RFC 7636 부록 B 벡터 — 웹(appLogin) 시험에도 같은 값이 들어간다(개정 §3-1).
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function newPair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: pkceChallengeOf(verifier) };
}

test('RFC 7636 부록 B 벡터: S256(verifier) 가 기대 challenge 와 같다', () => {
  assert.strictEqual(pkceChallengeOf(RFC_VERIFIER), RFC_CHALLENGE);
  assert.match(RFC_VERIFIER, PKCE_RE);
  assert.match(RFC_CHALLENGE, PKCE_RE);
});

test('RFC 벡터로 발급→교환이 성공한다', () => {
  const store = createAppAuthCodeStore();
  const code = store.issue({ token: 'jwt.rfc', challenge: RFC_CHALLENGE });
  assert.deepStrictEqual(store.consume(code, RFC_VERIFIER), { status: 'ok', token: 'jwt.rfc' });
});

test('32바이트 base64url verifier 는 정확히 43자이고 challenge 도 43자다', () => {
  const { verifier, challenge } = newPair();
  assert.strictEqual(verifier.length, 43);
  assert.strictEqual(challenge.length, 43);
});

test('발급한 코드는 소문자 hex 64자다', () => {
  const store = createAppAuthCodeStore();
  const { challenge } = newPair();
  assert.match(store.issue({ token: 'jwt.token.value', challenge }), APP_AUTH_CODE_RE);
});

test('issue 는 challenge 가 없거나 형식이 틀리면 던진다(코드를 만들지 않는다)', () => {
  const store = createAppAuthCodeStore();
  for (const challenge of [undefined, '', 'short', 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}+`]) {
    assert.throws(() => store.issue({ token: 't', challenge }));
  }
  assert.throws(() => store.issue({ token: '', challenge: RFC_CHALLENGE }));
  assert.strictEqual(store.size(), 0);
});

test('한 번 교환하면 토큰이 나오고, 두 번째(재사용)는 unknown 이다', () => {
  const store = createAppAuthCodeStore();
  const { verifier, challenge } = newPair();
  const code = store.issue({ token: 'jwt.token.value', challenge });
  assert.deepStrictEqual(store.consume(code, verifier), { status: 'ok', token: 'jwt.token.value' });
  assert.strictEqual(store.consume(code, verifier).status, 'unknown');
});

test('TTL 이 지나면 expired 이고, 그 코드도 즉시 지워진다', () => {
  let now = 1_000_000;
  const store = createAppAuthCodeStore({ ttlMs: 60_000, now: () => now });
  const { verifier, challenge } = newPair();
  const code = store.issue({ token: 'jwt.token.value', challenge });
  now += 60_001;
  assert.strictEqual(store.consume(code, verifier).status, 'expired');
  assert.strictEqual(store.size(), 0);
  assert.strictEqual(store.consume(code, verifier).status, 'unknown');
});

test('TTL 경계: 정확히 만료 시각이면 expired(<=)', () => {
  let now = 5_000;
  const store = createAppAuthCodeStore({ ttlMs: 1_000, now: () => now });
  const { verifier, challenge } = newPair();
  const code = store.issue({ token: 't', challenge });
  now += 1_000;
  assert.strictEqual(store.consume(code, verifier).status, 'expired');
});

test('verifier 불일치는 mismatch 이고 항목을 소각한다 — 같은 코드로 올바른 verifier 를 다시 보내도 실패', () => {
  const store = createAppAuthCodeStore();
  const right = newPair();
  const wrong = newPair();
  const code = store.issue({ token: 'jwt.token.value', challenge: right.challenge });
  assert.strictEqual(store.consume(code, wrong.verifier).status, 'mismatch');
  assert.strictEqual(store.size(), 0);
  assert.strictEqual(store.consume(code, right.verifier).status, 'unknown');
});

test('challenge 를 verifier 자리에 넣어도(평문 비교 우회 시도) mismatch 다', () => {
  const store = createAppAuthCodeStore();
  const { challenge } = newPair();
  const code = store.issue({ token: 't', challenge });
  assert.strictEqual(store.consume(code, challenge).status, 'mismatch');
});

test('형식이 틀린 code 는 malformed 이고 저장소를 건드리지 않는다', () => {
  const store = createAppAuthCodeStore();
  const { verifier, challenge } = newPair();
  store.issue({ token: 'jwt.token.value', challenge });
  for (const bad of [undefined, null, 42, '', 'ZZZ', 'a'.repeat(63), 'A'.repeat(64), ['a'.repeat(64)]]) {
    assert.strictEqual(store.consume(bad, verifier).status, 'malformed');
  }
  assert.strictEqual(store.size(), 1);
});

test('형식이 틀린 verifier 는 malformed 이고 그 코드를 태우지 않는다', () => {
  const store = createAppAuthCodeStore();
  const { verifier, challenge } = newPair();
  const code = store.issue({ token: 'jwt.token.value', challenge });
  for (const bad of [undefined, null, 42, '', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}/`, [verifier]]) {
    assert.strictEqual(store.consume(code, bad).status, 'malformed');
  }
  assert.strictEqual(store.size(), 1);
  assert.strictEqual(store.consume(code, verifier).status, 'ok');
});

test('상한(기본 500)을 넘으면 가장 오래된 코드부터 버린다', () => {
  const store = createAppAuthCodeStore();
  const pairs = [];
  for (let i = 0; i < 501; i += 1) {
    const p = newPair();
    pairs.push({ ...p, code: store.issue({ token: `t${i}`, challenge: p.challenge }) });
  }
  assert.strictEqual(store.size(), 500);
  assert.strictEqual(store.consume(pairs[0].code, pairs[0].verifier).status, 'unknown');
  assert.deepStrictEqual(store.consume(pairs[500].code, pairs[500].verifier), { status: 'ok', token: 't500' });
  assert.deepStrictEqual(store.consume(pairs[1].code, pairs[1].verifier), { status: 'ok', token: 't1' });
});

test('작은 상한에서도 오래된 것부터 버린다', () => {
  const store = createAppAuthCodeStore({ maxEntries: 2 });
  const a = newPair();
  const first = store.issue({ token: 't1', challenge: a.challenge });
  store.issue({ token: 't2', challenge: newPair().challenge });
  store.issue({ token: 't3', challenge: newPair().challenge });
  assert.strictEqual(store.size(), 2);
  assert.strictEqual(store.consume(first, a.verifier).status, 'unknown');
});

test('발급 때 만료 항목을 sweep 한다', () => {
  let now = 0;
  const store = createAppAuthCodeStore({ ttlMs: 10, now: () => now });
  store.issue({ token: 't1', challenge: newPair().challenge });
  now = 100;
  store.issue({ token: 't2', challenge: newPair().challenge });
  assert.strictEqual(store.size(), 1);
});

test('L-6: maxEntries 가 1 미만·정수 아님이면 생성 시 거부한다(무한 루프 방지)', () => {
  for (const maxEntries of [0, -1, 0.5, NaN, Infinity, '500', null]) {
    assert.throws(() => createAppAuthCodeStore({ maxEntries }), RangeError, String(maxEntries));
  }
  const store = createAppAuthCodeStore({ maxEntries: 1 });
  store.issue({ token: 't1', challenge: newPair().challenge });
  store.issue({ token: 't2', challenge: newPair().challenge });
  assert.strictEqual(store.size(), 1);
});

test('딥링크는 theroute 스킴이고 빈 값은 싣지 않는다', () => {
  assert.strictEqual(buildAppDeepLink({ code: 'abc' }), 'theroute://auth/callback?code=abc');
  assert.strictEqual(buildAppDeepLink({ error: 'x', msg: '' }), 'theroute://auth/callback?error=x');
});

test('쿠키는 헤더에서 이름으로만 읽는다', () => {
  const req = { headers: { cookie: `other=1; ${APP_LOGIN_COOKIE}=n.${RFC_CHALLENGE}; trailing=2` } };
  assert.strictEqual(readCookie(req, APP_LOGIN_COOKIE), `n.${RFC_CHALLENGE}`);
  assert.strictEqual(readCookie({ headers: {} }, APP_LOGIN_COOKIE), null);
  assert.strictEqual(readCookie({ headers: { cookie: `x${APP_LOGIN_COOKIE}=n.${RFC_CHALLENGE}` } }, APP_LOGIN_COOKIE), null);
  assert.strictEqual(readCookie({ headers: { cookie: `${APP_LOGIN_COOKIE}=%E0%A4%A` } }, APP_LOGIN_COOKIE), null);
});

test('표시 쿠키 인코딩·엄격 파싱', () => {
  assert.strictEqual(encodeAppLoginCookie({ challenge: RFC_CHALLENGE }), `n.${RFC_CHALLENGE}`);
  assert.strictEqual(encodeAppLoginCookie({ challenge: RFC_CHALLENGE, fallback: true }), `f.${RFC_CHALLENGE}`);
  assert.deepStrictEqual(parseAppLoginCookie(`n.${RFC_CHALLENGE}`), { fallback: false, challenge: RFC_CHALLENGE });
  assert.deepStrictEqual(parseAppLoginCookie(`f.${RFC_CHALLENGE}`), { fallback: true, challenge: RFC_CHALLENGE });
  assert.throws(() => encodeAppLoginCookie({ challenge: 'bad' }));
  // 09-18 계획의 옛 값('1'·'fallback')과 그 밖의 모양은 "앱 로그인이 아님"
  for (const bad of [null, undefined, '', '1', 'fallback', `x.${RFC_CHALLENGE}`, `n.${RFC_CHALLENGE}x`,
    ` n.${RFC_CHALLENGE}`, `n.${RFC_CHALLENGE.slice(1)}`, `n:${RFC_CHALLENGE}`, `N.${RFC_CHALLENGE}`]) {
    assert.strictEqual(parseAppLoginCookie(bad), null, String(bad));
  }
});

test('provider 화이트리스트는 google 과 github 뿐이다', () => {
  assert.deepStrictEqual([...APP_AUTH_PROVIDERS], ['google', 'github']);
});

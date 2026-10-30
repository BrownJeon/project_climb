import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  APP_LOGIN_PROVIDERS,
  HANDLED_KEY,
  HANDLED_MAX,
  LAUNCH_ECHO_TTL_MS,
  MESSAGES,
  PKCE_KEY,
  PKCE_RE,
  PKCE_TTL_MS,
  START_GUARD_MS,
  START_INFLIGHT_MAX_MS,
  __resetAppLoginForTest,
  buildAppStartUrl,
  createAppLoginHandler,
  createPkcePair,
  describeAuthError,
  exchangeErrorMessage,
  fingerprint,
  pkceChallenge,
  savePendingLogin,
  startAppLogin,
  takePendingVerifier,
  toExchangeError,
} from '../src/native/appLogin.js';

const CODE = 'b'.repeat(64);
const LINK = `theroute://auth/callback?code=${CODE}`;
const CANCEL_LINK = 'theroute://auth/callback?error=oauth_failed&msg=access_denied'; // 실제 서버 출력 형태
const FAIL_LINK = 'theroute://auth/callback?error=oauth_failed&msg=server_error';
const T0 = 1_800_000_000_000;
const VERIFIER = 'v'.repeat(43);

// RFC 7636 부록 B — 개정 §3-1: 양쪽(서버·웹) 시험에 반드시 포함
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

// 승인 데모 v1 §4 "제안 v1" 열 — 마침표까지 그대로(D4)
const MSG_CANCELLED = '로그인을 취소했습니다.';
const MSG_EXPIRED = '로그인 시간이 지났습니다. 다시 로그인해 주세요.';
const MSG_NETWORK = '서버에 연결하지 못했습니다. 다시 로그인해 주세요.';
const MSG_FAILED = '로그인에 실패했습니다. 다시 시도해 주세요.';

beforeEach(() => __resetAppLoginForTest());

/** Storage 를 흉내 낸다. */
function memStorage() {
  const m = new Map();
  return {
    map: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const blockedStorage = () => ({
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
});

/** console.warn 을 잠시 막는다(의도된 경고가 시험 출력을 어지럽히지 않게). */
async function quiet(fn) {
  const w = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = w; }
}

function harness(overrides = {}) {
  const calls = { navigate: [], notify: [], closed: 0, exchanged: [] };
  const pkce = overrides.pkceStorage || memStorage();
  if (!overrides.noPending) savePendingLogin(pkce, { verifier: VERIFIER, provider: 'google' }, T0);
  const { noPending, ...rest } = overrides;
  const deps = {
    exchange: async (code, verifier) => { calls.exchanged.push([code, verifier]); return 'jwt.token'; },
    login: async () => true,
    navigate: (p, o) => calls.navigate.push([p, o]),
    notify: (m) => calls.notify.push(m),
    closeExternal: async () => { calls.closed += 1; },
    hasToken: () => false,
    storage: memStorage(),
    pkceStorage: pkce,
    now: () => T0 + 1000,
    ...rest,
  };
  return { calls, deps, pkce, handle: createAppLoginHandler(deps) };
}

// ── 승인 문구 ───────────────────────────────────────────────────────────

test('사용자 문구는 승인 데모 v1 §4 와 마침표까지 같다', () => {
  assert.deepStrictEqual({ ...MESSAGES }, {
    cancelled: MSG_CANCELLED, expired: MSG_EXPIRED, network: MSG_NETWORK, failed: MSG_FAILED,
  });
});

// ── PKCE 형식 ───────────────────────────────────────────────────────────

test('RFC 7636 부록 B 벡터: S256(verifier) = challenge', async () => {
  assert.strictEqual(await pkceChallenge(RFC_VERIFIER), RFC_CHALLENGE);
});

test('verifier 는 43자 base64url, challenge 는 그 S256 이고 같은 정규식', async () => {
  const seen = new Set();
  for (let i = 0; i < 20; i += 1) {
    const { verifier, challenge } = await createPkcePair();
    assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
    assert.match(challenge, PKCE_RE);
    assert.strictEqual(challenge, await pkceChallenge(verifier));
    seen.add(verifier);
  }
  assert.strictEqual(seen.size, 20, '무작위여야 한다');
});

test('형식이 틀린 verifier 의 challenge 는 만들지 않는다', async () => {
  for (const bad of ['', 'short', 'v'.repeat(44), `${'v'.repeat(42)}=`, `${'v'.repeat(42)}+`, null]) {
    await assert.rejects(() => pkceChallenge(bad));
  }
});

test('Web Crypto 가 없으면 PKCE 쌍 생성이 실패한다', async () => {
  await assert.rejects(() => createPkcePair({}));
});

// ── 보관(localStorage `theroute_app_pkce`) ──────────────────────────────

test('보관 형식은 {verifier, provider, createdAt} 이고 꺼내면 지워진다', () => {
  const st = memStorage();
  savePendingLogin(st, { verifier: VERIFIER, provider: 'github' }, T0);
  assert.deepStrictEqual(JSON.parse(st.getItem(PKCE_KEY)), { verifier: VERIFIER, provider: 'github', createdAt: T0 });
  __resetAppLoginForTest(); // 메모리 없이 저장소만으로(앱 프로세스 재시작 흉내)
  assert.deepStrictEqual(takePendingVerifier(st, T0 + 1), { verifier: VERIFIER, provider: 'github' });
  assert.strictEqual(st.getItem(PKCE_KEY), null);
  assert.strictEqual(takePendingVerifier(st, T0 + 2), null, '두 번째는 null');
});

test('TTL 10분: 경계 안은 유효, 넘거나 미래 시각이면 null 이고 어쨌든 지운다', () => {
  for (const [at, ok] of [[T0 + PKCE_TTL_MS, true], [T0 + PKCE_TTL_MS + 1, false], [T0 - 1, false]]) {
    const st = memStorage();
    savePendingLogin(st, { verifier: VERIFIER, provider: 'google' }, T0);
    __resetAppLoginForTest();
    const r = takePendingVerifier(st, at);
    assert.strictEqual(r !== null, ok, `now=${at - T0}`);
    assert.strictEqual(st.getItem(PKCE_KEY), null);
  }
});

test('깨진 값·형식이 틀린 verifier 는 null 이고 지운다', () => {
  for (const raw of ['{', 'null', '42', JSON.stringify({ verifier: 'x', createdAt: T0 }), JSON.stringify({ verifier: VERIFIER })]) {
    const st = memStorage();
    st.setItem(PKCE_KEY, raw);
    assert.strictEqual(takePendingVerifier(st, T0), null, raw);
    assert.strictEqual(st.getItem(PKCE_KEY), null);
  }
});

test('localStorage 가 막혀 있어도 같은 프로세스 안에서는 메모리로 돌아온다', async () => {
  await quiet(() => savePendingLogin(blockedStorage(), { verifier: VERIFIER, provider: 'google' }, T0));
  assert.deepStrictEqual(takePendingVerifier(blockedStorage(), T0 + 1), { verifier: VERIFIER, provider: 'google' });
  assert.strictEqual(takePendingVerifier(blockedStorage(), T0 + 2), null);
});

// ── 시작(startAppLogin) ─────────────────────────────────────────────────

test('app-start 주소: provider·challenge, fallback 은 선택', () => {
  assert.strictEqual(
    buildAppStartUrl('google', RFC_CHALLENGE),
    `https://climb.xn--lh0b87pnudm10a4vd.com/api/auth/app-start?provider=google&challenge=${RFC_CHALLENGE}`,
  );
  assert.ok(buildAppStartUrl('github', RFC_CHALLENGE, { fallback: true }).endsWith('&fallback=1'));
  assert.deepStrictEqual([...APP_LOGIN_PROVIDERS], ['google', 'github']);
});

test('startAppLogin: verifier 를 보관하고 그 S256 challenge 로 Custom Tab 을 연다', async () => {
  const st = memStorage();
  const opened = [];
  const ok = await startAppLogin('google', {
    isNative: () => true, open: async (u) => { opened.push(u); return true; }, storage: st, now: () => T0,
  });
  assert.strictEqual(ok, true);
  const saved = JSON.parse(st.getItem(PKCE_KEY));
  assert.match(saved.verifier, PKCE_RE);
  assert.strictEqual(saved.provider, 'google');
  assert.strictEqual(saved.createdAt, T0);
  const u = new URL(opened[0]);
  assert.strictEqual(u.origin + u.pathname, 'https://climb.xn--lh0b87pnudm10a4vd.com/api/auth/app-start');
  assert.strictEqual(u.searchParams.get('provider'), 'google');
  assert.strictEqual(u.searchParams.get('challenge'), await pkceChallenge(saved.verifier));
  assert.ok(!opened[0].includes(saved.verifier), 'verifier 는 주소에 실리지 않는다');
  assert.strictEqual(u.searchParams.get('fallback'), null);
});

test('startAppLogin: 앱이 아니면 아무것도 하지 않고 false (웹 이동)', async () => {
  const st = memStorage();
  let opened = 0;
  assert.strictEqual(await startAppLogin('google', { isNative: () => false, open: async () => { opened += 1; return true; }, storage: st }), false);
  assert.strictEqual(opened, 0);
  assert.strictEqual(st.getItem(PKCE_KEY), null);
});

test('startAppLogin: 모르는 provider 는 false', async () => {
  const st = memStorage();
  assert.strictEqual(await startAppLogin('kakao', { isNative: () => true, open: async () => true, storage: st }), false);
  assert.strictEqual(st.getItem(PKCE_KEY), null);
});

test('startAppLogin: Custom Tab 을 못 열면(false·throw) false 이고 보관한 verifier 를 지운다', async () => {
  for (const open of [async () => false, async () => { throw new Error('x'); }]) {
    __resetAppLoginForTest();
    const st = memStorage();
    assert.strictEqual(await startAppLogin('github', { isNative: () => true, open, storage: st, now: () => T0 }), false);
    assert.strictEqual(st.getItem(PKCE_KEY), null);
    assert.strictEqual(takePendingVerifier(st, T0), null, '메모리에도 남지 않는다');
  }
});

test('startAppLogin: Web Crypto 가 없으면 false (웹 이동으로 폴백)', async () => {
  const st = memStorage();
  const r = await quiet(() => startAppLogin('google', { isNative: () => true, open: async () => true, storage: st, cryptoImpl: {} }));
  assert.strictEqual(r, false);
  assert.strictEqual(st.getItem(PKCE_KEY), null);
});

test('이중 탭: 진행 중인 시작이 있으면 두 번째는 새 흐름 없이 true, verifier 는 첫 것 그대로', async () => {
  const st = memStorage();
  const opened = [];
  let release;
  const gate = new Promise((r) => { release = r; });
  const deps = {
    isNative: () => true, storage: st, now: () => T0,
    open: async (u) => { opened.push(u); await gate; return true; },
  };
  const first = startAppLogin('google', deps);
  while (opened.length === 0) await new Promise((r) => setTimeout(r, 1)); // 첫 시작이 open 대기 중
  const savedFirst = st.getItem(PKCE_KEY);
  assert.strictEqual(await startAppLogin('google', deps), true, '이미 처리 중');
  release();
  assert.strictEqual(await first, true);
  assert.strictEqual(opened.length, 1, 'Custom Tab 은 한 번만');
  assert.strictEqual(st.getItem(PKCE_KEY), savedFirst, 'verifier 를 덮어쓰지 않는다');
});

test('이중 탭: 연 직후 2초 안의 탭은 무시, 2초가 지나면 새로 연다', async () => {
  const st = memStorage();
  let t = T0;
  const opened = [];
  const deps = { isNative: () => true, storage: st, now: () => t, open: async (u) => { opened.push(u); return true; } };
  assert.strictEqual(await startAppLogin('google', deps), true);
  const first = st.getItem(PKCE_KEY);
  t = T0 + START_GUARD_MS - 1;
  assert.strictEqual(await startAppLogin('github', deps), true);
  assert.strictEqual(opened.length, 1);
  assert.strictEqual(st.getItem(PKCE_KEY), first);
  t = T0 + START_GUARD_MS;
  assert.strictEqual(await startAppLogin('github', deps), true);
  assert.strictEqual(opened.length, 2);
  assert.notStrictEqual(st.getItem(PKCE_KEY), first);
});

test('이중 탭 보호는 로그인 딥링크(취소)가 오면 풀린다 — 취소 직후 다시 누르면 곧바로 열린다', async () => {
  const st = memStorage();
  const opened = [];
  const deps = { isNative: () => true, storage: st, now: () => T0, open: async (u) => { opened.push(u); return true; } };
  await startAppLogin('google', deps);
  const { handle } = harness({ noPending: true, pkceStorage: st });
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link');
  assert.strictEqual(await startAppLogin('google', deps), true);
  assert.strictEqual(opened.length, 2);
});

test('이중 탭 보호: 앞선 시작이 실패(false)했으면 바로 다시 시도할 수 있다', async () => {
  const st = memStorage();
  let n = 0;
  const deps = { isNative: () => true, storage: st, now: () => T0, open: async () => { n += 1; return n > 1; } };
  assert.strictEqual(await startAppLogin('google', deps), false);
  assert.strictEqual(await startAppLogin('google', deps), true);
  assert.strictEqual(n, 2);
});

test('startAppLogin → 딥링크: 보관한 verifier 가 교환에 실린다(왕복)', async () => {
  const pkce = memStorage();
  await startAppLogin('google', { isNative: () => true, open: async () => true, storage: pkce, now: () => T0 });
  const verifier = JSON.parse(pkce.getItem(PKCE_KEY)).verifier;
  const { handle, calls } = harness({ pkceStorage: pkce, noPending: true });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'ok');
  assert.deepStrictEqual(calls.exchanged, [[CODE, verifier]]);
  assert.strictEqual(pkce.getItem(PKCE_KEY), null);
});

// ── 교환 실패 분류 → 승인 문구 ─────────────────────────────────────────

test('교환 실패 분류: 401 → 시간 지남, 400 등 → 실패, 서버에 못 닿음 → 연결 실패', () => {
  const cases = [
    [{ success: false, data: null, message: '서버 문구', httpStatus: 401 }, 'expired', MSG_EXPIRED],
    [{ success: false, data: null, message: '서버 문구', httpStatus: 400 }, 'failed', MSG_FAILED],
    [{ success: false, data: null, message: 'x', httpStatus: 500 }, 'failed', MSG_FAILED],
    [{ success: false, data: null, message: 'x' }, 'failed', MSG_FAILED], // 상태 미상이지만 서버 응답
    [{ success: false, message: 'timeout of 15000ms exceeded' }, 'network', MSG_NETWORK], // 인터셉터 대체 객체
    [{ success: false, message: 'Network Error' }, 'network', MSG_NETWORK],
    ['<html>502 Bad Gateway</html>', 'network', MSG_NETWORK], // 프록시 HTML
    [undefined, 'network', MSG_NETWORK],
  ];
  for (const [rejected, kind, msg] of cases) {
    const e = toExchangeError(rejected);
    assert.ok(e instanceof Error);
    assert.strictEqual(e.kind, kind, JSON.stringify(rejected));
    assert.strictEqual(e.message, msg);
    assert.strictEqual(exchangeErrorMessage(e), msg);
  }
  assert.strictEqual(toExchangeError({ data: null, httpStatus: 401 }).httpStatus, 401);
  assert.strictEqual(exchangeErrorMessage(new Error('예상 밖')), MSG_FAILED);
  assert.strictEqual(exchangeErrorMessage(null), MSG_FAILED);
});

test('교환 401(만료·재사용·불일치) → "로그인 시간이 지났습니다." 안내', async () => {
  const { handle, calls } = harness({ exchange: async () => { throw toExchangeError({ data: null, httpStatus: 401 }); } });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.notify, [MSG_EXPIRED]);
  assert.deepStrictEqual(calls.navigate, [['/login', { replace: true }]]);
});

test('교환이 서버에 닿지 못하면 → "서버에 연결하지 못했습니다." 안내', async () => {
  const { handle, calls } = harness({ exchange: async () => { throw toExchangeError({ success: false, message: 'Network Error' }); } });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.notify, [MSG_NETWORK]);
});

test('교환 400 → "로그인에 실패했습니다." 안내', async () => {
  const { handle, calls } = harness({ exchange: async () => { throw toExchangeError({ data: null, httpStatus: 400 }); } });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.notify, [MSG_FAILED]);
});

// ── 딥링크 → 로그인 (09-18 계획 케이스 + PKCE) ───────────────────────────

test('로그인 딥링크가 아니면 ignored (verifier 를 건드리지 않는다)', async () => {
  const { handle, calls, pkce } = harness();
  assert.strictEqual(await handle('https://climb.example.com/'), 'ignored');
  assert.strictEqual(calls.closed, 0);
  assert.notStrictEqual(pkce.getItem(PKCE_KEY), null);
});

test('정상 흐름: 코드+verifier 교환 → 로그인 → 홈으로, verifier 는 지워진다', async () => {
  const { handle, calls, pkce } = harness();
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'ok');
  assert.deepStrictEqual(calls.exchanged, [[CODE, VERIFIER]]);
  assert.strictEqual(calls.closed, 1);
  assert.deepStrictEqual(calls.navigate, [['/', { replace: true }]]);
  assert.deepStrictEqual(calls.notify, []);
  assert.strictEqual(pkce.getItem(PKCE_KEY), null);
});

test('교환이 실패해도 verifier 는 지워진다(1회용)', async () => {
  const { handle, pkce } = harness({ exchange: async () => { throw new Error('x'); } });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.strictEqual(pkce.getItem(PKCE_KEY), null);
});

test('같은 코드가 두 번 오면 두 번째는 duplicate (교환하지 않는다)', async () => {
  const { handle, calls } = harness();
  await handle(LINK, { source: 'open' });
  assert.strictEqual(await handle(LINK, { source: 'launch' }), 'duplicate');
  assert.strictEqual(calls.exchanged.length, 1);
});

test('새로고침 뒤에도 sessionStorage 지문으로 코드 중복을 막는다 — 원문은 저장하지 않는다', async () => {
  const storage = memStorage();
  const first = harness({ storage });
  await first.handle(LINK, { source: 'open' });
  const second = harness({ storage });  // 새 페이지 = 새 메모리 Set
  assert.strictEqual(await second.handle(LINK, { source: 'launch' }), 'duplicate');
  assert.deepStrictEqual(second.calls.exchanged, []);
  const raw = storage.getItem(HANDLED_KEY);
  assert.deepStrictEqual(JSON.parse(raw), [fingerprint(LINK)]);
  assert.match(JSON.parse(raw)[0], /^[0-9a-f]{8}$/);
  assert.ok(!raw.includes(CODE), '코드 원문이 저장소에 없다');
});

test('중복 기록은 최근 20개까지만 남는다', async () => {
  assert.strictEqual(HANDLED_MAX, 20);
  const storage = memStorage();
  const { handle } = harness({ storage, noPending: true, hasToken: () => true });
  for (let i = 0; i < 25; i += 1) {
    await handle(`theroute://auth/callback?code=${i.toString(16).padStart(64, '0')}`, { source: 'launch' });
  }
  const list = JSON.parse(storage.getItem(HANDLED_KEY));
  assert.strictEqual(list.length, 20);
  assert.strictEqual(list[19], fingerprint(`theroute://auth/callback?code=${(24).toString(16).padStart(64, '0')}`));
});

test('사용자가 방금 누른 로그인(open)의 교환 실패는 반드시 알린다', async () => {
  const { handle, calls } = harness({ exchange: async () => { throw new Error('예상 밖'); } });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.notify, [MSG_FAILED]);
  assert.deepStrictEqual(calls.navigate, [['/login', { replace: true }]]);
});

test('옛 launch 코드가 실패했는데 이미 로그인돼 있으면 조용히 넘긴다', async () => {
  const { handle, calls } = harness({
    exchange: async () => { throw toExchangeError({ data: null, httpStatus: 401 }); },
    hasToken: () => true,
  });
  assert.strictEqual(await handle(LINK, { source: 'launch' }), 'silent');
  assert.deepStrictEqual(calls.notify, []);
  assert.deepStrictEqual(calls.navigate, []);
});

test('보관된 verifier 가 없으면 교환하지 않고 "로그인 시간이 지났습니다." (open)', async () => {
  const { handle, calls } = harness({ noPending: true });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.exchanged, []);
  assert.deepStrictEqual(calls.notify, [MSG_EXPIRED]);
  assert.deepStrictEqual(calls.navigate, [['/login', { replace: true }]]);
});

test('verifier 가 10분을 넘었으면 교환하지 않고 "로그인 시간이 지났습니다."', async () => {
  const { handle, calls } = harness({ now: () => T0 + PKCE_TTL_MS + 1 });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.exchanged, []);
  assert.deepStrictEqual(calls.notify, [MSG_EXPIRED]);
});

test('verifier 가 없는 옛 launch 코드 + 이미 로그인 → silent', async () => {
  const { handle, calls } = harness({ noPending: true, hasToken: () => true });
  assert.strictEqual(await handle(LINK, { source: 'launch' }), 'silent');
  assert.deepStrictEqual(calls.notify, []);
  assert.deepStrictEqual(calls.exchanged, []);
});

test('다른 코드가 연달아 오면 두 번째는 verifier 가 없어 교환하지 않는다', async () => {
  const { handle, calls } = harness();
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'ok');
  const other = `theroute://auth/callback?code=${'c'.repeat(64)}`;
  assert.strictEqual(await handle(other, { source: 'open' }), 'failed');
  assert.strictEqual(calls.exchanged.length, 1);
});

test('토큰은 받았지만 사용자 조회가 실패하면 "로그인에 실패했습니다." 와 로그인 화면으로', async () => {
  const { handle, calls } = harness({ login: async () => false });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.notify, [MSG_FAILED]);
  assert.deepStrictEqual(calls.navigate, [['/login', { replace: true }]]);
});

// ── 오류 딥링크 (Reviewer H2) ─────────────────────────────────────────

test('오류 딥링크(취소)는 "로그인을 취소했습니다." 로 안내한다(교환하지 않는다)', async () => {
  const { handle, calls } = harness();
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link');
  assert.deepStrictEqual(calls.notify, [MSG_CANCELLED]);
  assert.strictEqual(calls.closed, 1);
  assert.deepStrictEqual(calls.navigate, [['/login', { replace: true }]]);
  assert.deepStrictEqual(calls.exchanged, []);
});

test('같은 취소를 연속 3회 하면 3회 모두 알리고 Custom Tab 닫기도 매번 부른다', async () => {
  const { handle, calls } = harness();
  for (let i = 0; i < 3; i += 1) {
    assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link', `${i + 1}번째`);
  }
  assert.deepStrictEqual(calls.notify, [MSG_CANCELLED, MSG_CANCELLED, MSG_CANCELLED]);
  assert.strictEqual(calls.closed, 3);
  assert.strictEqual(calls.navigate.length, 3);
});

test('같은 서버 오류가 반복돼도 매번 "로그인에 실패했습니다." 를 알린다', async () => {
  const { handle, calls } = harness();
  await handle(FAIL_LINK, { source: 'open' });
  await handle(FAIL_LINK, { source: 'open' });
  assert.deepStrictEqual(calls.notify, [MSG_FAILED, MSG_FAILED]);
});

test('콜드 스타트 이중 전달(launch 먼저 → open)은 한 번만 알린다, 그 뒤 새 취소는 다시 알린다', async () => {
  const { handle, calls } = harness();
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'launch' }), 'error-link');
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'duplicate');
  assert.strictEqual(calls.notify.length, 1);
  assert.strictEqual(calls.closed, 1);
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link', '사용자가 다시 취소');
  assert.strictEqual(calls.notify.length, 2);
});

test('콜드 스타트 이중 전달(open 먼저 → launch)도 한 번만 알린다', async () => {
  const { handle, calls } = harness();
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link');
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'launch' }), 'duplicate');
  assert.strictEqual(calls.notify.length, 1);
});

test('새로고침 뒤 옛 launch 오류 주소는 다시 알리지 않는다', async () => {
  const storage = memStorage();
  const first = harness({ storage });
  await first.handle(CANCEL_LINK, { source: 'launch' });
  const second = harness({ storage });
  assert.strictEqual(await second.handle(CANCEL_LINK, { source: 'launch' }), 'duplicate');
  assert.deepStrictEqual(second.calls.notify, []);
  assert.ok(!storage.getItem(HANDLED_KEY).includes('oauth_failed'), '오류 주소 원문도 저장하지 않는다');
});

test('오류 문구 판정', () => {
  assert.strictEqual(describeAuthError({ error: 'oauth_failed', msg: 'access_denied' }), MSG_CANCELLED);
  assert.strictEqual(describeAuthError({ error: 'access_denied' }), MSG_CANCELLED);
  assert.strictEqual(describeAuthError({ error: 'x', msg: 'user cancelled' }), MSG_CANCELLED);
  assert.strictEqual(describeAuthError({ error: 'invalid_token' }), MSG_FAILED);
  assert.strictEqual(describeAuthError(), MSG_FAILED);
});

test('storage 가 막혀 있어도(한 페이지 안) 코드 중복은 막힌다', async () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() {},
  };
  const { handle, calls } = harness({ storage: blocked });
  await handle(LINK, { source: 'open' });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'duplicate');
  assert.strictEqual(calls.exchanged.length, 1);
});

// ── Reviewer 2라운드 L-2: open() 이 영영 응답하지 않을 때 ───────────────────

/** 손으로 풀어 주는 open — 결과를 나중에 정한다. */
function deferredOpen() {
  const calls = [];
  const open = (u) => new Promise((resolve) => { calls.push({ url: u, resolve }); });
  return { calls, open };
}
const until = async (cond) => { while (!cond()) await new Promise((r) => setTimeout(r, 1)); };

test('L-2: open() 이 응답하지 않아도 10초 안의 탭은 "이미 처리 중", 10초가 지나면 새로 시작할 수 있다', async () => {
  const st = memStorage();
  let t = T0;
  const d = deferredOpen();
  const deps = { isNative: () => true, storage: st, now: () => t, open: d.open };
  startAppLogin('google', deps); // 영영 끝나지 않는 첫 시작
  await until(() => d.calls.length === 1);

  t = T0 + START_INFLIGHT_MAX_MS - 1;
  assert.strictEqual(await startAppLogin('google', deps), true, '아직 진행 중으로 본다');
  assert.strictEqual(d.calls.length, 1);

  t = T0 + START_INFLIGHT_MAX_MS;
  const second = startAppLogin('github', deps);
  await until(() => d.calls.length === 2);
  assert.strictEqual(new URL(d.calls[1].url).searchParams.get('provider'), 'github', '낡은 표시를 넘어 새로 연다');
  d.calls[1].resolve(true);
  assert.strictEqual(await second, true);
  assert.strictEqual(JSON.parse(st.getItem(PKCE_KEY)).provider, 'github');
});

test('L-2: 밀려난 낡은 시작이 늦게 실패로 끝나도 새 시작의 verifier 를 지우지 않고, 웹 폴백(false)도 하지 않는다', async () => {
  const st = memStorage();
  let t = T0;
  const d = deferredOpen();
  const deps = { isNative: () => true, storage: st, now: () => t, open: d.open };
  const first = startAppLogin('google', deps);
  await until(() => d.calls.length === 1);
  t = T0 + START_INFLIGHT_MAX_MS;
  const second = startAppLogin('github', deps);
  await until(() => d.calls.length === 2);
  d.calls[1].resolve(true);
  await second;
  const savedSecond = st.getItem(PKCE_KEY);

  d.calls[0].resolve(false); // 낡은 첫 시작이 이제야 실패
  assert.strictEqual(await first, true, '옛 탭이 뒤늦게 웹 이동하지 않도록 true');
  assert.strictEqual(st.getItem(PKCE_KEY), savedSecond, '새 verifier 그대로');
  // 새 시작이 연 직후라 2초 보호는 그대로 살아 있다
  t += 1;
  assert.strictEqual(await startAppLogin('google', deps), true);
  assert.strictEqual(d.calls.length, 2);
});

test('L-2: 진행 중 표시는 로그인 딥링크가 오면 풀린다(open() 이 아직 응답 없어도)', async () => {
  const st = memStorage();
  const d = deferredOpen();
  const deps = { isNative: () => true, storage: st, now: () => T0, open: d.open };
  startAppLogin('google', deps);
  await until(() => d.calls.length === 1);
  const { handle } = harness({ noPending: true, pkceStorage: memStorage() });
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link');
  const again = startAppLogin('google', deps);
  await until(() => d.calls.length === 2);
  d.calls[1].resolve(true);
  assert.strictEqual(await again, true);
});

test('L-2: 시작이 실패로 끝나면 진행 중 표시가 바로 풀린다', async () => {
  const st = memStorage();
  const d = deferredOpen();
  const deps = { isNative: () => true, storage: st, now: () => T0, open: d.open };
  const first = startAppLogin('google', deps);
  await until(() => d.calls.length === 1);
  d.calls[0].resolve(false);
  assert.strictEqual(await first, false);
  const again = startAppLogin('google', deps);
  await until(() => d.calls.length === 2);
  d.calls[1].resolve(true);
  assert.strictEqual(await again, true);
});

// ── Reviewer 2라운드 L-1: launch 만 오고 보관된 open 이 오지 않을 때 ──────────

test('L-1: launch 오류 뒤 3초가 지나 같은 오류가 open 으로 오면 새 취소로 보고 알린다', async () => {
  let t = T0;
  const { handle, calls } = harness({ now: () => t });
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'launch' }), 'error-link');
  t = T0 + LAUNCH_ECHO_TTL_MS;
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link');
  assert.deepStrictEqual(calls.notify, [MSG_CANCELLED, MSG_CANCELLED]);
});

test('L-1: launch 오류 뒤 3초 안에 같은 오류가 open 으로 오면 이중 전달로 보고 거른다', async () => {
  let t = T0;
  const { handle, calls } = harness({ now: () => t });
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'launch' }), 'error-link');
  t = T0 + LAUNCH_ECHO_TTL_MS - 1;
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'duplicate');
  assert.strictEqual(calls.notify.length, 1);
  t += 1; // 걸러낸 뒤에는 대기 항목이 소비돼 다음 취소는 바로 처리된다
  assert.strictEqual(await handle(CANCEL_LINK, { source: 'open' }), 'error-link');
  assert.strictEqual(calls.notify.length, 2);
});

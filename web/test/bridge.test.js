import { test, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  APP_ORIGIN,
  AUTH_DEEP_LINK_SCHEME,
  authCodeFromDeepLink,
  authErrorFromDeepLink,
  closeExternal,
  isNativeApp,
  exitApp,
  onAuthDeepLink,
  onBackButton,
  openExternal,
} from '../src/native/bridge.js';

const CODE = 'a'.repeat(64);

/** window.Capacitor 를 흉내 낸다. 시험이 끝나면 지운다. */
function fakeApp({ native = true, browser = {}, app = {} } = {}) {
  const calls = { opened: [], listeners: {}, removed: [], exited: 0 };
  globalThis.window = {
    Capacitor: {
      isNativePlatform: () => native,
      Plugins: {
        Browser: { open: async (o) => { calls.opened.push(o.url); }, close: async () => {}, ...browser },
        App: {
          addListener: (ev, cb) => {
            calls.listeners[ev] = cb;
            return Promise.resolve({ remove: () => { calls.removed.push(ev); } });
          },
          getLaunchUrl: async () => null,
          exitApp: async () => { calls.exited += 1; },
          ...app,
        },
      },
    },
  };
  return calls;
}

afterEach(() => { delete globalThis.window; });

const tick = () => new Promise((r) => setTimeout(r, 0));

test('상수는 네이티브 설정과 같은 값이다', () => {
  assert.strictEqual(APP_ORIGIN, 'https://climb.xn--lh0b87pnudm10a4vd.com');
  assert.strictEqual(AUTH_DEEP_LINK_SCHEME, 'theroute:');
});

test('window 가 없으면(웹 SSR·Node) 앱이 아니고 모든 호출이 조용히 끝난다', async () => {
  assert.strictEqual(isNativeApp(), false);
  assert.strictEqual(await openExternal('https://example.com'), false);
  assert.strictEqual(await exitApp(), false);
  await closeExternal();
  const off1 = onAuthDeepLink(() => { throw new Error('불리면 안 됨'); });
  const off2 = onBackButton(() => { throw new Error('불리면 안 됨'); });
  off1(); off2();
});

test('Capacitor 가 있어도 네이티브 플랫폼이 아니면(웹) 앱이 아니다', async () => {
  const calls = fakeApp({ native: false });
  assert.strictEqual(isNativeApp(), false);
  assert.strictEqual(await openExternal('https://example.com'), false);
  assert.deepStrictEqual(calls.opened, []);
});

test('딥링크에서 코드를 꺼낸다 — host 와 path 를 따로 본다', () => {
  assert.strictEqual(authCodeFromDeepLink(`theroute://auth/callback?code=${CODE}`), CODE);
  assert.strictEqual(authCodeFromDeepLink(`theroute://auth/callback/?code=${CODE}`), CODE);
});

test('코드 형식(소문자 hex 64자)이 아니면 null 이다', () => {
  for (const bad of ['', 'ZZZ', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)]) {
    assert.strictEqual(authCodeFromDeepLink(`theroute://auth/callback?code=${bad}`), null);
  }
});

test('다른 스킴·다른 host·다른 path 는 무시한다', () => {
  assert.strictEqual(authCodeFromDeepLink(`bjjapp://auth/callback?code=${CODE}`), null);
  assert.strictEqual(authCodeFromDeepLink(`theroute://other/callback?code=${CODE}`), null);
  assert.strictEqual(authCodeFromDeepLink(`theroute://auth/other?code=${CODE}`), null);
  assert.strictEqual(authCodeFromDeepLink('https://climb.example.com/callback?code=' + CODE), null);
});

test('문자열이 아니거나 파싱 불가·지나치게 길면 null 이다', () => {
  const long = `theroute://auth/callback?code=${CODE}&pad=${'x'.repeat(2100)}`;
  for (const bad of [undefined, null, 42, '', 'not a url', long]) {
    assert.strictEqual(authCodeFromDeepLink(bad), null);
    assert.strictEqual(authErrorFromDeepLink(bad), null);
  }
});

test('오류 딥링크에서 error 와 msg 를 꺼낸다', () => {
  assert.deepStrictEqual(
    authErrorFromDeepLink('theroute://auth/callback?error=access_denied&msg=cancelled'),
    { error: 'access_denied', msg: 'cancelled' },
  );
  assert.deepStrictEqual(
    authErrorFromDeepLink('theroute://auth/callback?error=no_token'),
    { error: 'no_token', msg: '' },
  );
  assert.strictEqual(authErrorFromDeepLink(`theroute://auth/callback?code=${CODE}`), null);
});

test('openExternal 은 APP_ORIGIN 과 출처가 정확히 같은 https 주소만 연다 (Reviewer L2)', async () => {
  const calls = fakeApp();
  assert.strictEqual(await openExternal('/api/auth/app-start?provider=google'), true);
  assert.strictEqual(calls.opened[0], `${APP_ORIGIN}/api/auth/app-start?provider=google`);
  assert.strictEqual(await openExternal(`${APP_ORIGIN}/api/auth/app-start?provider=github`), true);
  // 유니코드 도메인은 같은 퓨니코드 출처로 풀린다
  assert.strictEqual(await openExternal('https://climb.미라클펭귄.com/x'), true);
  assert.strictEqual(calls.opened[2], `${APP_ORIGIN}/x`);
  for (const bad of [
    'https://example.com/',                          // 다른 출처
    '//evil.example/api/auth/app-start',             // 스킴 상대 — 다른 출처로 풀림
    'https://climb.xn--lh0b87pnudm10a4vd.com.evil.example/', // 접미사 위장
    'https://climb.xn--lh0b87pnudm10a4vd.com:8443/', // 다른 포트
    'http://climb.xn--lh0b87pnudm10a4vd.com/',       // http
    'javascript:alert(1)',
    'https://u:p@climb.xn--lh0b87pnudm10a4vd.com/',  // 사용자 정보
  ]) {
    assert.strictEqual(await openExternal(bad), false, bad);
  }
  assert.strictEqual(calls.opened.length, 3);
});

test('openExternal 은 플러그인이 던지면 false (호출부가 웹으로 폴백)', async () => {
  fakeApp({ browser: { open: async () => { throw new Error('no activity'); } } });
  assert.strictEqual(await openExternal(`${APP_ORIGIN}/`), false);
});

test('onAuthDeepLink — appUrlOpen 은 open, getLaunchUrl 은 launch 로 넘기고 해제 뒤엔 넘기지 않는다', async () => {
  const launch = `theroute://auth/callback?code=${CODE}`;
  const calls = fakeApp({ app: { getLaunchUrl: async () => ({ url: launch }) } });
  const got = [];
  const off = onAuthDeepLink((url, meta) => got.push([url, meta.source]));
  await tick();
  calls.listeners.appUrlOpen({ url: 'theroute://auth/callback?error=x' });
  assert.deepStrictEqual(got, [[launch, 'launch'], ['theroute://auth/callback?error=x', 'open']]);
  off();
  await tick();
  calls.listeners.appUrlOpen({ url: launch });
  assert.strictEqual(got.length, 2);
  assert.deepStrictEqual(calls.removed, ['appUrlOpen']);
});

test('onAuthDeepLink — 등록이 끝나기 전에 해제해도 등록 완료 즉시 지운다', async () => {
  const calls = fakeApp();
  const off = onAuthDeepLink(() => {});
  off();
  await tick();
  assert.deepStrictEqual(calls.removed, ['appUrlOpen']);
});

test('onBackButton — 이벤트 데이터를 넘기고, 데이터가 없으면 빈 객체', async () => {
  const calls = fakeApp();
  const got = [];
  const off = onBackButton((d) => got.push(d));
  calls.listeners.backButton({ canGoBack: false });
  calls.listeners.backButton(undefined);
  assert.deepStrictEqual(got, [{ canGoBack: false }, {}]);
  off();
  await tick();
  calls.listeners.backButton({ canGoBack: true });
  assert.strictEqual(got.length, 2);
});

test('앱에서 exitApp 은 플러그인을 부르고 true', async () => {
  const calls = fakeApp();
  assert.strictEqual(await exitApp(), true);
  assert.strictEqual(calls.exited, 1);
});

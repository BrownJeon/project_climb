import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  __resetBackStackForTest,
  backStackSize,
  handleNativeBack,
  pushBackHandler,
  runTopBackHandler,
} from '../src/native/backStack.js';

beforeEach(() => __resetBackStackForTest());

function env(overrides = {}) {
  const calls = { back: 0, exit: 0 };
  return {
    calls,
    env: { goBack: () => { calls.back += 1; }, exitApp: () => { calls.exit += 1; }, ...overrides },
  };
}

test('스택이 비었으면 runTopBackHandler 는 false', () => {
  assert.strictEqual(runTopBackHandler(), false);
});

test('겹친 모달에서 맨 위 하나만 닫는다', () => {
  const closed = [];
  pushBackHandler(() => closed.push('아래'));
  pushBackHandler(() => closed.push('위'));
  const { env: e } = env();
  assert.strictEqual(handleNativeBack({ canGoBack: true }, e), 'handler');
  assert.deepStrictEqual(closed, ['위']);
});

test('핸들러는 실행해도 스택에서 빠지지 않는다 (닫힘은 컴포넌트가 스스로 뺀다)', () => {
  pushBackHandler(() => {});
  runTopBackHandler();
  assert.strictEqual(backStackSize(), 1);
});

test('돌려받은 함수로 빼고, 여러 번 불러도 안전하다', () => {
  const remove = pushBackHandler(() => {});
  remove();
  remove();
  assert.strictEqual(backStackSize(), 0);
});

test('중간 것을 빼도 나머지 순서가 유지된다', () => {
  const closed = [];
  pushBackHandler(() => closed.push('1'));
  const removeMid = pushBackHandler(() => closed.push('2'));
  pushBackHandler(() => closed.push('3'));
  removeMid();
  runTopBackHandler();
  assert.deepStrictEqual(closed, ['3']);
  assert.strictEqual(backStackSize(), 2);
});

test('함수가 아니면 스택에 올리지 않는다', () => {
  pushBackHandler(null);
  pushBackHandler('닫기');
  assert.strictEqual(backStackSize(), 0);
});

test('모달이 없고 canGoBack 이면 뒤로 간다', () => {
  const { calls, env: e } = env();
  assert.strictEqual(handleNativeBack({ canGoBack: true }, e), 'back');
  assert.deepStrictEqual(calls, { back: 1, exit: 0 });
});

test('모달이 없고 canGoBack 이 false 면 앱을 끈다', () => {
  const { calls, env: e } = env();
  assert.strictEqual(handleNativeBack({ canGoBack: false }, e), 'exit');
  assert.deepStrictEqual(calls, { back: 0, exit: 1 });
});

test('canGoBack 이 없으면 historyLength 로 대신한다', () => {
  const a = env({ historyLength: 3 });
  assert.strictEqual(handleNativeBack({}, a.env), 'back');
  const b = env({ historyLength: 1 });
  assert.strictEqual(handleNativeBack({}, b.env), 'exit');
});

test('핸들러가 던져도 뒤로가기가 죽지 않는다', () => {
  pushBackHandler(() => { throw new Error('닫기 실패'); });
  const { env: e } = env();
  const origError = console.error;
  console.error = () => {};
  try {
    assert.strictEqual(handleNativeBack({ canGoBack: true }, e), 'handler');
  } finally {
    console.error = origError;
  }
});

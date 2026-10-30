/**
 * 안드로이드 하드웨어 뒤로가기 처리 — T009.
 *
 * 순서: ① 열린 모달이 있으면 **맨 위 하나만** 닫는다 → ② 뒤로 갈 기록이 있으면 history.back()
 *       → ③ 없으면 앱 종료.
 *
 * 왜 "전역 스택"인가: 모달은 부모가 조건부로 렌더하는 컴포넌트라 "열려 있음 = 마운트됨"이다.
 * 열려 있는 동안 닫는 방법을 스택에 올려 두면(useBackHandler) 뒤로가기는 맨 위 것만 부르면 된다.
 * 겹친 모달(상세 위 편집기)에서 **위의 것만** 닫힌다 — Escape 키 이벤트를 흉내 내면 열린 모달이
 * 한꺼번에 다 닫힌다.
 * 핸들러는 실행해도 스택에서 빼지 않는다: 닫힘은 컴포넌트가 언마운트되며 스스로 빠진다.
 * (닫기를 거절하는 화면이면 다음 뒤로가기도 같은 핸들러로 간다.)
 *
 * 왜 history.length 가 아니라 canGoBack 인가: history.length 는 뒤로 가도 줄지 않는다 —
 * 첫 화면으로 돌아와도 1 보다 커서 **앱이 영원히 안 꺼진다.** Capacitor App 플러그인이
 * backButton 이벤트에 WebView 의 canGoBack() 을 실어 주므로 그것을 쓰고, 값이 없을 때만
 * history.length 로 대신한다.
 *
 * 이 파일은 React 를 import 하지 않는다(단위 테스트가 Node 에서 실제 파일을 읽는다).
 */

const stack = [];

/** 닫기 함수를 스택 맨 위에 올린다. 돌려받은 함수로 뺀다(여러 번 불러도 안전). */
export function pushBackHandler(handler) {
  if (typeof handler !== 'function') return () => {};
  const entry = { handler };
  stack.push(entry);
  return () => {
    const i = stack.lastIndexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function backStackSize() {
  return stack.length;
}

/** 맨 위 핸들러를 부른다. 불렀으면 true. */
export function runTopBackHandler() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  try {
    top.handler();
  } catch (e) {
    console.error('[native-back] 닫기 핸들러 오류', e);
  }
  return true;
}

/**
 * @param {{canGoBack?: boolean}} data  App backButton 이벤트 데이터
 * @param {{goBack: () => void, exitApp: () => void, historyLength?: number}} env
 * @returns {'handler'|'back'|'exit'}
 */
export function handleNativeBack(data, env) {
  if (runTopBackHandler()) return 'handler';
  const canGoBack = data && typeof data.canGoBack === 'boolean'
    ? data.canGoBack
    : (Number(env && env.historyLength) || 0) > 1;
  if (canGoBack) {
    env.goBack();
    return 'back';
  }
  env.exitApp();
  return 'exit';
}

/** 테스트 전용 — 스택 비우기. */
export function __resetBackStackForTest() {
  stack.length = 0;
}

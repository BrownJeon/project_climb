import { useEffect, useRef } from 'react';
import { pushBackHandler } from './backStack.js';

/**
 * 열려 있는 동안 안드로이드 뒤로가기로 닫히게 한다 (T009, 설명은 ./backStack.js).
 *
 * 🔴 핸들러는 ref 로 최신값만 부르고, 스택 등록은 active 가 바뀔 때만 한다. onClose 가 매 렌더
 *    새 함수(인라인 화살표)여도 재등록하지 않으므로 **겹친 모달의 위·아래 순서가 뒤바뀌지 않는다.**
 * 웹 브라우저에서는 스택에 올라가기만 하고 아무도 부르지 않는다(동작 변화 없음).
 *
 * ⚠ 순서는 "등록(effect 실행) 순서"다. React 는 자식 effect 를 부모보다 먼저 실행하므로,
 *   부모·자식 모달이 **같은 렌더에서 동시에** 마운트되면 부모가 위에 놓인다. 현재 중첩 모달
 *   (RecordEditModal→ProblemPhotoModal, SessionAddModal→VideoLinkPicker)은 자식이 나중에 열리므로 해당 없다.
 *
 * @param {boolean} active   열려 있는가
 * @param {() => void} [onBack] 닫는 함수 — 없으면 등록하지 않는다
 */
export default function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  const enabled = !!active && typeof onBack === 'function';
  useEffect(() => {
    if (!enabled) return undefined;
    return pushBackHandler(() => { if (typeof ref.current === 'function') ref.current(); });
  }, [enabled]);
}

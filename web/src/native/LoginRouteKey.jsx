import { Fragment } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/**
 * `/login` 라우트 요소를 감싸, 주소에 `?error=` 가 새로 실려 오면 LoginPage 를 **새로 만든다** (T009 Reviewer H1).
 *
 * 왜: LoginPage 는 `useState(searchParams.get('error') || '')` 로 오류 문구를 **첫 렌더에만** 읽는다.
 * 앱에서는 사용자가 /login 에 머문 채 Custom Tab 으로 나갔다가, 취소·실패 딥링크를 받은 NativeAppHost 가
 * `/login?error=<문구>` 로 replace 이동한다 — 같은 라우트·같은 요소라 LoginPage 가 다시 만들어지지 않아 문구가 안 보인다.
 * LoginPage.jsx(화면 파일)는 건드리지 않고 key 로만 해결한다.
 *
 * key 규칙:
 *  · `?error=` 가 없으면 고정값 → **웹·앱 모두 지금과 똑같이** 한 번 만든 LoginPage 를 그대로 쓴다.
 *  · `?error=` 가 있으면 `오류값 + 이 이동의 location.key` → `/login?error=…` 로 **이동할 때마다** 새로 만든다.
 *    오류값만 쓰면 같은 취소를 두 번 했을 때(같은 문구) 두 번째는 새로 만들어지지 않고, 그 사이 사용자가 이메일 로그인 실패로
 *    오류 줄을 다른 문구로 바꿔 놓았다면 앱 안내가 화면에 닿지 않는다 — 그래서 이동 키를 붙인다.
 *
 * 웹 브라우저 영향: 웹에서 `/login?error=` 로 가는 길은 OAuthCallbackPage(다른 라우트에서 넘어오므로 어차피 새로 만든다)와
 * 주소 직접 입력·새로고침(첫 로드라 어차피 새로 만든다)뿐이다(`grep "/login?error"` — OAuthCallbackPage.jsx 20·33행).
 * LoginPage 안에서는 주소를 바꾸지 않는다(setSearchParams·navigate('/login…') 없음). 그러므로 웹에서는 재마운트가 새로 생기지 않는다.
 */
export default function LoginRouteKey({ children }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const error = searchParams.get('error');
  const key = error ? `e:${error}:${location.key}` : 'login';
  return <Fragment key={key}>{children}</Fragment>;
}

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { appExchange, getMe } from '../api/auth';
import { closeExternal, exitApp, isNativeApp, onAuthDeepLink, onBackButton } from './bridge.js';
import { createAppLoginHandler, defaultLocalStorage, defaultSessionStorage } from './appLogin.js';
import { handleNativeBack } from './backStack.js';

const TOKEN_KEY = 'theroute_token';

function hasToken() {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

/**
 * 안드로이드 앱(Capacitor WebView)에서만 켜지는 전역 연결부 — T009.
 * 웹 브라우저에서는 **아무것도 등록하지 않고** 아무것도 그리지 않는다(isNativeApp() false).
 *
 *  1. 로그인 딥링크 → (PKCE verifier 와 함께) 코드 교환 → 로그인 → 홈 (native/appLogin.js)
 *  2. 하드웨어 뒤로가기 → 맨 위 모달 닫기 → 뒤로 → 종료 (native/backStack.js)
 *  3. 키보드가 열려 WebView 가 줄면 입력 중인 칸을 화면 가운데로
 *
 * BrowserRouter · AuthProvider **안쪽**에 마운트해야 한다(navigate·authLogin 을 쓴다).
 * 로그인 **시작**(Custom Tab 열기)은 여기가 아니라 OAuthButtons 가 startAppLogin 으로 한다.
 */
export default function NativeAppHost() {
  const navigate = useNavigate();
  const { authLogin } = useAuth();
  // 딥링크·뒤로가기 구독은 마운트 1회만 한다(중복 교환 방지 Set 이 앱 수명 동안 유지돼야 한다).
  // 그래서 navigate·authLogin 은 ref 로 **호출 시점의 최신값**을 부른다.
  const live = useRef({ navigate, authLogin });
  live.current = { navigate, authLogin };

  // 1. 로그인 딥링크
  useEffect(() => {
    if (!isNativeApp()) return undefined;

    // TheRoute 에는 범용 토스트가 없다(VideoUploadToast 는 영상 업로드 전용).
    // 그래서 메시지를 버퍼에 담았다가 `/login?error=<문구>` 이동에 실어 보낸다 — OAuthCallbackPage 와 같은 기존 패턴이다.
    // LoginPage 는 ?error= 를 첫 렌더에만 읽으므로, 사용자가 /login 에 머문 채 Custom Tab 에서 돌아와도 문구가 보이도록
    // main.jsx 의 `/login` 라우트를 감싼 LoginRouteKey(./LoginRouteKey.jsx)가 ?error= 가 실린 이동마다 LoginPage 를
    // 새로 만든다(T009 Reviewer H1). /signup 등 다른 화면에서 시작했으면 라우트가 바뀌어 원래도 새로 만들어진다.
    let pendingError = '';

    const handle = createAppLoginHandler({
      exchange: appExchange,
      // AuthContext.authLogin 은 사용자 정보를 스스로 가져오지 않는다 —
      // OAuthCallbackPage 와 같은 순서로 토큰을 먼저 저장하고(axios 인터셉터가 요청 시점에 읽는다)
      // /auth/me 로 사용자를 가져온 뒤 확정한다.
      login: async (token) => {
        try {
          localStorage.setItem(TOKEN_KEY, token);
          const r = await getMe();
          live.current.authLogin(token, r.data);
          return true;
        } catch {
          try { localStorage.removeItem(TOKEN_KEY); } catch { /* 저장소 막힘 */ }
          return false;
        }
      },
      navigate: (path, opts) => {
        const to = pendingError && path === '/login'
          ? `/login?error=${encodeURIComponent(pendingError)}`
          : path;
        pendingError = '';
        live.current.navigate(to, opts);
      },
      notify: (msg) => { pendingError = msg; },
      closeExternal,
      hasToken,
      storage: defaultSessionStorage(),
      pkceStorage: defaultLocalStorage(),
    });

    return onAuthDeepLink((url, meta) => {
      handle(url, meta)
        .then(() => {
          // 이미 로그인된 상태라(토큰 있음) /login 으로 보내지 않은 경우 — 메시지를 실을 화면 이동이 없어 콘솔에만 남는다.
          // 대개 "로그인된 채로 옛 오류 딥링크가 다시 온" 때라 사용자가 막힌 상태가 아니다. 다만 만료된 토큰이 남은 채
          // 방금 누른 로그인이 실패한 경우도 이론상 여기로 온다(Reviewer L1 — 도달 가능성 낮아 현재 미처리).
          if (pendingError) {
            console.warn('[native-login]', pendingError);
            pendingError = '';
          }
        })
        .catch((e) => console.error('[native-login]', e && e.message));
    });
  }, []);

  // 2. 뒤로가기
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    return onBackButton((data) => {
      handleNativeBack(data, {
        goBack: () => window.history.back(),
        exitApp: () => { exitApp(); },
        historyLength: window.history.length,
      });
    });
  }, []);

  // 3. 키보드가 열려 WebView 가 줄면(MainActivity 가 키보드만큼 margin 을 준다) 입력 중인 칸을
  //    **화면 가운데**로. 브라우저 기본 스크롤은 칸이 겨우 보이는 데서 멈춰, 그 아래 목록이
  //    키보드 경계에 잘린다. input·textarea·select·contenteditable 공통.
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    const isEditable = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    let fullHeight = window.innerHeight;   // 키보드 없는 높이(회전·첫 로드 때 갱신)
    let lastHeight = window.innerHeight;
    let raf = 0;
    let timer = 0;
    const centerActive = () => {
      const el = document.activeElement;
      if (!isEditable(el) || typeof el.scrollIntoView !== 'function') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    };
    const keyboardOpen = () => window.innerHeight < fullHeight * 0.85;
    const onResize = () => {
      const h = window.innerHeight;
      if (h > fullHeight) fullHeight = h;
      if (h < lastHeight && keyboardOpen()) centerActive();
      lastHeight = h;
    };
    const onFocusIn = (e) => {
      if (!isEditable(e.target) || !keyboardOpen()) return;
      clearTimeout(timer);
      timer = setTimeout(centerActive, 50);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  return null;
}

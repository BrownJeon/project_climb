# TheRoute Android APK 설계 — Capacitor 7 원격 URL 셸

- 작성일: 2026-09-18
- 상태: 승인됨 (사용자 승인 2026-09-18)
- 참고 구현: `bjj-trainning` task-039 (`agent-vault/30-Knowledge/runbooks/android-apk-build.md`), TheMeal

## 1. 목표와 결정 요약

TheRoute 웹앱(`https://climb.미라클펭귄.com`)을 안드로이드 APK로 감싸 폰에 설치해 쓴다.
앱은 **껍데기**이고 내용물은 서버에 있다 — WebView가 운영 도메인을 직접 로드하므로 화면·기능
수정은 웹 배포만으로 반영되고, APK 재설치는 아이콘·권한·플러그인·네이티브 설정을 바꿀 때만 필요하다.

| 항목 | 값 | 근거 |
|---|---|---|
| 방식 | Capacitor 7 원격 URL 로딩 | BJJ·TheMeal에서 검증됨. 웹 자산을 APK에 넣지 않아 배포와 앱이 분리된다 |
| `server.url` | `https://climb.xn--lh0b87pnudm10a4vd.com` | 한글 도메인은 플랫폼마다 IDN 정규화가 달라 WebView가 못 열거나 "앱 내부 주소" 판정이 어긋난다 |
| `appId` | `com.miraclepenguin.theroute` | BJJ `com.miraclepenguin.bjj` 관례 |
| `appName` | `더 루트` | 기획서 제품명 |
| 딥링크 스킴 | `theroute://auth/callback` | BJJ `bjjapp://auth/callback` 대응 |
| targetSdk | 35 | 설치된 SDK가 android-35 단일 |
| 서명 | 디버그 키 사이드로드 (`~/.android/debug.keystore`) | Play 스토어 미사용. 릴리스 키스토어를 만들지 않는다 |

### 확인된 전제조건 (2026-09-18 실측)

- `https://climb.xn--lh0b87pnudm10a4vd.com/` → HTTP 200, 인증서 검증 통과. nginx vhost 활성.
- JDK 21 (`/usr/lib/jvm/java-21-openjdk-amd64`), Android SDK (`~/.node-local/android-sdk`,
  platforms `android-35`, build-tools `34.0.0`·`35.0.0`), `~/.android/debug.keystore` 모두 존재.
- 백엔드 OAuth가 BJJ와 **같은 공용 패키지** `@workspace/auth-oauth`(`project/shared/auth-oauth`)를 쓴다
  → 앱 로그인 흐름을 구조 그대로 이식할 수 있다.
- `web/src/utils/videoCompress.js`는 `@ffmpeg/core`(**단일스레드**, `core-mt` 아님)를 CDN에서 받는다
  → SharedArrayBuffer·COOP/COEP 헤더가 필요 없고 WebView에서 그대로 동작한다. nginx 변경 없음.

## 2. 범위

### 포함

1. Capacitor 7 Android 셸 (`mobile/`) — 설정·app-shell·빌드 스크립트·Android 프로젝트
2. 적응형 앱 아이콘 생성기와 산출물
3. Android 15 edge-to-edge 대응 (하단 탭 겹침·키보드 가림)
4. 하드웨어 뒤로가기 (모달 닫기 → 뒤로 → 종료)
5. 앱 OAuth 로그인 (Custom Tab + 1회용 코드 + 딥링크) — 백엔드 2개 라우트 + 콜백 가로채기, 웹 네이티브 모듈
6. 위치·카메라 권한 (암장 위치 검색, 사진 촬영 업로드)

### 제외 — 하지 않는 것과 그 이유

- **파일 다운로드/기기 저장**: TheRoute 웹에 다운로드 흐름이 없다(`web/src`에 `a[download]`·`saveAs` 없음).
  BJJ의 `@capacitor/file-transfer`·`@capacitor/filesystem`·`utils/download.js`를 이식하지 않는다.
- **`@capacitor/status-bar`**: 상태바 색·아이콘 밝기는 `styles.xml`로 끝난다. BJJ도 의존성에만 있고
  실제로 호출하지 않는다 — 넣지 않는다.
- **iOS**: 요청 범위 밖.
- **Play 스토어 배포·릴리스 서명**: 사이드로드만 한다.
- **기존 `mobile/` React Native Expo 앱**: 사용자 결정(2026-09-18)에 따라 **삭제**한다. git 이력에는 남는다.
- **`JWT_SECRET` 폴백 일원화**: agent-vault board의 별도 Todo 항목이다. 이번 작업은 기존 동작을
  바꾸지 않기 위해 `routes/auth.js`와 **동일한** 폴백 표현을 쓴다(아래 7절).

## 3. 아키텍처

```
 [ Android 앱 (Capacitor WebView) ]
         │  server.url = https://climb.xn--lh0b87pnudm10a4vd.com
         ▼
 [ nginx ] ──► [ pm2: theroute-api :3100 ] ──► [ web/dist 정적 + /api/* ]
         ▲
         │ Custom Tab (외부 브라우저) — Google이 WebView 로그인을 차단하므로
         └──  /api/auth/app-start → OAuth → /oauth/callback → theroute://auth/callback?code=
```

웹 번들은 **하나**다. 같은 번들이 폰 앱과 PC·모바일 브라우저에 함께 나가므로, 웹 코드는
`@capacitor/*`를 import하지 않고 앱 WebView에 주입되는 `window.Capacitor` 전역만 본다.
플러그인이 없으면 모든 네이티브 함수가 no-op/false/null을 돌려주고 호출부가 웹 동작으로 갈라진다.

## 4. 파일 구성

### 신규

```
mobile/                                   ← RN Expo 삭제 후 재구성
├── package.json                          @capacitor/{core,app,browser} + dev {android,cli,typescript}
├── capacitor.config.ts
├── app-shell/index.html                  연결 실패 시에만 뜨는 안내 (라이트 테마)
├── scripts/sync-local.sh                 NFS → ~/.node-local/theroute-mobile
├── scripts/build-apk.sh                  sync → cap sync → gradlew assembleDebug
└── android/                              `npx cap add android` 산출 + 아래 커스터마이즈
    ├── app/src/main/AndroidManifest.xml
    ├── app/src/main/java/com/miraclepenguin/theroute/MainActivity.java
    └── app/src/main/res/values/{styles.xml,theroute_colors.xml}

web/scripts/gen-app-icons.mjs             아이콘 생성기 (도안이 코드에 있는 단일 진실)
web/src/native/bridge.js                  window.Capacitor 접근 유일 경로
web/src/native/appLogin.js                딥링크 → 로그인 (React 비의존, 단위 테스트 가능)
web/src/native/backStack.js               뒤로가기 스택 (React 비의존, 단위 테스트 가능)
web/src/native/useBackHandler.js          모달이 열린 동안 뒤로가기로 닫히게 하는 훅
web/src/native/NativeAppHost.jsx          앱에서만 켜지는 전역 연결부
backend/src/services/appAuthCodes.js      60초·1회용 코드 저장소 + 쿠키 헬퍼
backend/src/routes/appOAuthCallback.js    앱 로그인 복귀 가로채기
```

### 수정

```
mobile/                                   (전체 교체 — RN Expo 삭제)
backend/src/routes/auth.js                app-start·app-exchange 추가 (공용 OAuth 라우터보다 앞)
backend/src/index.js                      appOAuthCallback 마운트 (static 뒤 · SPA 폴백 앞)
web/src/main.jsx                          <NativeAppHost/> 마운트, <html data-native> 표시
web/src/components/OAuthButtons.jsx       앱이면 Custom Tab으로 app-start, 아니면 기존 동작
web/src/components/modals/*.jsx           useBackHandler 연결 (뒤로가기로 닫기)
web/index.html                            파비콘 링크
.gitignore                                android 빌드 산출물·키스토어
```

### 건드리지 않을 것

- `project/shared/auth-oauth` 공용 패키지 (5개 프로젝트 공용) — TheRoute 전용 라우트로만 덧댄다.
- `backend/src/index.js`의 SPA 폴백 정규식 `/^\/(?!api|uploads|health).*$/`.
- 웹 로그인 흐름(`OAuthCallbackPage`, 이메일 로그인) — 앱 표시 쿠키가 없으면 한 글자도 바뀌지 않는다.

## 5. Capacitor 설정

`mobile/capacitor.config.ts`:

```ts
const config: CapacitorConfig = {
  appId: 'com.miraclepenguin.theroute',
  appName: '더 루트',
  webDir: 'app-shell',
  server: {
    url: 'https://climb.xn--lh0b87pnudm10a4vd.com',
    androidScheme: 'https',
    cleartext: false,
    errorPath: 'index.html',
  },
  android: {
    adjustMarginsForEdgeToEdge: 'auto',
  },
};
```

- `androidScheme: 'https'` + `cleartext: false` — 운영 서버가 정식 인증서를 쓴다. Secure 쿠키와
  보안 컨텍스트 전용 API가 브라우저와 똑같이 동작한다.
- `webDir: 'app-shell'`은 Capacitor가 요구하는 자리표시다. 그 안의 `index.html`을 `errorPath`로 지정해
  **운영 웹을 불러오지 못했을 때만** "연결할 수 없습니다" 안내로 쓴다. 이 페이지는 플러그인을 쓰지 않는다.

## 6. Android 네이티브 커스터마이즈

### AndroidManifest.xml

| 항목 | 값 | 이유 |
|---|---|---|
| `launchMode` | `singleTask` | 딥링크 복귀 시 앱 인스턴스가 새로 뜨지 않게 |
| intent-filter | `theroute://auth` (scheme `theroute`, host `auth`) | 로그인 딥링크 수신 |
| `allowBackup` | `false` | 토큰이 든 WebView 저장소가 백업에 실리지 않게 |
| `windowSoftInputMode` | `adjustResize` | API 34 이하 키보드 대응 |
| 권한 | `INTERNET` | 필수 |
| 권한 | `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` | `GymListPage`의 geolocation 암장 검색 |
| 권한 | `CAMERA` | 사진 모달들의 `<input type=file>` 촬영 경로 |

저장소 권한은 선언하지 않는다(다운로드 흐름 없음).

### MainActivity.java

1. **IME 인셋 리스너 (API 35+)** — Capacitor의 edge-to-edge margin은 키보드를 계산하지 않고,
   API 35에서는 `adjustResize`도 창을 줄이지 않는다. 하단 margin을 `max(시스템 바, IME)`로 준다.
   API 34 이하는 `adjustResize`가 처리하므로 이중 축소를 막기 위해 적용하지 않는다.
2. **geolocation 권한 프롬프트** — WebView는 `WebChromeClient.onGeolocationPermissionsShowPrompt`를
   구현하지 않으면 위치 요청이 **조용히 거부**된다. Capacitor 7 기본 `BridgeWebChromeClient`가 이를
   처리하는지 구현 단계에서 소스로 확인하고, 처리하지 않으면 여기서 보강한다(14절 "구현 중 확정" 항목).

### res/values

- `theroute_colors.xml`: 창 배경 `#FAFAFA` (웹 `--bg`와 동일)
- `styles.xml`: 창 배경색 지정 + **상태바·내비게이션바 아이콘을 어둡게**
  (`windowLightStatusBar`·`windowLightNavigationBar` = `true`).
  🔴 BJJ는 다크 테마(`#0C0D12`)라 반대 설정이었다 — TheRoute는 라이트다.
- 🔴 **Android XML 주석에 `--` 를 쓰지 않는다** — BJJ에서 주석 안 `--bg` 한 글자로 `mergeDebugResources`가 실패했다.

## 7. 앱 로그인 — 백엔드

Google은 WebView 안 OAuth를 차단한다(`disallowed_useragent`). 그래서 Custom Tab(외부 브라우저)으로
로그인하고, 서버가 앱 스킴으로 돌려보낸다. Custom Tab과 앱 WebView는 저장소를 공유하지 않으므로
토큰을 넘길 통로가 필요한데, 딥링크에 JWT(30일)를 그대로 실으면 기록·가로채기 한 번에 계정이 넘어간다.
→ 딥링크에는 **60초·1회용·256bit** 코드만 싣고, 앱 WebView가 코드를 JWT로 바꾼다.

### `services/appAuthCodes.js`

- 코드 형식 `/^[0-9a-f]{64}$/` (`crypto.randomBytes(32).toString('hex')`)
- 저장: 프로세스 메모리 `Map`. pm2 단일 프로세스(`theroute-api`)이고 코드 수명이 60초라,
  재시작으로 잃는 것은 "진행 중이던 로그인 1건"뿐이다 — DB 테이블을 만들 이유가 없다.
- `consume(code)`는 **맞든 틀리든 만료됐든 그 자리에서 지운다**(1회용).
- 상한 500건(발급 폭주 시 가장 오래된 것부터 버림), 만료 항목은 발급 때 sweep.
- 쿠키 이름 `route_app_login`, HttpOnly·Secure·SameSite=Lax·path `/`·10분.
  `SameSite=Lax`여야 OAuth 제공자에서 돌아오는 최상위 GET 네비게이션에 쿠키가 실린다.
- `cookie-parser`를 추가하지 않는다 — 쿠키가 이것 하나뿐이라 헤더에서 직접 읽는다.
- 🔴 코드·토큰 원문을 로그에 남기지 않는다.

### `GET /api/auth/app-start?provider=google|github[&fallback=1]`

`routes/auth.js`에 추가한다. 🔴 **`router.use('/', oauthRouter)`보다 앞**에 둔다 — 뒤에 두면
공용 라우터의 `GET /:provider`가 먼저 잡아 "Unknown OAuth provider" 404가 된다.

provider 화이트리스트(`['google','github']`) 검사 → 표시 쿠키 심기 → `302 /api/auth/<provider>`.
응답 형식은 프로젝트 규약 `{ success, data, message }`를 따른다(실패 시 400).

### `POST /api/auth/app-exchange { code } → { token }`

같은 파일, 같은 위치. `appAuthCodes.consume(code)` → `ok`면 토큰 반환, 형식 오류 400,
만료·미지의·재사용 401. `Cache-Control: no-store`.

### `routes/appOAuthCallback.js` — 복귀 가로채기

`backend/src/index.js`에서 `express.static(distDir)` **뒤**, SPA 폴백 **앞**에 등록한다.
현재 두 줄이 모두 `if (fs.existsSync(distDir))` 블록 안에 있으므로 그 사이에 넣는다.

```js
app.get(['/oauth/callback', '/login'], require('./routes/appOAuthCallback').createAppOAuthCallbackHandler());
```

`/login`도 받는 이유: 공용 라우터는 실패 시 `/oauth/callback`이 아니라 **`/login?error=…&msg=…`**로
302한다. 받지 않으면 사용자가 구글에서 "취소"했을 때 Custom Tab에 웹 로그인 화면이 떠 있고
앱으로는 영영 돌아가지 않는다.

동작:

1. GET이 아니거나 `/oauth/callback`도 `/login?error=`도 아니면 `next()`
2. 표시 쿠키가 없으면 `next()` — **일반 브라우저의 웹 로그인은 기존 `OAuthCallbackPage`가 그대로 처리**
3. 쿠키가 있으면 성공이든 실패든 **쿠키를 즉시 지운다**(남기면 10분 안에 같은 폰 브라우저에서 한
   웹 로그인까지 앱으로 끌려간다). `Cache-Control: no-store`, `Referrer-Policy: no-referrer`
4. 유효 JWT → 1회용 코드 발급 → `302 theroute://auth/callback?code=…`
   무효/없음/error → `302 theroute://auth/callback?error=…&msg=…`
5. **폴백**: 쿠키 값이 `fallback`이거나 요청에 `?fallback=1`이 있으면 302 대신 "앱으로 돌아가기"
   버튼 HTML을 준다(사용자 제스처라 Custom Tab이 스킴 이동을 허용한다). 기기가 302 스킴 이동을
   막는 경우 **웹 배포만으로** 전환할 수 있다 — APK 재빌드 불필요.

JWT 검증 비밀키는 `routes/auth.js`와 **동일한 표현**(`process.env.JWT_SECRET || 'theroute-dev-secret'`)을
쓴다. 폴백 일원화는 board의 별도 Todo이며 이번 작업에서 동작을 바꾸지 않는다.

## 8. 앱 로그인 — 웹

### `native/bridge.js`

`window.Capacitor` 전역만 본다. 내보내는 것: `isNativeApp()`, `openExternal(url)`,
`closeExternal()`, `authCodeFromDeepLink(url)`, `authErrorFromDeepLink(url)`,
`onAuthDeepLink(handler)`, `onBackButton(handler)`, `exitApp()`, 상수 `APP_ORIGIN`·`AUTH_DEEP_LINK_SCHEME`.

🔴 함정 두 가지를 그대로 이식한다:

- 커스텀 스킴은 WHATWG URL의 "특수 스킴"이 아니라서 `new URL('theroute://auth/callback')`은
  host=`auth`, pathname=`/callback`으로 파싱된다. `pathname.includes('auth/callback')`으로 찾으면
  영원히 못 찾는다(TheMeal 실기기에서 로그인이 통째로 죽은 원인) — host와 path를 따로 본다.
- `onAuthDeepLink`는 `appUrlOpen` 구독과 `getLaunchUrl()` 보정을 **둘 다** 한다. 콜드 스타트에서
  같은 주소가 두 번 올 수 있고, `getLaunchUrl()`은 WebView 새로고침 뒤에도 앱 시작 때의 옛 주소를
  계속 준다. 중복 처리는 호출부가 막는다.

### `native/appLogin.js`

의존성을 전부 주입받는 순수 모듈(React 비의존 → Node 단위 테스트가 실제 파일을 읽는다).
`createAppLoginHandler({ exchange, login, navigate, closeExternal, hasToken, storage })`가
`(url, meta) => 'ignored'|'duplicate'|'error-link'|'failed'|'silent'|'ok'`를 돌려준다.

중복 방지 2단: 한 페이지 안은 메모리 `Set`, 새로고침 뒤는 `sessionStorage`
(키 `theroute_app_login_handled`, 최근 5건). 옛 launch 코드가 교환에 실패했는데 **이미 로그인돼
있으면 조용히 넘긴다** — 멀쩡히 쓰는 사람에게 "로그인 코드 만료" 알림을 띄우지 않는다.
사용자가 방금 누른 로그인(`source === 'open'`)의 실패는 **항상 알린다**(조용한 실패 금지).

### 알림 방식 — BJJ와 다른 점

BJJ는 `UIContext.showToast`를 썼지만 TheRoute에는 범용 토스트가 없다(`VideoUploadToast`는 전용).
새 토스트 시스템을 만들지 않고 **기존 패턴을 그대로 쓴다**:
`navigate('/login?error=<메시지>', { replace: true })` → `LoginPage`가
`useSearchParams().get('error')`를 초기 상태로 읽어 이미 렌더한다(`LoginPage.jsx:13`, `:49`).

### 로그인 확정

`AuthContext.authLogin(token, userData)`는 BJJ와 달리 **사용자 정보를 스스로 가져오지 않는다.**
`OAuthCallbackPage`와 똑같은 순서를 쓴다:

```js
localStorage.setItem('theroute_token', token);  // axios 인터셉터가 요청 시점에 읽는다
const r = await getMe();
authLogin(token, r.data);
```

실패하면 토큰을 지우고 `/login?error=…`로 보낸다.

### `NativeAppHost.jsx`

`isNativeApp()`이 false면 **아무것도 등록하지 않고 아무것도 그리지 않는다**.
`BrowserRouter`·`AuthProvider` 안쪽에 마운트한다. 구독은 마운트 1회만 하고(중복 교환 방지 Set이
앱 수명 동안 유지돼야 한다) `navigate`·`authLogin`은 ref로 호출 시점 최신값을 부른다.

담당: ① 로그인 딥링크 ② 하드웨어 뒤로가기 ③ 키보드가 열려 WebView가 줄면 포커스된 입력칸을
`scrollIntoView({block:'center'})`로 가운데 정렬(브라우저 기본 스크롤은 칸이 겨우 보이는 데서 멈춘다).

### `OAuthButtons.jsx`

```js
onClick={async () => {
  const url = `/api/auth/app-start?provider=${btn.key}`;
  if (isNativeApp() && await openExternal(new URL(url, APP_ORIGIN).toString())) return;
  window.location.href = `/api/auth/${btn.key}`;   // 웹은 기존 동작 그대로
}}
```

Custom Tab 열기가 실패하면 기존 웹 이동으로 폴백한다.

## 9. 뒤로가기

`native/backStack.js` (React 비의존). 순서: ① 열린 모달이 있으면 **맨 위 하나만** 닫는다
→ ② 뒤로 갈 기록이 있으면 `history.back()` → ③ 없으면 앱 종료.

🔴 `history.length`는 뒤로 가도 줄지 않아 첫 화면에서도 1보다 크다 — 앱이 영원히 안 꺼진다.
App 플러그인이 `backButton` 이벤트에 실어 주는 `canGoBack`을 쓰고, 값이 없을 때만 `history.length`로 대신한다.

🔴 리스너를 하나라도 등록하면 Capacitor의 기본 동작(WebView goBack)이 꺼진다 — 등록한 쪽이
모달 닫기·뒤로·종료를 전부 책임진다.

`useBackHandler(active, onBack)` 훅을 `web/src/components/modals/` 아래 모달들에 붙인다.
핸들러는 ref로 최신값만 부르고 스택 등록은 `active`가 바뀔 때만 한다 — `onClose`가 매 렌더 새
인라인 함수여도 재등록하지 않으므로 겹친 모달의 위·아래 순서가 뒤바뀌지 않는다.
웹 브라우저에서는 스택에 올라가기만 하고 아무도 부르지 않는다(동작 변화 없음).

## 10. safe-area / 키보드

TheRoute 웹에는 safe-area CSS가 **하나도 없는데** `BottomNav`가 화면 하단에 붙어 있다
(`--bottomnav-h: 64px`). Android 15(targetSdk 35)는 edge-to-edge를 강제해 WebView가 시스템 바
밑까지 그려지고, **이 WebView에서 CSS `env(safe-area-inset-*)`는 0을 반환한다** — 웹 CSS만으로는
하단 탭과 내비게이션 버튼의 겹침을 막을 수 없다(BJJ 2026-09-14 실기기 확인).

해법:

1. `capacitor.config.ts`의 `android.adjustMarginsForEdgeToEdge: 'auto'` — API 35+에서 WebView에
   시스템 바·컷아웃 크기만큼 **네이티브 margin**을 준다. 웹이 바를 아예 피한다.
2. 바 뒤에 보이는 배경은 `styles.xml`의 창 배경색(`#FAFAFA`)이 채운다.
3. **웹 CSS는 선제적으로 건드리지 않는다.** 네이티브 margin이 상·하단을 모두 처리하므로
   `env(safe-area-inset-*)`(앱에서 항상 0)를 참조하는 토큰은 죽은 코드가 된다. 실기기에서 상단·하단
   여백 문제가 실제로 보이면 그때 `--native-top: env(safe-area-inset-top, 0px)`을 추가한다 —
   **웹 배포만으로 고칠 수 있고 APK 재설치가 필요 없다.**
   🔴 어떤 경우에도 고정 px 바닥값(예: 24px)을 주지 않는다 — 네이티브 margin과 이중 여백이 된다.
4. 키보드는 6절 `MainActivity` 인셋 리스너 + `NativeAppHost`의 가운데 정렬로 처리한다.

## 11. 아이콘

`web/scripts/gen-app-icons.mjs` — 도안을 **파일 상단 상수로** 두는 단일 진실. 산출된 PNG/XML은
손으로 고치지 않는다.

- 모티브: 클라이밍 홀드 3점 + 이를 잇는 루트 라인. 배경 브랜드 `#ff5a3c`, 전경 흰색.
- 산출: Android 적응형 3레이어(`background`·`foreground`·`monochrome`) + 밀도별 `mipmap-*` PNG
  + 웹 파비콘. `--android <res경로>` 옵션으로 Android만, 옵션 없이 실행하면 웹만.
  웹 파비콘은 `web/public/`에 넣는다 — 이 디렉터리는 현재 없으므로 생성기가 만든다(Vite가 `public/`을
  루트로 복사한다).
- 🔴 전경 벡터 이름은 `ic_theroute_foreground`·`ic_theroute_monochrome`으로 분리한다 —
  Capacitor 템플릿의 `drawable-v24/ic_launcher_foreground.xml`이 같은 이름을 덮는다.
- 생성기는 `sharp`를 필요로 한다. BJJ는 TheMeal의 ext4 설치본을 빌려 쓰는데 그쪽 정리 시 같이
  깨진다 — TheRoute는 미러(`~/.node-local/theroute-mobile`)에 자체 설치한다.

## 12. 빌드 절차

🔴 NFS(`project/`)는 `noexec`이라 npm·Capacitor CLI·gradle을 NFS 위에서 돌릴 수 없다.
소스는 항상 NFS에서 편집하고, 실행은 ext4 미러 `~/.node-local/theroute-mobile/`에서만 한다.

```bash
bash /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/scripts/build-apk.sh
```

`sync-local.sh` → (`node_modules` 없으면 `npm ci`) → `npx cap sync android` → `gradlew assembleDebug`.

- `sync-local.sh`는 `android/`를 `--delete`로 보내되 `build/`·`.gradle/`·`local.properties`·`.idea/`를
  `--filter 'P'`로 보호한다. 반대 방향(미러 → NFS)은 하지 않는다 — `npx cap add android` 같은
  작업 뒤에는 필요한 파일만 손으로 NFS에 되돌린다.
- `JAVA_HOME`은 JDK 21을 명시한다(`@capacitor/android` 7이 Java 21을 요구).
- 🔴 **gradle 출력을 `| head` 등 파이프로 자르지 않는다** — SIGPIPE로 빌드가 중간에 죽는다
  (TheMeal에서 실제로 겪음). 로그 파일로만 보내고 종료 코드와 로그 끝부분으로 판단한다.
- 산출: `~/.node-local/theroute-mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
  전달은 scratchpad로 복사 후 `SendUserFile`.

### 서명 키

디버그 키 `~/.android/debug.keystore`를 쓴다. 🔴 이 키를 잃거나 다른 키로 빌드하면 **덮어쓰기
설치가 거부**된다 → 앱 삭제 후 재설치(로그인 초기화). 키는 git에 넣지 않는다(`*.keystore`·`*.jks` gitignore).

### 업데이트 규칙

| 바뀐 것 | 할 일 | 재설치 |
|---|---|---|
| 화면·기능(`web/src`·`web/index.html`)·백엔드 | 웹 빌드 배포 / `pm2 restart theroute-api` | **불필요** — 앱을 완전히 껐다 켜면 반영 |
| 아이콘·권한·플러그인·`capacitor.config.ts`·`styles.xml`·`MainActivity`·`AndroidManifest` | `build-apk.sh` → 검사 → APK 전달 | **필요** |

🔴 네이티브 변경은 **착수 전에 사용자에게 "재설치 필요"를 먼저 알린다.**

## 13. 검증

### 정적 (빌드 직후, 자동)

```bash
BT=~/.node-local/android-sdk/build-tools/35.0.0
APK=~/.node-local/theroute-mobile/android/app/build/outputs/apk/debug/app-debug.apk
$BT/aapt2 dump badging "$APK"                                               # package·label 더 루트·icon·권한 3종
$BT/aapt2 dump xmltree --file AndroidManifest.xml "$APK"                    # singleTask(launchMode=2)·theroute/auth·allowBackup=false
$BT/aapt2 dump xmltree --file res/mipmap-anydpi-v26/ic_launcher.xml "$APK"  # background·foreground·monochrome 3레이어
$BT/apksigner verify --print-certs "$APK"                                   # Verifies · CN=Android Debug
unzip -p "$APK" assets/capacitor.config.json                                # server.url 퓨니코드·https·adjustMarginsForEdgeToEdge
```

### 단위 테스트 (Node, React 비의존 모듈)

`native/appLogin.js`·`native/backStack.js`·`services/appAuthCodes.js`는 순수 모듈이므로 실제 파일을
읽어 테스트한다. 최소 케이스:

- `appAuthCodes`: 발급→교환 성공 / 재사용 401 / 만료 401 / 형식 오류 400 / 상한 초과 시 오래된 것 폐기
- `appLogin`: 정상 로그인 / 중복 코드 무시 / launch 출처 실패인데 이미 로그인 → `silent` /
  open 출처 실패 → 알림 / 오류 딥링크 → 취소 문구
- `backStack`: 모달 있으면 맨 위 하나만 / `canGoBack=true`면 back / `canGoBack=false`면 exit /
  `canGoBack` 없으면 `history.length` 대체

### 백엔드 회귀 (웹 로그인 불변 확인)

표시 쿠키 **없이** `/oauth/callback?token=…`을 부르면 핸들러가 `next()`로 흘려 SPA `index.html`이
그대로 나오는지 — 웹 로그인이 변하지 않았다는 증거.

### 실기기 (사용자 폰, 유일한 판정 수단)

headless로는 시스템 바·키보드가 재현되지 않는다.

1. 하단 탭이 내비게이션 버튼과 겹치지 않는가
2. 입력칸을 탭했을 때 키보드가 칸을 가리지 않는가
3. Google 로그인이 Custom Tab으로 열리고 앱으로 돌아와 로그인되는가 (GitHub도)
4. 암장 목록에서 위치 권한 프롬프트가 뜨고 내 위치 검색이 되는가
5. 사진 업로드에서 카메라·갤러리 선택이 되는가
6. 뒤로가기: 모달 닫기 → 화면 뒤로 → 첫 화면에서 앱 종료
7. 영상 업로드(ffmpeg 압축)가 동작하는가

### 팀 워크플로

Designer(아이콘 도안·app-shell) → Developer(구현) → Reviewer(인증 분기·보안 독립 감사)
→ QA(체크리스트 실행) → Leader(최종 보고). QA가 결함을 찾으면 Developer 수정 후 **Reviewer부터** 재순환.

## 14. 리스크와 보류

| 항목 | 성격 | 처리 |
|---|---|---|
| 실기기 없이는 edge-to-edge·키보드 판정 불가 | 검증 한계 | 빌드·정적 검사까지 수행 후 사용자 실기 확인 요청 |
| WebView geolocation 권한 프롬프트 | 구현 중 확정 | Capacitor 7 `BridgeWebChromeClient` 소스 확인 → 미처리면 `MainActivity`에서 보강 |
| 커스텀 스킴 PKCE 미결속 | 보안(MEDIUM) | **보류**. 다른 앱이 `theroute://auth`를 등록하면 60초·1회용 코드를 가로챌 이론적 여지. 단일 사용자 범위라 BJJ와 동일하게 보류하고, 다중 사용자로 넓히면 app-start challenge / app-exchange verifier 결속을 추가한다 |
| 10분 쿠키 잔존 | UX 엣지케이스 | 앱 로그인을 시작만 하고 10분 안에 같은 폰 크롬에서 웹 로그인하면 그 1회가 앱 스킴으로 넘어간다. 콜백에서 즉시 삭제하므로 1회로 끝난다 |
| `project_climb` 자동배포 미작동 | 기존 이슈 | board Backlog 항목. pm2가 작업 디렉터리를 직접 실행하므로 현재는 무해 — 이번 작업 범위 밖 |

## 15. 완료 정의

1. `mobile/`에서 `build-apk.sh`가 성공하고 APK가 나온다
2. 13절 정적 검사 5종이 모두 기대값과 일치한다
3. 단위 테스트가 통과한다
4. 표시 쿠키 없는 웹 로그인이 변하지 않았음이 확인된다
5. APK가 사용자에게 전달되고, 실기기 체크리스트 7항목 결과가 회신된다

---
task_id: T009
title: 안드로이드 APK 앱 구현 (Capacitor 7 원격 URL 셸)
slug: android-apk
project: TheRoute
status: doing
roles_involved: leader, designer, developer, reviewer, qa
created: 2026-09-18
updated: 2026-09-18
aliases: ["APK", "안드로이드 앱", "Capacitor 셸"]
tags:
  - type/task
  - domain/mobile
  - domain/auth
  - domain/infra
---

# T009 · 안드로이드 APK 앱 구현 (Capacitor 7 원격 URL 셸)

## 배경 / 요청

사용자 지시 (2026-09-18):
> "지금 프로젝트에 대하여 '주짓수일상' 프로젝트에서 작업했던 apk 앱 구현 작업을 진행하려고해.
> 필요한 사항 체크해서 작업 진행해줘"

`bjj-trainning`의 task-039에서 완성한 **Capacitor 7 원격 URL 셸** 방식을 TheRoute에 이식한다.
앱은 껍데기이고 WebView가 운영 도메인(`climb.미라클펭귄.com`)을 직접 로드하므로, 화면·기능 수정은
웹 배포만으로 반영되고 APK 재설치는 네이티브 설정을 바꿀 때만 필요하다.

**설계 문서(단일 진실)**: [`docs/superpowers/specs/2026-09-18-android-apk-design.md`](../../../docs/superpowers/specs/2026-09-18-android-apk-design.md)
**구현 계획(11개 태스크)**: [`docs/superpowers/plans/2026-09-18-android-apk.md`](../../../docs/superpowers/plans/2026-09-18-android-apk.md)

## 사용자 승인 결정 (2026-09-18)

| 질문 | 결정 |
|---|---|
| 1차 범위 | **BJJ 전체 패리티** — 셸 + 아이콘 + edge-to-edge + 뒤로가기 + 앱 OAuth 로그인 + 권한 |
| 기존 `mobile/` (RN Expo) | **삭제**하고 `mobile/`을 Capacitor 셸로 교체 (git 이력에는 남음) |
| 아이콘 | BJJ와 동일한 **벡터 생성기 스크립트** 방식 (`web/scripts/gen-app-icons.mjs`) |

## 사전 조사 결과 (leader 역할 겸임, 2026-09-18)

### 참고 구현 — bjj-trainning task-039

런북 [`android-apk-build.md`](../../../../bjj-trainning/agent-vault/30-Knowledge/runbooks/android-apk-build.md)와
실제 소스를 모두 읽었다. 이식 대상 파일:

- `mobile/{capacitor.config.ts,package.json,app-shell/index.html,scripts/*.sh}`
- `web/src/native/{bridge.js,appLogin.js,backStack.js,useBackHandler.js,NativeAppHost.jsx}`
- `backend/src/services/appAuthCodes.js`, `backend/src/routes/appOAuthCallback.js`,
  `backend/src/routes/auth.js`의 `app-start`·`app-exchange`

### 전제조건 — 전부 충족 (실측)

- `https://climb.xn--lh0b87pnudm10a4vd.com/` → 200, 인증서 검증 통과. nginx vhost 활성.
- JDK 21 · Android SDK(android-35, build-tools 34/35) · `~/.android/debug.keystore` 존재.
- 백엔드가 BJJ와 **같은 공용 패키지** `@workspace/auth-oauth`를 쓴다 → 앱 로그인 구조 그대로 이식 가능.

### TheRoute 고유 차이 — BJJ 코드를 그대로 복사하면 안 되는 지점

1. **다운로드 흐름 없음** → `@capacitor/file-transfer`·`filesystem`·`utils/download.js` **이식하지 않음**.
   `@capacitor/status-bar`도 BJJ에서 실제 호출되지 않아 제외. 플러그인은 `core`·`app`·`browser` 3개.
2. **범용 토스트 없음** (`VideoUploadToast`는 전용) → BJJ의 `UIContext.showToast` 대신
   `navigate('/login?error=…')`를 쓴다. `LoginPage.jsx:13`이 `searchParams.get('error')`를 초기
   상태로 읽어 `:49`에서 이미 렌더한다 — **새 토스트 시스템을 만들 필요가 없다.**
3. **`authLogin(token, userData)`가 사용자 정보를 스스로 가져오지 않는다** (BJJ는 가져옴).
   `OAuthCallbackPage.jsx`와 똑같이 `localStorage.setItem` → `getMe()` → `authLogin(token, r.data)` 순서.
4. **라이트 테마** (`--bg: #fafafa`, `--primary: #ff5a3c`) → `styles.xml`에서 상태바 아이콘을
   **어둡게** 설정. BJJ(다크 `#0C0D12`)와 반대.
5. **safe-area CSS가 전무한데 `BottomNav`가 하단 고정** → Android 15 edge-to-edge 겹침이 그대로
   재현될 조건. `adjustMarginsForEdgeToEdge: 'auto'`가 1차 방어.
6. **위치·카메라 사용** (`GymListPage` geolocation, 사진 모달 `<input type=file>`) → BJJ에 없던
   권한 2종 추가. WebView geolocation 프롬프트는 Capacitor 기본 처리 여부를 구현 중 확인.
7. **백엔드 마운트 위치가 다름** — TheRoute의 static·SPA 폴백은 `if (fs.existsSync(distDir))` 블록
   **안**에 있다(`backend/src/index.js:50-57`). 콜백 핸들러를 그 사이에 넣어야 한다.
   SPA 폴백 정규식 `/^\/(?!api|uploads|health).*$/`는 건드리지 않는다.
8. **`ok`/`fail` 헬퍼 없음** → 프로젝트 규약 `{ success, data, message }`를 직접 구성.
9. **ffmpeg는 단일스레드 코어** (`@ffmpeg/core`, `core-mt` 아님) → SharedArrayBuffer·COOP/COEP 불필요.
   nginx 변경 없음.

### 확정된 네이티브 식별자

| 항목 | 값 |
|---|---|
| `appId` | `com.miraclepenguin.theroute` |
| `appName` | `더 루트` |
| 딥링크 | `theroute://auth/callback` |
| 표시 쿠키 | `route_app_login` |
| sessionStorage 키 | `theroute_app_login_handled` |
| 미러 경로 | `~/.node-local/theroute-mobile` |

## 대상 파일

**신규**: `mobile/` 전체, `web/scripts/gen-app-icons.mjs`, `web/src/native/*`,
`backend/src/services/appAuthCodes.js`, `backend/src/routes/appOAuthCallback.js`

**수정**: `backend/src/routes/auth.js`(공용 라우터보다 **앞**), `backend/src/index.js`,
`web/src/main.jsx`, `web/src/components/OAuthButtons.jsx`, `web/src/components/modals/*.jsx`,
`web/index.html`, `.gitignore`

**건드리지 말 것**: `project/shared/auth-oauth` 공용 패키지(5개 프로젝트 공용),
`backend/src/index.js`의 SPA 폴백 정규식, 웹 로그인 흐름(`OAuthCallbackPage`·이메일 로그인)

## 역할별 기록

### leader

- 2026-09-18: brainstorming 스킬로 설계 확정 → 스펙 문서 작성 후 커밋.
- 2026-09-18: writing-plans 스킬로 11개 태스크 구현 계획 작성. 자기검토에서 생성기 경로·`web/dist` 커밋 대상 여부 등 불일치 3건을 찾아 스펙·계획 양쪽을 정렬.

### designer

(미착수)

### developer

(미착수)

### reviewer

(미착수)

### qa

(미착수)

## 관련 이력

- [[T004-auth-flow]] · 웹 인증 플로우(이메일/비밀번호 + OAuth) — 이 작업이 확장하는 기반
- [[T005-remove-kakao-login]] · 카카오 로그인 제거 — provider가 google·github 2종인 이유
- [[board]] · 칸반

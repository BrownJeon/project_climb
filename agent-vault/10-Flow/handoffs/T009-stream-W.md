---
tags: [type/handoff, domain/mobile, domain/auth]
task: "[[T009-android-apk]]"
stream: W
role: developer
date: 2026-10-30
status: DONE
---

# T009 스트림 W — 웹 순수 모듈 (Task 7·8·9 + Task 10 화면 밖 + PKCE)

작업 위치: `/home/brownjeon/.node-local/theroute-app` (worktree, 브랜치 `mobile-app-t009`). **커밋하지 않았다**(개정 §4).
정본 계약: `docs/superpowers/plans/2026-10-30-android-apk-addendum.md` §3 (09-18 계획보다 우선).

## 1. 변경 파일

| 파일 | 신규/수정 | 무엇을 |
|---|---|---|
| `web/src/native/bridge.js` | 신규 | `window.Capacitor` 전역만 보는 브리지(Task 7). `openExternal` 은 https·사용자정보 없는 주소만, 딥링크 길이 2048 상한(StockInvest 이식) |
| `web/src/native/appLogin.js` | 신규 | PKCE(S256) 생성·보관·꺼내기 + `startAppLogin(provider)` + 딥링크→로그인 처리기(Task 8 + 개정 §3) |
| `web/src/native/backStack.js` | 신규 | 뒤로가기 스택·`handleNativeBack`(Task 9, 계획 그대로) |
| `web/src/native/useBackHandler.js` | 신규 | 모달용 훅(Task 9, 계획 그대로 + 동시 마운트 순서 주석) |
| `web/src/native/NativeAppHost.jsx` | 신규 | 앱 전역 연결부(Task 10 Step 2) — verifier 보관소(localStorage) 주입 |
| `web/src/api/auth.js` | 수정(추가만) | `appExchange(code, verifier)` → `r.data.token`, 15초 제한 |
| `web/src/main.jsx` | 수정 | `<NativeAppHost />` 를 `<AuthProvider>` 안·`<Routes>` 앞에 마운트, 앱이면 `<html data-native="app">` |
| `web/test/bridge.test.js` | 신규 | 14건 |
| `web/test/appLogin.test.js` | 신규 | 30건 (RFC 7636 벡터 포함) |
| `web/test/backStack.test.js` | 신규 | 10건 |

화면 파일(`web/src/{pages,components,styles}/**`)은 **읽기만** 했다 — 데모 게이트.

## 2. 구현 요약 — PKCE 흐름 (개정 §3-2 대응)

1. `startAppLogin(provider)` — 앱 아님·provider 가 `google|github` 아님·Web Crypto 없음 → `false`(호출부가 웹 이동으로 폴백).
   통과하면 `createPkcePair()`(32바이트 `crypto.getRandomValues` → base64url 43자, challenge=`base64url(SHA-256(verifier))`) →
   `localStorage['theroute_app_pkce'] = {verifier, provider, createdAt}` → Custom Tab 으로
   `https://climb.xn--lh0b87pnudm10a4vd.com/api/auth/app-start?provider=…&challenge=…` 를 연다. 열기 실패면 보관값을 지우고 `false`.
2. 딥링크 처리기(`createAppLoginHandler`) — 중복 검사(메모리 Set + sessionStorage) 통과 후 Custom Tab 닫기 →
   **교환 전에** `takePendingVerifier()` 가 꺼내면서 지운다(성공·실패 무관 삭제 = §3-2). TTL 10분·미래 시각·형식 불일치는 null.
   verifier 가 없으면 교환하지 않고 "로그인 대기 시간이 지났습니다…" 안내(옛 launch 코드 + 이미 로그인이면 silent).
3. `appExchange(code, verifier)` — `POST /auth/app-exchange {code, verifier}` → `r.data.token`(인터셉터가 한 겹 벗김, `r.data.data` 아님).

## 3. 계획과 다르게 한 것과 이유

| # | 09-18 계획 | 이번 구현 | 이유 |
|---|---|---|---|
| 1 | bridge.js 주석 `pathname 은 **/callback** 으로` | 백틱으로 바꿈 | 🔴 `**/` 가 블록 주석을 닫아 **SyntaxError** — 계획서 원문을 그대로 복사하면 모듈이 로드되지 않는다(시험이 실제로 잡았다) |
| 2 | `exchange(code)` | `exchange(code, verifier)`, 처리기에 `pkceStorage`·`now` 주입 | 개정 §3 PKCE |
| 3 | OAuthButtons 가 `openExternal(app-start)` 직접 호출 | `startAppLogin(provider)` 를 부른다(W2 지침 §5) | verifier 생성·보관을 순수 모듈 안에 두어 시험 가능하게 |
| 4 | `openExternal` 은 주소 검사 없음 | https·userinfo 없는 주소만, 상대 경로는 `APP_ORIGIN` 기준 | StockInvest `bridge.ts` 이식 — Custom Tab 에 임의 스킴을 넘기지 않게 |
| 5 | (없음) | verifier 메모리 사본 | localStorage 가 막힌 WebView 에서도 같은 프로세스 안에서는 로그인이 된다. 꺼낼 때 둘 다 지운다 |
| 6 | `appExchange` 제한 시간 없음 | 15초(axios `timeout`) + 서버 응답이 아닌 실패는 한국어 문구 | 응답 없이 멈추면 아무 안내가 없는 조용한 실패. 인터셉터 대체 객체(`{success,message}`)에는 `data` 키가 없어 서버 응답(`data:null`)과 구분 |
| 7 | (없음) | `APP_START_FALLBACK` 상수(기본 false) | 스펙 §7 "기기가 302 스킴 이동을 막으면 웹 배포만으로 폴백 전환" 의 웹 쪽 스위치 |
| 8 | `web/package.json` 에 `"test": "node --test test/"` | **안 했다** | 담당 파일 밖(Leader 지정 목록에 없음). 그리고 이 서버 Node 는 **v24.22.2** 라 `node --test test/`(디렉터리)는 "Cannot find module" 로 실패한다 — 스크립트를 넣는다면 `node --test 'test/*.test.js'` 로 넣어야 한다(Leader 결정) |
| 9 | `<html data-native>` 값 미정 | `data-native="app"` | 스펙 §4 표에만 있고 값·사용처 없음. `[data-native]` 선택자로 쓰면 된다. 현재 읽는 CSS 없음 |
| 10 | 오류 딥링크 때 verifier 처리 미정 | 지우지 않는다 | 계약상 삭제 시점은 "교환 시도". 남은 값은 다음 시작이 덮거나 TTL 로 무효 |

## 4. 실제 실행한 검증

- `nice -n 10 node --test 'web/test/*.test.js'` (worktree 루트, **Node v24.22.2** — 이 서버에 Node 20 없음): **54/54 통과, 실패 0** (22:3x KST).
  - 지시서의 `node --test web/test/` 는 Node 24 에서 디렉터리를 glob 으로 보지 않아 실패한다 → glob 으로 실행.
- 구문 검사: 기존 미러 `~/.node-local/theroute-web-work/node_modules/.bin/esbuild` 로 파일 단위 **변환만**(번들·출력 없음) — `main.jsx`·`NativeAppHost.jsx`·`useBackHandler.js`·`appLogin.js`·`bridge.js`·`backStack.js`·`api/auth.js` 7개 OK.
- 스트림 B 계약 대조(읽기만): `backend/src/routes/appAuth.js` 의 성공 `{success:true,data:{token},message:''}`·실패 `{success:false,data:null,message}`·app-start 쿼리 `provider`·`challenge`·`fallback=1` — 웹 쪽과 일치.

## 5. 못 한 것

- `vite build`(지시대로 하지 않음 — Leader 에게 요청). import 해석(`../contexts/AuthContext` 등 확장자 없는 Vite 경로)은 빌드에서만 확인된다.
- `NativeAppHost.jsx`·`useBackHandler.js`·`appExchange` 는 React·axios 가 필요해 **단위 시험 없음**(node_modules 없음). 실기기·빌드에서 확인 필요.
- 실기기 로그인 왕복(Custom Tab → 딥링크 → 교환) — APK 이후.
- RFC 벡터는 웹 쪽만 확인. 서버 쪽 벡터 시험은 스트림 B 몫.

## 6. Reviewer 가 중점적으로 볼 곳

1. `appLogin.js` `createAppLoginHandler` — **verifier 소모 순서**: 중복 검사 → 닫기 → `takePendingVerifier`(교환 전 삭제) → `exchange`. 중복(duplicate)·무관(ignored)·오류 딥링크는 verifier 를 건드리지 않는다.
2. `takePendingVerifier` — TTL 경계(`now - createdAt > 10분` 이면 무효, `now < createdAt` 무효), 깨진 JSON·형식 불일치 시 삭제.
3. 🟡 알려진 잔여 위험 [가능성 높음]: sessionStorage 중복 기록이 사라진 상태(예: 앱 프로세스 재시작)에서 **옛 launch 코드**가 다시 오고, 그 사이 사용자가 **새 로그인을 시작해 verifier 를 보관해 둔** 경우 → 옛 코드가 새 verifier 를 소모하고 401 → 진짜 새 딥링크는 "대기 시간 지남" 안내. 사용자는 다시 누르면 된다. 서버가 challenge 불일치를 401 로 막으므로 **보안 문제는 아니다**(가용성만).
4. `api/auth.js` `appExchange` 의 서버/비서버 오류 구분(`'data' in e`) — 인터셉터(`client.js`)가 `err.response?.data || {success:false, message}` 를 reject 하는 구조에 기댄다.
5. `bridge.js` `openExternal` 의 https 검사, `onAuthDeepLink` 해제가 등록 완료보다 먼저 와도 지우는지(`trackListener`).
6. 비밀: verifier·code·token 을 로그에 남기는 줄이 없는지(`console.warn` 은 오류 이름·메시지만).

## 7. W2 배선 지침 (데모 승인 + Leader `activate` 뒤에만 적용)

### 7-1. `web/src/components/OAuthButtons.jsx`

파일 맨 위(첫 줄)에 import 한 줄:

```js
import { startAppLogin } from '../native/appLogin.js';
```

현재 `onClick={() => { window.location.href = `/api/auth/${btn.key}`; }}` (**27행** — Reviewer L4 정정, 처음 기록의 "39행 부근"은 틀림) 를 아래로 바꾼다:

```jsx
          onClick={async () => {
            // Google 은 WebView 안 OAuth 를 막는다(disallowed_useragent). 앱에서는 PKCE verifier 를 만들어 보관하고
            // Custom Tab 으로 app-start 를 연다 — 서버가 로그인 끝에 theroute:// 딥링크로 앱에 돌려보낸다.
            // 웹 브라우저이거나 Custom Tab 을 못 열면(false) 아래 기존 웹 이동 그대로.
            if (await startAppLogin(btn.key)) return;
            window.location.href = `/api/auth/${btn.key}`;
          }}
```

- `startAppLogin` 은 앱이 아니면 즉시 `false` 이므로 **웹 동작은 바뀌지 않는다**(비동기 한 틱 뒤 같은 이동).
- `btn.key` 는 `'google' | 'github'` — `APP_LOGIN_PROVIDERS` 와 같다. 버튼을 추가하면 `appLogin.js` 의 목록과 서버 화이트리스트도 같이 바꿔야 한다.
- 이중 탭 방지·로딩 표시가 필요한지는 **designer 판단**(데모에 따라). 지금 지침은 의미 변화 없음.

### 7-2. 모달 12개 — `useBackHandler`

12개 모두 **부모가 조건부로 렌더**한다(마운트 = 열림, 열림 prop 없음 — 호출부 grep 으로 확인). 그래서 `active` 는 항상 `true`, 닫기 함수는 모두 `onClose` prop 이다.
각 파일에 ① 기존 import 묶음 끝에 `import useBackHandler from '../../native/useBackHandler';` ② 컴포넌트 함수 본문 **첫 줄**(다른 훅보다 먼저)에 `useBackHandler(true, onClose);`.

| # | 파일 | 시그니처(행) | 넣을 호출 | 열림 상태(부모 쪽, 읽기용) |
|---|---|---|---|---|
| 1 | `GoalAddModal.jsx` | `({ goal, onClose, onSaved, onDeleted })` (36) | `useBackHandler(true, onClose);` | `TrainingPage` `goalAddOpen` / `editGoal` |
| 2 | `GymAddModal.jsx` | `({ gym, onClose, onSaved })` (6) | 〃 | `GymListPage` `addOpen`·`editTarget`, `GymDetailPage` `editOpen` |
| 3 | `PassAddModal.jsx` | `({ onClose, onSaved })` (26) | 〃 | `MyPage` `passAddOpen` |
| 4 | `PassEditModal.jsx` | `({ pass, onClose, onSaved })` (7) | 〃 | `MyPage` `passEditTarget` |
| 5 | `ProblemAddModal.jsx` | `({ gymId, onClose, onSaved })` (8) | 〃 | ⚠ **호출부 없음**(현재 어디서도 렌더하지 않음). 넣어도 무해 — 12개 일관성을 위해 넣는다 |
| 6 | `ProblemPhotoModal.jsx` | `({ logId, cpId, photo, onSaved, onDeleted, onClose })` (31) | 〃 | `RecordEditModal` 안 `photoTarget` — **중첩**(아래 주의) |
| 7 | `ProfileEditModal.jsx` | `({ user, onClose, onSaved })` (12) | 〃 | `MyPage` `editOpen` |
| 8 | `RecordEditModal.jsx` | `({ kind, logId, initial, onSubmit, onClose, onChanged })` (92) | 〃 | `CalendarPage`·`CalendarDetailPage` `editLog`, `LogDetailPage` `editOpen`, `TrainingPage` `editTarget` |
| 9 | `RouteEditModal.jsx` | `({ route, onClose, onSaved })` (11) | 〃 | `RouteDetailPage` `editOpen` |
| 10 | `SessionAddModal.jsx` | `({ mode = 'full', initialPrefill = {}, onClose, onSaved })` (22) | 〃 | `SessionAddModalContext` `state.visible`, `onClose={close}` |
| 11 | `VideoLinkPicker.jsx` | `({ defaultColor, defaultLevel, onPick, onClose })` (11) | 〃 | `SessionAddModal` 안 `pickerForRow` — **중첩** |
| 12 | `VideoUploadModal.jsx` | `({ onClose, onSaved })` (12) | 〃 | `MyPage` `videoUploadOpen` |

확인 명령: `grep -l "useBackHandler(true, onClose)" web/src/components/modals/*.jsx | wc -l` → `12`.

주의:
- **중첩 2쌍**(RecordEditModal→ProblemPhotoModal, SessionAddModal→VideoLinkPicker): 자식이 나중에 열리므로 스택 맨 위가 자식 → 뒤로가기 한 번에 자식만 닫힌다(의도대로). 부모·자식이 같은 렌더에서 동시에 마운트되는 경로가 새로 생기면 순서가 뒤집힌다(`useBackHandler.js` 주석).
- **모달 12개 밖 오버레이**: `pages/TrainingPage.jsx` 의 내부 컴포넌트 `AnalysisDetailModal({ data, loading, onClose })`(694행, `position:fixed` 전체 덮개)는 `components/modals/` 밖이라 09-18 계획 목록에 없다. 붙이지 않으면 앱에서 뒤로가기 시 모달이 아니라 **페이지가 뒤로 간다**. 같은 방식(`useBackHandler(true, onClose)`, import 경로는 `'../native/useBackHandler'`)으로 붙일지 Leader·designer 결정 필요. `pages/**` 도 데모 게이트 대상이다.
- `SessionAddModal.jsx` 에 다른 세션의 미커밋 변경이 있었다는 09-18 경고는 이 worktree 에서는 해당 없음(`git status` 에 수정 없음, 22:35 확인).
- 저장 중(`saving`) 뒤로가기는 `onClose` 를 그대로 부른다 — 취소 버튼·배경 클릭과 같은 동작이라 새 위험은 아니다.

---

## 8. 라운드 2 (22:40~22:55) — Reviewer-W FAIL 수정 + 승인 문구 정렬 + W2 적용

근거: [[T009-reviewer-W]] (H1·H2·M1·L2·L4), 사용자 데모 v1 승인(22:43, D4 "그대로"), Leader 후속 지시.
데모 게이트: `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/T009-android-apk.md` → 첫 두 줄 `DEMO_GATE_PASSED` / `task: T009` (status approved, approved_version v1).

### 8-1. Reviewer 지적 수정

| # | 무엇을 | 어디를 |
|---|---|---|
| H1 | `/login` 라우트 요소를 감싸는 `LoginRouteKey` 신설. `?error=` 가 있으면 key=`e:<오류값>:<location.key>`, 없으면 고정 `'login'` → 앱이 `/login?error=…` 로 replace 이동할 때마다 LoginPage 를 새로 만든다. `LoginPage.jsx`·`SignupPage.jsx` 무수정 | `web/src/native/LoginRouteKey.jsx`(신규), `main.jsx` 의 `/login` 라우트 한 줄 |
| H2 | 오류 딥링크 중복 제거 분리 — 코드 딥링크는 출처 무관 1회, 오류 딥링크는 **open 이면 매번 처리**(같은 취소 반복 → 매번 알림·매번 Custom Tab 닫기), launch 출처만 sessionStorage 로 거른다. 콜드 스타트 이중 전달은 양 순서 모두 1회(open 이 먼저면 지문 기록으로 뒤 launch 를 거르고, launch 가 먼저면 페이지 메모리 `launchEchoes` 로 바로 뒤 open 한 번만 거른다) | `appLogin.js` `createAppLoginHandler` 의 `admit()` |
| M1 | sessionStorage 에 원문 대신 FNV-1a 32비트 지문(8 hex)만, 상한 5 → 20, 읽을 때 형식(`^[0-9a-f]{8}$`) 아닌 값은 버림 | `appLogin.js` `fingerprint`·`readHandled`·`writeHandled`, `HANDLED_MAX` |
| L2 | `openExternal` 은 https + **출처가 `APP_ORIGIN` 과 정확히 같을 때만**(스킴 상대 `//evil`, 접미사 위장, 다른 포트, 사용자정보 거부). 유니코드 도메인은 같은 퓨니코드 출처로 풀려 허용 | `bridge.js` `openExternal` |
| L4 | §7-1 OAuthButtons 행 번호 27행으로 정정 | 이 문서 |
| 이중 탭 | `startAppLogin` 안에서 시작 진행 중이거나 Custom Tab 을 연 지 2초(`START_GUARD_MS`) 안이면 새 흐름을 만들지 않고 `true`(이미 처리 중). 앞선 시작이 실패(false)면 보호 없음. 로그인 딥링크(성공·오류)가 오면 보호를 바로 푼다 — 취소 직후 다시 누르면 곧바로 열린다 | `appLogin.js` `startAppLogin`, 처리기 안 `lastOpenedAt = -Infinity` |

L1·L3·L5 는 지시대로 하지 않았다(기록만). L3 일부는 아래 8-3 의 axios 실측으로 대신 확인했다.

### 8-2. 승인 문구 정렬 (데모 v1 §4 "제안 v1", 마침표 포함)

`appLogin.js` `MESSAGES` 한 곳에 모았고 시험이 문자열을 그대로 단언한다.

| 상황 | 판정 | 문구 |
|---|---|---|
| 취소(error/msg 에 access_denied·cancel) | `describeAuthError` | `로그인을 취소했습니다.` |
| 교환 401(만료·재사용·불일치) · 저장된 verifier 없음 · 10분 지남 | `toExchangeError` kind `expired` / 처리기 | `로그인 시간이 지났습니다. 다시 로그인해 주세요.` |
| 서버에 닿지 못함(인터셉터 대체 객체 — `data` 키 없음, 시간 초과, 프록시 HTML 등 객체 아님) | kind `network` | `서버에 연결하지 못했습니다. 다시 로그인해 주세요.` |
| 그 밖(400·500·200인데 토큰 없음·사용자 조회 실패·그 밖의 오류 딥링크·예상 밖 오류) | kind `failed` | `로그인에 실패했습니다. 다시 시도해 주세요.` |

401 과 400 을 가르려면 상태 코드가 필요한데 `client.js` 응답 인터셉터가 실패 때 본문만 reject 해 상태가 사라진다. `appExchange` 가 **이 요청에만** `transformResponse` 를 덧붙여 JSON 본문 객체에 `httpStatus` 를 싣는다(axios 1.x 가 세 번째 인자로 상태를 줌). 서버 문구(`message`)는 사용자에게 보이지 않는다. 분류 함수 `toExchangeError` 는 순수 모듈(`appLogin.js`)에 있어 Node 시험 대상이다. 성공 경로는 여전히 `r.data.token`.

### 8-3. 실행한 검증 (라운드 2)

- `nice -n 10 node --test 'web/test/*.test.js'` → **69/69 통과, 실패 0** (Node v24.22.2, 22:5x). bridge 14 · appLogin 45 · backStack 10.
  - 추가 시험: 승인 문구 4종 일치 · 같은 취소 연속 3회(알림 3회, `closeExternal` 3회) · 같은 서버 오류 반복 · 콜드 스타트 이중 전달 양 순서 1회 · 새로고침 뒤 옛 launch 오류 1회 · 지문 저장(코드·오류 원문 없음) · 상한 20 · 이중 탭(진행 중 / 2초 경계 / 딥링크로 해제 / 실패 후 재시도) · 교환 실패 분류 8형태 · openExternal 출처 7형태.
- axios 실측(scratchpad `axios-probe/probe.mjs`): 기존 미러 `~/.node-local/theroute-web-work` 의 axios **1.16.0**(worktree `package-lock.json` 과 같은 버전)으로 `client.js` 와 같은 인터셉터를 만들고 127.0.0.1 임시 서버에 보냄 → 200 `token=T httpStatus=200` · 401 `expired` · 400 `failed` · 502(HTML) `network` · 응답 없음(시간 초과) `network`. 운영·외부 요청 없음.
- 구문 검사: 변경·신규 `web/src` 파일 전부(15+6개) esbuild 변환 성공(번들·출력 없음).
- `vite build` 는 하지 않았다(Leader 몫).

### 8-4. H1 — 웹 브라우저 불변 근거

1. `?error=` 가 없으면 key 가 고정(`'login'`)이라 지금과 같은 한 인스턴스다 — 일반 `/login` 진입·이메일 로그인·실패 표시(LoginPage 내부 `setError`)는 주소를 바꾸지 않으므로 재마운트가 없다.
2. 웹에서 `/login?error=` 로 가는 길은 `OAuthCallbackPage.jsx` 20·33행(다른 라우트에서 넘어오므로 원래도 새로 만든다)과 주소 직접 입력·새로고침(첫 로드라 원래도 새로 만든다)뿐이다(`grep -rn "/login?error\|setSearchParams" web/src` 로 확인, native 제외 2건).
3. LoginPage 는 `setSearchParams`·`navigate('/login…')` 를 쓰지 않는다(읽어서 확인) → `/login` 에 머문 채 오류 값이 바뀌는 웹 경로가 없다.
- 오류값만이 아니라 `location.key` 를 붙인 이유: 같은 취소를 두 번 하면 문구가 같아 오류값만으로는 다시 만들어지지 않는다. 그 사이 이메일 로그인 실패로 오류 줄이 다른 문구가 됐다면 앱 안내가 화면에 닿지 않는다. Leader 지시("예: error 값을 key")와 다른 점은 이것뿐이다.
- 확인 못 함: 실제 브라우저·앱에서 재마운트되는지(jsdom 없음) — QA 몫.

### 8-5. W2 적용 (worktree 파일만, 시각·구조·CSS 무변경 — 동작만)

`git diff --stat -- web/src` 의 화면 파일: `OAuthButtons.jsx`(+9 −1) · 모달 11개(각 +2) · `pages/TrainingPage.jsx`(+2). `ProblemAddModal.jsx` 는 호출부가 없어 제외(지시대로).

**OAuthButtons.jsx**
```diff
@@ -0,0 +1,3 @@
+import { isNativeApp } from '../native/bridge.js';
+import { startAppLogin } from '../native/appLogin.js';
+
@@ -27 +30,6 @@ export default function OAuthButtons() {
-          onClick={() => { window.location.href = `/api/auth/${btn.key}`; }}
+          onClick={async () => {
+            // T009 — Google 은 WebView 안 OAuth 를 막는다(disallowed_useragent). 앱에서는 PKCE verifier 를 보관하고
+            // Custom Tab 으로 app-start 를 연다(이중 탭이면 이미 처리 중이라 true). 웹은 await 없이 기존 이동 그대로.
+            if (isNativeApp() && await startAppLogin(btn.key)) return;
+            window.location.href = `/api/auth/${btn.key}`;
+          }}
```
지침(§7-1)과 다른 점: `isNativeApp() &&` 를 앞에 둬 **웹에서는 await 없이 동기로** 기존 이동을 한다(지침 원안은 웹에서도 한 틱 늦게 이동).

**모달 11개** — 각 파일 동일 패턴(기존 import 묶음 끝에 1줄, 컴포넌트 본문 첫 줄에 1줄):
```diff
+import useBackHandler from '../../native/useBackHandler';
 ...
 export default function <이름>({ …, onClose, … }) {
+  useBackHandler(true, onClose);
```
| 파일 | import 행 | 호출 행 |
|---|---|---|
| GoalAddModal | 6 | 38 |
| GymAddModal | 5 | 8 |
| PassAddModal | 5 | 28 |
| PassEditModal | 4 | 9 |
| ProblemPhotoModal | 7 | 33 |
| ProfileEditModal | 9 | 14 |
| RecordEditModal | 12 | 94 |
| RouteEditModal | 6 | 13 |
| SessionAddModal | 14 | 24 |
| VideoLinkPicker | 5 | 13 |
| VideoUploadModal | 7 | 14 |

적용 방법: 정확 일치 스크립트(scratchpad `wire-modals.mjs`) — 파일마다 시그니처 줄이 정확히 1개(`export default function <이름>({…onClose…}) {`)인지, 이미 적용됐는지 검사하고 임시 파일→rename 으로 썼다. `git diff -U1` 로 11개 모두 2줄 추가뿐임을 확인.

**pages/TrainingPage.jsx** (Leader 결정: 포함)
```diff
@@ -12,0 +13 @@ import { colorMeta } from '../utils/colors';
+import useBackHandler from '../native/useBackHandler';
@@ -694,0 +696 @@ function AnalysisDetailModal({ data, loading, onClose }) {
+  useBackHandler(true, onClose);
```

**main.jsx** (W 담당, 라운드 2 추가분)
```diff
+import LoginRouteKey from './native/LoginRouteKey';
-          <Route path="/login"          element={<LoginPage />} />
+          <Route path="/login"          element={<LoginRouteKey><LoginPage /></LoginRouteKey>} />
```

범위 밖(손대지 않음): 팝오버 `RecordActionMenu`, 콤보박스 `GymSearchCombobox`(열린 채 뒤로가기 → 모달이 있으면 모달이 닫히고, 없으면 페이지가 뒤로 감).

### 8-6. Reviewer 재검토 중점 (라운드 2)

1. `admit()` 의 출처별 분기 — 특히 launch 먼저 → open 이중 전달을 `launchEchoes` 로 **한 번만** 거르는 것, 그리고 open 먼저일 때 지문 기록으로 뒤 launch 를 거르는 것.
2. 이중 탭 보호가 정상 흐름을 막지 않는지: 실패 후 즉시 재시도 가능 · 딥링크 수신 시 해제 · 2초 경계. [추측] 사용자가 Custom Tab 을 뒤로가기로 닫고(딥링크 없음) 2초 안에 다시 누르면 한 번 무시된다 — 두 번째 탭부터 열린다.
3. `appExchange` 의 `transformResponse` 연결 — `client.defaults.transformResponse` 뒤에 붙여 기본 JSON 파싱을 유지하는지, 성공 본문에 `httpStatus` 가 더해져도 `r.data.token` 이 그대로인지(실측 200 OK).
4. `LoginRouteKey` key 규칙과 8-4 근거.
5. 화면 파일 diff 가 위 목록뿐이고 시각·CSS 변화가 없는지.

### 8-7. 못 한 것 (라운드 2)

- 브라우저·실기기 재현(H1 재마운트, 반복 취소 안내, 뒤로가기로 모달 닫힘, 이중 탭) — QA 몫.
- `vite build` — Leader 몫. `NativeAppHost.jsx`·`useBackHandler.js`·`LoginRouteKey.jsx` 는 여전히 React 가 필요해 단위 시험 없음(구문 검사만).

---

## 9. 소규모 패치 (23:00~23:11) — Reviewer-W 2라운드(CONDITIONAL_PASS) L-1·L-2·L-4 + test 스크립트

근거: [[T009-reviewer-W]] "2라운드" 절, Leader 지시. 화면 파일(`web/src/{pages,components,styles}/**`)은 이번에 건드리지 않았다.

| # | 무엇을 | 어디를 |
|---|---|---|
| L-2 | 진행 중 표시를 불리언 `startInFlight` → `currentStart = {token, at}` 로 바꾸고 **수명 `START_INFLIGHT_MAX_MS`=10초**를 뒀다. `Browser.open()` 이 영영 응답하지 않아도 10초 뒤에는 새 시작이 된다. 타이머를 쓰지 않고 기존 주입 시계(`now`)로 판정한다(정리할 타이머가 없다). 정리 시점: 시작이 끝날 때(`finally`)·실패할 때·로그인 딥링크 처리 때(`releaseStartGuard()`). 밀려난 낡은 시작이 늦게 끝나면 **상태·verifier 를 건드리지 않고 `true`** 를 돌려준다 — `false` 면 그 옛 탭의 OAuthButtons 가 뒤늦게 웹 이동(`/api/auth/…`)으로 폴백해 새 로그인을 깨뜨리기 때문 | `appLogin.js` `startAppLogin`·`releaseStartGuard`·`__resetAppLoginForTest` |
| L-1 | `launchEchoes` 를 Set → Map(지문 → launch 처리 시각)으로, **수명 `LAUNCH_ECHO_TTL_MS`=3초**. 3초 안에 같은 오류가 open 으로 오면 이중 전달로 한 번 거르고, 3초가 지나면 사용자의 새 취소로 처리한다. 확인한 항목은 어느 쪽이든 지운다 | `appLogin.js` `createAppLoginHandler` `admit()` |
| L-4 | NativeAppHost 주석 정정: "LoginPage 가 초기 상태로 읽어 이미 렌더하므로" → LoginRouteKey 가 `?error=` 실린 이동마다 LoginPage 를 새로 만든다는 현재 동작. 토큰이 있을 때 콘솔에만 남는 경로 주석에 L1(만료 토큰 잔존 시 이론상 도달)을 명시. **동작 변경 없음** | `NativeAppHost.jsx` 42~46행·81~84행 |
| test 스크립트 | `web/package.json`·`backend/package.json` `scripts` 끝에 `"test": "node --test test/*.test.js"` 한 줄씩(기존 `test` 없음 확인). 의존성·버전·다른 스크립트 무변경, `package-lock.json` 무변경 | 두 package.json |

package.json diff (그대로):
```diff
--- a/backend/package.json
+++ b/backend/package.json
@@ -6,7 +6,8 @@
   "scripts": {
     "start": "node src/index.js",
     "dev": "nodemon src/index.js",
-    "lint": "eslint src/"
+    "lint": "eslint src/",
+    "test": "node --test test/*.test.js"
   },
--- a/web/package.json
+++ b/web/package.json
@@ -6,7 +6,8 @@
   "scripts": {
     "dev": "vite --host 0.0.0.0",
     "build": "vite build",
-    "preview": "vite preview"
+    "preview": "vite preview",
+    "test": "node --test test/*.test.js"
   },
```

추가 시험(6건, `appLogin.test.js` 끝): L-2 — 10초 경계(직전 탭은 "처리 중", 10초부터 새로 엶) · 밀려난 낡은 시작이 늦게 실패해도 새 verifier 유지·`true` 반환·새 시작의 2초 보호 유지 · open 응답 없음 중 딥링크로 해제 · 실패 시 즉시 해제. L-1 — launch 뒤 3초 경과 open 은 처리 · 3초 안 open 은 duplicate 후 다음 취소는 처리.

실행 결과 (23:1x, Node v24.22.2):
- `nice -n 10 node --test 'web/test/*.test.js'` → **75/75 통과**(라운드 2의 69 + 6).
- `cd backend && nice -n 10 node --test test/*.test.js` → **63/63 통과**(유지).
- 두 package.json `JSON.parse` OK. `git status` 상 `web`·`backend` 의 `package-lock.json` 변화 없음(보이는 lock 변화는 스트림 N 의 `mobile/package-lock.json` 뿐).
- `appLogin.js`·`NativeAppHost.jsx` esbuild 변환 구문 OK.

못 한 것: `npm test` 자체는 실행하지 않았다(같은 명령을 직접 실행함 — npm 은 sh 를 거쳐 glob 을 펼치므로 결과는 같다고 본다 [가능성 높음]). 브라우저·실기기 재현은 QA 몫.

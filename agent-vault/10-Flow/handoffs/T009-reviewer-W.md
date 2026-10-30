---
tags: [type/handoff, domain/mobile, domain/auth, role/reviewer]
task: "[[T009-android-apk]]"
stream: W
role: reviewer
date: 2026-10-30
verdict: CONDITIONAL_PASS
verdict_history: "round1=fail, round2=CONDITIONAL_PASS"
---

# T009 스트림 W 독립 감사 (reviewer)

대상: worktree `/home/brownjeon/.node-local/theroute-app` (브랜치 `mobile-app-t009`, 미커밋). 개발자 기록 [[T009-stream-W]].
방법: 읽기 + `node --test` + 프로젝트 파일을 건드리지 않는 임시 스크립트(scratchpad) 2개. 코드 수정·git 조작·운영 요청 없음.

## 판정: FAIL (High 2건 — 웹/서버 불변·PKCE 계약은 통과, 앱 로그인 실패 알림 경로가 실제로는 보이지 않거나 삼켜짐)

## 0. 선결 확인 (데모 게이트)

- `git status --short -- web/src/pages web/src/components web/src/styles` → 출력 없음. `git diff --stat -- web/` → `web/index.html`(스트림 N 몫 2줄)·`web/src/api/auth.js`(+26)·`web/src/main.jsx`(+7) 뿐. **화면 파일 수정 없음 — 데모 게이트 위반 아님.**
- `@capacitor/*` import: `web/src`·`web/test` 에서 0건(`bridge.js:4`, `:85` 는 주석 문장).

## 1. 직접 실행 결과

| 실행 | 결과 |
|---|---|
| `nice -n 10 node --test 'web/test/*.test.js'` (Node v24) | **54/54 통과, 실패 0, 종료코드 0** (bridge 14 + appLogin 30 + backStack 10) |
| 임시 스크립트 `contract-roundtrip.mjs` (웹 모듈 ↔ 백엔드 핸들러를 메모리에서 연결) | 아래 §3 — 전 항목 일치 |
| 임시 스크립트 `dup-error-probe.mjs` | **H2 재현**: 같은 오류 딥링크 두 번째가 `duplicate` 로 무시됨 |

임시 스크립트 위치: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project/f1b66db4-4f76-4841-aa22-e72593bc6de0/scratchpad/{contract-roundtrip,dup-error-probe}.mjs`

## 2. 발견 이슈

| # | 심각도 | 파일:행 | 요약 |
|---|---|---|---|
| H1 | HIGH | `NativeAppHost.jsx:63-69` · `LoginPage.jsx:13` · `main.jsx:42` | 로그인 실패·취소 안내가 `/login` 화면에서는 **표시되지 않는다**(같은 라우트 이동은 LoginPage 를 다시 만들지 않음) |
| H2 | HIGH | `appLogin.js:269-272` | **같은 오류 딥링크가 두 번째부터 조용히 무시**된다(취소 2회, 서버 오류 2회) — 재현함 |
| M1 | MEDIUM | `appLogin.js:217-226` · `:269` | 처리한 코드 **원문**과 오류 URL 을 sessionStorage 에 그대로 저장(참고 구현은 지문). `HANDLED_MAX=5` 는 참고 구현 20 |
| L1 | LOW | `NativeAppHost.jsx:63-69`, `:82-85` | 이미 토큰이 있으면(`hasToken`) open 출처 실패 안내가 `console.warn` 으로만 남음 |
| L2 | LOW | `bridge.js:58-68` | `openExternal` 이 **모든 https 출처**를 연다(앱 출처 한정 아님) — 현재 호출부는 상수 주소라 악용 경로 없음 |
| L3 | LOW | `api/auth.js:25-38`, `NativeAppHost.jsx:52-62` | `appExchange` 오류 구분·로그인 확정 순서에 단위 시험 없음 |
| L4 | LOW | 개발자 기록 §7-1 | OAuthButtons 의 onClick 행은 "39행 부근"이 아니라 **27행**(코드 조각 자체는 일치) |
| L5 | LOW | `bridge.js:107-109` | `theroute://x@auth/callback`(사용자정보 포함)도 로그인 딥링크로 받음 — 서버는 만들지 않는 모양, 무해 |

### H1 — 안내 문구가 `/login` 위에서는 안 보인다
- 근거: 앱은 `/login` 에서 [Google로 계속하기]를 누르고 Custom Tab 으로 나간다. 그동안 WebView 는 `/login` 에 그대로 있다. 취소/실패 딥링크가 오면 `NativeAppHost.jsx:63-66` 이 `navigate('/login?error=…', {replace:true})` 를 부른다. 같은 경로(`/login`)·같은 엘리먼트라 React 는 `LoginPage` 를 **다시 만들지 않고**, `LoginPage.jsx:13` 의 `useState(searchParams.get('error') || '')` 는 첫 렌더 값만 쓴다 → `error` 는 계속 `''`. `main.jsx:42` 의 `<Route path="/login" element={<LoginPage />}>` 에 `key` 도 없다.
- 효과: "방금 누른 로그인(open)의 실패는 항상 알린다"(스펙 §8, 개정 §3-3, 심사 항목 3)가 핸들러 단위(`notify` 호출)에서는 지켜지지만 **사용자 화면에는 도달하지 않는다**. 교환 실패·토큰 조회 실패·취소·오류 딥링크가 전부 해당. 보이는 경우는 앱 프로세스가 죽었다 새로 떠서 LoginPage 가 새로 만들어질 때, 또는 `/signup` 에서 시작했을 때뿐.
- 뿌리: 스펙 §8 L267-272 가 "LoginPage 가 초기 상태로 읽어 이미 렌더한다"를 전제했다(처음 진입할 때만 맞음). 구현은 스펙을 충실히 따랐고 개발자 주석(`NativeAppHost.jsx:42-44`)도 같은 전제다.
- 신뢰도: 코드 근거는 확인함(읽음). **브라우저 재현은 하지 못했다**(reviewer 는 기능 시험 금지, jsdom 없음) → QA 가 반드시 확인.
- 제안(화면 파일 불필요 — 둘 중 하나):
  - A) `NativeAppHost` 의 navigate 래퍼에서, 현재 경로가 이미 `/login` 이면 `/oauth/callback?error=<메시지>` 로 `replace` 이동한다. 기존 `OAuthCallbackPage.jsx:19-21` 이 `/login?error=…` 로 다시 보내므로 LoginPage 가 새로 만들어진다(기존 동작 재사용).
  - B) `main.jsx`(W 담당 파일)에서 `/login` 라우트 엘리먼트를 `useLocation().search` 를 `key` 로 쓰는 작은 래퍼로 감싼다.
  - C) `LoginPage.jsx` 가 `searchParams` 변화를 동기화(화면 파일 → 데모 게이트·designer 판단 필요).

### H2 — 같은 오류 딥링크 두 번째는 무시된다 (재현함)
- 근거: `appLogin.js:269` `const key = code ? \`code:${code}\` : \`error:${url}\`` → `:270` 메모리 Set + sessionStorage 에 이미 있으면 `'duplicate'`. 오류 딥링크는 매번 똑같은 문자열이다. 실제 서버 출력: 취소는 `theroute://auth/callback?error=oauth_failed&msg=access_denied`(공용 라우터 `adapters/express.js:82-86` 이 `error=oauth_failed&msg=<제공자 오류>` 로 보냄 → `appOAuthCallback.js:141-142`).
- 재현: 임시 스크립트에서 첫 취소 → `error-link`(알림 1), **두 번째 취소 → `duplicate`**(알림 없음, `closeExternal` 도 호출 안 됨). `oauth_failed` 반복도 동일. 같은 앱 실행 중에는 `seen` Set 이, 새로고침 뒤에도 sessionStorage(최근 5건)가 막는다.
- 대비: 참고 구현 `StockInvest/src/lib/native/appLogin.ts:255` 주석 — "appUrlOpen 의 오류 딥링크는 매번 넘긴다 — 같은 페이지에서 두 번 취소해도 두 번째 안내가 나와야 한다", `:266-270` 코드 딥링크만 중복 제거하고 launch 출처만 sessionStorage 로 거른다.
- 영향: 사용자가 로그인을 두 번 연속 취소하거나 같은 서버 오류가 반복되면 두 번째부터 아무 반응이 없다(조용한 실패).
- 제안: 오류 딥링크는 `source==='open'` 이면 중복 제거하지 말고, `source==='launch'` 일 때만 sessionStorage 로 거른다(코드 딥링크는 지금처럼 유지). 오류 딥링크가 기록에서 빠지면 M1 의 5건 상한 압박도 줄어든다. **반복 오류 시험을 추가**한다.
- 참고: 시험이 이 경로를 못 잡은 이유 — `오류 딥링크는 취소 문구로 안내한다`(appLogin.test.js:306)는 1회 호출만 확인한다.

### M1 — 저장소에 코드 원문
- `writeHandled`(`appLogin.js:217-226`)가 `code:<64hex>` 원문과 오류 URL 을 sessionStorage `theroute_app_login_handled` 에 둔다. 소모된 코드라 대개 무해하지만, 교환 요청이 서버에 닿지 못한 경우(오프라인)엔 60초간 유효한 코드가 남는다. 참고 구현은 FNV 지문(`appLogin.ts:215-223`, 주석 "코드 원문을 저장소에 남기지 않으려는 것")과 상한 20 이다.
- 상한 5 는 launch 주소가 밀려나면 새로고침 때 옛 launch 주소를 다시 처리해 "로그인 대기 시간이 지났습니다" 안내가 엉뚱하게 뜰 수 있다(드묾). 제안: 지문 저장 + 상한 20.

### L1 — 이미 토큰이 있을 때 open 실패 안내 소실
- `NativeAppHost.jsx:63-69`: 안내 문구는 `/login` 이동에 실어 보내는데, 핸들러는 `hasToken()` 이 true 면 이동하지 않는다(`appLogin.js:279,288`). 문구는 `:82-85` 에서 `console.warn` 으로만 남는다. 개발자 주석은 "옛 오류 딥링크가 다시 온 때뿐"이라 했지만 open 출처(사용자가 방금 시작)이면서 토큰이 남아 있는 경우도 이론상 가능(만료 토큰 잔존 등). 도달 가능성은 낮다.

### L2 — openExternal 출처 제한
- `bridge.js:63-65` 는 https·사용자정보 없음만 본다. 심사 기준("https + 정확한 앱 출처")보다 넓다(참고 구현 `bridge.ts:129-131` 과 같은 수준). 현재 유일한 호출부 `startAppLogin` 은 상수 `APP_ORIGIN` 으로 주소를 만든다. `//evil.com` 같은 값도 https 로 풀린다. 향후 W2 등에서 사용자 입력 주소를 넘기는 호출부가 생기면 위험 → 허용 출처 옵션 또는 문서화 권고.

### L3 — 시험 공백 (React/axios 의존 파일)
- 시험이 없는 것: `appExchange`(`'data' in e` 로 서버/비서버 오류 구분), `NativeAppHost` 의 로그인 확정 순서(`setItem`→`getMe`→`authLogin`, 실패 시 토큰 제거), `useBackHandler`. 구현을 복사한 시험은 아니고(실제 파일을 import 해 실행) 핵심 분기(중복·TTL 경계·launch silent·open 알림·형식 오류·verifier 소각)는 실제로 검증된다. 공백은 위 세 파일이며, `appExchange` 는 axios 인스턴스를 주입받도록 하면 Node 시험이 가능하다.

## 3. 서버 계약 대조 (임시 스크립트로 실제 핸들러 연결, 한 글자까지)

| 항목 | 웹 | 서버 | 결과 |
|---|---|---|---|
| app-start 쿼리 | `provider`·`challenge`(`fallback=1` 선택) — `appLogin.js:160-164` | `appAuth.js:36-45` 가 `q.provider`·`q.challenge`·`q.fallback==='1'` | 일치 |
| challenge/verifier 형식 | `^[A-Za-z0-9_-]{43}$` (`appLogin.js:39`) | `appAuthCodes.js:31` 같은 정규식 | 일치. 웹 `createPkcePair` 결과를 서버 `isPkceVerifier/isPkceChallenge` 가 수락, 웹 challenge == 서버 `pkceChallengeOf(verifier)` |
| 표시 쿠키 | (웹은 만들지 않음) | `route_app_login`=`n.<challenge>`, HttpOnly·Secure·Lax·path `/`·600000ms | 확인 |
| 콜백→딥링크 | `authCodeFromDeepLink` | `theroute://auth/callback?code=<64hex>` | 일치 |
| 오류 딥링크 | `authErrorFromDeepLink`→`{error,msg}` | `?error=oauth_failed&msg=access_denied` | 일치, `describeAuthError`→"로그인을 취소했습니다" |
| 교환 요청 | `POST /auth/app-exchange {code, verifier}` (`api/auth.js:27`, baseURL `/api`) | `routes/auth.js` 에 `router.post('/app-exchange')` 마운트(공용 OAuth 라우터 앞) | 일치 |
| 교환 응답 | `r.data.token` (`api/auth.js:33`) | 200 `{success:true,data:{token},message:''}`, `Cache-Control: no-store` | 일치 (`r.data.data` 사용 안 함) |
| 실패 응답 | `'data' in e` 로 서버 문구 사용 | 400/401 `{success:false,data:null,message}` — 서버 `data` 키 있음 | 일치 |
| 1회용·소각 | 교환 전 verifier 삭제 | 재사용 401, 불일치 401 후 올바른 verifier 도 401 | 일치 |
| 쿠키 없는 웹 로그인 | — | `/oauth/callback?token=` → `next()`, redirect 없음 | 불변 확인 |
| 딥링크 상수 | `theroute:`·`auth`·`/callback`, `APP_ORIGIN` | manifest `scheme=theroute host=auth`, `capacitor.config.ts` `server.url` | 일치 |

> RFC 7636 부록 B 벡터는 웹 시험(`appLogin.test.js:77`)에 존재, 통과. 서버 쪽 벡터 시험은 스트림 B 몫이라 이번 범위 밖.

## 4. 항목별 판정 (요청서 중점 감사 1~9)

1. **웹 불변 — 통과.** `NativeAppHost` 는 비앱에서 `isNativeApp()` 이 false 라 세 effect 모두 아무것도 등록하지 않고 `null` 렌더(`NativeAppHost.jsx:40,93,107,141`). bridge 함수 전부 no-op/false/null(시험 `bridge.test.js:50,60`). `main.jsx` 변경은 import 2줄·`<NativeAppHost/>` 1줄·`data-native` 설정 1줄뿐, 라우팅·렌더 불변. 모듈 최상위 부작용 없음.
2. **PKCE 클라이언트 — 통과.** verifier 32바이트→base64url 43자(`appLogin.js:77-83`), S256, RFC 벡터 시험, 키 `theroute_app_pkce`·`{verifier,provider,createdAt}`·TTL 10분 경계 시험(`:115`), 교환 **전** 삭제(`:284`)·성공 실패 무관(`:229` 시험). verifier 는 URL(`:167` 시험)·로그(`console.warn` 은 오류 이름/메시지만)에 안 나감.
3. **딥링크 처리 — 부분 통과.** host=`auth`·pathname=`/callback` 분리 판정, 2048 길이 상한, 64hex, 다른 링크 무시, 코드 중복 처리(메모리+sessionStorage), appUrlOpen+getLaunchUrl, launch silent / open 알림 — 코드 딥링크는 정상. **오류 딥링크 중복(H2)과 `/login` 위 표시(H1)에서 실패.**
4. **교환·로그인 확정 — 통과(H1 별도).** `r.data.token`, 15초 `timeout`, 오류 구분이 서버 실제 형태와 일치, 순서와 실패 시 토큰 제거가 `OAuthCallbackPage` 와 같다.
5. **뒤로가기 — 통과.** `canGoBack` 우선(`backStack.js:58-60`), 리스너 등록 시 기본 동작 소멸을 모달→뒤로→종료로 책임, 맨 위 하나만, ref 사용으로 재등록 없음(`useBackHandler.js:19-25`), 언마운트 시 해제. 한계: 팝오버(`RecordActionMenu.jsx:36`)·콤보박스(`GymSearchCombobox.jsx:87`)는 모달이 아니라 스택 밖(후속).
6. **서버 계약 — 일치** (§3).
7. **보안 — 대체로 통과.** 토큰 저장은 기존 `theroute_token` localStorage, `window.Capacitor` 는 서버 권한 판단에 안 쓰임(서버는 challenge·1회용 코드만). 오류 문구는 서버의 고정 한국어 문구만 노출(예외: `errorHandler.js:3-6` 의 `err.message` 가 `data:null` 과 함께 나가므로 이론상 그대로 표시되나 이 라우트에서 도달할 경우는 비정상 JSON 뿐). L2 참고.
8. **시험 품질 — 양호, 공백 있음.** L3·H2 참고.
9. **W2 배선 지침 — 대체로 정확.** 모달 12개 파일 목록·시그니처 행(36/6/26/7/8/31/12/92/11/22/11/12)·부모 조건부 렌더·중첩 2쌍·ProblemAddModal 호출부 없음·`AnalysisDetailModal`(`TrainingPage.jsx:694`, 호출 `:684` 조건부)을 직접 대조해 일치. 오차는 L4(27행). import 경로(`'../native/appLogin.js'`, `'../../native/useBackHandler'`, `'../native/useBackHandler'`)도 올바름. 추가 주의: OAuthButtons 에 이중 탭 방지가 없어 연타하면 Custom Tab 이 두 번 열리고 마지막 verifier 만 유효(designer 판단 — 지침 §7-1 에 이미 언급). `OAuthButtons` 는 `LoginPage.jsx:61`·`SignupPage.jsx:74` 두 곳에서 쓰임(H1 은 /login 에서만 발생).

## 5. QA 에 넘길 high_risk_areas (수정 후 재순환 뒤)

1. `/login` 위에서 앱 로그인 취소·실패 시 **안내 문구가 실제로 보이는가**(H1 수정 확인) — 가짜 `window.Capacitor`(isNativePlatform true, App.addListener 캡처)를 주입한 브라우저에서 `appUrlOpen` 을 직접 발사.
2. 같은 취소·오류를 **연속 2~3회** 해도 매번 안내가 나오는가(H2 수정 확인), 콜드 스타트 중복(open+launch 같은 오류 링크)은 한 번만 나오는가.
3. 실기기 PKCE 왕복: Custom Tab→딥링크→교환→홈, 앱 프로세스 종료 후 콜드 스타트 복귀(verifier 가 localStorage 에서 복원되는가), `Browser.close` 효과.
4. 웹 브라우저(비앱)에서 로그인·OAuth 콜백·라우팅이 변하지 않았는가, `<html data-native>` 가 붙지 않는가.
5. 뒤로가기: 루트에서 앱 종료, 겹친 모달 맨 위만 닫힘(W2 배선 뒤), 실제 Capacitor 7 `backButton` 이벤트의 `canGoBack` 값, 팝오버·콤보박스 열린 상태.
6. 오래된 토큰이 남은 상태에서의 로그인(`hasToken` silent/알림 분기, L1).
7. 키보드 열림 시 입력칸 가운데 정렬(실기기).

## 6. 후속 과제

- H1·H2 수정 후 reviewer 부터 재순환.
- `appExchange` 를 axios 주입 형태로 바꿔 시험 추가, 반복 오류 딥링크 시험 추가(L3, H2).
- 모달 밖 오버레이(`AnalysisDetailModal`·팝오버·콤보박스)의 뒤로가기 정책은 Leader·designer 결정.
- `web/package.json` 의 `test` 스크립트는 `node --test 'test/*.test.js'` 형태여야 Node 24 에서 돈다(개발자 보고와 동일, Leader 결정).
- 워크스페이스에 Node 20 이 없으므로 개정 §5 의 "Node 20" 표기와 실제 환경(v24.22.2)이 다름 — 문서 정정 권고.

## 7. 검토하지 못한 것

`vite build`/실제 React 렌더(jsdom 없음)·H1 의 브라우저 재현, 실기기(Custom Tab·딥링크·Capacitor 7 `Plugins` 프록시가 원격 URL 앱에서 `addListener`/`getLaunchUrl` 을 제공하는지 — StockInvest/TheKaiwa 선례에 의존), 스트림 N(네이티브 셸·`MainActivity`)·스트림 B 시험(`backend/test`) 실행, 데모 게이트 `check.mjs`(화면 파일 변경이 없어 생략), Codex C2.

- [reviewer] 1라운드 판정은 fail 이었고 H1·H2 는 2라운드에서 해소됐다(아래 "2라운드" 절 참조). 유효한 최종 판정은 문서 맨 끝 줄이다.

---

# 2라운드 (22:5x~) — H1·H2 수정 + W2 화면 배선 재감사

대상: 개발자 기록 [[T009-stream-W]] §8. 같은 worktree(미커밋). 데모 게이트: 사용자 데모 v1 승인 후 활성.
방법: 코드를 직접 읽고, `node --test`, 임시 스크립트 1개(`r2probe/probe.mjs`, 로컬 임시 서버 127.0.0.1 + 소스 사본, 운영·외부 요청 없음)로 확인. 코드 수정·git 조작 없음.
임시 스크립트 위치: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project/f1b66db4-4f76-4841-aa22-e72593bc6de0/scratchpad/r2probe/probe.mjs`

## 판정 (2라운드): CONDITIONAL_PASS — Critical 0 · High 0 · Medium 0 · Low 6

단, H1(안내가 /login 위에서 실제로 보임)은 **코드와 라우터 소스로만 확인**했고 브라우저 재현은 못 했다. QA 가 아래 S2 시나리오로 재현해 실패하면 High 로 되돌린다.

## 2-0. 선결 확인

| 항목 | 결과 |
|---|---|
| 데모 게이트 | `check.mjs check` → `DEMO_GATE_PASSED` / `status: approved` / `approved_version: v1` / `hash: verified`, 종료코드 0 |
| 승인 기록의 실제 대화 대조 | 사용자(`origin.kind: human`) 발화 "권고대로 진행해줘"가 22:42:14(KST)에 데모 검토 요청 메시지 직후 들어왔고(`queued_command`), 그 메시지가 승인 방법으로 "권고대로 승인"을 안내했다. `approve` 는 Leader 가 `check.mjs approve --quote` 로 실행(22:43:01)했고 `evidence.jsonl` 의 `quote_sha256` 은 해당 원문의 해시와 일치한다. `waive` 호출·`.claude/state/demo-gate/` 직접 쓰기 흔적은 없다(demo-gate 관련 도구 호출은 init·status·lint·approve·activate·check 뿐) |
| 승인 기록의 흠 | `evidence.jsonl` 의 `transcript_uuid` 는 22:18 의 **같은 문장** 첫 발화(결정 4건 승인)를 가리키고, `prompt_ts`(22:42:34)가 맞는 발화다. 도구가 같은 문장의 첫 줄에 붙은 것으로 보이며 승인 효력엔 영향이 없다. Leader 는 task 파일에 "권고대로 진행해줘" = D1~D4 권고 승인으로 해석했다고 적었다(해석이 틀리면 정정 요청) — reviewer 는 이 해석의 타당성을 판정하지 않고 기록만 한다 |
| 화면 파일 변경 범위 | `git status -s -- web/src/pages web/src/components web/src/styles` = `OAuthButtons.jsx` + 모달 11개 + `pages/TrainingPage.jsx` **뿐**. `LoginPage.jsx`·`SignupPage.jsx`·`OAuthCallbackPage.jsx`·`AuthContext.jsx`·`api/client.js` 는 수정 없음(빈 출력 확인) |
| 변경 규모 | `git diff --stat -- web/` = 16 files, 81 insertions, 2 deletions (OAuthButtons +9 −1, main.jsx +9 −1, 나머지 순수 추가) |

## 2-1. 시험 실행

`cd /home/brownjeon/.node-local/theroute-app && nice -n 10 node --test 'web/test/*.test.js'` → **69/69 통과, 실패 0, 종료코드 0** (Node v24.22.2). 시험이 없는 React/axios 의존 파일: `LoginRouteKey.jsx`, `NativeAppHost.jsx`, `useBackHandler.js`, `OAuthButtons.jsx` 의 onClick, `api/auth.js`(`attachHttpStatus`·transformResponse 연결). `api/auth.js` 는 아래 임시 서버 실측으로 대신 확인했으나 **저장소에 시험으로 남아 있지 않다**.

## 2-2. 항목별 판정

### H1 (LoginRouteKey) — 해소(브라우저 재현 대기)
- `main.jsx` `/login` 라우트가 `<LoginRouteKey><LoginPage /></LoginRouteKey>` 로 바뀌었다. `LoginRouteKey.jsx:26` `key = error ? \`e:${error}:${location.key}\` : 'login'`, `:27` `<Fragment key={key}>`. 키가 바뀌면 자식(LoginPage)이 새로 만들어진다.
- (a) 앱의 `navigate('/login?error=…', {replace:true})` 는 `?error=` 가 새로 실려 키가 `login`→`e:…` 로 바뀐다 → LoginPage 가 새로 만들어져 `useState(searchParams.get('error'))`(`LoginPage.jsx:13`)가 새 값을 읽는다. 이미 `?error=` 가 있는 상태에서 오는 두 번째 이동은 아래 (b).
- (b) 같은 오류 연속 N회: react-router 6.30.3(`web/package-lock.json` 과 미러 동일)의 `@remix-run/router` 에서 `replace()` 는 `createLocation(history.location, to, state)`(router.cjs.js:477-479)이고 `createLocation` 은 `key: to && to.key || key || createKey()`(:365), `createKey()` 는 `Math.random().toString(36).substr(2, 8)`(:333)이다. 새 키가 `getHistoryState` 로 history state 에 들어가고(:340-345) `useLocation().key` 가 그것을 읽는다(:229) → **replace 마다 키가 달라져** 오류 문구가 같아도 매번 재마운트된다.
- (c) 오류가 없으면 키가 고정 `'login'` → 기존과 같은 한 인스턴스, DOM 추가 없음(Fragment). 일반 `/login` 진입·이메일 로그인·실패 표시(LoginPage 내부 `setError`)는 주소를 바꾸지 않아 재마운트·입력 손실이 없다.
- (d) 웹에서 `/login?error=` 로 가는 경로는 `OAuthCallbackPage.jsx:20,33`(다른 라우트에서 넘어오므로 원래도 새로 만듦)과 주소 직접 입력·새로고침(첫 로드)뿐임을 `grep` 으로 확인(`setSearchParams`·`navigate('/login…')` 는 native 밖에 없음). 오류가 있는 채 `location.key` 가 바뀌는 웹 동작이 없어 입력값 손실 회귀 경로는 못 찾았다. 앱에서는 의도된 재마운트로 이메일·비밀번호 입력이 비워진다(수용 가능, 데모 v1 의 오류 줄 표시와 일치).
- 신뢰도: [가능성 높음] — 키 기반 재마운트는 React 표준 동작이고 키의 변화는 라우터 소스로 확인했다. 브라우저 재현은 하지 못했다.

### H2 (admit) — 해소
`appLogin.js:327-347` 모든 분기를 읽었다.

| 링크 | 출처 | 동작 |
|---|---|---|
| 코드 | open/launch | 메모리 Set 또는 sessionStorage 지문에 있으면 duplicate, 없으면 기록 후 처리 (출처 무관 1회) |
| 오류 | launch | 지문이 있으면 duplicate; 없으면 기록 + `launchEchoes` 추가 후 처리 |
| 오류 | open | `launchEchoes` 에 있으면 그 한 번만 duplicate(콜드 스타트 launch→open 이중 전달); 아니면 지문 기록 후 **매번 처리·알림·`closeExternal`** |

시험(`appLogin.test.js`)이 실제로 단언한다: 같은 취소 3회 → 알림 3회·`closeExternal` 3회(`:456`), 같은 서버 오류 반복(`:466`), launch→open 한 번(`:473`), open→launch 한 번(`:483`), 새로고침 뒤 옛 launch 오류 무시(`:490`). 처리된 링크에서 `lastOpenedAt = -Infinity`(`appLogin.js:356`)로 더블탭 보호도 풀린다. 사소한 허점은 L-1·L-5.

### M1 · L2 · 더블탭 — 해소
- M1: sessionStorage 에 FNV-1a 32비트 지문(8 hex)만, 상한 20(`appLogin.js:34`), 읽을 때 `/^[0-9a-f]{8}$/` 아닌 값은 버린다(`:272`). 시험(`:366-377`, `:379`, `:490`)이 원문 부재·상한을 단언한다.
- L2: `bridge.js:65` `u.origin !== APP_ORIGIN` → 거부. `//evil.example`·접미사 위장·다른 포트·http·javascript:·사용자정보 7형태 시험 통과(`bridge.test.js:105`). 유니코드 도메인은 같은 퓨니코드 출처로 풀려 허용(무해).
- 더블탭(`appLogin.js:201`): 진행 중이거나 연 지 2초 안이면 새 흐름 없이 `true`. 해제 조건은 ① 시작 실패(`:221` clear, `startInFlight` finally) ② 처리된 로그인 딥링크(`:356`) ③ 2초 경과. 시험(`:224-278`)이 진행 중·2초 경계·딥링크 해제·실패 후 재시도를 단언. 정상 흐름을 막는 경우는 "Custom Tab 을 연 지 2초 안에 뒤로가기로 닫고 곧바로 다시 누르면 한 번 무시" 뿐이다(L-3).

### appExchange transformResponse — 통과 (임시 서버 실측)
- 이 요청에만 적용: `api/auth.js` 의 `post(..., { transformResponse })` 는 요청별 설정이다. 실측에서 `client.post('/auth/login')` 의 거절 본문과 `client.get('/auth/me')` 의 성공 본문에는 `httpStatus` 가 붙지 않았다. `client.js` 는 수정 없음.
- 성공 경로: 200 → `r.data.token` 반환(`T0K`). 기본 JSON 파싱 유지(`[].concat(client.defaults.transformResponse, attachHttpStatus)`).
- 분류(서버 계약과 대조): 401 → `expired`(status 401), 400 → `failed`, 500 → `failed`, 502 HTML → `network`, 502 빈 본문 → `network`, 소켓 끊김 → `network`, 200 인데 토큰 없음 → `failed`. 서버의 실제 응답 형태(`{success,data:null,message}`, 401 은 unknown/expired/mismatch 공통)와 일치.
- 누출: 던져진 Error 의 own key 는 `kind`·`httpStatus` 뿐이고 메시지는 고정 한국어 문구라 코드·verifier·토큰·서버 문구(`서버문구-노출금지`)가 새지 않는다.

### D4 문구 — 일치
`appLogin.js:53-58` `MESSAGES` 4개가 `로그인을 취소했습니다.` / `로그인 시간이 지났습니다. 다시 로그인해 주세요.` / `서버에 연결하지 못했습니다. 다시 로그인해 주세요.` / `로그인에 실패했습니다. 다시 시도해 주세요.` 와 마침표까지 같다. 문자열 포함 검사로 `appLogin.js` 와 데모 `T009-android-apk-v1.html`(401-404, 589-592행) 양쪽에 각각 들어 있음을 확인. 시험이 별도 리터럴(`MSG_*`)과 `deepStrictEqual` 로 대조한다(`:91`).

### W2 화면 배선 — 통과
- 모달 11개: 각 파일 정확히 +2줄(`import useBackHandler from '../../native/useBackHandler';` 1줄 + 컴포넌트 본문 첫 줄 `useBackHandler(true, onClose);` 1줄), 삭제 0. 호출 위치는 모두 함수 본문 **첫 문장**(조건문·루프·조기 반환 앞)이라 훅 규칙 위반 없음. `onClose` 는 11개 모두 함수 매개변수 구조 분해에 존재(GoalAdd:37, GymAdd:7, PassAdd:27, PassEdit:8, ProblemPhoto:32, ProfileEdit:13, RecordEdit:93, RouteEdit:12, SessionAdd:23, VideoLinkPicker:12, VideoUpload:13). `grep -c` 로 파일마다 호출이 정확히 1회. `ProblemAddModal.jsx` 는 0회(호출부 없음, 지시대로).
- `pages/TrainingPage.jsx`: import 1줄(`:13`) + `AnalysisDetailModal` 첫 줄(`:696`), 매개변수에 `onClose` 존재, 호출부는 조건부 렌더(`(detail || detailLoading) && …`)라 마운트=열림.
- 중첩 쌍: `RecordEditModal`(photoTarget 기본 null, `:114`)이 먼저 마운트되고 `ProblemPhotoModal` 은 `photoTarget` 이 생길 때 나중에 마운트 → 스택 맨 위 = 자식. `SessionAddModal`(pickerForRow 기본 null, `:41`) → `VideoLinkPicker` 도 같다.
- 시각·CSS·구조·문구: diff 에 스타일·JSX 구조·문구 줄이 없다(위 줄 수와 일치).
- `OAuthButtons.jsx`: `onClick={async () => { if (isNativeApp() && await startAppLogin(btn.key)) return; window.location.href = … }}`. 웹(`isNativeApp()` false)에서는 `&&` 가 단락돼 **await 없이 같은 동기 호출 안에서** 기존 이동을 한다(지침 원안보다 개선). 앱에서 `startAppLogin` 이 false 면 같은 이동으로 폴백.
- 웹 브라우저에서 훅은 스택에 올라가기만 하고 아무도 부르지 않아 동작이 같다.

## 2-3. 발견 이슈 (2라운드)

| # | 심각도 | 파일:행 | 요약 |
|---|---|---|---|
| L-1 | LOW | `appLogin.js:336-345` | `launchEchoes` 에 남은 지문이 **소비되지 않으면**(콜드 스타트에 launch 만 오고 retained open 은 안 오는 경우) 같은 페이지의 다음 사용자 취소(open, 같은 주소) 한 번이 무시된다. 화면에는 이미 같은 취소 문구가 떠 있어 체감은 작다. 제안: `launchEchoes` 에 짧은 수명(예: 3초)을 둔다 |
| L-2 | LOW | `appLogin.js:203-225` | `open()` 이 끝내 응답하지 않으면 `startInFlight` 가 앱 종료까지 true 로 남아 이후 모든 탭이 조용히 무시된다. `Browser.open` 은 보통 즉시 resolve 하므로 가능성 낮음. 제안: `open()` 에 제한 시간 또는 `lastOpenedAt` 방식의 만료 |
| L-3 | LOW | `appLogin.js:201` | 연 지 2초 안의 재탭은 아무 반응 없이 무시된다(피드백 없음). 개발자 기록 8-6 이 이미 인지. 수용 가능 |
| L-4 | LOW | `NativeAppHost.jsx:42-44`, `:63-69`, `:82-85` | (a) 주석이 아직 "LoginPage 가 초기 상태로 읽어 이미 렌더하므로"라고 적혀 H1 수정 이후 설명이 낡았다. (b) 1라운드 L1(토큰이 있을 때 open 실패 안내가 `console.warn` 으로만 남음)은 지시대로 미수정 — 도달 가능성 낮음 |
| L-5 | LOW | `appLogin.js:343-346` | sessionStorage 가 막힌 WebView 에서는 open→launch 이중 전달 시 지문이 없어 오류 안내가 두 번 나올 수 있다(드묾) |
| L-6 | LOW | 시험 공백 | `LoginRouteKey`·`NativeAppHost`·`useBackHandler`·`OAuthButtons` onClick·`attachHttpStatus` 연결에 저장소 시험이 없다 — QA 브라우저 재현 항목(아래). `attachHttpStatus` 는 axios 가 변환 함수의 3번째 인자로 상태를 준다는 가정에 기댄다(현재 1.16.0 에서 실측 확인, 메이저 업그레이드 때 재확인 필요) |

## 2-4. QA 에 넘길 high_risk_areas (브라우저 재현 우선순위)

가짜 `window.Capacitor` 주입(`page.addInitScript`): `isNativePlatform: () => true`, `Plugins.App.addListener(ev, cb)` 가 `window.__cap[ev]=cb` 를 저장하고 `Promise.resolve({remove(){}})` 반환, `getLaunchUrl: async () => null`(시나리오 S5 에선 주소 반환), `exitApp: async () => { window.__exited=(window.__exited||0)+1 }`, `Plugins.Browser.open: async (o) => (window.__opened||=[]).push(o.url)`, `close: async () => {}`. 백엔드 응답은 `page.route` 로 `/api/auth/app-exchange`·`/api/auth/me` 만 모의한다.

- **S1 시작·더블탭**: `/login` 에서 [Google로 계속하기] 클릭 → `__opened` 에 `https://climb.xn--lh0b87pnudm10a4vd.com/api/auth/app-start?provider=google&challenge=<43자>` 1건, localStorage `theroute_app_pkce` 에 `{verifier,provider,createdAt}`, `location` 은 그대로. 2초 안에 연타하면 `__opened` 가 늘지 않고 verifier 가 그대로. 웹(Capacitor 없음)에서는 같은 클릭이 **즉시** `/api/auth/google` 로 이동.
- **S2 취소 반복 (H1·H2 핵심)**: `/login` 에서 이메일 칸에 임의 글자를 입력한 뒤 `__cap.appUrlOpen({url:'theroute://auth/callback?error=oauth_failed&msg=access_denied'})` 발사 → "로그인을 취소했습니다." 가 오류 줄에 보이고 **입력 칸이 비워진다(재마운트 증거)**. 같은 발사를 3번 반복해도 매번 문구가 보이고 매번 입력이 비워진다. `/signup` 에서 시작해도 `/login` 에 문구가 보인다. `msg=server_error` 는 "로그인에 실패했습니다. 다시 시도해 주세요.".
- **S3 코드 딥링크**: `theroute_app_pkce` 를 심은 뒤 `…?code=<64hex>` 발사 + `app-exchange` 모의 — 200 → `theroute_token` 저장·`/` 이동·verifier 삭제, 같은 링크 재발사는 무반응; 401 → "로그인 시간이 지났습니다. 다시 로그인해 주세요."; `route.abort()` → "서버에 연결하지 못했습니다. 다시 로그인해 주세요."; 400 → "로그인에 실패했습니다. 다시 시도해 주세요."; verifier 없이 발사 → "로그인 시간이 지났습니다. …". `/api/auth/me` 실패 → "로그인에 실패했습니다. …" 이고 토큰 제거.
- **S4 웹 불변**: Capacitor 없는 브라우저에서 `/login` 이메일 로그인 실패 → 오류 줄 표시 + 입력한 값 유지(재마운트 없음); `/login?error=x` 직접 진입·`OAuthCallbackPage` 경유 진입 → 오류 줄 표시; `<html data-native>` 없음; 콘솔 오류 없음.
- **S5 콜드 스타트 이중 전달**: `getLaunchUrl` 이 오류 링크를 돌려주고 같은 링크를 `appUrlOpen` 으로도 발사 → 안내 1번. launch 만 오고 이후 사용자 취소(open)가 오는 경우(L-1)도 한 번 확인. 새로고침 뒤 옛 launch 오류가 다시 안내되지 않는가.
- **S6 뒤로가기(모달)**: 모달을 열고 `__cap.backButton({canGoBack:true})` → 모달만 닫히고 페이지는 그대로. 겹친 쌍(기록 수정→문제 사진, 세션 추가→영상 링크 선택)은 한 번에 자식만 닫힘. 모달 없음 + `canGoBack:false` → `__exited` 증가, `canGoBack:true` → `history.back()`. `TrainingPage` 분석 상세 시트도 닫힘. 팝오버(`RecordActionMenu`)·콤보박스가 열린 상태는 스택 밖이라 페이지가 뒤로 감(알려진 한계).
- **S7 실기기(사용자 폰)**: Custom Tab→딥링크→교환→홈 왕복, 앱 프로세스 종료 뒤 콜드 스타트 복귀, `Browser.close` 효과, 실제 `canGoBack` 값, 키보드 열림 시 입력칸 가운데 정렬.

## 2-5. 검토하지 못한 것

브라우저에서의 실제 렌더·재마운트(jsdom 없음, reviewer 는 기능 시험 금지), 실기기(Capacitor 7 원격 URL 앱의 `Plugins`/`getLaunchUrl`/콜드 스타트 이벤트 전달 순서), `vite build`(Leader 가 통과했다고 전달 — 직접 확인 못 함), 스트림 N·B 의 후속 패치(별도 reviewer 몫), Codex C2, 데모 승인 해석의 타당성 판단(기록만).

- [reviewer] 2라운드 판정은 conditional_pass 였고 3라운드에서 갱신한다(아래 "3라운드" 절, 유효한 최종 판정은 문서 맨 끝 줄).

---

# 3라운드 (23:1x~) — 소규모 패치(L-1·L-2·L-4·test 스크립트) 변경분 확인

대상: 개발자 기록 [[T009-stream-W]] §9. 변경분만 확인했고 1·2라운드 PASS 항목은 회귀 관점으로 `appLogin.js` 전체를 다시 읽어 훑었다. 코드 수정·git 조작 없음, 운영 요청 없음.

## 판정 (3라운드): CONDITIONAL_PASS — Critical 0 · High 0 · Medium 0 · 신규 Low 2

2라운드의 조건(H1 의 브라우저 재현은 QA 몫)은 그대로 남는다. 이번 패치는 L-1·L-2·L-4(a)를 해소했고 회귀는 못 찾았다.

## 3-0. 선결·실행

| 항목 | 결과 |
|---|---|
| 화면 파일 집합 | `git status -s -- web/src/pages web/src/components web/src/styles` = 13개(OAuthButtons + 모달 11 + TrainingPage), 2라운드와 같은 집합. `git diff --stat -- web/src` = 15 files +79/−2 (2라운드의 "16 files" 는 `web/index.html` 포함 수치이고 이 명령은 `web/src` 만 센다). 13개 파일의 mtime 은 모두 22:55:29 이전(2라운드 시점)이라 이번에 안 바뀜 |
| `web` 시험 | `nice -n 10 node --test 'web/test/*.test.js'` → **75/75 통과, 실패 0, 종료코드 0** |
| `backend` 시험 | `cd backend && nice -n 10 node --test test/*.test.js` → **63/63 통과, 실패 0, 종료코드 0** |
| package.json 두 개 | `git diff -- web/package.json backend/package.json web/package-lock.json backend/package-lock.json` = 두 package.json 에 `"test": "node --test test/*.test.js"` 한 줄 추가(앞 줄 끝 쉼표 포함)뿐. 의존성·버전·기존 스크립트 무변경, 두 `package-lock.json` 은 diff 없음. 운영 배포 스크립트(`~/.local/webhook-deploy/deploy-climb.sh`)는 `npm ci`·`npm run build` 만 쓰고 `npm test` 를 부르지 않아 배포 흐름은 안 바뀐다 |

## 3-1. L-2 (`appLogin.js:51-55, 108-122, 214-257`) — 해소

- 설계: 진행 중 표시를 `currentStart = {token, at}` 로 두고 `t - currentStart.at < START_INFLIGHT_MAX_MS(10초)` 를 **주입 시계 `now()`** 로 판정한다(`:225-227`). 타이머가 없어 정리할 것이 없다. 맞다.
- 해제 조건: ① 시작 종료 `finally { if (isCurrent()) currentStart = null }`(`:254-256`) ② 시작 실패 — 같은 `finally`, 그리고 `opened=false` 면 `clearPendingLogin`(`:252`) ③ 처리된 로그인 딥링크 `releaseStartGuard()`(`:395`, 진행 중 표시와 `lastOpenedAt` 둘 다 해제) ④ 10초 경과. 정상 흐름(연 직후 2초 보호 → 이후 새 시작)을 막지 않는다. 시험 `appLogin.test.js:532`(9.999초는 "처리 중", 10초부터 새로 엶), `:590`(실패 직후 재시도), `:576`(딥링크로 해제).
- 밀려난 옛 시작: `isCurrent()`(`:231`)가 `createPkcePair` 뒤(`:237,241`)와 `open()` 뒤(`:250`)에서 확인되고, 아니면 **상태·verifier 를 건드리지 않고 `true`** 를 돌려준다. 옛 시작이 늦게 실패해도 새 verifier 를 지우지 않고(`:253` 까지 가지 않음) 새 시작의 2초 보호(`lastOpenedAt`)도 그대로다. 시험 `:553` 이 새 verifier 유지·`true`·보호 유지를 단언한다. `true` 를 돌려주는 이유(옛 탭의 `OAuthButtons` 가 `false` 를 받으면 뒤늦게 `/api/auth/…` 웹 이동으로 폴백해 새 로그인을 깨뜨림)는 호출부 `if (isNativeApp() && await startAppLogin(...)) return;` 와 맞는다.
- "진짜 실패인데 true" 경로: 모두 이미 다른 흐름이 UI 를 쥐고 있다. (a) 10초에 밀려난 옛 시작 — 새 시작이 진행/완료. (b) 시작 도중 로그인 딥링크가 와서 `releaseStartGuard()` 가 불린 경우 — 사용자는 그 딥링크의 결과(알림·이동)를 본다. 다음 탭은 보호가 풀려 바로 시작된다. 사용자가 아무 반응도 못 보는 경로는 못 찾았다. 아래 L-7 은 (b)의 드문 경쟁 조건이다.

## 3-2. L-1 (`appLogin.js:350-386`) — 해소, H2 회귀 없음

- `launchEchoes` 가 Map(지문 → launch 처리 시각)이고 open 에서 `age >= 0 && age < LAUNCH_ECHO_TTL_MS(3초)` 일 때만 duplicate. 확인한 항목은 어느 쪽이든 지운다(`:379-380`). 3초 이후 open 은 사용자의 새 취소로 처리된다. 음의 경과(시계가 뒤로 감)도 "이중 전달 아님"으로 처리한다.
- H2 회귀 없음: launch 가 먼저 처리한 적이 없는 open 오류는 `launchEchoes` 에 없어서 매번 처리·알림·`closeExternal`(`:378-385`). 기존 시험(`:456` 3회 연속, `:466` 서버 오류 반복, `:473` launch→open, `:483` open→launch, `:490` 새로고침 뒤 launch)이 모두 통과(75/75). 새 시험 `:606`(정확히 3초 = 처리), `:615`(2.999초 = duplicate, 그 뒤 다음 취소는 처리).
- 콜드 스타트의 실제 이중 전달은 `onAuthDeepLink` 가 `addListener` 와 `getLaunchUrl()` 을 연달아 부르는 구조라 수십~수백 ms 안에 오므로 3초 창은 충분히 넉넉하다 [가능성 높음 — 실기기 미확인].

## 3-3. L-4 · test 스크립트

- `NativeAppHost.jsx`: 코드 줄 변경 없음. 파일이 142→145줄(주석 3줄 증가, 42-46행·82-84행)이다. 이전 판본이 git 에 없어(미추적 파일) 해시 비교는 못 했고, import·세 effect·`login`·`navigate`·`notify`·`onAuthDeepLink` 연결을 2라운드에 읽은 내용과 줄 단위로 눈으로 대조했다 — 코드 줄 차이를 못 찾았다. 줄 수 증가(+3)도 바뀐 주석 줄 수와 맞는다. 새 주석은 LoginRouteKey 의 현재 동작을 정확히 설명하고 1라운드 L1(만료 토큰 잔존 시 안내가 콘솔에만 남음)을 명시한다.
- `package.json` 두 개: 위 3-0 참조.

## 3-4. 시험 6건 평가

경계 단언이 실제로 있다: 10초 직전(9999ms)·정확히 10초(`:532`), 3초 정확히(처리)·2999ms(거름)(`:606,615`), 밀려난 시작이 늦게 실패(`:553`), 딥링크로 해제(`:576`), 실패 후 즉시 재시도(`:590`). 시험이 구현의 상수 `START_INFLIGHT_MAX_MS`·`LAUNCH_ECHO_TTL_MS` 를 import 해 경계를 계산하므로 상수 값이 바뀌어도 경계는 따라간다(상수의 값 자체는 의도적으로 못 박지 않음 — 허용). 빠진 시험: 시작 도중 로그인 딥링크가 오는 경쟁(L-7), 시계가 뒤로 가는 경우(L-8), `createPkcePair` 가 밀려난 뒤 실패하는 경로.

## 3-5. 회귀 훑기 (1·2라운드 PASS 항목)

`appLogin.js` 전체를 다시 읽었다. 변경 지점은 상수 2개(`:51-60`), 진행 중 상태(`:108-122`), `startAppLogin`(`:214-257`), `admit()`(`:361-386`), 핸들러의 `releaseStartGuard()` 호출(`:395`), `__resetAppLoginForTest`(`:442-445`)뿐이다. PKCE 생성·S256·보관·`takePendingVerifier`·TTL(`:72-188`), `buildAppStartUrl`, D4 문구 `MESSAGES`(`:63-68`, 네 문장 그대로), 교환 실패 분류(`toExchangeError`), 지문 저장·상한 20, 딥링크 처리 순서(교환 전 verifier 삭제)는 변경이 없다. `bridge.js`·`api/auth.js`·`main.jsx`·`LoginRouteKey.jsx` 의 mtime 은 2라운드(22:52) 그대로이고 W2 화면 파일은 위 3-0 에서 확인했다. 웹 불변·PKCE·딥링크·D4·W2 배선 PASS 항목에 회귀 없음.

## 3-6. 신규 이슈

| # | 심각도 | 파일:행 | 요약 |
|---|---|---|---|
| L-7 | LOW | `appLogin.js:118-122, 237, 241, 250` | `releaseStartGuard()` 가 `currentStart = null` 까지 하므로, 시작 도중(`createPkcePair`/`open()` 대기 중, 수 ms~수백 ms) 로그인 딥링크가 도착하면 그 시작은 "밀려난 것"으로 취급돼 `true` 만 돌려주고 Custom Tab 을 열지 않거나(`:241` 이전) `opened` 결과를 반영하지 않는다(`:250`). 사용자는 그 딥링크의 알림을 보고 다시 누르면 된다. 동시 도착 확률이 매우 낮다. 제안: "해제됨"과 "밀려남"을 구분하거나, 해제 시 진행 중인 시작을 그대로 두고 `lastOpenedAt` 만 푼다 |
| L-8 | LOW | `appLogin.js:226-227` | 경과 시간 `t - lastOpenedAt`·`t - currentStart.at` 이 음수(벽시계가 뒤로 감)면 `< START_GUARD_MS` 가 참이라 시계가 따라올 때까지 모든 탭이 조용히 무시된다(2라운드부터 있던 패턴, `admit()` 의 `age >= 0` 처리와 불일치). 제안: `elapsed >= 0 &&` 조건을 붙여 음수는 만료로 본다 |

남은 2라운드 Low: L-3(2초 안 재탭 무반응, 수용), L-4(b) (토큰 있을 때 open 실패 안내가 콘솔에만, 지시대로 미처리), L-5(sessionStorage 막힘 시 이중 알림), L-6(React 파일 무시험 — QA 브라우저 재현).

## 3-7. QA high_risk_areas 중 달라진 것

- **S1 더블탭**: 기존 시나리오에 추가 — (a) Browser.open 을 영영 resolve 하지 않게 모의(`open: () => new Promise(() => {})`)한 뒤 9초 후 탭은 무반응, 10초 이후 탭은 새 `__opened` 가 생겨야 한다. (b) 그 사이 `appUrlOpen` 딥링크를 발사하면 즉시 다음 탭이 열려야 한다. (c) `open` 이 즉시 true 를 돌려주는 정상 경로는 이전과 같다(연 지 2초 안 재탭 무시, 이후 새로 엶).
- **S5 콜드 스타트**: `getLaunchUrl` 이 오류 링크를 돌려주고 보관된 open 이 안 오는 경우 → 이후 사용자의 같은 취소(open)가 **3초 이후**면 알림이 나와야 하고(예전엔 한 번 삼켜졌음), 3초 안 이중 전달은 한 번만 나와야 한다. 3초 안에 사용자가 취소를 연속으로 하는 일은 현실적으로 불가능하다.
- 나머지 시나리오(S2·S3·S4·S6·S7)는 변경 없음.

## 3-8. 검토하지 못한 것

브라우저·실기기 재현, `npm test` 자체(같은 명령을 직접 실행 — npm 은 sh 로 glob 을 펼치므로 결과가 같다고 본다 [가능성 높음]), `vite build`, Codex C2.

- [reviewer] **최종 판정: CONDITIONAL_PASS (scope: web/src/native/appLogin.js, web/src/native/NativeAppHost.jsx, web/test/appLogin.test.js, web/package.json, backend/package.json; 이전 라운드 scope 의 나머지 파일은 무변경 확인)**

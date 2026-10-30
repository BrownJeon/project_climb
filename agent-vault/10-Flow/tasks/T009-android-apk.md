---
task_id: T009
title: 안드로이드 APK 앱 구현 (Capacitor 7 원격 URL 셸)
slug: android-apk
project: TheRoute
status: doing
roles_involved: leader, judge, designer, developer, reviewer, qa, deployer, codex
created: 2026-09-18
updated: 2026-10-30
base_ref: d727f22cdc1d470d0969858e73157c2d7c0007b0
risk_level: R2
waiting: push_confirm
worktree: /home/brownjeon/.node-local/theroute-app (branch mobile-app-t009)
aliases: ["APK", "안드로이드 앱", "Capacitor 셸"]
tags:
  - type/task
  - domain/mobile
  - domain/auth
  - domain/infra
demo_gate:
  required: true
  level: "delta"
  status: "approved"
  version: 1
  repo_path: "docs/demo/T009-android-apk-v1.html"
  artifact_url: "https://claude.ai/artifact/FWcZFXTnUiUGBASAUHswrS"
  content_sha256: "4d5e58e0e2a4d497ae983bb076849f83a4fedfeb136df5dfbc1be08e8f31b6ec"
  decided_by: "judge"
  rule_id: "DM-kw-risky-cta"
  approved_by: "user"
  approved_at: "2026-10-30T22:43:02+09:00"
  approval_quote: "권고대로 진행해줘"
  waived_by: ""
  waived_at: ""
  waiver_quote: ""
  active: true
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

(미착수 — 아래 "진행 보류" 참고)

### developer

(미착수)

### reviewer

(미착수)

### qa

(미착수)

## 진행 보류 (2026-09-18)

**설계와 구현 계획은 완료됐고, 구현 착수만 대기 중이다.**

사용자 판단: 현재 에이전트 팀 구조가 레거시라 최신 프로젝트 기준으로 **재개편할 예정**이며,
그 작업을 먼저 끝낸 뒤 새 구조로 이 계획을 실행한다.

재개 시 할 일:
1. `docs/superpowers/plans/2026-09-18-android-apk.md`를 Task 1부터 순서대로 실행
2. 계획서는 실행 주체에 의존하지 않는다(에이전트·역할 언급 0건) — 어떤 팀 구조로든 그대로 쓸 수 있다
3. 착수 전 재확인할 것: 운영 도메인 HTTPS 응답, `~/.node-local/android-sdk`·`~/.android/debug.keystore` 존재
   (2026-09-18 기준 모두 충족이었으나 시간이 지났으면 다시 본다)

## 재개 기록 (2026-10-30)

사용자 지시: "권고대로 진행해줘" (영향도 보고 직후). 권고 4건을 그대로 채택했다.

| # | 항목 | 09-18 계획 | 2026-10-30 결정 |
|---|---|---|---|
| 1 | 서명 키 | 공용 `debug.keystore` | **TheRoute 전용 키** + 백업 (StockInvest 방식, 경로만 문서화·값 미기록) |
| 2 | PKCE | 보류 | **포함** (S256, verifier 는 WebView 밖으로 안 나감) |
| 3 | APK 전달 | 직접 전달 | **직접 전달 유지** (DB 마이그레이션 없음) |
| 4 | push(=배포) | 정함 없음 | **Reviewer·QA 통과 후, 사용자 승인으로만** |

- 계획서 갱신: worktree 의 `docs/superpowers/plans/2026-10-30-android-apk-addendum.md` (09-18 계획서·스펙보다 우선).
- 작업 위치: 격리 worktree `~/.node-local/theroute-app` (브랜치 `mobile-app-t009`, base `d727f22`). 이유: NFS main 트리에 타 세션 미커밋 변경 18개 + 미push 1커밋이 있고, push 는 곧 운영 배포(webhook `project_climb`)다. **Vault 기록(이 파일 등)은 NFS 정본에만 쓴다 — worktree 사본은 수정하지 않는다.**
- 관련 승인 교훈(`/이슈기록 관련`): 없음 — 사용한 교훈 ID 없음.
- 정정: 09-18 의 "배포는 deploy.sh 로만"·deploy-order §1 "미해소 4건" 은 낡았다. 2026-10-30 실측: webhook 활성(`project_climb.log` 10-04 23:22 ↔ 릴리스 `20261004-232235-84456285` 일치), pm2 `theroute-api` online.

## 판단 기록 (judge)

- [2026-10-30 KST] intake engine=rules → task_type=null · risk=R2 · developer_model=opus · next=demo_first · demo=delta/designer(DM-kw-risky-cta) | overrides=R2-native,R2-auth,R2-kw-auth,MD-judge-failed-opus,DM-kw-risky-cta | fallback=budget_window_closed | tokens=0
  - 실행 주체: 메인 세션(Leader 겸임)이 도구를 직접 실행(입력은 기능 수준 요약 + 경로만, 코드·비밀·사용자 데이터 없음). 판정 JSON: scratchpad `judge-T009-intake.out.json`.
  - Leader 해석: 게이트가 막는 것은 화면 파일(`web/src/{pages,components,styles}/**`) 수정이다. **백엔드·네이티브 셸·`web/src/native/**`·`main.jsx`·`web/index.html` 은 게이트 밖이라 먼저 진행**하고, `OAuthButtons.jsx`·모달 12개 배선은 데모 승인 뒤로 미룬다. delta 데모 범위 = 앱 아이콘 · 연결 실패 안내(`app-shell`) · "앱으로 돌아가기" 폴백 페이지 · 앱 안 로그인 오류 문구.

- [2026-10-30 KST, 개정 문서 확정 직후] codex_gate/C1 engine=rules → codex_required=false (CX-limit-unknown-r2, 한도값 stale) | overrides=- | fallback=budget_window_closed | tokens=0
- [2026-10-30 23:17] codex_gate/C2 engine=rules → codex_required=true · mode=review · focus=none (CX-r2-post-review) · 호출 차수 1/4 | overrides=CX-r2-post-review | fallback=budget_window_closed | tokens=0
  - C2 입력 요약은 기능 수준(코드·비밀·사용자 데이터 없음). 판정 JSON: scratchpad `judge-T009-c2.out.json`. Codex 연계 스위치 on → codex 역할 호출(실행 위치: worktree, base_ref=HEAD=d727f22).

## Leader 기록

- [23:18] **Reviewer 최종 판정(라운드 요약)**: 스트림 B — 1라운드 CONDITIONAL_PASS(L-1~L-6, 차단 0) → 2라운드 CONDITIONAL_PASS(패치 결함 0, 시험 63/63 직접 실행). 스트림 W — 1라운드 **FAIL**(High 2: H1 `/login` 위 실패 안내 미표시·H2 같은 오류 딥링크 두 번째부터 무시) → 2라운드 CONDITIONAL_PASS(H1·H2 해소, 시험 69/69) → 3라운드 CONDITIONAL_PASS(소규모 패치 L-1·L-2·L-4 해소, 신규 Low 2 = L-7 시작 도중 딥링크 경쟁·L-8 시계 역행, 시험 75/75). 스트림 N — 1라운드 CONDITIONAL_PASS(M-1·M-2·M-3) → 2라운드 **PASS**(Low 5). 조건: W 의 H1(`/login` 위 안내가 실제로 보이는가)은 코드·라우터 소스로만 확인 — **QA 가 브라우저에서 재현**해야 하고 실패하면 High 로 되돌린다.
- [23:18] Leader 직접 확인: 웹 `vite build` 3회 성공(마지막 소규모 패치 반영본, CSS 해시 불변). 폴백 페이지·app-shell·앱 아이콘을 실제 렌더/이미지로 승인 데모와 대조 — 구조·규격·색 일치(폴백 간격 약 2px 차이는 INFO 로만 기록). 렌더용 임시 서버는 PID 로 종료, `/tmp/qa-artifacts` 에 만든 내 산출물은 이름 지정으로 삭제.
- [23:18] 수용한 Low(수정하지 않음): W L-7(시작 도중 딥링크 도착 시 그 시작이 "밀려남"으로 처리 — 확률 극소), W L-8(벽시계 역행 시 탭 일시 무시), N-1(`build-apk.sh` 부모만 종료하면 자식 빌드가 남음 — QA·사용자 안내에 "자식 프로세스 종료"), N-2·N-3·N-4, B L-3(nginx `limit_req` — 운영·sudo 후속)·L-4·L-5(`__Host-` 접두 선택). **사용자 결정 후보**: N-5 웹 `theme-color`(`#ff5a3c`)가 새 아이콘 주황(`#EE6438`)과 다름(주소창 색만, 승인 범위 밖이라 유지).
- [22:5x] 데모 v1 게시(Artifact 비공개 `https://claude.ai/artifact/FWcZFXTnUiUGBASAUHswrS`, 승인 정본은 저장소 파일 `docs/demo/T009-android-apk-v1.html`) → 게이트 `review_requested` v1. 승인 대기(사용자 결정 D1~D4).
- Leader 가 직접 한 수정 1건: designer 파일의 메타 `demo-version` 을 `T009-android-apk-v1` → `T009-v1` 로 고침(게이트 도구가 거부). 내용·디자인 변경 없음, v1 은 검토·승인 전이었음. 규칙상 `docs/demo/**` 는 designer 영역이라 여기 남긴다.
- 정정 발견(designer, Leader 직접 확인): 09-18 계획·스펙이 쓴 색 값(`base.css`)은 앱이 쓰지 않는 파일의 값이다. 실제는 `tokens.css`. 개정 문서 §5-1. `designer.md` 의 토큰 표에도 같은 오류가 있다(역할 파일이라 이번에 고치지 않음 — 후속).
- 검증(Leader 직접): worktree 웹 소스 `vite build` 성공(155 모듈, 종료 0, 임시 디렉터리에서 실행 — 기존 미러·NFS 불변). 이 서버 Node 는 v24 라 `node --test <디렉터리>` 가 실패한다 → 시험은 `test/*.test.js` 글로브로(백엔드·웹 두 스트림이 같은 확인).

- [22:43] **데모 v1 승인 기록.** 사용자 원문 "권고대로 진행해줘"(데모 검토 요청 직후, 승인 방법으로 안내한 "권고대로 승인" 계열). Leader 해석: **D1 B(홀드 3점 세로) · D2 B(창 배경 `#FFFFFF`) · D3 B(아이콘 주황 `#EE6438`) · D4 그대로(문구 3종)** 을 권고대로 승인. 해석이 틀리면 정정을 요청한다 — 되돌리기는 생성기 상수·리소스 값 교체와 APK 재빌드로 끝난다(네이티브 변경이라 재설치 1회 필요). `check.mjs approve` 통과(sha256 `4d5e58e0…b6ec`). 설계 가이드 `docs/web-design/T009-android-apk-guide.md` 에 승인 버전 기입.
- 이후 순서: ① 세 Reviewer(B·W·N) 감사 결과 수령 → ② 승인 데모 일치 패치(N: 아이콘 도안·색·app-shell / B: 폴백 페이지 / W: 오류 문구) + 스트림 W2(OAuthButtons·모달 배선) → ③ 변경분 재감사 → ④ QA → ⑤ 사용자 push 승인 → 배포 → APK 전달.

## Codex 검토

### [2026-10-30 14:18] C2 review focus=none — 완료(지적 1건)
- judge 판정: C2 judge 판정 JSON 은 scratchpad `judge-T009-c2.out.json`, 규칙 CX-r2-post-review / 호출 차수: 1/4
- 대상: repo=/home/brownjeon/.node-local/theroute-app base=d727f22(HEAD_fallback) snapshot=18e4ede
- 참고: base_source 가 HEAD_fallback 인 것은 정상이다. 모든 변경이 미커밋이라 검토 범위에서 빠진 것이 없다(인계 지시 기준).
- 지적 1건: [medium] `backend/src/routes/appAuth.js:64` — 형식이 잘못된 code 또는 verifier 가 `app-exchange` 에 들어올 때 `consume` 이 malformed 를 즉시 반환해 유효한 code 를 소각하지 않고(`appAuthCodes.js:132-133`), 핸들러는 다른 교환 실패와 달리 별도 400 본문으로 응답한다(`appAuth.js:65-71`). 테스트도 이 비소각·400 동작을 고정한다. 수용 기준 (2) "성공·실패와 무관하게 즉시 소각 / 모든 실패 동일 401 본문"과 반대다. 영향: malformed verifier 실패 시 유효 코드가 살아 남아 재교환될 수 있고, 응답으로 실패 원인을 구별할 수 있다. 권고: code 가 64자리 형식이면 verifier 검증 전에 조회·삭제하고, malformed 포함 모든 교환 실패를 동일 401 로 수렴. 400·비소각을 기대하는 테스트도 함께 바꾼다.
- 검토하지 못한 범위: 삭제된 RN Expo 파일 내용(인계 지시 따름), 바이너리 아이콘·Gradle wrapper JAR 내부, 실기기 OAuth 동작. 테스트·빌드·APK 생성은 실행하지 않음(상태 변경 금지 조건).
- 원본: /home/brownjeon/NFS/homes/brownjeon/project/.claude/state/codex-review/runs/20261030T141836Z-T009-C2/raw.txt
- 판정: 채택·기각은 Reviewer 몫. Codex 지적은 채택 판단 전까지 적용하지 않는다.
- **Reviewer 판정 (2026-10-30 23:3x, reviewer-b): 오탐 — 결함 아님.** 근거: ① 개정 §3-2 ④·09-18 스펙 §7 이 형식 오류는 400, 존재·불일치·만료·재사용은 같은 401 로 계약에 분리해 놓았고 구현이 그대로다 ② 형식이 틀린 verifier 4종을 살아 있는 코드/없는 코드로 핸들러에 직접 호출한 결과 응답이 동일(오라클 아님), 어느 필드가 틀렸는지도 알려 주지 않는다 ③ 형식이 맞는 시도는 코드당 1회로 고정되어 시도 횟수 이득이 없다 ④ Codex 안을 적용하면 클라이언트 형식 결함이 승인 문구 "로그인 시간이 지났습니다"로 안내돼 승인된 오류 분류(400→"로그인에 실패했습니다")와 어긋난다. 코드·시험 무변경. 적용한 것은 문서 한 문장 보강(개정 §3-2 ④, 스펙 §7)뿐이다.
- **Leader 기록 — 지적 경위와 판정의 독립성**: Codex 가 기준으로 쓴 "성공·실패와 무관 즉시 소각 / 모든 실패 동일 401" 은 Leader 가 인계 묶음에 요약한 수용 기준이며 계약 원문보다 엄격했다(요약 오류). 또 Reviewer-B 는 1라운드에서 이 선택을 "타당"으로 이미 판정한 당사자라 같은 사람이 자기 판정 관련 지적을 다룬 셈이다 — 이번에는 새 증거(핸들러 직접 호출 실증, Codex 인용 줄번호가 현재 파일과 다름 확인)로 결론을 다시 검증했고 Leader 가 근거를 읽고 동의했다. 사용자 이의가 있으면 변형 A(소각만 앞당김, W 코드 변경 없음)로 되돌릴 수 있다 — 보안 이득은 없다고 판정됨.
- 호출 차수 1/4 사용. 채택분이 없어 C2 재판정·재검토는 하지 않는다.

## QA·커밋·push 준비 (Leader)

- [23:41] **QA(qa-t009) 판정 PASS — 배포 전 로컬 범위.** 모델: qa.md 는 Haiku 이나 이번에는 **Sonnet** 으로 실행했다(브라우저 재현 시나리오 복잡도 + "QA 는 Sonnet 이 직접 실행·판정" 교훈). 실행 근거: 웹 75/75·백엔드 63/63(직접 실행) · 브라우저(Chromium, 가짜 `window.Capacitor`, `/api` 전부 모의·127.0.0.1 외 요청 abort) S1~S6·S8 PASS — **H1(`/login` 위 안내 재마운트) 재현 성공**(취소 3회 연속 매번 문구·입력 칸 비워짐, `/signup` 시작도 `/login` 에 문구) · 웹 불변(S4: 이메일 로그인 실패 시 입력값 유지, `data-native` 없음, 앱·웹 `/login` 스크린샷 3폭 바이트 일치) · PKCE(브라우저 안 SHA-256 = challenge) · APK 정적 검사 전부 PASS · 운영 호스트 요청 0건. 기록 `handoffs/T009-qa.md`.
- QA 결함: 없음(차단). 참고 L-1(LOW, **T009 무관 기존 동작**): TrainingPage 분석 상세 시트를 응답 전(로딩 중)에 닫으면 늦게 온 응답이 시트를 다시 연다(`openDetail` 이 `await` 뒤 취소 확인 없음 — 앱 뒤로가기·웹 닫기 모두 재현) → 개선 후속 후보.
- QA NOT_VERIFIED: 실기기(Custom Tab 왕복·SameSite 쿠키 체인·302 스킴 이동 허용·콜드 스타트 이벤트 순서·실제 `canGoBack`·키보드 API 35/34 이하·위치·카메라 권한·시작 화면·다크 모드·런처 마스크·테마 아이콘·app-shell 오프라인 재연결·덮어쓰기 설치), 운영 배포 후(`/health`·pm2·`app-start` 302·nginx 헤더 통과·표시 쿠키 없는 `/oauth/callback` SPA 응답·Google/GitHub 콜백·앱 PKCE 로그인 end-to-end).
- [23:41] **로컬 커밋 4개 — 브랜치 `mobile-app-t009`(worktree), base `d727f22`, 미merge·미push**: `198e6a6` feat(mobile) · `8c33daa` feat(auth) · `3d58134` feat(web) · `cc315f0` docs(T009). 파일을 명시해 stage(`git add -A` 미사용), 비밀·산출물 0건 확인, 화면 파일 변경은 모달 11개·TrainingPage 각 +2줄·OAuthButtons +9/−1뿐. 커밋 메시지 attribution `Claude Sonnet 5.5`.
- push 전 실측(읽기 전용): 원격 `main` = `8445628` = 현재 운영 릴리스 `20261004-232235-84456285`. 로컬 main `d727f22`(타 세션 docs 커밋 1개, 미push) 위에 브랜치가 선형 → **ff 병합 가능**. 브랜치 변경 110개와 메인 트리의 타 세션 미커밋 변경 34개 사이 **겹침 없음**. webhook 수신기 `deploy-climb.sh` = `release.sh deploy --ref main`(Gitea `project_climb`), 설치 `npm ci`(backend `--omit=dev`·web), 빌드 `cd web && npm run build`, 헬스 `/health` 120초, `--migrate` 없음(DB 변경 불가). 운영 `/health` 200(23:4x 1회 GET).
- **승인 전에는 main 에 합치지 않는다**(타 세션의 push 한 번에 미승인 코드가 배포되는 것 방지). 승인 시: main 에 ff 병합 → Vault·문서 커밋(파일 명시) → push 한 번(= webhook 배포) → 배포 후 검증 → APK 전달.

- [23:51] **사용자 push 승인**: 원문 "푸시 승인하니 진행해줘"(push 승인 요청 보고 직후). 해석: 보고에 적은 범위 전체 — main 에 ff 병합 → 문서 커밋 → push 한 번(webhook 배포) → 배포 후 읽기 전용 점검 → APK 전달. 결정 2(theme-color)에는 별도 답이 없어 **권고(그대로)** 로 진행. 롤백은 사용자 지시가 있을 때만(deploy-order §6) — 문제 시 권고만 드리고 지시를 기다린다. 승인 직후 main 은 `d727f22`(예상대로)였고 `git merge --ff-only mobile-app-t009` 로 `cc315f0` 까지 병합(origin/main 보다 5커밋 앞섬 = 타 세션 `d727f22` + 내 4커밋).
- Vault·문서 커밋 직전 비밀 스캔: 48자 hex 토큰 0건, 비밀번호 대입 문자열 2건은 `-storepass:env`(키 생성 방식 설명)일 뿐 값 아님. 커밋 대상: `CLAUDE.md`·`agent-vault/{00-Context/ACTIVE.md, 10-Flow/board.md, 10-Flow/tasks/T009-android-apk.md, 10-Flow/handoffs/T009-*.md(8), 20-Log/2026-10-30.md}`·`docs/demo/T009-android-apk-v1.html`·`docs/web-design/T009-android-apk-guide.md`(파일 명시, 타 세션 변경 제외).

## 최종 요약

(미작성 — 모든 역할 종료 후 Leader 가 작성)

## 관련 이력

- [[T004-auth-flow]] · 웹 인증 플로우(이메일/비밀번호 + OAuth) — 이 작업이 확장하는 기반
- [[T005-remove-kakao-login]] · 카카오 로그인 제거 — provider가 google·github 2종인 이유
- [[board]] · 칸반

## 데모 검토 (demo gate)

> 실행 판정 정본은 frontmatter `demo_gate` 이다. 이 표는 check.mjs 가 함께 기록하는 사람용 이력이다(docs/demo-review-gate.md).

| 버전 | 상태 | 저장소 파일 | Artifact | 사용자 결정 | 일시 |
|---|---|---|---|---|---|
| - | 작성중 | - | - | judge: delta (DM-kw-risky-cta) | 10-30 22:21 |
| v1 | 검토요청 | docs/demo/T009-android-apk-v1.html | https://claude.ai/artifact/FWcZFXTnUiUGBASAUHswrS | 사용자 검토 요청 | 10-30 22:40 |
| v1 | 승인 | docs/demo/T009-android-apk-v1.html | https://claude.ai/artifact/FWcZFXTnUiUGBASAUHswrS | "권고대로 진행해줘" | 10-30 22:43 |

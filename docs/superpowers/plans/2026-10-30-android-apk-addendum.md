# TheRoute Android APK — 구현 개정 (2026-10-30)

> **이 문서가 [2026-09-18 계획서](2026-09-18-android-apk.md)·[스펙](../specs/2026-09-18-android-apk-design.md)보다 우선한다.** 충돌하면 이 문서를 따른다. 여기 없는 것은 09-18 계획서 그대로다.
> 정본 task: `agent-vault/10-Flow/tasks/T009-android-apk.md` (NFS 정본 — worktree 사본은 읽기만).
> 승인: 사용자 2026-10-30 "권고대로 진행해줘" (서명 키·PKCE·직접 전달·push 승인 게이트 4건).

## 0. 왜 개정하는가

09-18 계획 이후 StockInvest 앱(2026-10-26, T-088)에서 발견·수정된 결함과 보강을 반영한다. 참고 구현(읽기 전용): `StockInvest/scripts/build-apk.sh`, `StockInvest/android/app/build.gradle`, `StockInvest/src/lib/auth/oauth/{pkce,app-flow}.ts`, `StockInvest/src/lib/native/appLogin.ts`, `StockInvest/docs/mobile-app-procedure.md`.

## 1. 결정 4건 (사용자 승인)

| # | 09-18 계획 | 변경 |
|---|---|---|
| 1 | 공용 `~/.android/debug.keystore`, `assembleDebug` | **TheRoute 전용 서명 키, `assembleRelease`** (§2) |
| 2 | PKCE 보류 | **PKCE(S256) 포함** (§3) |
| 3 | APK 직접 전달 | 유지. DB 테이블·마이그레이션·`/app/download` 없음 |
| 4 | push 시점 미정 | **Reviewer·QA 통과 + 사용자 승인 전에는 push 하지 않는다.** push 는 곧 운영 배포(webhook `project_climb`)다 |

## 2. 서명 키·빌드 스크립트 (스트림 N)

### 2-1. 전용 키 생성 (없을 때만 — 있으면 덮어쓰지 말고 멈춰서 Leader 에게 보고)

- 키스토어 `~/.android/theroute-release.keystore`, 서명 설정 `~/.android/theroute-signing.env`. 둘 다 권한 **600**. 저장소 밖.
- `keytool -genkeypair` RSA 2048 이상, 유효기간 10000일 이상, alias `theroute`, DN 은 `CN=TheRoute, O=miraclepenguin`. 비밀번호는 `openssl rand` 로 24자 이상 무작위 생성해 env 파일에만 쓴다.
- 🔴 **비밀번호·키 값을 stdout·로그·task 파일·문서·커밋 어디에도 출력하지 않는다.** 보고에는 파일 경로와 **공개 정보인 인증서 SHA-256 지문**만 쓴다.
- 백업: `/home/brownjeon/NFS/homes/brownjeon/backup/android-signing/theroute/` (디렉터리 700, 파일 600)에 키스토어와 env 를 복사한다. 이 키를 잃으면 덮어쓰기 설치가 막힌다.
- `build-apk.sh` 는 StockInvest 방식으로 ① env 파일 권한 600 확인 ② 서명 후 인증서 지문이 기대값(`mobile/scripts/expected-cert-sha256.txt`, 공개값 한 줄)과 다르면 실패 ③ 디버그 키로 서명하지 않는다.
- `.gitignore` 에 `*.keystore`·`*.jks`·`*signing.env`·`mobile/android/**/build/`·`mobile/android/.gradle/`·`mobile/android/local.properties`·`mobile/android/app/release/` 를 추가한다.

### 2-2. StockInvest 에서 이식할 보강 2건 (09-18 계획에 없음)

1. **`gradlew` 실행 비트**: TheRoute 는 2026-09-19 커밋 `ffe77f3` 으로 실행 비트를 일괄 제거했고 NFS 는 `core.fileMode=false`·noexec 라 신선한 clone 의 첫 빌드가 rc 126 으로 실패한다. 작업 디렉터리에 동기화한 뒤 `chmod +x "$WORK/android/gradlew"` 를 `build-apk.sh` 가 직접 한다.
2. **옛 빌드 캐시**: 네이티브 소스(`android/**`·`capacitor.config.ts`·app-shell) 해시가 바뀌면 `$WORK/android/app/build`·`$WORK/android/build` 를 지우고 빌드한다(AAPT "resource not found" 방지). 해시 파일 방식은 StockInvest `build-apk.sh` 의 `.native-src-hash` 를 따른다. `rm -rf` 는 경로 검증(빈 값·`/`·`$HOME`·프로젝트 루트 거부) 뒤 리터럴 경로로만 쓴다.

### 2-3. 버전·경로

- `android/app/build.gradle` 에 `routeVersionCode = 1`, `routeVersionName = "1.0.0"`. versionCode 는 줄어들면 안 된다.
- 작업 디렉터리 기본값 `~/.node-local/theroute-mobile`, 환경변수 `THEROUTE_APK_WORK` 로 덮어쓸 수 있다. `PROJECT_ROOT` 는 **스크립트 위치에서 계산**한다(NFS 정본에서도, worktree 에서도 같은 스크립트가 돈다).
- 산출 APK 는 `…/outputs/apk/release/` 아래. 09-18 스펙 §13 정적 검사의 `CN=Android Debug` 기대값은 **전용 키의 DN 과 지문**으로 바꾼다.

### 2-4. 서버 부하 규칙 (2026-10-28 사고 교훈)

이 서버는 운영 호스트다. 병렬 시험 부하로 서버가 멈춘 전례가 있다.
- gradle·`npm ci`·`cap sync` 는 **스트림 N 만** 실행한다. 형식: `nice -n 10 flock /tmp/theroute-heavy.lock <명령>`, gradle 은 `--no-daemon --max-workers=2`, 출력은 로그 파일로(파이프로 자르지 않는다).
- 나머지 스트림은 `node --test` 순수 시험만 돌린다. `vite build`·`npm ci` 는 하지 않는다(필요하면 Leader 에게 요청).
- 프로세스 종료가 필요하면 `pkill -f` 금지, PID 로.
- 🔴 **`build-apk.sh` 는 스스로 위 잠금(`nice -n 10 flock /tmp/theroute-heavy.lock`)을 잡는다.** 바깥에서 같은 잠금으로 또 감싸면 서로 막혀 교착한다(Reviewer-N M-2). 감싸야 할 때는 `THEROUTE_HEAVY_LOCK_HELD=1` 을 함께 준다. `gradlew` 를 직접 부를 때는 이 스크립트를 거치지 않으므로 위 형식을 직접 쓴다.

## 3. 앱 로그인 PKCE 계약 (스트림 B ↔ W 공통)

Custom Tab 로그인 결과는 커스텀 스킴 딥링크로 돌아온다. 다른 앱도 `theroute://` 를 등록할 수 있으므로 코드만으로는 가로채기를 막지 못한다. **verifier 는 앱 WebView 밖으로 나가지 않고, 서버는 challenge 만 안다.**

### 3-1. 형식

| 항목 | 규칙 |
|---|---|
| verifier | 32바이트 무작위의 base64url, 패딩 없음 = 정확히 43자. 정규식 `^[A-Za-z0-9_-]{43}$` |
| challenge | `base64url(SHA-256(ascii(verifier)))` = 43자. 같은 정규식 |
| code | `^[0-9a-f]{64}$` (09-18 계획 그대로, 32바이트 hex) |
| 검증 벡터 (RFC 7636 부록 B) | verifier `dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk` → challenge `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM` — **양쪽 시험에 반드시 포함** |

### 3-2. 흐름

1. 앱 WebView 가 `startAppLogin(provider)` (`web/src/native/appLogin.js`) 에서 verifier·challenge 를 만든다(`crypto.getRandomValues`, `crypto.subtle.digest`). verifier 는 **WebView localStorage 키 `theroute_app_pkce`** 에 `{verifier, provider, createdAt}` 로 저장한다(Custom Tab 이 떠 있는 동안 안드로이드가 앱 프로세스를 죽여도 남아야 하므로 sessionStorage 가 아니다). TTL 10분, 교환 시도 때 **성공·실패 무관하게 지운다**.
2. `GET /api/auth/app-start?provider=google|github&challenge=<43자>[&fallback=1]` — provider 화이트리스트, challenge 정규식 검사. 실패는 400 `{success:false,data:null,message}`. 통과하면 표시 쿠키 `route_app_login` 에 **challenge 를 싣고**(fallback 이면 그 표시도, 인코딩 방식은 자유이나 엄격 파싱, 형식이 다르면 "앱 로그인이 아님"으로 보고 `next()`) 302 `/api/auth/<provider>`. 쿠키 속성 HttpOnly·Secure·SameSite=Lax·path `/`·10분은 09-18 스펙 그대로.
3. 콜백 가로채기(`appOAuthCallback.js`)는 유효 JWT 를 받으면 `appAuthCodes.issue({ token, challenge })` 로 코드를 만들어 `theroute://auth/callback?code=<64hex>` 로 302 한다. 오류는 `?error=…&msg=…` (09-18 스펙 그대로). **challenge 가 쿠키에서 읽히지 않으면 코드를 발급하지 않고 오류 딥링크로 보낸다.**
4. 앱이 `POST /api/auth/app-exchange` 에 `{ code, verifier }` 를 JSON 으로 보낸다.
   - 형식 오류(code 64hex 아님, verifier 43자 아님) → 400. **형식 오류는 비밀과 무관하므로 코드를 태우지 않는다**(저장소 조회보다 앞서 반환 — 코드 존재 여부를 구별할 수 없고, 어느 필드가 틀렸는지도 알려 주지 않는다). **형식이 맞는 시도는 결과와 무관하게 한 번에 소각**하며, 존재·불일치·만료·재사용은 구별 불가한 같은 401 이다. (2026-10-30 Codex C2 지적 "형식 오류도 소각·401" 은 이 계약을 기준으로 Reviewer 가 오탐 판정 — handoffs/T009-reviewer-B.md "Codex C2 판정".)
   - `consume(code)` 는 **맞든 틀리든 만료됐든 그 자리에서 항목을 지운다**(1회용). 그 다음 `S256(verifier)` 와 저장된 challenge 를 `crypto.timingSafeEqual` 로 비교한다. 불일치·만료·미지의 코드·재사용은 **모두 같은 401 본문**(원인을 구별해 알려주지 않는다).
   - 성공 200 `{ success:true, data:{ token }, message }`, `Cache-Control: no-store`.
5. `appExchange(code, verifier)` (`web/src/api/auth.js`) 는 `r.data.token` 을 돌려준다 — 인터셉터가 이미 한 겹 벗기므로 `r.data.data` 금지.

### 3-3. 시험 (필수)

- `appAuthCodes`: 발급→교환 성공 / 재사용 401 / 만료 401 / **verifier 불일치 401 + 항목 소각(같은 코드로 올바른 verifier 를 다시 보내도 401)** / 형식 오류 400 / 상한(500) 초과 시 오래된 것 폐기 / RFC 벡터.
- `appLogin`(웹): verifier 형식·RFC 벡터 / 저장·TTL 만료·성공 실패 모두에서 삭제 / 09-18 계획의 기존 케이스(정상·중복 코드 무시·launch 출처 silent·open 출처 알림·오류 딥링크).
- 백엔드 회귀: **표시 쿠키 없이** `/oauth/callback?token=…` 과 `/login` 을 부르면 핸들러가 `next()` 로 흘러 웹 로그인이 변하지 않는다.

## 4. 작업 스트림과 파일 경계

데모 검토 게이트(`delta`, 상태 `drafting`)가 열려 있다. 게이트가 막는 것은 **화면 파일 `web/src/{pages,components,styles}/**` 수정**이다. 아래 경계를 지킨다.

| 스트림 | 범위 | 담당 파일 | 상태 |
|---|---|---|---|
| **N** 네이티브 셸 | 09-18 Task 1·2·3 + §2 | `mobile/**`(RN Expo 삭제는 `git rm`), `web/public/**`(파비콘), `web/index.html`(파비콘 링크만), `.gitignore`, `docs/mobile-*`(필요 시) | 즉시 |
| **B** 백엔드 | 09-18 Task 4·5·6 + §3 | `backend/src/services/appAuthCodes.js`, `backend/src/routes/{appAuth,appOAuthCallback}.js`, `backend/src/routes/auth.js`(마운트만), `backend/src/index.js`(마운트 한 줄), `backend/test/**` | 즉시 |
| **W** 웹 순수 모듈 | 09-18 Task 7·8·9 + §3 + Task 10 중 화면 밖 | `web/src/native/**`(NativeAppHost 포함), `web/src/api/auth.js`(`appExchange` 추가), `web/src/main.jsx`(마운트), `web/test/**` | 즉시 |
| **W2** 화면 배선 | Task 10 의 `OAuthButtons.jsx`, Task 9 의 모달 `useBackHandler` 연결 | `web/src/components/OAuthButtons.jsx`, `web/src/components/modals/*.jsx` | **데모 승인 + Leader 의 `activate` 뒤** |

- 한 스트림은 자기 파일만 수정한다. 다른 스트림의 파일이 필요하면 Leader 에게 요청한다.
- **눈에 보이는 산출물(앱 아이콘 도안·`app-shell/index.html`·백엔드 "앱으로 돌아가기" 폴백 페이지)** 은 09-18 계획의 기본안으로 먼저 만들고, 승인된 데모(`docs/demo/T009-android-apk-v<N>.html`)와 다르면 승인본에 맞춰 고친다. 아이콘은 생성기 단일 진실이라 재생성만 하면 된다.
- 에이전트는 **커밋하지 않는다**(`git add`·`commit`·`push` 금지). 변경은 worktree 작업 트리에 남기고, Leader 가 파일을 명시해 커밋한다.

## 5. 환경

- 작업 위치: `/home/brownjeon/.node-local/theroute-app` (ext4 worktree, 브랜치 `mobile-app-t009`). **NFS 의 main 트리·`.worktrees/feature-problem-review` 는 건드리지 않는다.**
- 이 worktree 에는 `node_modules` 가 없다. 백엔드 시험은 `backend/node_modules` → NFS 정본 `backend/node_modules` 심볼릭 링크로 돌린다(스트림 B 가 만들고, `.gitignore` 의 `node_modules/` 가 이미 제외한다). `web` 순수 모듈 시험은 의존성이 필요 없다.
- 시험: `node --test <디렉터리>/` (Node 20). 웹 모듈은 상대 import 에 `.js` 확장자를 쓴다.
- 기록: 각 스트림은 `/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/agent-vault/10-Flow/handoffs/T009-stream-<N|B|W>.md` 에 무엇을·왜·어디를·Reviewer 가 볼 곳을 쓴다(task 파일은 Leader 가 합친다).
- 커밋 메시지 규칙은 Leader 몫이다(에이전트는 커밋하지 않으므로 09-18 계획의 `Co-Authored-By` 지시는 무시한다).

## 5-1. 색 값 정정 (2026-10-30, designer 발견·Leader 확인)

09-18 계획서·스펙·`designer.md` 토큰 표가 근거로 삼은 `web/src/styles/base.css`(`#fafafa`·`#ff5a3c`·`#1a1a1a`·`#6b7280`)는 **어디서도 import 되지 않는다**(`web/src/main.jsx` 는 `tokens.css`·`app.css` 만 읽는다). 실제 값: `--bg #f6f5f3` · `--surface #ffffff` · `--ink-1 #131313` · `--ink-3 #6b6b68` · `--primary oklch(67% 0.18 38)`(sRGB 약 `#ee6438`).
- 아래는 **사용자 데모 결정(D1~D4)이 나온 뒤에 확정**한다: 아이콘 배경 주황(D3), `theroute_colors.xml`·`styles.xml` 창 배경색(D2), 아이콘 도안(D1), 새 문구(D4). 확정 전까지 스트림 N 의 값은 임시다.
- 스펙 §11 의 "홀드 3점" 과 계획서 생성기 `HOLDS`(4점)의 불일치는 D1 결정으로 해소된다.
- 데모 게이트 `demo-version` 메타는 `T009-v1` 형식(작업 ID 기준)이다.

## 6. 완료 정의 (09-18 §15 대체)

1. `build-apk.sh` 가 **전용 키로 서명된 release APK** 를 만들고, 인증서 지문이 기대값과 일치한다.
2. 정적 검사(`aapt2 dump badging`·manifest xmltree·아이콘 3레이어·`apksigner verify`·`capacitor.config.json`)가 기대값과 일치한다.
3. 순수 모듈 시험(§3-3)이 전부 통과한다.
4. 표시 쿠키 없는 웹 로그인이 변하지 않았음이 확인된다.
5. Reviewer PASS → Codex C2(판정 시) → QA PASS → **사용자 push 승인** → 배포 → APK 전달 → 사용자 실기기 7항목(09-18 스펙 §13)·**PKCE 로그인 성공** 회신.

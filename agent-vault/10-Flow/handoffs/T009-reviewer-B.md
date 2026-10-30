---
task: T009
stream: B
role: reviewer
date: 2026-10-30
verdict: CONDITIONAL_PASS
tags: [type/handoff, domain/auth, domain/mobile]
---

# T009 스트림 B 독립 감사 — 앱 로그인 백엔드 (PKCE S256)

대상: `/home/brownjeon/.node-local/theroute-app` (브랜치 `mobile-app-t009`, 미커밋) · 개발자 기록 [[T009-stream-B]] · 의도 `docs/superpowers/plans/2026-10-30-android-apk-addendum.md` §3 · 설계 `specs/2026-09-18-android-apk-design.md` §7·§14.
코드는 수정하지 않았다(읽기·시험 실행·읽기 전용 소규모 node 확인만).

## 판정: CONDITIONAL_PASS (Critical 0 / High 0 / Medium 0 / Low 6)

의도(개정 §3 계약)와 구현이 일치하고, 인증 분기·PKCE·주입·쿠키·로그·규약 항목에서 차단 결함은 없다. 아래 LOW 는 QA 인계를 막지 않는다. 가장 먼저 고칠 것은 L-1(허울뿐인 시험).

## 직접 실행한 검증

| 명령 | 결과 |
|---|---|
| `cd backend && nice -n 10 node --test test/*.test.js` | tests 59 · pass 59 · fail 0 · cancelled 0 · skipped 0 · **종료 코드 0** (≈0.71초) |
| `git diff -- backend/src` | 변경은 `index.js` +5줄, `routes/auth.js` +9줄뿐. SPA 정규식 줄은 diff 에 없음(무변경) |
| 읽기 전용 확인 ① | Express 4.22.1 실제 `Set-Cookie`: 설정 `route_app_login=n.<43자>; Max-Age=600; Path=/; Expires=…; HttpOnly; Secure; SameSite=Lax` / 삭제 `route_app_login=; Path=/; Expires=Thu, 01 Jan 1970…; HttpOnly; Secure; SameSite=Lax` |
| 읽기 전용 확인 ② | Express 라우트는 `/login/`·`/Login`·`/OAuth/Callback` 도 매칭하지만 핸들러의 `req.path === …` 엄격 비교 때문에 전부 `next()` 로 빠진다(안전하게 웹 흐름 유지) |
| 읽기 전용 확인 ③ | 운영·로컬 `.env` 의 `FRONTEND_URL`·`OAUTH_CALLBACK_BASE` 호스트 = `https://climb.xn--lh0b87pnudm10a4vd.com`(호스트 외 값은 출력하지 않음) → 호스트 전용 쿠키가 콜백 호스트와 같다 |
| `ecosystem.config.js` | `instances: 1`, `exec_mode: 'fork'` → 메모리 Map 저장소 전제(단일 프로세스) 성립 |

## 항목별 판정

### 1. 인증 분기 — PASS
- 웹 로그인 불변: `appOAuthCallback.js:100` GET 아니면 `next()` → `:102-106` 경로가 `/oauth/callback` 또는 `/login`+`error` 아니면 `next()` → `:108-109` `parseAppLoginCookie(readCookie(…))` 실패면 `next()`. **`:113` `clearAppLoginCookie`·`:114-115` 헤더 설정보다 앞**이다. 시험 `appOAuthCallback.test.js:48-54 assertUntouched` 가 `redirected/body/cleared/headers` 전부 비어 있음을 확인한다.
- `?error=` 없는 일반 `/login`: `:105 isLoginError = path==='/login' && errorParam!==''` → 가로채지 않음. 시험 `:92-95`(쿠키가 있어도 `next()`).
- 유효 쿠키면 성공·실패 무관 즉시 삭제: `:113` 이 분기(`:117-144`) 전에 실행된다. 폴백(`:146-150`)·302(`:151`) 모두 그 뒤.
- `Cache-Control: no-store`·`Referrer-Policy: no-referrer`: 콜백 `:114-115`, app-start `appAuth.js:37,46`, exchange `appAuth.js:62`. ✔
- POST·HEAD 등은 `:100` 에서 통과. 시험 `:86-90`.
- 한계(문서화됨): 쿠키는 `/oauth/callback`·`/login?error=` 에서만 지워진다 → L-4.

### 2. PKCE / 1회용 코드 — PASS
- `consume` 순서(`appAuthCodes.js:101-112`): 형식(code `:102`, verifier `:103`) → S256 계산 `:105` → `get` `:106` → **`delete` `:107`** → 미지 `:108` → 만료 `:109` → `timingSafeEqual` `:110`. 개정 §3-2 ④ 와 같다. 단일 스레드 동기 함수라 이중 사용 경합 없음.
- `safeEqualAscii`(`:53-58`): 길이 다르면 `false` 로 선반환 → 예외(500) 경로 없음. 두 입력 모두 정규식(43자)을 통과한 값이라 실제로는 항상 같은 길이.
- 실패 응답 단일화: `appAuth.js:68-72` malformed 외 모든 실패가 `EXCHANGE_INVALID_MESSAGE` 401 한 문구. 원인 구분(`unknown|expired|mismatch`)은 서버 로그(`:70`)에만. 시험 `appAuth.test.js:106-140`, `appAuthHttp.test.js:114-127`(본문 deepEqual).
- 미지 코드 비교 비용: S256 해시는 형식 통과 시 항상 먼저 계산(`:105`)된다. 다만 `timingSafeEqual`(수백 ns)은 항목이 있을 때만 돈다 → 이론상 차이는 있으나 코드 공간 2^256 이라 존재 여부를 열거할 수 없고, challenge 는 공개값이라 이 비교의 타이밍은 비밀을 새지 않는다. 실질 영향 없음.
- 상한 500·sweep: `:70-75`, `:85-87`. 발급 때만 sweep(소비 쪽은 지우므로 잔존은 상한 500 이하). 시험 `appAuthCodes.test.js:125-155`. 재시작 손실은 설계상 허용(단일 fork 프로세스 확인).
- 코드 충돌: `randomBytes(32)` 256bit, `Map.set` 덮어쓰기 확률 무시 가능.
- **「형식 오류 400 은 코드를 태우지 않는다」 득실(관점 7)**: 득 — 클라이언트 버그·잘린 verifier·저장소 소실(verifier `undefined`)로 정상 코드가 소각되지 않고 앱이 오류 문구를 보여 줄 수 있다. 실 — 공격자가 얻는 정보가 없다. 400 은 「코드 모양이 틀림」(공개 형식)만 알려 주고, 모양이 맞는 시도는 전부 소각되므로 추측 공격은 1회로 끝난다. 400/401 구분은 오라클이 아니다. **타당한 선택**. 단 W 가 이미 교환 전에 verifier 를 지우므로(`appLogin.js` takePendingVerifier) 400 후 재시도는 어차피 불가 — 이득은 서버 쪽 정리뿐이다.
- 부수 관찰: 소각 정책상 코드를 가로챈 쪽이 틀린 verifier 로 한 번 두드리면 정당한 앱 교환이 401 이 된다. 그러나 코드를 가로챌 수 있는 쪽은 애초에 앱 수신을 막을 수 있으므로 새로운 위험이 아니다.

### 3. 오픈 리다이렉트 / 주입 — PASS
- 딥링크 조립 `buildAppDeepLink`(`appAuthCodes.js:118-124`)는 `URLSearchParams` 로 인코딩 → `error`·`msg` 가 `&`·`#`·공백으로 스킴·쿼리를 깨뜨릴 수 없다(시험 `appOAuthCallback.test.js:172-184`, `x=1` 주입 불가 확인).
- `error` 는 `[A-Za-z0-9_]{1,64}` 만(`appOAuthCallback.js:44,141`), 그 밖은 `oauth_failed`. `msg` 는 제어문자 제거·100자(`:62-65`).
- 폴백 HTML: `renderFallbackPage`(`:76-91`)의 `href`·`msg` 모두 `escapeHtml`(`:46-53`), 딥링크는 항상 고정 접두 `theroute://auth/callback?` 로 시작 → `javascript:` 스킴 불가. CSP `default-src 'none'; style-src 'unsafe-inline'`(`:73,148`)로 스크립트도 차단. 시험 `:207-224`.
- `app-start`: provider 화이트리스트 `APP_AUTH_PROVIDERS`(`appAuth.js:39`), 리다이렉트 대상은 `/api/auth/${provider}` 로 화이트리스트 값만 → 오픈 리다이렉트 없음. `fallback` 은 `=== '1'` 일 때만(`:45`), 배열·`true` 는 일반 모드(시험 `appAuth.test.js:55-63`).
- 참고: 공용 어댑터가 보내는 `msg` 에는 제공자 오류 문구(`HTTP 401 from … 본문 200자` 등)가 실릴 수 있다. 토큰류는 아니고 웹 `/login?msg=` 에도 이미 실리던 값이다(어댑터 `express.js:122`, `exchange.js:41`).

### 4. 쿠키 — PASS
- 속성 `appAuthCodes.js:167,170-175`: HttpOnly·Secure·SameSite=Lax·Path=/·Max-Age=600(실제 헤더 확인, 위 표). 삭제 `:177-179` 는 같은 옵션 객체를 재사용 → 같은 Path·속성. (삭제 헤더의 HttpOnly/Secure/SameSite 는 시험이 단언하지 않음 → L-2)
- challenge 를 쿠키에 싣는 설계: 가정 맞음. PKCE S256 의 challenge 는 표준 OAuth 에서도 인가 요청 URL(전면 채널)에 그대로 실리는 공개값이고, 안전성은 verifier(256bit, WebView 밖으로 안 나감)와 SHA-256 역상 저항에 있다. `app-start` URL 쿼리·nginx 로그에도 같은 값이 남지만 문제 없다. HttpOnly 라 JS 가 못 읽는 것은 보너스.
- 쿠키 값 엄격 정규식 `^([nf])\.([A-Za-z0-9_-]{43})$`(`:151`) — 옛 값 `1`·`fallback` 은 앱 로그인이 아님으로 처리(시험 `appAuthCodes.test.js:170-181`).

### 5. 로그 — PASS (시험 증빙에 L-1 있음)
- 로그 줄: `appOAuthCallback.js:126,133,136,143`, `appAuth.js:70`. 전부 고정 문구 또는 `e.message`(고정 문구 `'valid PKCE challenge required'`·`'token required'`) — code·JWT·verifier·challenge 원문 없음. `jwt.verify` 예외 객체는 로그에 쓰지 않는다.
- `errorHandler.js` 는 로그를 남기지 않는다(JSON 본문 파싱 오류의 `err.message` 는 호출자 자신의 입력을 응답으로 되돌릴 뿐).
- `morgan('dev')` 는 `NODE_ENV=development` 에서만 켜지고(`index.js:21`) 운영은 production(`ecosystem.config.js`).
- 이전부터의 사항(범위 밖): 공용 어댑터가 `…/oauth/callback?token=<JWT 30일>` 로 보내므로 nginx 접근 로그·Custom Tab 기록에 JWT 가 남는다. 웹 로그인과 동일한 기존 노출이며 이번 변경이 악화시키지 않는다(딥링크에는 JWT 없음). 공용 패키지 수정 금지 제약상 이번 범위에서 줄일 수 없다.

### 6. 프로젝트 규약 — PASS
- 응답 형식: `appAuth.js:22-27` `{success,data,message}`. app-start 성공(302)·폴백(HTML)은 JSON 이 아니지만 용도상 정당.
- JWT 시크릿: `appOAuthCallback.js:41` `process.env.JWT_SECRET || 'theroute-dev-secret'` = `routes/auth.js:7`·`authController.js:5` 와 같은 표현. 모듈 로드 시 평가되며 `index.js` 의 `dotenv.config()`(`:2`) 이후 `require` 되므로 순서 문제 없음.
- 빈 `catch {}` 없음: `readCookie` 의 `catch → null`(`appAuthCodes.js:136-138`)은 「디코딩 실패 = 앱 로그인 아님」으로 의도적이고 웹 흐름으로 안전하게 수렴. `jwt.verify`·`issue` 의 catch 는 경고 로그를 남기고 오류 딥링크로 응답.
- 마운트: `index.js:51` `if (fs.existsSync(distDir))` 블록 안, `:52` `express.static` 뒤, `:57` 가로채기, `:58` SPA 폴백 앞. SPA 정규식 `/^\/(?!api|uploads|health).*$/` 불변. `routes/auth.js:23-24` app-start·app-exchange 가 `:47 router.use('/', oauthRouter)` 앞. 시험 `appAuthHttp.test.js:155-175`(소스 순서 검사)와 실제 express 로 `app-start` 가 공용 `/:provider` 에 먹히지 않음 `:61-71` 확인.
- 부수: app-start·exchange 는 `AUTH_ENABLED==='true'` 일 때만 마운트(`index.js:36`), 가로채기는 무조건 마운트 — 해롭지 않으나 비대칭.

### 7. 의도 대조 — PASS (개발자가 바꾼 6가지 모두 의도에 부합)
| 변경 | 판정 |
|---|---|
| 표시 쿠키 값 `n./f.`+challenge | 개정 §3-2 ②(인코딩 자유·엄격 파싱) 허용 범위 |
| `issue({token,challenge})`·`consume(code,verifier)` | §3-2 ③④ 와 일치 |
| `app_login_invalid` 방어 분기 | §3-2 ③ 해석 타당. 정상 경로에서는 도달 불가한 방어 코드(시험 `appOAuthCallback.test.js:147-158`) |
| `error` 식별자 제한 | 09-18 보다 엄격, 안전 방향 |
| app-start `Referrer-Policy` | 무해(시험 단언 없음 → L-2) |
| 계획서 주석 `*/` 조기 종료 수정 | 맞음(코드 주석에도 경고 남김) |
- 개정 §3-3 필수 시험 7종(재사용·만료·불일치+소각·형식 400·상한·RFC 벡터·웹 회귀)이 모두 존재.
- 문서 정합: 설계 §14 `:450` 「커스텀 스킴 PKCE 미결속 보류」 행은 이제 낡았다 → INFO.

### 8. 설계 한계 — 개발자 주장 정확
악성 앱이 자기 verifier/challenge 로 `app-start` 를 직접 열고, 사용자가 그 Custom Tab 에서 로그인을 마치고, 악성 앱이 `theroute://` 를 수신하면 교환할 수 있다. PKCE 는 「남이 시작한 흐름의 코드 가로채기」만 막는다 [확실 — 코드 읽기와 PKCE 의미론으로 확인]. 동의 화면은 정상 TheRoute 이므로 사용자가 시작 주체를 구별할 수 없다.
- 현실성을 낮추는 요소 [추측 — 실기기 미검증]: 같은 커스텀 스킴을 두 앱이 등록하면 안드로이드가 일반적으로 선택창을 띄운다. 정식 앱이 설치돼 있으면 사용자가 악성 앱을 직접 골라야 한다. 또한 사용자가 의도하지 않은 Google 로그인 창이 떠야 한다.
- 이번 범위(백엔드, 공용 패키지 무수정)에서 줄일 수 있는 현실적 완화는 사실상 없다 [가능성 높음]. 앱 정체를 증명할 수단 없이 서버가 시작 주체를 구별할 수 없고(서버에 비밀을 둬도 APK 에서 추출 가능), 「이중 확인」(콜백 페이지에서 한 번 더 누르기)은 어느 앱이 수신하는지와 무관해 효과가 거의 없다.
- 근본 대책: Android App Links(https 검증 링크 + `assetlinks.json`, 서명 인증서 지문 결속). StockInvest T-091 M2 선례가 있다. 후속 과제로 올릴 것. 착수 시 확인할 점 [추측]: `express.static` 기본값은 점 디렉터리(`/.well-known/`)를 무시(`dotfiles: 'ignore'`)하고 SPA 폴백 정규식이 그 경로를 `index.html` 로 응답할 수 있어 `assetlinks.json` 서빙에 별도 처리가 필요할 수 있다.
- 단일 사용자 규모·정상 앱 우선 선택창 가능성을 고려하면 이번 릴리스에서는 「문서화된 잔여 위험」으로 두는 것이 합리적이다.

## 발견 결함

| ID | 심각도 | 파일:줄 | 증상 → 원인 → 제안 |
|---|---|---|---|
| L-1 | LOW | `backend/test/appAuthHttp.test.js:135`, `:146-151` | 「로그 전체에 토큰·코드·verifier 원문이 없다」시험이 실질적으로 비어 있다. `:135 logs = []` 가 바로 앞 회귀 시험에서 로그를 초기화하고, 그 시험은 `[app-auth]` 로그 0줄을 단언(`:143`)하므로 `:146` 시점의 `logs` 는 빈 문자열이다 → 어떤 구현이라도 통과. 개발자 기록의 「시험 3곳」 중 HTTP 시험은 증거가 못 된다(나머지 2곳 `appOAuthCallback.test.js:226-237`·`appAuth.test.js:142-156` 은 유효). 제안: 로그를 초기화하는 위치와 검사하는 위치를 분리(전체 흐름 시험 안에서 로그 배열을 캡처해 단언하거나 최초 `before` 에서만 초기화). 소스 수정 불필요. |
| L-2 | LOW | `appAuth.js:46`, `appAuthHttp.test.js:99-102`, `appAuth.js:62` | 시험이 못 잡는 변이: ① app-start 의 `Referrer-Policy: no-referrer` 제거(`appAuth.test.js:52`·`appAuthHttp.test.js:65` 가 `Cache-Control` 만 단언) ② 쿠키 삭제 헤더의 `HttpOnly/Secure/SameSite` 제거(`:99-102` 는 이름·Expires·Path 만) ③ exchange 400 응답의 `Cache-Control`(200·401 만 단언). 제안: 단언 3줄 추가. |
| L-3 | LOW | `appAuthCodes.js:85-87`, `authController.js:13`, `appOAuthCallback.js:108-131` | 코드 발급 폭주로 정상 로그인 방해 가능. `register` 가 열려 있어 누구나 유효 JWT 를 얻고, 표시 쿠키는 요청 헤더에 직접 쓰면 되므로 `/oauth/callback?token=` 를 60초에 500회 이상 두드리면 진행 중인 코드가 오래된 것부터 밀려난다(가용성만, 권한 상승 없음). 앱 수준 속도 제한이 없다. 제안: nginx `limit_req` 를 `/oauth/callback`·`/api/auth/app-exchange` 에 적용(운영 후속, sudo 필요). 코드 변경 불필요. |
| L-4 | LOW | `appOAuthCallback.js:113`(삭제 시점), 공용 `express.js:60` | 표시 쿠키는 `/oauth/callback`·`/login?error=` 에서만 지워진다. Custom Tab 을 도중에 닫거나, `/api/auth/<provider>` 가 JSON 503(제공자 자격증명 미설정)을 내면 쿠키가 최대 10분 남아 같은 폰 크롬의 웹 로그인 1회가 앱 스킴으로 넘어갈 수 있다. 설계 §14 `:451` 이 이미 수용한 위험이고 1회로 끝난다. 트리거가 「503 JSON」까지 넓다는 점만 추가로 기록. 운영에서 GitHub 가 미설정이면 앱 GitHub 버튼을 숨기는 쪽(W)이 근본 해소. |
| L-5 | LOW (선택) | `appAuthCodes.js:33` | 쿠키 이름 `__Host-` 접두 미사용. 이 워크스페이스는 같은 상위 도메인 아래 다른 서브도메인(voice·meal·career 등)을 호스팅한다 [추측: 그 중 하나가 XSS 를 당하면] `Domain=` 쿠키로 같은 이름을 심어 웹 로그인 1회를 앱 스킴으로 돌릴 수 있다(코드는 피해자 브라우저의 Location 헤더에만 있어 탈취는 불가, 가용성 영향). `__Host-` 접두는 Secure·Path=/·Domain 없음을 브라우저가 강제한다. 이름은 서버 내부 값이라 W 와의 계약에 영향 없음. 필수 아님. |
| L-6 | LOW (잠복) | `appAuthCodes.js:85-87` | `maxEntries <= 0` 이면 `while` 이 무한 루프(`keys().next().value` 가 `undefined` 라 삭제가 안 됨). 기본값 500 이고 공개 설정 경로가 없어 도달 불가. 방어적 가드 1줄 권장. |
| INFO | — | 설계 `2026-09-18-android-apk-design.md:450` | §14 「커스텀 스킴 PKCE 미결속 / 보류」 행이 낡음. 「PKCE 적용 완료, 잔여: 악성 앱이 시작하는 흐름(→ App Links)」로 갱신 필요(Leader/N). |

## QA 에 넘길 high_risk_areas
1. **웹 로그인 불변(배포 직후)**: 표시 쿠키 없이 `/oauth/callback?token=dummy`·`/login`·`/login?error=x` → `200 text/html`(SPA)·`Set-Cookie` 없음, pm2 로그에 `[app-auth]` 0줄.
2. **실기기 Custom Tab 왕복**(코드로 확인 불가): 쿠키가 `app-start → Google → 콜백` 체인에서 유지되는지(SameSite=Lax), 302 딥링크가 막히면 `&fallback=1` 로 폴백 버튼이 동작하는지, Google 에서 「취소」 시 `/login?error=` 가로채기로 앱에 오류 복귀하고 쿠키가 지워지는지.
3. **PKCE 교환**: 재사용 401, 틀린 verifier 소각 뒤 올바른 verifier 도 401, 60초 만료, 형식 오류 400, 응답 `Cache-Control: no-store`.
4. **배포 후 경로 존재**: 운영이 `AUTH_ENABLED=true` 라 `/api/auth/app-start` 가 404 가 아닌 302(공용 라우터에 먹히지 않음). GitHub 미설정이면 503 JSON 에 머무는지.
5. **프록시 통과**: nginx 가 `Set-Cookie`(다중 헤더)·`Location: theroute://…`·`Cache-Control` 을 변형하지 않는지(운영 curl).
6. **스트림 W 교차**: 딥링크 `msg` 는 `URLSearchParams` 인코딩(공백 → `+`)이라 W 가 `URLSearchParams`/`new URL` 로 파싱해야 한다. `describeAuthError` 의 `access_denied` 매칭(공용 어댑터는 `error=oauth_failed&msg=access_denied` 로 보냄, 서버는 그대로 전달).
7. **재시작 손실**: pm2 재시작/blue-green 전환 중 진행 중 로그인은 401(예상 동작) — 사용자 문구 「다시 로그인해 주세요」 확인.

## 후속 과제
- 시험 보강: L-1·L-2(소스 무수정, 단언 추가).
- 운영: nginx `limit_req`(L-3).
- 설계 문서 §14 행 갱신(INFO).
- App Links 후속 task 검토(관점 8) — 스트림 N 의 매니페스트와 `assetlinks.json` 서빙 영향 사전 확인.
- 선택: `__Host-` 접두(L-5), `maxEntries` 가드(L-6).

## 검토하지 못한 것
- 실기기/Custom Tab 동작(쿠키 체인, 스킴 302 허용 여부, 같은 스킴 다중 앱 선택창) — 코드·표준 지식으로만 판단.
- 운영 서버·DB·nginx 설정, 실제 Google/GitHub 왕복, 운영 `.env` 의 시크릿(호스트 값 2개만 확인).
- `index.js` 전체 기동(DB 접속) — 소스 순서 시험과 동일 순서로 조립한 시험 앱으로 대체됨.
- 스트림 N(`mobile/**`, 매니페스트 intent-filter)·스트림 W 전체 감사 — 교차 계약(`error`·`msg`·`+` 인코딩)만 확인.
- 소스 변이 시험(금지) — 시험 코드를 읽고 판단한 변이 생존 목록은 L-1·L-2 에 한정. 타이밍 안전 비교를 `===` 로 바꿔도 통과하는 점은 시험으로 잡을 수 없다(타이밍은 단위 시험 불가).

---

# 2라운드 (2026-10-30 22:5x) — 후속 패치 재확인

대상: [[T009-stream-B]] "후속 패치" 절(폴백 페이지 승인 디자인 v1 + L-1·L-2·L-6). 승인 데모 `docs/demo/T009-android-apk-v1.html` §3 "제안 v1" · 가이드 `docs/web-design/T009-android-apk-guide.md` §0·§2-3·§2-4.
코드는 수정하지 않았다. 읽기·시험 실행·읽기 전용 node 확인만.

## 2라운드 판정: CONDITIONAL_PASS (Critical 0 / High 0 / Medium 0 / 신규 Low 1 + 이월 Low 3 · INFO 2)

이번 패치 자체의 결함은 없다. 1라운드에서 지적한 L-1·L-2·L-6 은 해소를 확인했고, 폴백 페이지는 승인 가이드 값과 일치하며 보안 속성이 약화되지 않았다. CONDITIONAL 인 이유는 코드 결함이 아니라 1라운드부터 이월된 후속 과제(L-3 운영 nginx · L-4 수용된 위험 · L-5 선택) 때문이며, QA 인계 전에 고칠 코드는 없다.

## 직접 실행한 검증

| 명령 | 결과 |
|---|---|
| `cd backend && nice -n 10 node --test test/*.test.js` | tests 63 · pass 63 · fail 0 · cancelled 0 · skipped 0 · **종료 코드 0** (≈0.69초). 로그: scratchpad `reviewer-b-round2.log` |
| `git diff -- backend/src` | 추적 파일 diff 는 1라운드와 동일(`index.js` +5, `auth.js` +9). `appAuth.js` 수정 시각 22:28(패치 전)이라 무변경 |
| 실제 express 에 폴백 응답 3경우 호출(읽기 전용 확인) | 성공 / `/login?error=access_denied&msg=%3Cscript%3E` / 무효 JWT 모두 `200 text/html; charset=utf-8`, `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, `Cache-Control: no-store`. href 는 각각 `theroute://auth/callback?code=<64hex>` · `…?error=access_denied&amp;msg=%3Cscript%3E` · `…?error=invalid_token` |
| `node ../.claude/tools/demo-gate/check.mjs check --task agent-vault/10-Flow/tasks/T009-android-apk.md` | `DEMO_GATE_PASSED` · status approved · approved_version v1 · hash verified. 워크스페이스 `evidence.jsonl` 의 승인 줄: 2026-10-30T22:43:02 `kind:"approve"` `version:1` (사용자 프롬프트 22:42:34 에서 유래, 세션 f1b66db4…). 에이전트가 `approve`·`waive` 를 대신 실행한 흔적은 찾지 못함 [확인한 범위: evidence 줄의 메타데이터, 대화 원문과의 대조는 하지 않음] |

## 항목별 확인

### 1. 변경 범위 — PASS
신규 파일(미추적)이라 git diff 로 비교할 기준선이 없어, 1라운드에서 읽은 전문과 줄 단위로 대조했다.
- `appOAuthCallback.js`: 줄 1-66(주석·`JWT_SECRET`·`ERROR_CODE_RE`·`escapeHtml`·`firstString`·`cleanMsg`)과 핸들러 본문(`:113-168`, 1라운드 `:98-153`) 동일 — 메서드·경로 판정, `parseAppLoginCookie`→`next()`, `clearAppLoginCookie` 위치(`:128`), 헤더 설정, JWT 검증, 로그 문구, `ERROR_CODE_RE` 처리, `wantFallback` 판정, CSP 설정, 302 모두 무변경. 바뀐 것은 `renderFallbackPage()`(`:79-106`)와 그 위 주석(`:67-75`)뿐이다. `FALLBACK_PAGE_CSP` 상수(`:76`) 문자열 동일.
- `appAuthCodes.js`: `createAppAuthCodeStore` 첫머리의 가드 2줄(`:67-68`)만 추가. `issue`·`consume`·`sweep`·`safeEqualAscii`·`buildAppDeepLink`·쿠키 인코딩/파싱/옵션/설정/삭제 무변경(전 줄 대조, 줄 번호만 +2 이동).

### 2. 폴백 페이지 — PASS
- **이스케이프**: `href` 는 `escapeHtml(deepLink)`(`:80,104`), `msg` 는 코드 상수 두 가지뿐이며 그래도 `escapeHtml`(`:103`)을 거친다. 딥링크는 `URLSearchParams` 산출이라 `javascript:` 접두가 구조적으로 불가능하다. 시험 `appOAuthCallback.test.js:248-262` 가 성공·무효 JWT·`error=javascript:alert(1)&msg=javascript:alert(1)` 세 경우의 href 가 `theroute://auth/callback?` 로 시작함을 단언한다. 위 실제 호출 결과도 일치.
- **CSP·외부 요청**: 응답 헤더 CSP `default-src 'none'; style-src 'unsafe-inline'` 확인. HTML 에 `<script>`·`<link>`·`<img>`·`@import`·`url(`·`http(s)://`·`javascript:` 없음(시험 `:242-246` + 직접 읽기). 글꼴은 시스템 글꼴 스택뿐.
- **구조(가이드 §2-4 / 데모 §3)**: `<title>더 루트</title>` ✔ · `<meta name="referrer" content="no-referrer">` ✔ · 본문 순서 앱 이름(`<p class="appname">`) → 상황 한 줄(`<h1>`) → 큰 버튼 `<a class="cta">`(`role` 없음, 링크 1개) ✔ · 문구 성공 `로그인이 완료되었습니다.` / 실패·취소 `로그인을 완료하지 못했습니다.` ✔ · 성공·실패 같은 버튼 ✔ · 데모와 같이 `<main>` 안 `<div>` 래퍼(그리드 중앙 정렬용).
- **CSS 값 대조(가이드 §0·§2-3 / 데모 `.cta`·`.fb`)**: 배경 `#f6f5f3` · 글자 `#131313` · 앱 이름 13px/600/`#6b6b68`/아래 14px/자간 -0.1px(데모와 동일) · 상황 줄 16px/600/`#131313`/`word-break:keep-all` · 버튼 `min-height:52px`·`min-width:200px`·`padding:0 28px`·`margin-top:22px`·`border-radius:10px`·`background:#ee6438;background:oklch(67% 0.18 38)`(두 줄)·`#fff` 19px 700·자간 -0.2px·`text-decoration:none` · `:active{filter:brightness(.94)}` · `:focus-visible{outline:3px solid #9d2800;outline-offset:2px}` · 글꼴 `-apple-system,system-ui,"Apple SD Gothic Neo","Noto Sans KR",sans-serif` — 전부 일치.
- **개발자가 밝힌 의도적 차이**: `<h3 class="msg">`→`<h1>`(가이드 §2-4 대로, 독립 페이지의 첫 제목) · 버튼·링크 겸용 규칙(`border:0; cursor:pointer; font:inherit`) 제거(`<a>` 라 불필요) · `:focus-visible` — 모두 타당. 분류: implementation(근거 있음), material 아님.
- **렌더 비교는 하지 않았다**(HTML 문자열·CSS 값 대조까지). Leader/QA 몫.

### 3. L-1 / L-2 / L-6 — 해소 확인
- **L-1 해소**: `appAuthHttp.test.js:89,119-125` 전체 흐름 시험이 `logFrom = logs.length` 로 구간을 잡고, 원문 부재를 검사하기 **전에** `[app-auth] 앱 로그인 코드 발급` 과 `[app-auth] 코드 교환 실패 (unknown)`(재사용 응답) 로그가 실제로 찍혔음을 단언한다. 회귀 시험(`:150,158`)은 `slice(logFrom)` 로 바뀌었고 더는 배열을 비우지 않는다(`logs = [` 는 `:31` 선언뿐). 마지막 누적 시험(`:161-168`)은 `[app-auth]` 줄이 3줄 이상(실제로 앞 시험들에서 5줄 이상 쌓임)이어야 통과하므로 **빈 로그로는 통과할 수 없다**. 1라운드의 변이(코드에 `console.log(code)` 추가)는 이제 `!all.includes(m[1])` 에서 잡힌다.
- **L-2 해소**: ① app-start `Referrer-Policy` — 단위 `appAuth.test.js:53`, HTTP `appAuthHttp.test.js:66`(실제 헤더) 둘 다 단언. ② 쿠키 삭제 헤더 `HttpOnly`·`Secure`·`SameSite=Lax` — `appAuthHttp.test.js:105-107`, 실제 `Set-Cookie` 문자열 `includes` 로 단언(`Secure` 가 빠지면 헤더 어디에도 그 단어가 없어 실패). ③ exchange 400 `Cache-Control` — 단위 `appAuth.test.js:177`(여섯 입력 반복), HTTP `appAuthHttp.test.js:146`. 세 변이 모두 걸린다.
- **L-6 해소**: `appAuthCodes.js:67-68` 가드(`Number.isInteger && >=1`, 아니면 `RangeError`) + 시험 `appAuthCodes.test.js:157-165`(`0,-1,0.5,NaN,Infinity,'500',null` 거부, `maxEntries:1` 이 두 번째 발급에서 첫 항목을 밀어내며 크기 1 유지). 가드가 빠지면 `assert.throws` 가 실패한다(생성자는 순환하지 않으므로 시험이 멈추지 않는다). 기본값 500·`undefined` 는 통과하므로 모듈 로드 시 `createAppAuthCodeStore()` 에 영향 없음.

### 4. 시험 수 / 5. 보안 단언 약화 여부 — 약화 없음
- 1라운드 59건 → 63건. 시험 이름을 구 목록과 하나씩 대조: 구 59건 이름이 모두 존재한다(단, `appAuthHttp` 마지막 시험은 이름만 「로그 전체(시험 파일 시작부터 누적, 비우지 않음)에 …」로 바뀌었고 단언은 강화됨). 신규 4건: 폴백 구조·색·규격(`appOAuthCallback.test.js:220`), 외부 요청·스크립트 없음(`:242`), href 접두 고정(`:248`), L-6(`appAuthCodes.test.js:157`).
- 기존 보안 단언 유지: 이스케이프 시험(`:207-218`)은 `<script>alert(1)</script>` 부재와 href 안 `[<>"']` 부재를 그대로 단언하고 정규식만 새 마크업(`<a class="cta" href=`)에 맞췄다. `renderFallbackPage 는 href 를 이스케이프한다`(`:264`)·CSP 정확 일치(`:196`)·토큰이 본문에 없음(`:195`)·로그 원문 부재(`:270`)는 무변경. `appOAuthCallback.test.js` 줄 1-180(웹 회귀 7건·가로채기 8건)은 이전 판과 동일하게 읽혔다.

## 새로 발견한 것

| ID | 심각도 | 파일:줄 | 증상 → 원인 → 제안 |
|---|---|---|---|
| N-1 | LOW | `backend/test/appOAuthCallback.test.js:234-238` | 디자인 값 단언이 일부만 고정한다. 확인하는 문자열은 색 3·버튼 규격 중 52/200/19/700/10/focus/brightness 등인데, 상황 줄 `font-size:16px;font-weight:600`, 앱 이름 `13px/600`, 여백 14·22, `padding:0 28px`, `word-break:keep-all`, `letter-spacing`, `outline-offset:2px` 는 단언이 없고, 문자열이 문서 어디에 있어도 통과해 선택자 결속도 없다(예: `color:#131313` 은 body 와 h1 어느 쪽이든 만족). 위계(16px 상황 줄)가 조용히 바뀌어도 시험이 못 잡는다. 제안: 누락 값을 같은 목록에 추가하거나 선택자 단위 정규식(`/\.cta\{[^}]*min-height:52px/` 등)으로 바꾼다. 차단 아님. |
| INFO-2 | INFO | `appOAuthCallback.js:87-89` ↔ 데모 `body` | 데모 본문의 `font-size:14px; line-height:1.55; -webkit-font-smoothing:antialiased` 가 폴백 페이지에는 없다(요소별 px 는 명시돼 있어 글자 크기는 같다). 줄 높이는 브라우저 기본값(`normal`)이라 안드로이드 Noto Sans KR 에서 세로 리듬이 한 줄당 1~2px 정도 데모보다 좁을 수 있다 [추측, 렌더 미확인]. 가이드 값이 아니라 데모 CSS 에서 온 차이이므로 결함이 아니다. QA 의 렌더 비교 때 눈으로 확인할 항목으로만 남긴다. |

## 이월 항목(이번 패치 범위 밖, 1라운드와 동일)
- L-3 nginx `limit_req`(운영, sudo) · L-4 쿠키 잔존 트리거(수용된 위험, 설계 §14 `:451`) · L-5 `__Host-` 접두(선택) · INFO 설계 §14 `:450` 행 갱신 — 개발자가 의도적으로 하지 않았다고 기록했고(`T009-stream-B.md` "하지 않은 것"), 이번 패치가 새로 악화시킨 것은 없다.

## QA 에 넘길 high_risk_areas — 1라운드 대비 달라진 것
1. **(변경)** 폴백 페이지 렌더: 실기기 Custom Tab 에서 `&fallback=1` 로 열어 성공/실패 두 상태를 본다. 승인 데모 §3 과 나란히 비교 — 앱 이름·한 줄·큰 버튼 위계, 배경 `#f6f5f3`, 버튼 색(구형 WebView 는 `#ee6438`, 신형은 oklch), 탭 표시줄 제목이 「더 루트」인지, 버튼을 누르면 앱이 열리는지(사용자 제스처), 360~412px 에서 줄바꿈만 일어나고 버튼 폭 200px 이 유지되는지, 키보드/스위치 포커스 테두리.
2. **(신규)** 폴백 페이지는 외부 글꼴·이미지·스크립트 요청이 없어야 한다 — 크롬 원격 디버깅 네트워크 탭에서 요청 0건(문서 1건) 확인.
3. 1라운드의 1·3·4·5·6·7 항목은 그대로(웹 로그인 불변, PKCE 교환, 배포 후 `app-start` 302, 프록시 헤더 통과, W 와의 `+` 인코딩 계약, 재시작 손실). 2번(Custom Tab 왕복)은 폴백 문구가 바뀐 것 외에 동일.
4. (제거) 1라운드 L-1·L-2 로 인한 「시험 증거 신뢰」 주의는 해소됨.

## 2라운드에서 검토하지 못한 것
- 브라우저 렌더 비교(데모 대비 픽셀·줄 높이) — Leader/QA 몫이며 내가 한 것은 HTML 문자열·CSS 값 대조까지.
- 실기기 Custom Tab, 운영 서버·nginx, 실제 Google/GitHub 왕복 — 1라운드와 동일.
- `evidence.jsonl` 승인 줄과 대화 원문의 일치(프롬프트 22:42:34 인용 해시) 직접 대조 — 메타데이터만 확인.
- 스트림 N(`mobile/app-shell/index.html`, 같은 디자인 가이드 §2-3 적용 대상)과 W 의 문구 변경 — 내 범위(스트림 B) 밖.

---

# Codex C2 판정 (2026-10-30)

지적(Codex, medium): 「app-exchange 에 형식이 틀린 code/verifier 가 오면 consume 이 malformed 를 즉시 반환해 유효한 코드를 소각하지 않고, 핸들러가 별도 400 본문으로 응답한다. 수용 기준 『성공·실패 무관 즉시 소각 / 모든 실패 동일 401』과 반대.」
권고(Codex): 「code 가 64자 형식이면 verifier 검증보다 먼저 조회·삭제하고, malformed 를 포함한 모든 실패를 동일 401 로 수렴. 400·비소각 시험도 변경.」

## 판정: 오탐 (근거 있음) — 심각도 재평가: Medium → 결함 아님(문서 보강 권고 INFO 1건)

### 1. 계약 대조 — 구현이 계약 문장 그대로다
- 개정 §3-2 ④ 는 「형식 오류(code 64hex 아님, verifier 43자 아님) → 400」을 **먼저** 적고, 그다음 「`consume(code)` 는 맞든 틀리든 만료됐든 그 자리에서 지운다. 불일치·만료·미지의 코드·재사용은 모두 같은 401」이라고 적는다. **같은 401 로 묶이는 것은 네 가지(불일치·만료·미지·재사용)이고 형식 오류는 그 목록에 없다.** 09-18 스펙 §7 도 「형식 오류 400, 만료·미지의·재사용 401」로 분리한다. 구현 `appAuthCodes.js:104-105`(형식 → `malformed`, 저장소 미접촉)·`appAuth.js:65-67`(400)·`:68-72`(그 밖 실패 전부 같은 401)은 이 순서·분류와 일치한다.
- Codex 가 근거로 삼은 「성공·실패와 무관하게 즉시 소각 / 모든 실패는 동일한 401」은 Leader 가 인계 묶음에 요약한 문구이며 계약 원문보다 엄격하다. 요약을 기준으로 하면 지적처럼 보이지만 **원문 기준으로는 계약 위반이 아니다.**
- 참고: Codex 가 인용한 줄번호 `appAuthCodes.js:132-133` 는 현재 파일에서 `readCookie` 내부이고 malformed 반환은 `:104-105` 다. 서술 내용은 현재 동작과 맞지만 줄번호는 다른 판본을 본 것으로 보인다.

### 2. 실제 보안 영향 — 이득을 얻는 공격 경로가 없다 (직접 실행으로 확인)
프로세스 안에서 `createAppExchangeHandler({store})` 를 직접 호출했다(서버·DB·네트워크 없음).

| 질문 | 결과 |
|---|---|
| **코드 존재 오라클?** 형식이 틀린 verifier(`'short'`, 44자, `undefined`, 객체)를 **살아 있는 코드**와 **없는 코드**로 각각 보냄 | 4종 모두 `400`/`400`, 본문 JSON 완전 동일(`true`). 형식 검사가 저장소 조회보다 앞(`appAuthCodes.js:104-105` → `:108`)이라 존재 여부가 응답에 반영될 수 없다. |
| **형식 오류가 얼마나 알려 주나?** 틀린 code vs 틀린 verifier 의 본문 | 동일(`'로그인 요청 형식이 올바르지 않습니다'`, `appAuth.js:66`). 어느 필드가 틀렸는지도 구분하지 않는다. 400 이 알려 주는 것은 「요청이 문법적으로 틀렸다」뿐이고, 입력은 공격자가 정한 값이며 형식 규칙(64hex·43자 base64url)은 딥링크와 공개 웹 번들(`appLogin.js`)에서 이미 관찰 가능한 공개 정보다. |
| **시도 횟수 이득?** 가로챈 유효 코드로 형식이 맞는 틀린 verifier 1회 → 이어서 올바른 verifier | `401`, 이어서 `401`, 저장소 크기 0. **형식이 맞는 시도는 첫 한 번에 소각**된다. 형식이 틀린 verifier 는 평가 대상이 아니므로(해시도 비교도 안 함) 맞을 수가 없고, 응답에 정보가 없어 추측을 좁혀 주지 못한다. 형식 오류 시도를 몇 번 해도 형식이 맞는 시도 횟수는 코드당 1회로 변하지 않는다. |
| **살아 있는 코드가 이후 다시 교환될 수 있다는 영향** | 맞는 verifier 를 가진 쪽만 교환할 수 있다. 그 쪽은 정당한 앱뿐이다(공격자는 challenge 의 원상을 모른다 — SHA-256 역상). 코드는 어차피 60초 후 만료되고 프로세스 재시작으로도 사라진다. 공격자 이득 0. |
| **타이밍** | 형식 오류는 해시 계산 이전에 반환되어 더 빠르지만, 분기를 정하는 것은 공격자 자신의 입력 형식뿐이다(비밀 의존 분기 아님). |

소각을 앞당기는 Codex 안이 주는 보안 이득: 없음. 이미 가로챈 코드를 태워 정당한 앱을 막는 일은 형식이 맞는 틀린 verifier 한 번으로 지금도 가능하므로 한계 위험이 늘지도 줄지도 않는다. 반대로 비용이 있다.
- 정당한 앱 쪽: 형식 오류는 거의 클라이언트 결함(verifier 소실·잘림)이다. 이때 서버가 코드를 태우든 안 태우든 앱의 verifier 는 이미 지워져(`takePendingVerifier`) 재시도가 불가능하므로 실질 차이는 없다.
- 진단성: malformed 를 401 로 수렴시키면 W 의 `toExchangeError`(`appLogin.js:263-277`, 401 → `expired`)가 이를 「로그인 시간이 지났습니다. 다시 로그인해 주세요.」(승인 문구 T2)로 잘못 안내한다. 승인 가이드 §2-5 의 분류(401 → T2 / 그 밖 400·5xx → 「로그인에 실패했습니다. 다시 시도해 주세요.」)와 어긋난다. 클라이언트 결함이 만료로 위장되어 실기기 진단도 어려워진다.

### 3. 1·2라운드 판정과의 일관성
1라운드 관점 7·2에서 「형식 오류 400 은 코드를 태우지 않는다」를 타당하다고 판정한 근거는 (a) 400 은 공개된 형식만 알려 줌 (b) 형식이 맞는 시도는 전부 소각되어 추측은 1회 (c) 존재 여부 오라클 아님 (d) 정당한 앱의 재시도·진단을 깨지 않음이었다. 이번에 **새로 확인된 사실은 두 가지뿐이고 둘 다 같은 결론을 강화한다** — ① 직접 호출로 코드 존재/비존재와 필드별 형식 오류가 응답에서 구분되지 않음을 실증 ② Codex 의 수용 기준이 계약 원문이 아니라 Leader 요약에서 왔음. 판정이 달라진 것은 없다.

### 4. 권고 (코드 변경 없음)
- **채택하지 않는다.** 소각 순서·400 분리·시험(`appAuthCodes.test.js:104-123`, `appAuth.test.js:159-182`, `appAuthHttp.test.js:143-147`)을 그대로 둔다.
- INFO(문서): 같은 해석 분쟁이 다시 나지 않도록 개정 §3-2 ④ 와 09-18 스펙 §7 에 한 문장을 덧붙인다 — 「형식 오류(400)는 비밀과 무관하므로 코드를 태우지 않는다. 형식이 맞는 시도는 결과와 무관하게 한 번에 소각하며, 존재·불일치·만료·재사용은 구별할 수 없는 같은 401 이다.」 Codex 인계 묶음의 수용 기준 요약도 이 문장으로 바로잡는다.
- 사용자/Leader 가 정책으로 더 엄격한 문구를 계약으로 격상하기로 한다면(보안 이득은 없다는 점을 한 번 명시한 뒤) 최소 수정은 다음이다. 어느 쪽이든 W 의 코드 변경은 필요 없고, 승인 문구 분류만 영향을 받는다.
  - 변형 A(상태·본문 유지, 소각만 앞당김): `appAuthCodes.js` `consume` 에서 code 형식만 먼저 검사해 `codes.get/delete` 를 수행한 뒤 verifier 형식을 검사해 `malformed`(400) 반환. 바꿀 시험: `appAuthCodes.test.js:114-123`(verifier 형식 오류가 코드를 태움으로 반전), `appAuth.test.js:159-182`(반복마다 코드를 새로 발급하고 마지막 교환이 401). W 영향 없음(400 → `failed` 유지).
  - 변형 B(Codex 권고 전체, 형식 오류도 401): 변형 A 에 더해 `appAuth.js:65-67` 의 400 분기 삭제, 시험 `appAuth.test.js:158-188`·`appAuthHttp.test.js:143-147` 를 401 기대로 변경. W: `toExchangeError` 는 그대로지만 형식 오류가 `expired` 문구(T2)로 보이게 되고 `appLogin.test.js:297,331` 의 400 → `failed` 케이스는 서버가 더는 내지 않는 경로가 된다. 비권장.

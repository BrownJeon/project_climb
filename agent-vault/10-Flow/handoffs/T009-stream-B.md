---
task: T009
stream: B
role: developer
date: 2026-10-30
status: DONE
tags: [type/handoff, domain/auth, domain/mobile]
---

# T009 스트림 B — 앱 로그인 백엔드 (09-18 Task 4·5·6 + PKCE S256)

정본: [[T009-android-apk]] · 개정 `docs/superpowers/plans/2026-10-30-android-apk-addendum.md` §3·§4
작업 위치: `/home/brownjeon/.node-local/theroute-app` (브랜치 `mobile-app-t009`). **커밋하지 않음**(Leader 가 파일 명시 커밋).

## 무엇을 · 왜

| 파일 | 신규/수정 | 무엇을 |
|---|---|---|
| `backend/src/services/appAuthCodes.js` | 신규 | 60초·1회용 코드 저장소(메모리 Map, 상한 500) + PKCE(S256, `timingSafeEqual`) + 표시 쿠키 인코딩·엄격 파싱·설정·삭제 + 딥링크 조립 |
| `backend/src/routes/appAuth.js` | 신규 | `GET /api/auth/app-start` · `POST /api/auth/app-exchange` 핸들러(가짜 req/res 로 시험하려고 분리) |
| `backend/src/routes/appOAuthCallback.js` | 신규 | `/oauth/callback`·`/login?error=` 가로채기. 표시 쿠키 없거나 형식 다르면 `next()`. 폴백 HTML 은 `renderFallbackPage()` 한 함수 |
| `backend/src/routes/auth.js` | 수정(+9줄) | import 1줄 + app-start·app-exchange 마운트(공용 `router.use('/', oauthRouter)` **앞**) |
| `backend/src/index.js` | 수정(+5줄) | 가로채기 마운트 1줄 + 주석 4줄 — `express.static` 뒤·SPA 폴백 앞, SPA 정규식 무변경 |
| `backend/test/appAuthCodes.test.js` 외 3개 | 신규 | 59건(아래) |

왜 PKCE: `theroute://` 는 다른 앱도 등록할 수 있어 딥링크 코드만으로는 가로채기를 못 막는다. verifier 는 앱 WebView 밖으로 안 나가고 서버는 challenge 만 안다(개정 §3).

## API 계약 최종본 (스트림 W 소비용)

1. `GET /api/auth/app-start?provider=google|github&challenge=<43자 base64url>[&fallback=1]`
   - 성공: `302 Location: /api/auth/<provider>` + `Set-Cookie: route_app_login=<n|f>.<challenge>; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`, `Cache-Control: no-store`
   - 실패: `400 {"success":false,"data":null,"message":"…"}` (provider 밖 / challenge 형식 오류), 쿠키 없음
2. 콜백 → 딥링크
   - 성공: `302 theroute://auth/callback?code=<64 hex>`
   - 실패: `302 theroute://auth/callback?error=<식별자>[&msg=<≤100자>]` — error 값: `invalid_token`(JWT 무효·만료) · `no_token` · `app_login_invalid`(challenge 결속 실패, 방어용) · 공용 라우터가 보낸 값(`oauth_failed` 등, `[A-Za-z0-9_]{1,64}` 아니면 `oauth_failed`)
   - fallback(쿠키 f. 또는 요청 `?fallback=1`): `200 text/html` "앱으로 돌아가기" 버튼(같은 딥링크)
3. `POST /api/auth/app-exchange` `Content-Type: application/json` `{"code":"<64 hex>","verifier":"<43자>"}`
   - 성공: `200 {"success":true,"data":{"token":"<JWT>"},"message":""}`
   - 형식 오류: `400 {"success":false,"data":null,"message":"로그인 요청 형식이 올바르지 않습니다"}` (코드는 소각 안 됨)
   - 불일치·만료·미지·재사용: 모두 `401 {"success":false,"data":null,"message":"로그인 코드가 만료되었거나 올바르지 않습니다. 다시 로그인해 주세요"}`
   - 모든 응답 `Cache-Control: no-store`
   - 웹 `appExchange()` 는 인터셉터가 한 겹 벗기므로 `r.data.token` (개정 §3-2 ⑤)

## 계획과 다르게 한 것

1. **표시 쿠키 값** `1`/`fallback` → `n.<challenge>`/`f.<challenge>`. 정규식 `^([nf])\.([A-Za-z0-9_-]{43})$` 에 정확히 맞지 않으면 "앱 로그인 아님"으로 `next()`(옛 값 `1`·`fallback` 포함).
2. **`issue({token, challenge})`·`consume(code, verifier)`** 로 시그니처 변경. consume 은 형식(code·verifier 둘 다) 검사 → 통과 시 즉시 삭제 → 만료 → S256 대조. 형식 오류는 코드를 태우지 않는다(개정 §3-2 ④ 순서 그대로).
3. **"challenge 가 쿠키에서 읽히지 않으면 오류 딥링크"(§3-2 ③)** 해석: 형식이 깨진 쿠키는 §3-2 ② 에 따라 `next()` 가 우선이라, 오류 딥링크는 "쿠키는 맞는데 저장소가 challenge 를 거부"하는 방어 분기(`app_login_invalid`)로만 남겼다. 정상 경로에서는 도달하지 않는다.
4. **딥링크 `error` 값 제한**: 09-18 은 `/login?error=` 원문을 64자로 잘라 그대로 실었다. 식별자 모양(`[A-Za-z0-9_]{1,64}`)만 싣고 나머지는 `oauth_failed`. `msg` 는 제어문자 제거·100자(09-18 그대로).
5. **app-start 응답에도 `Referrer-Policy: no-referrer`** 추가(무해).
6. **09-18 원문 잠복 결함 수정**: 계획서 Task 6 머리말 주석의 `**/login**` 이 `*/` 를 포함해 블록 주석을 닫아 **SyntaxError** 가 난다. 문구를 바꿨다.
7. `backend/package.json` test 스크립트(09-18 Task 4 Step 1)는 담당 파일 밖이라 **추가하지 않았다**. 또한 이 서버의 `node` 는 **v24.22.2** 이고 Node 22+ 에서는 `node --test test/`(디렉터리 인자)가 `Cannot find module` 로 실패한다 → 실제 실행은 `node --test test/*.test.js`. 스크립트를 넣는다면 `"test": "node --test test/*.test.js"` 권장.

## 실제 실행한 검증

- `cd backend && nice -n 10 node --test test/*.test.js` → **tests 59 · pass 59 · fail 0** (rc=0)
  - `appAuthCodes.test.js` 19: RFC 7636 부록 B 벡터 2건(계산·발급→교환), 재사용·만료(경계 포함)·불일치+소각(올바른 verifier 재전송도 실패)·형식 오류(코드 미소각)·상한 500·sweep·쿠키 엄격 파싱
  - `appAuth.test.js` 10: app-start 쿠키 속성·fallback·400 분기 / exchange 성공(RFC)·4종 실패 동일 401 본문·형식 400·body 이상·로그에 원문 없음
  - `appOAuthCallback.test.js` 20: **회귀(쿠키 없음·다른 쿠키·형식 다른 쿠키 → next(), 헤더·쿠키 무변경)**, 가로채기·challenge 결속·무효/만료 JWT·no_token·`/login?error=`·error 정제·fallback·HTML 이스케이프·로그 원문 없음
  - `appAuthHttp.test.js` 10: **127.0.0.1 임시 포트의 실제 express**(실제 `routes/auth.js` + 공용 OAuth 라우터, DB 접속 없음)로 app-start→콜백→exchange 전체 흐름, 실제 Set-Cookie 직렬화·삭제 헤더, 공용 `/api/auth/google` 이 그대로 공용 라우터(503)에 가는지, **쿠키 없는 `/oauth/callback`·`/login` 이 SPA 폴백 본문을 그대로 받고 `[app-auth]` 로그가 0줄**, 마운트 순서 소스 검사(auth.js·index.js, SPA 정규식 문자열 그대로)
- `node --check` 로 변경 JS 5개 구문 확인

## 못 한 것

- 운영/스테이징 서버에서의 회귀 확인(09-18 Task 6 Step 6 의 `pm2 restart` + curl) — 금지 사항이라 하지 않았다. 배포 후 Deployer/QA 몫: 쿠키 없이 `https://climb.…/oauth/callback?token=dummy` → `200 text/html`, pm2 로그에 `[app-auth]` 없음.
- `index.js` 전체를 띄우는 시험(bootstrap 이 DB 접속·listen 을 함) — 소스 순서 검사 + 같은 순서로 조립한 시험 앱으로 대체.
- 실제 Google/GitHub 왕복·실기기 Custom Tab — 사용자 실기기 단계.

## Reviewer 가 볼 곳

1. `appOAuthCallback.js` 인증 분기: `parseAppLoginCookie` 실패 → `next()` 가 **헤더·쿠키를 건드리기 전**인지(웹 로그인 불변). 쿠키 삭제 시점(유효 쿠키면 성공·실패 무관 즉시).
2. `appAuthCodes.consume`: 형식 검사 → `codes.delete` → 만료 → `safeEqualAscii`(`crypto.timingSafeEqual`) 순서. 미지 코드에서도 S256 을 계산하는 점. 형식 오류 400 은 코드를 태우지 않는다는 선택(정당한 앱의 재시도를 깨지 않기 위함 — 공격자는 형식 오류로 얻는 정보가 없다).
3. 쿠키 속성(HttpOnly·Secure·SameSite=Lax·Path=/·Max-Age=600)과 `clearCookie` 가 같은 Path 로 지우는지 — 실제 헤더는 `appAuthHttp.test.js` 에서 검증.
4. 로그: `[app-auth]` 줄에 code·token·verifier·challenge 원문이 없는지(시험 3곳에서 확인).
5. **남는 위험(설계 한계, 구현 결함 아님)**: 악성 앱이 **스스로** app-start 를 자기 challenge 로 연 뒤 피해자가 그 Custom Tab 에서 로그인을 마치면, 그 악성 앱이 `theroute://` 를 받아 교환할 수 있다. PKCE 는 "남이 시작한 흐름의 코드 가로채기"만 막는다. 근본 대책은 App Links(https 검증 링크) — 후속 과제 후보.
6. 표시 쿠키는 사용자 브라우저가 스스로 위조할 수 있으나, 결과는 자기 토큰으로 코드를 받는 것뿐이라 권한 상승이 없다.

## Leader 에게 (파일 경계 밖 요청)

- `backend/node_modules` 심볼릭 링크가 `git status` 에 `??` 로 보인다 — `.gitignore` 의 `node_modules/`(끝 슬래시)는 디렉터리만 맞고 심볼릭 링크는 안 맞는다. 커밋 때 `git add -A` 를 쓰지 말거나, 스트림 N 이 `.gitignore` 에 `node_modules`(슬래시 없이) 를 넣어야 한다.
- `backend/package.json` test 스크립트 추가 여부(위 7번).

## 후속 패치 (2026-10-30 22:47) — 승인 데모 v1 폴백 + Reviewer L-1·L-2·L-6

근거: [[T009-reviewer-B]] (CONDITIONAL_PASS, 차단 0) · 승인 데모 `docs/demo/T009-android-apk-v1.html` §3 "제안 v1"(사용자 승인 2026-10-30 22:43) · 가이드 `docs/web-design/T009-android-apk-guide.md` §0·§2-3·§2-4.

| 파일 | 변경 |
|---|---|
| `backend/src/routes/appOAuthCallback.js` | `renderFallbackPage()` **한 함수만** 교체(+ 그 위 설명 주석). CSP 상수·이스케이프·딥링크 로직 무변경 |
| `backend/src/services/appAuthCodes.js` | L-6: `createAppAuthCodeStore` 첫 줄에 `maxEntries` 가 1 이상 정수가 아니면 `RangeError` |
| `backend/test/appOAuthCallback.test.js` | href 정규식을 새 마크업(`<a class="cta" href=…>`)에 맞춤 + 3건 추가(데모 구조·색·규격 / 외부 요청·스크립트 없음 / href 가 항상 `theroute://auth/callback?` 로 시작) |
| `backend/test/appAuth.test.js` | L-2 ① app-start `Referrer-Policy` · ③ exchange 400 `Cache-Control` 단언 |
| `backend/test/appAuthHttp.test.js` | L-1 로그 배열을 비우지 않고 구간(`logs.slice(logFrom)`)으로 검사 + 전체 흐름 시험 안에서 발급·교환 실패 로그가 실제로 찍혔는지 확인한 뒤 원문 부재 단언 · 마지막 누적 검사는 `[app-auth]` 3줄 이상 존재를 먼저 단언 · L-2 ① ② ③ 단언 |
| `backend/test/appAuthCodes.test.js` | L-6 시험 1건 |

### 폴백 페이지 — 승인 데모와 같은 점 / 다른 점
- 같음: `<title>더 루트</title>` · `referrer no-referrer` · 배경 `#f6f5f3`(--bg) · 화면 전체 가운데 정렬·padding 24px · 앱 이름 `더 루트` 13px 600 `#6b6b68`(--ink-3) 아래 14px · 상황 한 줄 16px 600 `#131313`(--ink-1)·`word-break:keep-all` · 문구 성공 `로그인이 완료되었습니다.` / 실패·취소 `로그인을 완료하지 못했습니다.` · 큰 주 버튼 `<a>` 하나(`role` 없음) min-height 52 · min-width 200 · 좌우 28 · 위 22 · 모서리 10 · 배경 `#ee6438` 다음 줄 `oklch(67% 0.18 38)` · 흰 글자 19px 700 · letter-spacing -0.2px · 누름 `brightness(.94)` · 포커스 `3px solid #9d2800` offset 2 · 시스템 글꼴(가이드 §2-3 글꼴 줄) · 성공·실패 같은 버튼.
- 다름(의도): 데모의 상황 줄은 `<h3 class="msg">`(데모 문서 안의 제목 계층 때문), 구현은 독립 페이지의 첫 제목이라 가이드 §2-4 대로 `<h1>`. 데모의 `.cta` 에 있던 `border:0; cursor:pointer; font:inherit`(버튼·링크 겸용 규칙)는 `<a>` 전용이라 뺐다. 포커스는 `:focus-visible` 로 걸었다(가이드는 "키보드 포커스"라고만 적음).
- 못 한 것: **브라우저 렌더 비교는 하지 않았다**(HTML 문자열·CSS 값 대조만). 샘플 HTML: `/tmp/claude-1000/-home-brownjeon-NFS-homes-brownjeon-project/f1b66db4-4f76-4841-aa22-e72593bc6de0/scratchpad/fallback-ok.html`, `…/fallback-err.html` — 세션 스크래치패드라 보존되지 않는다.

### 실행한 검증
- `node --check` 변경 JS 2개 OK
- `cd backend && nice -n 10 node --test test/*.test.js` → **tests 63 · pass 63 · fail 0** (rc=0). 이전 59 + 신규 4(폴백 3·L-6 1). L-1·L-2 는 기존 시험에 단언 추가.
- 보안 단언(이스케이프·CSP·javascript: 불가)은 약화하지 않고 늘렸다.

### 하지 않은 것 (지시대로 기록만)
- L-3 nginx `limit_req`(운영·sudo) · L-4 쿠키 잔존 트리거 · L-5 `__Host-` 접두 · INFO 설계 §14 행 갱신.

승인 데모: docs/demo/T009-android-apk-v1.html (v1) — 사용자 승인 2026-10-30 22:43 KST ("권고대로 진행해줘" = D1 B · D2 B · D3 B · D4 그대로로 해석, Leader 기록)

# [Design Guide] T009 안드로이드 앱 — 사용자에게 새로 보이는 4가지 (초안)

> 상태: **승인됨 (v1, 2026-10-30 22:43 KST)**. 결정 D1 B · D2 B · D3 B · D4 그대로.
> 아래 값이 승인 기준이다(데모 v1 의 권고안). 구현은 이 값을 그대로 따른다.
> 작성: designer · 2026-10-30 · 근거 문서: 개정 `docs/superpowers/plans/2026-10-30-android-apk-addendum.md` §4, 스펙 `docs/superpowers/specs/2026-09-18-android-apk-design.md` §5·§6·§7·§8·§10·§11

## 0. 먼저 바로잡을 전제 — 색 값의 출처

- 실제 웹 화면 색은 `web/src/styles/tokens.css` 다. `web/src/main.jsx` 는 `tokens.css`·`app.css` 만 import 하고, `base.css`(#fafafa·#ff5a3c·#1a1a1a·#6b7280)는 **어디서도 import 되지 않는다**(2026-10-30 확인).
- 09-18 스펙·계획서와 `designer.md` 토큰 표는 `base.css` 값을 근거로 썼다. 이 가이드는 `tokens.css` 값을 쓴다.
- app-shell·폴백 페이지는 웹 번들 밖의 단독 HTML 이라 CSS 변수를 못 읽는다. 아래 표의 **값을 그대로 복사**하고, 주석에 대응 토큰 이름을 적는다.

| 토큰 (tokens.css) | 값 | 단독 HTML 에 쓸 값 |
|---|---|---|
| `--bg` | `#f6f5f3` | `#f6f5f3` |
| `--surface` | `#ffffff` | `#ffffff` |
| `--ink-1` | `#131313` | `#131313` |
| `--ink-2` | `#3a3a39` | `#3a3a39` |
| `--ink-3` | `#6b6b68` | `#6b6b68` |
| `--line-2` | `#e0dfdb` | `#e0dfdb` |
| `--primary` | `oklch(67% 0.18 38)` | `background:#ee6438; background:oklch(67% 0.18 38);` (두 줄 — 구형 WebView 는 첫 줄, 신형은 둘째 줄) |
| `--primary-ink` | `oklch(46% 0.16 38)` | 포커스 테두리 `#9d2800` |
| `--r-sm` | `10px` | `10px` |

## 레이아웃 설계 (page-layout-designer)

새 화면 2개(app-shell·폴백)는 같은 골격을 쓴다. 기존 화면(LoginPage 등)은 구조를 바꾸지 않는다.

1. **목표**: app-shell = 서버를 못 불러온 사용자가 "무슨 일인지"와 "무엇을 하면 되는지"를 알고 다시 시도한다. 폴백 = 외부 브라우저에 남은 사용자가 한 번 눌러 앱으로 돌아간다.
2. **주요 위계**: 앱 이름(작게, 맥락) → 상황 한 줄(가장 진하게) → (app-shell 만) 해결 설명 → 버튼 하나.
3. **영역**: 화면 전체 한 칸, 내용은 가로·세로 가운데. 바깥 여백 24px.
4. **컴포넌트**: 큰 주 버튼 1개(아래 §2-3 "큰 주 버튼" 규격). 새 공용 컴포넌트를 만들지 않는다(웹 번들 밖이다).
5. **상태**: app-shell = 연결 실패 / 다시 연결 중. 폴백 = 로그인 성공 / 실패·취소(문구만 다르고 버튼은 같다).
6. **행동**: 주 행동 1개뿐. 보조·위험 행동 없음.
7. **반응형**: 360~412px 에서 문구는 줄바꿈(`word-break: keep-all`)만 하고 크기는 그대로. 버튼은 최소 폭 200px, 화면이 좁아도 줄어들지 않는다(360px 에서도 들어간다).

## 1. 화면 개요

| 요소 | 언제 보이나 | 어디서 나가나 | 담당 스트림·파일 |
|---|---|---|---|
| 앱 아이콘 | 설치 후 런처·최근 앱 | — | N · `mobile/scripts/gen-app-icons.mjs` 상수 |
| 연결 실패 안내 | 앱이 운영 웹을 못 불러올 때만(`server.errorPath`) | "다시 시도" → 운영 주소 | N · `mobile/app-shell/index.html` |
| 시스템 바 배경 | 항상(상태바·내비게이션 바 뒤) | — | N · `mobile/android/app/src/main/res/values/{styles.xml,theroute_colors.xml}` |
| "앱으로 돌아가기" 폴백 | 앱 로그인 복귀 때 `fallback` 표시가 있을 때만, Custom Tab 안 | 버튼 → `theroute://auth/callback?…` | B · `backend/src/routes/appOAuthCallback.js` 의 `renderFallbackPage` |
| 로그인 오류 문구 3종 | 앱 로그인 실패 뒤 `/login?error=` | 기존 LoginPage | W · `web/src/native/appLogin.js`(문구·분류), `web/src/api/auth.js`(`appExchange` 실패 구분) |

## 2. UI 구조

### 2-1. 앱 아이콘 (D1 권고 B · D3 권고 B)

생성기 상수만 바꾼다. 산출 PNG·XML 은 손으로 고치지 않는다.

```js
const BRAND = '#EE6438';      // tokens.css --primary 의 sRGB 근사값 (D3-A 를 고르면 '#FF5A3C')
const ON_BRAND = '#FFFFFF';
const ROUTE = 'M46,78 L62,56 L48,32';          // 아래에서 위로 지그재그로 오르는 선
const HOLDS = [
  { x: 46, y: 78, r: 6.5 },   // 시작
  { x: 62, y: 56, r: 5.5 },
  { x: 48, y: 32, r: 7.5 },   // 끝(완등) — 가장 크다
];
const STROKE = 5;
```

- D1-A(계획서 원안)를 고르면 09-18 계획서 상수 그대로(`ROUTE 'M38,74 L50,57 L65,65 L72,39'`, 홀드 4점, `STROKE 4`).
- D1-C(흰 바탕 반전)를 고르면 `BRAND='#FFFFFF'`, `ON_BRAND='#EE6438'`, 도형은 B 와 같다.
- 검증 가능한 조건: 모든 홀드가 중심 (54,54) 에서 반지름 33(안전 원 66dp) 안에 든다 — B 의 가장 먼 점은 (46,78) 거리 25.3 + r 6.5 = 31.8.
- monochrome 레이어는 foreground 와 같은 벡터(색은 런처가 칠한다). 웹 파비콘(`favicon.svg`·`favicon-32.png`·`apple-touch-icon.png`)도 같은 상수에서 나온다.
- 09-18 계획서의 생성기 주석 `// web/src/styles/base.css 의 --primary` 는 **틀린 근거**이므로 `// tokens.css --primary(oklch 67% 0.18 38) 의 sRGB 근사` 로 고친다.

### 2-2. 시스템 바 배경 (D2 권고 B)

- `theroute_colors.xml` 창 배경 = `#FFFFFF` (`--surface`, 상단바·하단 탭과 같은 색). D2-A 를 고르면 `#FAFAFA`.
- `styles.xml`: `windowLightStatusBar`·`windowLightNavigationBar` = `true`(아이콘 어둡게) — 스펙 §6 그대로.
- 🔴 XML 주석에 하이픈 두 개를 쓰지 않는다(스펙 §6). 토큰 이름을 주석에 적고 싶으면 `surface 토큰` 처럼 하이픈 없이 쓴다.

### 2-3. 연결 실패 안내 `mobile/app-shell/index.html`

구조(위에서 아래, 가로·세로 가운데 정렬, `text-align:center`):

```
<main>                       화면 전체, 배경 #f6f5f3, padding 24px
  <p .appname>더 루트</p>     13px · 600 · #6b6b68 · 아래 14px
  <div #fail>                (기본 보임)
    <h1>서버에 연결할 수 없습니다</h1>     18px · 700 · #131313 · 아래 6px
    <p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>   14px · 400 · #6b6b68
    <button type="button" #retry>다시 시도</button>      큰 주 버튼, 위 22px
  </div>
  <div #retrying hidden>
    <h1>다시 연결하는 중…</h1>
    <p>잠시만 기다려 주세요.</p>
    <span>스피너 18px + "연결 중"</span>   15px · #3a3a39 · 높이 52px(버튼 자리 유지)
  </div>
  <p aria-live="polite" class="sr-only"></p>
</main>
```

**큰 주 버튼** 규격(폴백 페이지도 같다): 높이 최소 52px · 최소 폭 200px · 좌우 패딩 28px · 모서리 10px · 배경 `--primary`(위 표의 두 줄) · 글자 흰색 **19px 700**(대비 3.2:1 이므로 "큰 글자" 기준 3:1 을 충족하려면 19px 굵게 미만으로 줄이지 않는다) · 누름 `filter: brightness(.94)` · 키보드 포커스 `outline: 3px solid #9d2800; outline-offset: 2px`.

글꼴: `-apple-system, system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif` — 오프라인 화면이라 Pretendard 를 원격으로 불러오지 않는다. 스피너는 `prefers-reduced-motion: reduce` 이면 회전하지 않는다.

### 2-4. "앱으로 돌아가기" 폴백 (`renderFallbackPage`)

```
<title>더 루트</title>                  (원안 "더 루트 — 앱으로 돌아가기" 에서 변경)
<meta name="referrer" content="no-referrer">   (유지)
<main>   배경 #f6f5f3, 가운데 정렬, padding 24px
  <p .appname>더 루트</p>        13px · 600 · #6b6b68 · 아래 14px
  <h1>{msg}</h1>                 16px · 600 · #131313
  <a href="{escape(deepLink)}" class="cta">앱으로 돌아가기</a>   큰 주 버튼(§2-3), 위 22px
</main>
```

- `msg`: 성공 `로그인이 완료되었습니다.` / 실패·취소 `로그인을 완료하지 못했습니다.` (원안 그대로).
- 버튼은 `<a>` 로 둔다(이동이므로 링크가 맞다. `role="button"` 을 붙이지 않는다). `href` 는 기존처럼 HTML 이스케이프.
- 이 페이지는 Custom Tab(크롬)에서 열리므로 `oklch` 가 지원되지만, 한 규격으로 맞추기 위해 §0 의 두 줄 표기를 그대로 쓴다.

### 2-5. 로그인 오류 문구 (D4)

기존 `LoginPage` 의 오류 줄(`<p style={s.error}>`, `--danger` · 12.5px, 비밀번호 칸과 로그인 버튼 사이)을 **그대로** 쓴다. 바꾸는 것은 `?error=` 에 실려 오는 문구뿐이다.

| # | 상황 | 판단 근거 | 문구 (그대로 복사) |
|---|---|---|---|
| T1 | 제공자 화면에서 취소 | 딥링크 `error`·`msg` 에 `access_denied` 또는 `cancel` | `로그인을 취소했습니다.` |
| T2 | 코드 만료·재사용·검증 불일치 | `app-exchange` 가 **401**, 또는 앱에 보관한 verifier 가 없거나 10분이 지나 교환을 시도하지 않음 | `로그인 시간이 지났습니다. 다시 로그인해 주세요.` |
| T3 | 서버에 닿지 못함 | `app-exchange` 요청에 **응답이 없음**(네트워크 오류·시간 초과) | `서버에 연결하지 못했습니다. 다시 로그인해 주세요.` |
| — | 그 밖의 실패(참고, 문장만 마침표 추가) | 400·5xx·`getMe` 실패 등 | `로그인에 실패했습니다. 다시 시도해 주세요.` |

- 서버가 보낸 401 문장(`로그인 코드가 만료되었거나…`)을 화면에 그대로 내보내지 않는다 — 상황별 고정 문구로 바꾼다.
- 이미 로그인된 상태에서 옛 launch 딥링크가 실패한 경우는 계획대로 **아무 문구도 띄우지 않는다**(변경 없음).

## 3. API 호출 계획

이번 디자인 범위에서 새 API 는 없다. 문구 분류에 필요한 기존(스트림 B 가 만드는) 호출만 적는다.

| 시점 | 메서드·경로 | 요청 | 응답 언랩 | 실패 시 |
|---|---|---|---|---|
| 딥링크 `?code=` 수신 | `POST /api/auth/app-exchange` | `{ code, verifier }` | `r.data.token` (인터셉터가 한 겹 벗김 — `r.data.data` 금지) | 401 → T2 · 응답 없음 → T3 · 그 밖 → 일반 실패 문구 |

## 4. 상태 관리

- app-shell: `body` 또는 두 묶음의 `hidden` 토글만. 저장소·플러그인 없음.
- 오류 문구: 기존 `NativeAppHost` 의 `pendingError` → `/login?error=` 경로 그대로(스펙 §8).

## 5. 파일 목록

| 파일 | 변경 | 스트림 |
|---|---|---|
| `mobile/scripts/gen-app-icons.mjs` | 상수 `BRAND·ROUTE·HOLDS·STROKE`(§2-1)·주석 근거 | N |
| `mobile/android/app/src/main/res/values/theroute_colors.xml` | 창 배경 `#FFFFFF` | N |
| `mobile/app-shell/index.html` | §2-3 구조·문구·스타일 | N |
| `backend/src/routes/appOAuthCallback.js` | `renderFallbackPage` 마크업·스타일·`<title>` (§2-4) | B |
| `web/src/native/appLogin.js` | `describeAuthError`·실패 분류 문구 T1~T3 | W |
| `web/src/api/auth.js` | `appExchange` 가 401·응답 없음을 호출부가 구분할 수 있게 실패를 던진다 | W |

화면 파일(`web/src/{pages,components,styles}/**`)은 이 가이드로 바꾸지 않는다. `LoginPage.jsx` 는 수정 대상이 아니다.

## 6. 구현 순서

1. (N) 생성기 상수 교체 → 미러에서 재생성 → 산출물 확인(아이콘 3레이어).
2. (N) `theroute_colors.xml`·app-shell 작성 → APK 정적 검사 때 app-shell `index.html` 이 APK 자산에 들어갔는지 확인(Capacitor 는 `webDir` 을 `assets/public/` 아래로 복사하는 것으로 안다 — 경로는 실제 APK 로 확인).
3. (B) `renderFallbackPage` 교체 → 기존 시험의 "앱으로 돌아가기"·이스케이프 단언이 그대로 통과하는지 확인.
4. (W) 문구 상수·실패 분류 → 시험에 T1·T2·T3 각 1건 추가(문구 문자열 정확 일치).

## 7. 주의사항·알려진 제약

- **실패 상태 코드가 지워진다**: `web/src/api/client.js` 응답 인터셉터는 오류를 `err.response?.data || { success:false, message }` 로 바꿔 던져 **HTTP 상태 코드가 남지 않는다**. T2(401)와 T3(응답 없음)를 가르려면 `appExchange` 가 상태를 알 수 있어야 한다. 인터셉터는 다른 화면에도 영향을 주므로 **바꾸지 않는다**. 구현 방법(예: 이 호출만 상태를 보존하는 방식)은 developer 가 정하고 Reviewer 가 확인한다 — 디자인이 요구하는 것은 "401 이면 T2, 응답이 없으면 T3" 라는 관찰 가능한 결과뿐이다.
- 기존 오류 줄 색(`--danger` 12.5px, 흰 카드 위 대비 약 4.4:1)은 일반 글자 기준 4.5:1 에 조금 못 미친다. **이번 범위 밖**(기존 화면, 디자인 변경 금지)이며 별도 개선 항목 후보다.
- 실기기에서만 판정되는 것: 런처 마스크 모양, 테마 아이콘 색, 시스템 바 높이, 하단 탭 아래 여백(하단 탭 자체 아래 여백 28px + 내비게이션 바). 하단 여백은 스펙 §10 대로 웹 CSS 를 미리 고치지 않는다.
- app-shell 은 Capacitor 플러그인에 접근할 수 없다(스펙 §5). "다시 시도" 는 `location.replace('https://climb.xn--lh0b87pnudm10a4vd.com/')` 만 한다. `online` 이벤트에도 같은 동작.
- 비로그인 처리: 해당 없음(4가지 요소 모두 로그인 전/밖에서 보이는 화면이며 사용자 데이터를 표시하지 않는다).

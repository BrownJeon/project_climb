---
tags: [type/handoff, domain/mobile, domain/design]
aliases: [T009-designer]
---

# T009 designer 인계 — 안드로이드 앱 delta 데모 v1

관련 task: [[T009-android-apk]] · 데모 게이트: level=delta, 규칙 DM-kw-risky-cta, 상태 drafting(변경하지 않음)

## 산출물

| 파일 | 상태 |
|---|---|
| `docs/demo/T009-android-apk-v1.html` | 작성 완료 · `check.mjs lint --expect T009-android-apk-v1` → `DEMO_LINT_PASSED` (경고 없음) · **아직 검토 요청 전** |
| `docs/web-design/T009-android-apk-guide.md` | 승인 전 초안(첫 줄 승인 버전 칸은 Leader 가 채움). 권고안 기준 값 |

## 기록

- [22:26] 읽은 근거: `designer.md`, `docs/demo-review-gate.md`, `docs/design-skills.md`, 개정 계획 `2026-10-30-android-apk-addendum.md` §4, 스펙 `2026-09-18-android-apk-design.md` §5~§11, 09-18 계획서의 app-shell·생성기·폴백 원안(Task 1·3·6), `web/src/pages/LoginPage.jsx`, `web/src/components/{OAuthButtons,BottomNav,TopBar}.jsx`, `web/src/main.jsx`, `web/src/styles/{tokens,base,app}.css`, `web/src/api/client.js`, `web/src/native/appLogin.js`(읽기만). 모두 worktree `/home/brownjeon/.node-local/theroute-app`.
- [22:28] **전제 정정**: 요청서가 준 색(#fafafa·#ff5a3c·#1a1a1a·#6b7280)은 `base.css` 값인데 `base.css` 는 어디서도 import 되지 않는다(`main.jsx` 는 `tokens.css`·`app.css` 만). 실제 값은 `tokens.css` — `--bg #f6f5f3`, `--surface #fff`, `--ink-1 #131313`, `--ink-3 #6b6b68`, `--primary oklch(67% 0.18 38)`(sRGB ≈ `#ee6438`). 게이트 `projects.json` 의 `token_files` 도 `tokens.css` 라 데모는 tokens.css 로 스냅샷했다(`demo-token-source …@sha256:a02dfd4f1666`). `designer.md` 의 토큰 표도 같은 오류가 있다 — 고치는 것은 Leader 판단.
- [22:28] 스펙 §11 "홀드 3점" ↔ 계획서 생성기 `HOLDS` 4점 불일치 발견 → 데모 A(원안 4점)·B(3점) 로 나란히 둠.
- [22:30] 아이콘 3안: A 원안 / B 세로 지그재그 3점·선 5 / C 흰 바탕 반전. 처음 B 는 가로로 퍼진 3점이었는데 렌더해 보니 안드로이드 "공유" 아이콘처럼 읽혀 세로로 길게 다시 그렸다. A 는 가로 꺾은선이라 차트 앱처럼 읽힌다. 권고 B — 48dp·단색(테마 아이콘)에서 요소가 적어 또렷하고 스펙 문구와 맞는다. 모든 도형은 원·직선뿐이라 생성기 상수(`ROUTE`·`HOLDS`·`STROKE`)로 그대로 옮겨진다. 안전 원 66dp 안에 듦(가장 먼 점 31.8).
- [22:31] 창 배경색 결정 D2 신설: 스펙 원안 `#FAFAFA` 는 앱의 어느 색과도 같지 않다. 시스템 바와 맞닿는 것은 흰 상단바(`TopBar` `--surface`)·흰 하단 탭(`BottomNav` `--surface`)이므로 `#FFFFFF` 권고.
- [22:31] 아이콘 주황 D3: 스펙·`index.html` theme-color `#FF5A3C` vs 실제 `--primary` sRGB `#EE6438`. 중요도 낮음, B 권고(앱 버튼·FAB 와 같은 색).
- [22:32] app-shell 제안: 원안은 앱 이름이 가장 큰 글자였다 → "상황(제목) → 해결(설명) → 버튼" 위계로 바꾸고 앱 이름은 작은 맥락 표시로. 재시도는 `location.replace` 만(플러그인 없음), `online` 이벤트 자동 재시도, `aria-live` 로 상태 알림. 오프라인 화면이라 원격 글꼴 없음.
- [22:32] 폴백 제안: 본문에 앱 이름 추가(Custom Tab 에서 어느 앱 페이지인지 알게), 상황 문구를 진하게, 큰 버튼 하나. 버튼은 `<a>` 유지(이동). 아이콘 이미지는 넣지 않았다 — 백엔드가 아이콘 SVG 를 따로 갖게 되면 생성기 단일 진실이 깨진다.
- [22:33] 로그인 오류 문구 3종(T1 취소 / T2 401·verifier 없음 → "로그인 시간이 지났습니다. 다시 로그인해 주세요." / T3 응답 없음 → "서버에 연결하지 못했습니다. 다시 로그인해 주세요."). "코드"는 사용자가 모르는 낱말이라 뺐고, 401 은 서버가 원인을 구분하지 않으므로(보안상 같은 본문) 한 문장으로 묶었다. 마침표는 기존 "로그인에 실패했습니다." 에 맞춤.
- [22:34] **developer 주의(알려진 제약)**: `client.js` 응답 인터셉터가 오류에서 HTTP 상태 코드를 지운다 → T2·T3 구분에는 `appExchange` 가 상태를 알 방법이 필요. 인터셉터는 건드리지 말 것(전 화면 영향). 방법은 developer·Reviewer 판단, 가이드 §7 에 기록.
- [22:35] 렌더 확인: 로컬 사본을 127.0.0.1 임시 서버로 열어 Playwright 로 캡처(콘솔 오류는 데모와 무관한 favicon 404 하나). 서버 종료·`/tmp/qa-artifacts` 의 이번 캡처 15개 이름 지정 삭제 완료. 브라우저가 새로고침 때 라디오 선택을 복원해 미리보기와 어긋나는 데모 버그를 발견해 고쳤다(체크된 라디오로 초기 렌더).
- [22:35] 디자인 스킬: layout·component (system 미적용 — TheRoute 프로필) / 자체 점검 P0 0·P1 0·P2 2, a11y Critical 0·Major 0·Minor 2
  - P2-1 B안 도형이 추상적이라 "앞으로(›)" 표시처럼 읽힐 여지 — 사용자 결정 D1 에서 판단.
  - P2-2 데모의 Custom Tab 상단 표시줄은 근사치(크롬 버전마다 다름).
  - Minor-1 기존 LoginPage 오류 줄 `--danger` 12.5px 대비 약 4.4:1(< 4.5) — 기존 화면·범위 밖, 개선 항목 후보.
  - Minor-2 큰 주 버튼 흰 글자/주황 3.2:1 은 19px 700(큰 글자 기준 3:1)일 때만 충족 — 가이드에 "19px 굵게 미만으로 줄이지 말 것" 명시. (기존 앱 로그인 버튼 15px 은 같은 이유로 기준 미달이지만 이번 범위 밖.)

## 사용자 결정 대기 (데모 "결정 필요" 패널)

| # | 내용 | 권고 |
|---|---|---|
| D1 | 아이콘 A 원안(4점) / B 세로 3점 / C 흰 바탕 | B |
| D2 | 시스템 바 뒤 창 배경 A `#FAFAFA` / B `#FFFFFF` | B |
| D3 | 아이콘 주황 A `#FF5A3C` / B `#EE6438` | B (중요도 낮음) |
| D4 | 새 문구(연결 실패·폴백·오류 3종) 그대로 / 수정 | 그대로 |

## 확인하지 못한 것

- 실제 런처 마스크·테마 아이콘 색·시스템 바 높이·하단 탭 아래 여백(실기기 전용).
- Capacitor 가 app-shell 을 APK 의 어느 자산 경로에 넣는지(`assets/public/` 로 알고 있으나 APK 로 미확인).
- `oklch` → sRGB 변환값 `#ee6438` 은 내 계산(OKLab 공식)이며 브라우저 렌더 값과 1~2 단위 차이가 날 수 있다.

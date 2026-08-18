---
task_id: T008
title: 마이페이지 설정 항목을 프로필 편집 화면으로 이동
slug: settings-into-profile-edit
project: TheRoute
status: done
roles_involved: developer, reviewer, qa
created: 2026-08-18
updated: 2026-08-18
tags:
  - type/task
  - domain/mypage
  - domain/profile
---

# T008 · 마이페이지 설정 항목을 프로필 편집 화면으로 이동

## 배경 / 요청

사용자 지시 (2026-08-18):
> "마이메뉴의 설정 항목은 프로필 편집 화면으로 이동시켜줘"

MyPage(`/me`)에 별도 섹션으로 노출되던 "설정"(로그아웃 버튼 + 영상 업로드 화질 선택)을 MyPage 메인 스크롤에서 **제거**하고, 프로필 블록의 "편집" 버튼이 여는 `ProfileEditModal`("프로필 편집" 화면) 안으로 **이동**한다. 복제가 아니라 이동이므로 MyPage에는 더 이상 설정 섹션이 남지 않아야 한다.

## 사전 조사 결과 (leader 역할 겸임, 2026-08-18)

- **이동 대상 블록**: [web/src/pages/MyPage.jsx:316-353](../../../web/src/pages/MyPage.jsx#L316-L353) — `{/* 설정 섹션 */}` 전체. 내용은 (1) 로그아웃 버튼(`confirm()` 후 `authLogout()`), (2) 영상 업로드 화질 `<select>`(`VIDEO_QUALITY_PRESETS`, `getVideoQualityKey`/`setVideoQualityKey`).
- **MyPage.jsx에서 이 블록 제거 시 함께 정리해야 할 것** (grep으로 확인 완료 — 아래 심볼들은 전부 이 설정 섹션에서만 쓰이고 있어 제거 후 dead code가 됨):
  - `import { useAuth } from '../contexts/AuthContext';` (13행) 및 `const { authLogout } = useAuth();` (25행)
  - `import { VIDEO_QUALITY_PRESETS, getVideoQualityKey, setVideoQualityKey } from '../utils/videoQuality';` (17행)
  - `const [videoQuality, setVideoQualityState] = useState(getVideoQualityKey);` (41행)
  - 단, 다른 곳에서 쓰이고 있지 않은지 최종 코드에서 한 번 더 grep으로 재확인할 것(이번 조사는 T007 반영 후 스냅샷 기준).
- **이식 대상**: `web/src/components/modals/ProfileEditModal.jsx`. 현재 이 모달은 `user` prop을 받아 닉네임/자기소개/시작일/최고레벨/주암장을 편집하고 상단 "저장" 버튼으로 `usersApi.updateMe(fd)`를 호출하는 폼이다. 로그아웃·화질 설정은 이 저장 흐름과 무관한 **독립 동작**이므로, `<Field>` 폼 항목들과 섞지 말고 폼 콘텐츠 아래(마지막 Field "주 암장" 다음, 모달 콘텐츠 div 닫히기 전)에 시각적으로 구분된 별도 블록으로 추가한다. MyPage 원본과 동일하게 "설정" 레이블(`fontSize:12, fontWeight:700, color:var(--ink-3)`) + 로그아웃 버튼 + 화질 select 스타일을 그대로 재사용.
- **ProfileEditModal은 현재 `useAuth`를 import하지 않는다** — 로그아웃 기능을 쓰려면 새로 import해야 한다. 화질 상태(`videoQuality`)도 모달 자체 로컬 state로 새로 선언해야 한다(MyPage와 마찬가지로 `useState(getVideoQualityKey)`).
- **로그아웃 확인 다이얼로그는 그대로 유지**(`confirm('로그아웃 하시겠습니까?')`). 로그아웃 실행 후 모달을 닫아야 하는지(`onClose()` 호출)는 `AuthContext.jsx`의 `authLogout` 구현(로그아웃 시 즉시 리다이렉트/컨텍스트 변경이 일어나는지)을 먼저 확인하고 판단할 것 — 이미 리다이렉트되어 MyPage 자체가 언마운트된다면 굳이 명시적 `onClose()` 호출이 필요 없을 수 있으나, 안전하게 `authLogout()` 직후 `onClose()`도 호출해 모달이 떠 있는 채로 방치되지 않게 하는 편을 권장한다.
- **저장(폼 제출) 흐름과 분리**: 화질 변경은 원본과 동일하게 `onChange`에서 즉시 `setVideoQualityKey()`로 로컬 저장(불변, 폼 "저장" 버튼과 무관하게 즉시 반영) — 이 동작 방식을 그대로 유지할 것.

## 대상 파일

**수정**
- `web/src/pages/MyPage.jsx` — 316-353행 "설정 섹션" 블록 삭제. 위에서 정리한 dead import/state 정리.
- `web/src/components/modals/ProfileEditModal.jsx` — 폼 콘텐츠 마지막(주 암장 Field 다음)에 로그아웃 버튼 + 영상 업로드 화질 select를 담은 "설정" 블록 추가. `useAuth`, `VIDEO_QUALITY_PRESETS`/`getVideoQualityKey`/`setVideoQualityKey` import 추가.

**건드리지 말 것**: `usersApi.updateMe` 저장 흐름(닉네임/자기소개/시작일/최고레벨/주암장) 자체, MyPage의 다른 섹션(암장 관리 진입, 이용권, 최근 방문 암장, 탭/영상 목록).

## 완료 기준

- MyPage.jsx 메인 화면에 "설정" 섹션이 더 이상 보이지 않는다.
- "편집" 버튼 → ProfileEditModal(프로필 편집)을 열면 폼 하단에 로그아웃 버튼과 영상 업로드 화질 선택이 보이고 기존과 동일하게 동작한다(로그아웃 확인 다이얼로그, 화질 선택 즉시 반영).
- MyPage.jsx에 dead import/state가 남지 않는다.
- `npm run build`(web) 성공.

## Developer 작업 기록

- [10:29] `AuthContext.jsx` 확인: `authLogout()`은 `localStorage` 토큰 제거 + `setUser(null)` 후 `window.location.href = '/login'`로 풀 페이지 네비게이션을 일으킴 — 컴포넌트가 언마운트되므로 명시적 `onClose()` 없이도 동작은 하지만, 이력서 권장대로 안전하게 `authLogout()` 직후 `onClose()`도 호출하도록 구현(모달이 떠 있는 채로 방치되는 경우 방지).
- [10:29] `web/src/components/modals/ProfileEditModal.jsx`: `useAuth`(`../../contexts/AuthContext`), `VIDEO_QUALITY_PRESETS`/`getVideoQualityKey`/`setVideoQualityKey`(`../../utils/videoQuality`) import 추가. `const { authLogout } = useAuth();`와 로컬 `const [videoQuality, setVideoQualityState] = useState(getVideoQualityKey);` 선언 추가. 마지막 `<Field label="주 암장 ...">` 다음, 콘텐츠 div 닫히기 전에 `<Field>`로 감싸지 않은 독립 `<div>` 블록으로 "설정" 레이블 + 로그아웃 버튼 + 화질 select를 MyPage 원본과 동일한 스타일·로직 그대로 이식(복제 아님 — 이동). 저장(`usersApi.updateMe`) 폼 흐름은 건드리지 않음.
- [10:29] `web/src/pages/MyPage.jsx`: 316-353행 "설정 섹션" 블록(로그아웃 버튼 + 화질 select) 삭제. grep 재확인 결과(`grep -n "authLogout\|VIDEO_QUALITY_PRESETS\|getVideoQualityKey\|setVideoQualityKey\|videoQuality" pages/MyPage.jsx` → 결과 없음) 해당 심볼들이 이 섹션 외 다른 곳에서 쓰이지 않음을 확인 후, dead import(`useAuth`, `VIDEO_QUALITY_PRESETS`/`getVideoQualityKey`/`setVideoQualityKey`) 3줄과 dead state(`videoQuality`/`setVideoQualityState`) 1줄 제거. 암장 관리 진입/이용권/최근 방문 암장/탭·영상 목록 섹션은 미변경(`git diff`로 최종 확인 — 변경 범위가 설정 섹션 삭제·import/state 정리에만 국한됨을 검증).
- [10:29] 빌드 검증: `cd web && npm run build` → `vite build` 성공(151 modules transformed, `dist/` 생성, 에러 없음. 청크 크기 경고는 기존부터 있던 것으로 이번 변경과 무관).
- [10:29] status: DONE. 변경 파일: `web/src/components/modals/ProfileEditModal.jsx`, `web/src/pages/MyPage.jsx`. self_check: build=true, dead-code grep=true(0 hits). Reviewer 인계 준비 완료.

## Reviewer 감사 기록

- [11:05] **판정: PASS** (Critical 0 / High 0 / Medium 0 / Low 1)
- [11:05] 검증①(의도 충족) — `web/src/pages/MyPage.jsx` 전체 Read: "설정" 섹션(로그아웃/화질) 완전 삭제 확인, `grep -n "설정" pages/MyPage.jsx` 결과 0건으로 잔존 헤딩 없음. `web/src/components/modals/ProfileEditModal.jsx` 전체 Read: 마지막 `<Field label="주 암장 ...">` 다음(223~224행), 콘텐츠 padding div 닫히기 전(261행)에 로그아웃 버튼 + 화질 select를 담은 신규 "설정" 블록 확인. 복제가 아니라 이동임을 두 파일 diff로 교차 확인(동일 JSX가 MyPage에는 없고 ProfileEditModal에만 존재).
- [11:05] 검증②(dead code) — `grep -n "useAuth\|authLogout\|VIDEO_QUALITY_PRESETS\|getVideoQualityKey\|setVideoQualityKey\|videoQuality\|setVideoQualityState" web/src/pages/MyPage.jsx` → 0 hits. import(13,17행 구 버전 기준)·state(41행 구 버전 기준) 전부 제거됐고, JSX 어디에도 해당 심볼을 참조하는 잔여 코드가 없어 런타임 ReferenceError 유발 가능성 없음. `npm run build` 독립 재실행 결과로도 미정의 참조 없음을 재확인(아래 참조).
- [11:05] 검증③(ProfileEditModal 신규 블록 정확성) — `useAuth`(7행)·`VIDEO_QUALITY_PRESETS`/`getVideoQualityKey`/`setVideoQualityKey`(8행) import 확인. 로그아웃 onClick(227행): `confirm('로그아웃 하시겠습니까?')` 문구가 삭제된 MyPage 원본과 완전 동일, true일 때 `authLogout(); onClose();` 순서로 호출 확인. 화질 select onChange(245-248행): `setVideoQualityKey(e.target.value)` 후 `setVideoQualityState(e.target.value)`로 로컬 state 갱신 — 원본과 동일 로직. 이 블록은 `<Field>`로 감싸지 않은 독립 `<div>`(224행 시작)이며, 컴포넌트 전체에 `<form>` 태그 자체가 없어(저장은 button onClick={submit} 호출 방식) "저장" 흐름과 구조적으로 얽힐 여지 없음. `submit()`(60-80행)은 이 블록과 완전히 분리되어 있으며 FormData에 로그아웃/화질 관련 필드를 추가하지 않음.
- [11:05] 검증④(다른 섹션 무변경) — `git diff -- web/src/pages/MyPage.jsx` 확인 결과, 설정 섹션 삭제·dead import/state 정리 외에 "최근 방문 암장"(recentGyms) 관련 대규모 추가(useNavigate/GymCard/climbLogsApi import, RECENT_GYMS_LIMIT, recentGyms state, loadRecentGyms 함수, JSX 섹션)가 diff에 함께 나타남 — 최초엔 T008 스코프 위반으로 의심했으나, `agent-vault/10-Flow/tasks/T007-mypage-recent-gyms.md`(status: done, 2026-08-18)가 이 기능을 이미 완료했고 아직 git에 커밋되지 않은 상태였음을 확인(마지막 커밋은 2026-08-16, T007/T008 모두 2026-08-18 작업)했기에 T008 Developer 책임이 아님. 암장 관리 진입/이용권/탭·영상 목록 섹션은 diff에 전혀 나타나지 않아 무변경 확인. `web/src/components/modals/ProfileEditModal.jsx` diff는 import 2줄 + `authLogout`/`videoQuality` 선언 2줄 + 신규 "설정" 블록(220행 이후) 추가만 존재, 기존 Field·submit 로직 무변경.
- [11:05] 검증⑤(AuthContext) — `web/src/contexts/AuthContext.jsx` 직접 확인 결과 Developer 주장 사실과 일치: `authLogout()`(26-30행)이 `localStorage.removeItem` + `setUser(null)` 후 `window.location.href = '/login'`으로 즉시 풀 페이지 리다이렉트함.
- [11:05] 검증⑥(빌드 재실행) — Reviewer가 독립적으로 `cd web && npm run build` 재실행: `vite v5.4.21 building for production... ✓ 151 modules transformed ... ✓ built in 1.28s`, 에러 없음. 청크 크기 경고(520KB)는 기존부터 있던 것으로 이번 변경과 무관함을 확인.
- [11:05] Low 이슈 1건(비차단): `ProfileEditModal.jsx`의 새 "설정" 블록 최상위 컨테이너가 MyPage 원본에 있던 `padding:'14px 16px', background:'var(--surface)', borderBottom:'1px solid var(--line)'` 섹션 래핑 스타일 없이 `<div>`(스타일 없음)로만 감싸져 있음 — 모달의 기존 Field 블록들과 시각적 밀도를 맞추기 위한 의도적 단순화로 보이며 기능·요구사항 위반은 아님. QA가 실브라우저에서 화면 하단 여백/구분선이 어색하지 않은지 육안 확인 권장.
- [11:05] QA 집중 포인트: (1) `web/src/pages/MyPage.jsx` — "설정" 섹션이 화면에 전혀 보이지 않는지, 편집 버튼 클릭 전/후 레이아웃 시프트 없는지. (2) `web/src/components/modals/ProfileEditModal.jsx` 220-260행 — 로그아웃 버튼 클릭 시 confirm 취소하면 아무 일도 안 일어나는지, confirm 확인 시 `/login`으로 실제 리다이렉트되는지, 화질 select 변경이 새로고침 후에도 유지되는지(localStorage 반영). (3) "저장" 버튼 클릭이 로그아웃/화질 블록과 무관하게 닉네임 등 프로필 필드만 저장하는지(두 동작이 서로 간섭하지 않는지). (4) 위 Low 이슈 — 설정 블록의 시각적 여백이 사용성에 문제없는지.

## QA 검증 기록

- [11:40] **판정: PASS** (Critical 0 / High 0 / Medium 0 / Low 1 — Reviewer가 남긴 기존 Low 재확인, 신규 결함 없음).
- [11:40] **실브라우저 검증 여부: 미실시.** T007 QA 때와 동일한 사유·판단 기준 적용.
  1. `mcp__plugin_ecc_chrome-devtools__list_pages` 직접 시도 → `"The browser is already running for .../chrome-profile. Use --isolated to run multiple browser instances."` 에러로 접속 자체가 막힘(T007 QA 때와 동일 증상 — 세션 내 다른 프로세스가 공유 프로필 점유 중).
  2. 설사 접속됐더라도 `/me`는 `ProtectedRoute` 보호 라우트라 실로그인 세션이 필요하고, `agent-vault/00-Context/ACTIVE.md`의 "검증 환경 메모"에 따르면 자동화 브라우저 진입은 `JWT_SECRET` 기반 단기 토큰을 `localStorage.theroute_token`에 주입하는 방식이며 이는 "사용자 승인 필요"로 명시돼 있어 비대화형 세션에서 임의 진행하지 않음.
  → 아래는 **코드 정적 추적 + `npm run build` 독립 재실행 + `git diff` 재확인**으로 대체 검증한 결과다.
- [11:40] **체크리스트 1 (MyPage.jsx "설정" 완전 제거) — PASS**: `grep -n "설정" web/src/pages/MyPage.jsx` → 0 hits(exit 1). `git diff -- web/src/pages/MyPage.jsx`로 실제 삭제 hunk 확인 — 구 274~281행대 `{/* 설정 섹션 */}` 주석부터 로그아웃 버튼·화질 select 블록 전체가 diff상 `-` 로만 나타나고 대응하는 `+` 없음(순수 삭제).
- [11:40] **체크리스트 2 (ProfileEditModal.jsx 문법·구조) — PASS**: 파일 전체(265행) Read로 직접 확인. 로그아웃 버튼(227행)·화질 select(243-258행) 실존. JSX 태그/중괄호 짝 정상(최상위 `overlay div → sheet div → header/error/content div → Field*5 → 신규 설정 div`가 262~264행에서 순서대로 정확히 닫힘), `showGymPicker` 상태(25, 192, 195, 218행)는 "주 암장" Field 안에서만 쓰이고 신규 설정 블록과 이름·로직 충돌 없음. `npm run build` 성공 자체가 문법 오류 없음의 강한 근거.
- [11:40] **체크리스트 3 (로그아웃 confirm→authLogout→onClose 순서) — PASS**: 227행 `onClick={() => { if (confirm('로그아웃 하시겠습니까?')) { authLogout(); onClose(); } }}` — `if` 블록 안에 `authLogout(); onClose();`가 순서대로 있어 confirm이 `true`일 때만 두 호출이 보장된 순서로 실행됨. confirm이 `false`(취소)면 `if` 블록 자체가 실행되지 않아 아무 동작도 일어나지 않음 — 코드 구조상 명확.
- [11:40] **체크리스트 4 (화질 select onChange) — PASS**: 245-248행 `onChange={(e) => { setVideoQualityKey(e.target.value); setVideoQualityState(e.target.value); }}` 확인 — 유틸 함수 호출(영속화 추정)과 로컬 state 갱신이 둘 다 수행됨. 240행 `VIDEO_QUALITY_PRESETS.find((p) => p.key === videoQuality)?.desc || ''`는 옵셔널 체이닝 + `|| ''` 폴백이 있어 `find` 결과가 `undefined`여도 크래시 없음 — 깨지지 않음.
- [11:40] **체크리스트 5 (저장 흐름과 미간섭) — PASS**: `submit()`(60-80행) 전체를 다시 읽어 확인 — `FormData`에 담기는 필드는 `nickname/bio/climbing_started_at/max_level_color/max_level_grade/main_gym_ids/profile_image` 뿐이고 로그아웃·화질 관련 값은 전혀 참조하지 않음. 컴포넌트에 `<form>` 태그 자체가 없고 저장은 헤더의 `<button onClick={submit}>`(86행) 클릭으로만 트리거되므로, 신규 설정 `<div>`(224행, `<Field>`로 감싸지 않은 독립 블록) 안의 `<button>`(로그아웃)·`<select>`(화질)가 이벤트 버블링이나 암묵적 submit으로 저장 로직에 영향을 줄 경로가 구조적으로 없음.
- [11:40] **체크리스트 6 (Reviewer Low 이슈 재확인) — 확인, 비차단으로 판단**: 신규 설정 `<div>`(224행)는 자체 `padding/background/borderBottom` 없이 MyPage 원본 대비 단순화된 것은 사실. 다만 이 블록의 부모 컨테이너(96행 `<div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>`)가 모든 `<Field>`와 이 신규 블록에 동일한 좌우 패딩(16px)과 형제 요소 간 14px 세로 gap을 이미 부여하고 있어, "완전히 민무늬"라기보다는 다른 Field들과 동일한 여백 리듬을 그대로 물려받는 구조다. 실제로 깨지는 것은 (a) 이전 Field(주 암장)와의 사이에 있던 뚜렷한 구분선(border-top/배경 대비)이 없어 "설정"이 독립 섹션이라기보다 하나의 Field처럼 보일 수 있다는 시각적 뉘앙스 차이뿐이며, (b) 레이아웃 붕괴(overflow, 요소 겹침, 줄바꿈 깨짐)로 이어질 요소는 코드상 없음. Reviewer 판정대로 **여백 차이 수준의 Low, 비차단**으로 재확인.
- [11:40] **체크리스트 7 (빌드 독립 재실행) — PASS**: `cd web && npm run build` 재실행 결과 `vite v5.4.21 building for production... ✓ 151 modules transformed ... ✓ built in 1.24s`, 에러 0건. 500KB 청크 크기 경고는 기존부터 있던 것으로 이번 변경과 무관.
- [11:40] **체크리스트 8 (다른 화면 영향 없음) — PASS, 단 확인 과정 기록**: `git status --porcelain -- web/` 결과 `ProfileEditModal.jsx`/`MyPage.jsx` 외에 `GymListPage.jsx`(M)·`GymCard.jsx`(신규, untracked)도 나타남. `git diff -- web/src/pages/GymListPage.jsx` 직접 확인 결과 이는 인라인 암장 카드 마크업을 `GymCard` 컴포넌트로 추출하는 변경으로, T008 작업 기록(Developer/Reviewer)과 무관한 내용 — `agent-vault/10-Flow/tasks/T007-mypage-recent-gyms.md`를 대조한 결과 T007(마이페이지 최근 방문 암장 미리보기, status: done)이 이미 이 변경을 만들었고 Developer/Reviewer/QA 3단계 모두 PASS로 검증을 마친 뒤 아직 git commit만 되지 않은 상태(2026-08-16 마지막 커밋 이후 T007·T008 모두 2026-08-18 작업)임을 확인 — T008이 유발한 회귀가 아니다. `MyPage.jsx` diff도 hunk 단위로 재확인한 결과 "설정 섹션" 삭제 hunk와 dead import/state 정리 hunk 외에 이용권·최근 방문 암장(T007)·암장 관리 진입·탭 목록 섹션을 건드리는 hunk는 없음.
- [11:40] **요약**: Developer·Reviewer 기록의 모든 주장(코드 위치·순서·범위)을 코드 Read·grep·`git diff`·독립 빌드로 재확인했고 불일치 없음. Critical/High/Medium 결함 0건. Reviewer의 Low 1건(설정 블록 시각적 여백)은 코드 구조상 레이아웃 붕괴로 이어지지 않는 비차단 항목으로 재확인. 실브라우저 확인은 수행하지 못했으므로(사유 상술) 사용자에게 브라우저 육안 확인을 권장한다.

## 최종 요약 (사용자용)

**마이페이지(`/me`)에 별도로 있던 "설정"(로그아웃, 영상 업로드 화질 선택)이 사라지고, "편집" 버튼으로 여는 프로필 편집 화면(바텀시트) 맨 아래로 옮겨졌습니다.**

### 무엇이 바뀌었나

- 마이페이지를 스크롤하면 더 이상 "설정" 섹션이 보이지 않습니다.
- 대신 프로필 블록의 "편집" 버튼을 눌러 여는 프로필 편집 화면의 맨 아래(마지막 항목인 "주 암장" 다음)에 로그아웃 버튼과 영상 업로드 화질 선택이 그대로 옮겨져 있습니다.
- 동작 방식은 예전과 동일합니다 — 로그아웃 버튼을 누르면 "로그아웃 하시겠습니까?" 확인창이 뜨고, 확인을 누르면 로그아웃 후 로그인 화면으로 이동합니다(취소하면 아무 일도 일어나지 않습니다). 화질 선택은 값을 바꾸는 즉시 저장되며, 프로필 편집 화면의 "저장" 버튼(닉네임 등 프로필 정보 저장용)과는 서로 무관하게 동작합니다.

### 왜 이동했나

사용자 지시("마이메뉴의 설정 항목은 프로필 편집 화면으로 이동시켜줘")에 따라 복제가 아니라 완전한 이동으로 처리했습니다. 마이페이지 쪽 관련 코드(사용하지 않게 된 import·상태 변수 포함)는 전부 정리해 죽은 코드가 남지 않았습니다.

### 검증 결과

Developer 구현 → Reviewer 코드 감사(PASS, Low 1건) → QA(저) 검증까지 3단계 모두 통과했습니다.

- 설정 섹션이 마이페이지에서 완전히 사라졌는지, 프로필 편집 화면에 로그아웃·화질 선택이 정상 동작 순서(확인창 → 로그아웃 → 화면 닫힘)로 옮겨졌는지, 죽은 코드가 없는지, 저장 버튼 로직과 서로 간섭하지 않는지, 다른 화면(암장 관리 등)에 영향이 없는지, 웹 빌드(`npm run build`) 성공 여부까지 총 8개 항목을 코드 직접 추적 + `git diff` + 빌드 독립 재실행으로 확인했고 결함은 없었습니다.
- **이번에도 실제 브라우저로 눈으로 확인하지는 못했습니다.** 이유는 T007 때와 동일합니다 — (1) 자동화 브라우저(Chrome DevTools MCP)가 다른 프로세스에 이미 점유돼 있어 접속 자체가 안 됐고, (2) 설사 접속됐더라도 `/me`와 프로필 편집 화면은 로그인이 필요해서 자동 로그인을 하려면 토큰을 브라우저에 직접 주입해야 하는데, 이는 "사용자 승인이 필요한 민감 동작"으로 분류돼 있어 임의로 진행하지 않았습니다.
- Reviewer가 남긴 Low 이슈(비차단) 1건: 프로필 편집 화면에 새로 생긴 "설정" 블록이 마이페이지 원본과 달리 배경색·구분선이 있는 별도 카드 느낌 없이, 다른 입력 항목들과 같은 여백으로만 구분됩니다. 코드로 확인한 결과 레이아웃이 깨지거나 요소가 겹치는 문제는 없고, 단지 "설정"이 하나의 독립된 섹션처럼 뚜렷하게 구분되어 보이지는 않을 수 있는 정도의 디자인 차이입니다.

### 사용자가 확인해 주시면 좋은 점

브라우저로 `climb.미라클펭귄.com` (또는 개발 서버)에 로그인해서 마이페이지 → "편집" 버튼을 눌러 아래를 육안으로 봐 주시면 완전히 마무리됩니다.
1. 마이페이지 스크롤에 "설정" 섹션이 더 이상 없는지
2. 프로필 편집 화면 맨 아래에 로그아웃 버튼과 화질 선택이 있고, 위 Low 이슈처럼 여백이 어색해 보이지 않는지(어색하면 배경/구분선 추가는 간단한 후속 작업입니다)
3. 로그아웃·화질 선택이 예전처럼 잘 동작하는지, "저장" 버튼을 눌렀을 때 닉네임 등 프로필 정보만 정상 저장되는지

**추가 배포 작업 없이 지금 바로 확인 가능합니다.** `backend/src/index.js`가 `web/dist`를 정적 서빙하는 구조라, QA 검증 중 `npm run build`를 재실행하며 `web/dist`가 최신 상태로 갱신됐습니다. 백엔드 코드는 이번 작업에서 건드리지 않았으므로 `pm2 restart` 없이도 새 파일이 바로 서빙됩니다.

## 추가 수정 (leader 역할 겸임 직접 처리, 2026-08-18)

QA PASS 이후 사용자가 육안 확인 없이 바로 3가지 폴리시를 추가 지시:
> "옮긴 설정항목에 대하여 설정 문구는 제거해주고 로그아웃 버튼은 제일 아래에 위치하도록 변경해준 후에 약간 공간을 떨어뜨려서 잘못 클릭하는 상황을 대비해줘."

단순 텍스트 제거 + JSX 순서 교체 + margin 조정 수준이라 3단계 에이전트 재순환 없이 직접 처리:

- `web/src/components/modals/ProfileEditModal.jsx` — "설정" 레이블 `<div>` 제거. 화질 select 블록을 로그아웃 버튼보다 먼저 오도록 순서 교체(화질 → 로그아웃). 로그아웃 버튼 `marginTop`을 기존 그룹 내 여백(8~14px 수준)보다 훨씬 큰 `28px`로 지정해 화질 select와 시각적으로 확실히 분리 — 스크롤/터치 중 화질 select 조작 여파로 로그아웃 버튼을 오터치하는 상황을 줄이려는 목적.
- 검증: `npm run build` 재실행 — `vite build` 성공(151 modules, 에러 없음). 로그아웃 onClick 핸들러(`confirm → authLogout → onClose`)와 화질 select onChange 로직 자체는 건드리지 않고 배치만 바꿨으므로 기존 Reviewer/QA 검증(로직 정확성)은 여전히 유효하다고 판단.
- Reviewer가 남겼던 Low 이슈(설정 블록에 배경/구분선 없음)는 이번 수정으로도 해소되지 않음 — "설정" 레이블까지 제거되어 이제는 아예 레이블 없는 두 항목(화질, 로그아웃)만 남은 상태. 사용자가 이후 시각적으로 어색하다고 판단하면 별도 후속 작업으로 처리.
- 실브라우저 확인은 여전히 미실시(사유는 위 QA 기록과 동일) — 사용자 육안 확인 시 로그아웃 버튼이 화질 select와 뚜렷하게 떨어져 보이는지, "설정" 문구가 사라졌는지 함께 봐주시면 됩니다.

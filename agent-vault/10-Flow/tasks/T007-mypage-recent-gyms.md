---
task_id: T007
title: 마이페이지 최근 방문 암장 4개 미리보기
slug: mypage-recent-gyms
project: TheRoute
status: done
roles_involved: developer, reviewer, qa
created: 2026-08-18
updated: 2026-08-18
tags:
  - type/task
  - domain/mypage
  - domain/gym
---

# T007 · 마이페이지 최근 방문 암장 4개 미리보기

## 배경 / 요청

사용자 지시 (2026-08-18):
> "마이 화면에 설정 항목 위쪽에 최근 방문 암장 상위 4개의 목록을 보여주는 항목을 추가해줘. 항목에는 암장관리 목록에서 사용하는 항목을 재사용하도록 해줘"

즉 `MyPage.jsx`의 "설정" 섹션 바로 위(현재는 이용권 섹션 다음)에 최근 방문 암장 상위 4개를 보여주는 새 섹션을 추가하고, 그 목록 아이템(카드)은 `GymListPage.jsx`에서 쓰는 것과 **동일한 마크업을 공유 컴포넌트로 재사용**한다.

## 사전 조사 결과 (leader 역할 겸임, 2026-08-18)

- **삽입 위치**: [web/src/pages/MyPage.jsx](../../../web/src/pages/MyPage.jsx) 이용권(Passes) 섹션 끝(275행) ~ 설정 섹션 시작(277행) 사이.
- **재사용 대상 아이템은 현재 컴포넌트로 분리되어 있지 않음** — [web/src/pages/GymListPage.jsx:180-265](../../../web/src/pages/GymListPage.jsx#L180-L265)에 `.map()` 인라인 JSX로만 존재. "재사용"을 만족하려면 이 마크업을 `web/src/components/GymCard.jsx`(신규)로 추출하고, GymListPage·MyPage 양쪽에서 그 컴포넌트를 사용해야 한다. 단순 복붙은 요청 취지(재사용) 위반.
- **데이터 소스**: 최근 방문 암장 API가 이미 존재함 — `climbLogsApi.visitedGymsWithDetail(limit)` → `GET /climb-logs/visited-gyms?include_gym=true&limit=N` ([web/src/api/climbLogs.js:6](../../../web/src/api/climbLogs.js#L6)). GymListPage의 "최근 방문" 필터 칩이 이미 이 API를 `limit=30`으로 쓰고 있다(GymListPage.jsx:91). MyPage에서는 `limit=4`로 호출하면 되고, 정렬(최신 방문순)은 백엔드가 이미 보장한다고 가정 — 신규 백엔드 작업 불필요.
- **GymCard가 감싸는 원본 아이템 구성** (GymListPage.jsx:180-265): 썸네일(9:13.5 비율) + 이름 + 주소 + 영업시간/영상수/최근방문일 메타 + 난이도별(color/level) breakdown 칩 + 수정/삭제 버튼(관리 컨텍스트 전용) + 클릭 시 `/gyms/:id`로 이동.
- **MyPage 컨텍스트는 관리가 아니라 미리보기**이므로 수정/삭제 버튼은 노출하지 않아야 한다 → `GymCard`는 `showActions`(또는 `onEdit`/`onDelete` 유무) prop으로 액션 버튼 노출을 제어하도록 설계할 것. 클릭 시 상세 이동(`/gyms/:id`)은 두 화면 공통으로 유지.
- **빈 상태 처리**: 같은 페이지의 이용권 섹션(MyPage.jsx:199-203)이 "등록된 이용권이 없습니다" 형태의 dashed 박스 empty state를 쓰는 패턴이 있다. 최근 방문 암장도 0건이면 섹션 헤더는 유지하고 동일 패턴의 empty state를 쓸 것(섹션 자체를 숨기지 말 것) — 페이지 내 기존 UX 일관성 유지.
- **참고**: 설정 섹션 위라는 위치 지정과 무관하게, 이 섹션은 "암장 관리" 진입 링크(MyPage.jsx:164-178, 프로필 블록 바로 아래) 와는 다른 섹션이다. 혼동해서 그 링크 블록을 건드리지 말 것.

## 대상 파일

**신규**
- `web/src/components/GymCard.jsx` — GymListPage.jsx:180-265의 아이템 마크업을 추출. props 예: `{ gym, onClick, showActions = true, onEdit, onDelete }`

**수정**
- `web/src/pages/GymListPage.jsx` — 인라인 `.map()` 블록을 `<GymCard>` 사용으로 교체(`onEdit`/`onDelete`/`onClick` 연결). 기존 동작(수정/삭제 버튼, breakdown 칩, 클릭 이동) 100% 동일하게 유지할 것 — 회귀 금지.
- `web/src/pages/MyPage.jsx` — 275행(이용권 섹션 종료) ~ 277행(설정 섹션 시작) 사이에 "최근 방문 암장" 섹션 추가. `climbLogsApi.visitedGymsWithDetail(4)`로 데이터 로드(다른 `useEffect(() => { loadUser(); loadPasses(); }, [])` 패턴과 동일하게 마운트 시 1회 호출), `<GymCard showActions={false} onClick={...} />`로 렌더링.

**건드리지 말 것**: 백엔드(`/climb-logs/visited-gyms` 엔드포인트는 이미 필요한 기능을 갖추고 있음 — limit 파라미터로 충분), MyPage의 "암장 관리" 진입 링크 블록(164-178행), 설정 섹션 자체(277행 이후).

## 완료 기준

- `GymCard` 공유 컴포넌트로 GymListPage·MyPage 양쪽이 동일 아이템 마크업을 사용한다(코드 중복 없음).
- MyPage 이용권 섹션과 설정 섹션 사이에 "최근 방문 암장" 섹션이 상위 4개만 노출한다.
- GymListPage 기존 동작(검색/필터/수정/삭제/breakdown 칩) 회귀 없음.
- `npm run build`(web) 성공.

## Developer 작업 기록

- [10:07] `web/src/components/GymCard.jsx` 신규 작성. `GymListPage.jsx:182-264`의 인라인 `.map()` 아이템 마크업(썸네일 9:13.5 + 이름/주소 + 영업시간·영상수·최근방문일 메타 + `routes_breakdown` 난이도 칩 + 수정/삭제 버튼 + chevron)을 그대로 옮겼다. props는 사전 조사에서 지정된 대로 `{ gym, onClick, showActions = true, onEdit, onDelete }`. `showActions=false`일 때는 수정/삭제 버튼 블록만 숨기고 chevron은 유지했다(두 화면 모두 클릭 시 상세로 이동하므로 "더 볼 수 있다"는 시각 신호는 공통으로 남기는 게 맞다고 판단). 원본과 마크업·스타일·조건부 렌더링 로직을 1:1로 옮겨 회귀 여지를 최소화했다.
- [10:07] `web/src/pages/GymListPage.jsx` 수정: 인라인 카드 JSX를 `<GymCard gym={g} onClick={() => nav(\`/gyms/${g.id}\`)} onEdit={setEditTarget} onDelete={handleDelete} />`로 교체. `onEdit`/`onDelete` 콜백 시그니처(`(gym) => void`)가 기존 `setEditTarget(g)` / `handleDelete(g)` 호출과 그대로 맞아떨어져 로직 변경 없이 연결만 했다. 더 이상 이 파일에서 쓰이지 않게 된 `colorMeta`(../utils/colors), `formatDateKR`(../utils/climbingTenure) import를 제거했다(`I` import는 검색 아이콘·필터 칩·상단바 버튼에 계속 쓰여서 유지). grep으로 두 심볼의 잔여 참조가 없음을 확인.
- [10:07] `web/src/pages/MyPage.jsx` 수정: 이용권 섹션 종료(구 275행) ~ 설정 섹션 시작(구 277행) 사이에 "최근 방문 암장" 섹션을 추가했다. `climbLogsApi.visitedGymsWithDetail(RECENT_GYMS_LIMIT=4)`를 신규 `loadRecentGyms()` 함수로 감싸 기존 `useEffect(() => { loadUser(); loadPasses(); }, [])`에 `loadRecentGyms()` 호출을 합류시켰다(기존 마운트 시 1회 로드 패턴 그대로, 별도 useEffect 추가하지 않음). `useNavigate`를 새로 import해서 `nav('/gyms/:id')`로 이동시키는 방식을 택했다 — GymListPage와 동일한 이동 방식(Link 아님)으로 일관성을 맞췄다. 빈 상태는 이용권 섹션(199-203행)과 동일한 dashed 박스 패턴(`border: 1px dashed var(--line-2)`)을 그대로 재사용했고, 0건이어도 섹션 헤더("최근 방문 암장")는 항상 렌더링해 섹션 자체가 숨겨지지 않게 했다. "암장 관리" 진입 링크 블록(164-178행)과 설정 섹션 본문(277행 이후)은 손대지 않았다. 색상은 전부 기존 CSS 변수(`var(--surface)`, `var(--ink-1/2/3)`, `var(--line)`, `var(--line-2)`, `var(--r-md)`)만 사용, 하드코딩 없음.
- [10:07] 빌드 검증: `cd .../TheRoute/web && npm run build` 실행 → `vite build` 성공 (`✓ 151 modules transformed`, `✓ built in 1.49s`, 경고는 기존에도 있던 청크 크기 경고 1건뿐, 에러 없음). `grep -n "colorMeta|formatDateKR" src/pages/GymListPage.jsx` 결과 0건으로 dead import 없음을 재확인.

## Reviewer 감사 기록

- [11:20] **판정: PASS** (Critical 0 / High 0 / Medium 0 / Low 1). `git diff`로 실제 변경분(HEAD 대비)을 직접 확인하고, GymCard.jsx/GymListPage.jsx/MyPage.jsx/climbLogs.js/backend climb-logs.js/auth.js/main.jsx(router)/AuthContext.jsx를 전부 직접 Read해서 Developer 주장을 재검증했다. `npm run build`도 독립적으로 재실행해 성공을 재확인했다(`✓ 151 modules transformed`, `✓ built in 1.27s`, 에러 0건 — Developer 보고와 별개로 직접 실행).
- [11:20] **1. 의도 충족 — 확인**: `web/src/components/GymCard.jsx` 신규 생성 확인. `GymListPage.jsx`(line 7)·`MyPage.jsx`(line 5) 양쪽 모두 `import GymCard from '../components/GymCard'`로 **동일 컴포넌트를 실제 import해서 사용** — `git diff web/src/pages/GymListPage.jsx` 확인 결과 기존 인라인 `.map()` JSX 전체가 삭제되고 `<GymCard gym={g} onClick={...} onEdit={setEditTarget} onDelete={handleDelete} />` 호출로 1:1 교체됨(마크업 복붙이 아니라 진짜 컴포넌트 추출·공유). `git diff web/src/pages/MyPage.jsx` 확인 결과 이용권 섹션(passes, 종료 지점) 바로 다음 ~ "설정 섹션" 주석 바로 앞 사이에 정확히 삽입됨(요청한 위치와 일치). `MyPage.jsx:50` `climbLogsApi.visitedGymsWithDetail(RECENT_GYMS_LIMIT)`, `RECENT_GYMS_LIMIT = 4`(line 19) 확인 — 상위 4개 제한 정확.
- [11:20] **2. GymListPage 회귀 여부 — 확인, 회귀 없음**: `git diff`로 삭제된 원본 블록과 GymCard.jsx 내용을 라인 단위 대조. 검색(`q`/`debouncedQ`), 필터 칩(all/near/recent/main) 로직은 GymCard 추출과 무관한 영역이라 손대지 않음(그대로 유지, GymListPage.jsx:35-112). `onEdit={setEditTarget}` → GymCard 내부 `onEdit?.(g)` 호출 → 기존 `onClick={() => setEditTarget(g)}`와 동일 결과. `onDelete={handleDelete}` → `onDelete?.(g)` → 기존 `onClick={() => handleDelete(g)}`와 동일. 액션 버튼 wrapper의 `onClick={(e) => e.stopPropagation()}`도 GymCard.jsx:56에 그대로 보존되어 카드 클릭(상세 이동)과 버튼 클릭 이벤트 버블링 충돌 없음. `routes_breakdown` 난이도 칩 렌더링(colorMeta 사용) 로직도 GymCard.jsx:74-96에 원본과 동일하게 이전됨. 클릭 시 `/gyms/:id` 이동도 `onClick={() => nav(...)}`로 그대로 연결.
- [11:20] **3. MyPage 신규 섹션 — 확인**: `showActions={false}`일 때 GymCard.jsx:55 `{showActions && (...)}` 조건부 렌더링으로 수정/삭제 버튼 블록 자체가 렌더 트리에서 제외됨(단순 CSS 숨김 아님) — 실제로 안 보임 확인. 빈 상태(`recentGyms.length === 0`)일 때도 섹션 헤더("최근 방문 암장")는 항상 렌더링되고, empty box 스타일(`padding: '14px 0', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-md)'`)이 이용권 섹션의 empty state(MyPage.jsx 210-214행대)와 완전히 동일한 패턴. `useNavigate` 신규 import는 기존 `Link`(react-router-dom) import와 공존하며 충돌 없음 — `git diff` 확인상 `Link`는 다른 용도(주 암장 배지, 암장 관리 진입 링크)로 계속 쓰이고 있어 그대로 유지됨.
- [11:20] **4. 인증/비회원 분기 — 확인, 문제 없음**: `climbLogsApi.visitedGymsWithDetail` → 백엔드 `GET /climb-logs/visited-gyms`(backend/src/routes/climb-logs.js:24)는 `optionalAuth` 미들웨어 사용. `optionalAuth`(backend/src/middleware/auth.js:33-50) 구현 확인 결과, 유효 토큰 없으면 `AUTH_ENABLED=true`일 때 401을 반환하고 `AUTH_ENABLED=false`일 때는 `DEFAULT_USER`를 주입 — 즉 컨트롤러(`climb-logs.js:36` `req.user.id`)에 도달하는 모든 경로에서 `req.user`가 항상 존재함이 보장되어 크래시 가능성 없음. 게다가 프론트 라우팅(`web/src/main.jsx:39` `<Route element={<ProtectedRoute />}>`) 확인 결과 `/me`(MyPage) 자체가 `ProtectedRoute`로 감싸여 있어 비로그인 사용자는 애초에 MyPage에 도달할 수 없음(이 웹앱은 RN 앱처럼 화면 내 `isGuest` 분기 패턴이 아니라 라우트 레벨 가드 패턴 — `AuthContext.jsx` 확인상 `isGuest` 개념 자체가 없음). 따라서 신규 API 호출이 비회원 화면 크래시를 일으킬 경로는 존재하지 않는다.
- [11:20] **5. 불필요한 사이드이펙트 — 확인**: `git show HEAD:web/src/pages/GymListPage.jsx | grep colorMeta` / `formatDateKR` 결과 없음(이번 diff에서 정상 제거됨), GymCard.jsx는 `colorMeta`(line 2)·`formatDateKR`(line 3)·`I`(line 1) 모두 정상 import해서 사용 중 — 누락 없음.
- [11:20] **6. 하드코딩/패턴 위반 — 확인, 경미한 발견 1건(Low, 이번 작업 범위 밖)**: GymCard.jsx 내 색상은 전부 `var(--...)` CSS 변수 사용, `#2D6A4F` 등 primary 하드코딩 없음(썸네일 배경의 `#000`은 원본 GymListPage.jsx에 이미 있던 로딩 플레이스홀더 색으로 이번 작업이 신규 도입한 게 아님 — `git diff` 확인). **Low 발견**: `GymListPage.jsx:4` `import { Chip, Pill } from '../components/atoms'` 중 `Pill`이 현재 파일 어디에서도 쓰이지 않는 dead import (`grep -n "Pill" GymListPage.jsx` → import 줄 1건만 매치). 단, `git show HEAD:web/src/pages/GymListPage.jsx`로 확인한 결과 이 dead import는 **이번 T007 작업 이전부터 이미 존재**하던 것으로, Developer가 이번에 새로 만든 문제가 아니다(회귀 아님, PASS 판정에 영향 없음). 기회가 되면 별도 정리 권고.
- [11:20] **7. 빌드 — 확인**: 독립 실행 결과 `vite build` 성공, 에러 0건, 경고는 기존에도 있던 청크 크기 경고 1건뿐(이번 변경과 무관, dist 500kB 초과 — 사전부터 있던 이슈).
- [11:20] **QA 집중 포인트 (high_risk_areas)**: 특별한 위험 영역 없음(Critical/High 없음). 참고용으로만 전달: (1) `MyPage.jsx` "최근 방문 암장" 섹션에서 실제로 최대 4개까지만 노출되는지 브라우저에서 육안 확인, (2) `GymListPage.jsx`에서 수정/삭제/breakdown 칩/검색/필터 칩이 GymCard 추출 이후에도 실사용 시나리오로 동일하게 동작하는지 클릭 테스트, (3) MyPage 신규 섹션에서 카드 클릭 시 수정/삭제 버튼이 없는 상태에서도 카드 전체 클릭으로 `/gyms/:id` 상세 이동이 잘 되는지(이벤트 버블링 확인).

## QA 검증 기록

- [10:16] **판정: PASS** (Critical 0 / High 0 / Medium 0 / Low 0 — 신규 발견 없음). Reviewer가 남긴 Low 1건(GymListPage.jsx `Pill` dead import)은 아래에서 재확인만 하고 이번 작업 결함으로 집계하지 않음(기존부터 있던 것, PASS 판정에 영향 없음).
- [10:16] **실브라우저 검증 여부: 미실시.** 이유 두 가지를 명시한다.
  1. Chrome DevTools MCP로 `list_pages` 시도 시 `"The browser is already running for .../chrome-profile. Use --isolated to run multiple browser instances."` 에러 반복 발생 — 세션 내 다른 프로세스가 공유 프로필을 점유 중이었고, 강제로 붙거나 죽이는 것은 다른 작업을 방해할 위험이 있어 시도하지 않음.
  2. 설사 접속 가능했더라도, `/me`는 `ProtectedRoute`로 보호되는 라우트라 실제 로그인 세션이 필요하고, `agent-vault/00-Context/ACTIVE.md`의 "검증 환경 메모"에 따르면 자동화 브라우저 진입은 `JWT_SECRET`으로 단기 토큰을 발급해 `localStorage.theroute_token`에 주입하는 방식이며 이는 "사용자 승인 필요"로 명시되어 있음. 비대화형 세션에서 임의로 승인을 대신할 수 없어 진행하지 않았다.
  → 아래는 **코드 정적 추적 + `npm run build` 독립 재실행**으로 대체 검증한 결과다.
- [10:16] **체크리스트 1 (섹션 위치) — PASS**: `MyPage.jsx` 288행 "최근 방문 암장" 섹션이 이용권 섹션(191-286행) 종료 직후, "설정" 섹션(316행 주석 `{/* 설정 섹션 */}`) 시작 직전에 정확히 위치. 코드 순서상 요청 그대로.
- [10:16] **체크리스트 2 (상위 4개 제한) — PASS**: 프론트 `MyPage.jsx:19` `RECENT_GYMS_LIMIT = 4`, `:50` `climbLogsApi.visitedGymsWithDetail(RECENT_GYMS_LIMIT)` 호출 확인. 백엔드 `backend/src/routes/climb-logs.js:27` `const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || '20', 10)));`로 클램프 후 SQL `LIMIT :lim`(35행)로 실제 쿼리 단계에서 4건까지만 반환 — 프론트에서 별도 `slice` 없이도 API가 보장. GymCard 렌더링 배열(`recentGyms.map`)도 추가 제한 없이 그대로 렌더링하는 게 맞는 구조.
- [10:16] **체크리스트 3 (GymCard 실제 공유) — PASS**: `grep -n "^import GymCard" web/src/pages/*.jsx` 결과 `GymListPage.jsx:7`과 `MyPage.jsx:5` 모두 `import GymCard from '../components/GymCard'`로 동일 파일을 import. 코드 복제 아님, 진짜 컴포넌트 재사용 확인.
- [10:16] **체크리스트 4 (GymListPage 기존 기능 회귀) — PASS**: `GymListPage.jsx` 직접 Read로 확인 — 검색(`q`/`debouncedQ`, 35-38행), 필터 칩 all/near/recent/main(159-162행, `filterChip` 상태 및 각 분기 로직 60-112행) 모두 GymCard 추출과 무관하게 그대로 유지. `<GymCard gym={g} onClick={() => nav(\`/gyms/${g.id}\`)} onEdit={setEditTarget} onDelete={handleDelete} />`(181-187행)로 수정(`onEdit`)·삭제(`onDelete`)·클릭 이동 전부 연결. `GymCard.jsx` 내부에서 breakdown 칩(74-96행)이 `g.routes_breakdown`을 원본과 동일 로직으로 렌더링.
- [10:16] **체크리스트 5 (MyPage 액션 버튼 숨김 + 클릭 이동) — PASS**: `MyPage.jsx:308` `<GymCard ... showActions={false} onClick={() => nav(\`/gyms/${g.id}\`)} />` 확인. `GymCard.jsx:55` `{showActions && (...)}`로 수정/삭제 버튼 블록 자체가 렌더 트리에서 제외(단순 CSS 숨김 아님). 카드 최상위 `<div onClick={onClick}>`(GymCard.jsx:14-15)이 클릭 핸들러를 감싸고 있어 버튼이 없는 상태에서도 카드 전체 클릭 시 `/gyms/:id`로 이동하는 경로가 코드상 명확함(이벤트 버블링 충돌 요소인 액션 버튼 wrapper의 `stopPropagation`도 `showActions=false`일 때는 렌더되지 않아 애초에 개입하지 않음).
- [10:16] **체크리스트 6 (빈 목록 empty state) — PASS**: `MyPage.jsx:297-301` `recentGyms.length === 0` 분기에서 dashed 박스(`border: '1px dashed var(--line-2)'`) empty state("최근 방문한 암장이 없습니다") 렌더링 확인. 섹션 헤더("최근 방문 암장", 293-295행)는 이 조건문 바깥에 위치해 0건이어도 섹션 자체는 항상 노출됨 — 섹션이 사라지지 않는다는 완료 기준 충족.
- [10:16] **체크리스트 7 (빌드) — PASS**: `cd web && npm run build` 독립 재실행 결과 `✓ 151 modules transformed`, `✓ built in 1.23s`, 에러 0건. 경고는 기존부터 있던 청크 크기 경고(500kB 초과) 1건뿐, 이번 변경과 무관.
- [10:16] **체크리스트 8 (오타/미정의 변수/잘못된 import 경로) — PASS**: `GymCard.jsx`가 사용하는 `I.clock`/`I.film`/`I.cal`/`I.chev`/`I.plus`/`I.search`/`I.pin`/`I.map`/`I.flame`을 `components/atoms/Icons.jsx`에서 전부 실존 확인. `colorMeta`(`utils/colors.js`), `formatDateKR`·`formatTenure`(`utils/climbingTenure.js`), `Chip`/`Pill`/`Btn`/`ColorBadge`(`components/atoms/index.jsx`) 전부 실제 export 존재 확인. 빌드 성공 자체가 import 경로 정합성의 가장 강한 증거이기도 함.
  - **Low 재확인(신규 아님)**: `GymListPage.jsx:4` `Pill` import가 파일 내 미사용(`grep -n "Pill" GymListPage.jsx` → import 줄 1건뿐)인 것을 확인. `git show HEAD:web/src/pages/GymListPage.jsx | grep Pill`로 커밋된 HEAD(T007 착수 이전 상태)에도 동일하게 존재함을 대조 확인 — Reviewer 판정대로 이번 작업이 만든 결함이 아니라 기존부터 있던 무관한 dead import. PASS 판정에 영향 없음.
- [10:16] **요약**: Developer·Reviewer 기록의 모든 주장을 코드 Read·grep·독립 빌드로 재확인했고 불일치 없음. 실브라우저 확인은 수행하지 못했으므로(사유 상술) 사용자에게 브라우저 육안 확인을 권장한다.

## 최종 요약 (사용자용)

**마이페이지(`/me`)에 "최근 방문 암장" 섹션이 추가되었습니다. 이용권 섹션과 설정 섹션 사이에 위치하며, 최근 방문한 암장 상위 4개를 미리보기 카드로 보여줍니다.**

### 무엇이 바뀌었나

- 마이페이지에 새 섹션이 생겼습니다 — 방문 기록 기준 최근 암장 4개를 카드 목록으로 보여주고, 카드를 누르면 해당 암장 상세(`/gyms/:id`)로 이동합니다.
- 이 카드는 "암장 관리"(`/gyms`) 화면에서 쓰던 것과 **완전히 같은 카드**입니다. 요청하신 "재사용" 취지를 살리기 위해, 원래 암장 관리 화면 안에 인라인으로만 존재하던 카드 마크업을 `GymCard.jsx`라는 별도 부품으로 뽑아냈고, 두 화면이 이 부품을 나눠 씁니다. 그냥 마크업을 복붙한 게 아니라 진짜 같은 파일을 가져다 쓰는 구조라, 나중에 카드 디자인이 바뀌면 두 화면에 한 번만 수정하면 됩니다.
- 마이페이지 쪽은 "미리보기" 용도라서 암장 관리 화면에 있던 수정·삭제 버튼은 뺐습니다(`showActions=false`로 끔). 암장 관리 화면 쪽은 기존 그대로 수정·삭제 버튼이 살아 있습니다.
- 방문 기록이 하나도 없으면 섹션 자체가 사라지지 않고, 이용권 섹션의 빈 상태와 같은 스타일로 "최근 방문한 암장이 없습니다" 문구가 나옵니다.

### 왜 GymCard를 별도 부품으로 뽑았나

요청이 "암장관리 목록에서 사용하는 항목을 재사용"이었는데, 원래 그 카드는 암장 관리 화면 파일 안에 인라인 코드로만 있어서 그대로는 재사용할 방법이 없었습니다. 그래서 그 마크업을 `web/src/components/GymCard.jsx`라는 공용 부품으로 옮기고, 암장 관리 화면도 이 부품을 쓰도록 같이 고쳤습니다. 이 과정에서 암장 관리 화면의 기존 기능(검색, 필터 칩, 수정, 삭제, 난이도별 개수 표시)이 깨지지 않는 게 가장 중요했는데, 아래 검증에서 전부 그대로 연결돼 있음을 확인했습니다.

### 검증 결과

Developer 구현 → Reviewer 코드 감사(PASS, 결함 0건 — Low 1건은 이번 작업과 무관한 기존 dead import) → QA(저) 검증까지 3단계 모두 통과했습니다.

- 섹션 위치, 4개 제한, 컴포넌트 재사용 여부, 암장 관리 화면 회귀 여부, 액션 버튼 숨김·클릭 이동, 빈 상태 처리, 웹 빌드(`npm run build`) 총 7개 항목을 코드 직접 추적 + 빌드 독립 재실행으로 확인했고 결함은 없었습니다.
- **다만 이번 QA는 실제 브라우저로 눈으로 확인하지는 못했습니다.** 이유는 두 가지입니다. (1) 자동화 브라우저(Chrome DevTools MCP)가 다른 프로세스에 이미 점유돼 있어 접속 자체가 안 됐고, (2) 설사 접속됐더라도 `/me`는 로그인이 필요한 화면이라 자동 로그인을 위해서는 토큰을 브라우저에 직접 주입해야 하는데, 이는 원래부터 "사용자 승인이 필요한 민감 동작"으로 분류돼 있어 임의로 진행하지 않았습니다.

### 사용자가 확인해 주시면 좋은 점

브라우저로 `climb.미라클펭귄.com` (또는 개발 서버)에 로그인해서 마이페이지에 들어가 아래 3가지만 육안으로 봐 주시면 완전히 마무리됩니다.
1. "최근 방문 암장" 섹션이 이용권과 설정 사이에 있고, 카드가 최대 4개까지만 보이는지
2. 카드를 눌렀을 때 해당 암장 상세 페이지로 잘 이동하는지 (수정/삭제 버튼 없이도 카드 전체가 눌리는지)
3. 암장 관리(`/gyms`) 화면에서 검색·필터·수정·삭제가 예전처럼 잘 되는지

**추가 배포 작업 없이 지금 바로 확인 가능합니다.** `backend/src/index.js`가 `web/dist`를 `express.static`으로 직접 서빙하는 구조라(nginx는 `127.0.0.1:3100`으로 프록시만 함), QA 검증 중 `npm run build`를 재실행하며 `web/dist`가 이미 최신 상태로 갱신됐습니다. Express 정적 서빙은 요청마다 디스크에서 파일을 읽으므로 `pm2 restart` 없이도 새로 빌드된 파일이 즉시 서빙됩니다. 백엔드 코드는 이번 작업에서 건드리지 않았으므로 그 점에서도 재시작은 불필요합니다.

# Handoff: TheRoute — 클라이밍 영상·세션 기록 앱

## Overview

**TheRoute** 는 클라이밍하는 사람을 위한 모바일 기록 앱입니다. 사용자가 암장에서 시도한 문제를 영상과 함께 기록하고, 색깔/난이도/시도 횟수를 관리하며, 운동 기록과 목표를 추적하고, AI 분석으로 약점·강점을 받습니다.

핵심 컨셉:

- **영상 = 1차 데이터.** 모든 클라이밍 기록은 9:16 세로 영상이 중심이고, 메타데이터(색·난이도·시도·메모)가 그 위에 붙는다.
- **암장(Gym) → 문제(Problem) → 영상(Route) 3단 분류.** 같은 색·난이도여도 암장이 다르면 다른 문제다. 한 문제에 영상이 여러 개일 수 있다.
- **세션(Session) = 한 번의 운동.** 클라이밍 시도 + 훈련(컨디셔닝/지구력) + 이용권 차감 + 메모를 한 번에 기록한다.
- **이용권(Pass) 관리 내장.** 정기권(기간제) / 횟수권(잔여 회수) 두 종류를 지원하고 세션 추가 시 자동 차감.

타겟: 갤럭시 S25+ (412×892 CSS px, Android, 한국어 사용자).

## About the Design Files

이 번들의 HTML 파일들은 **디자인 레퍼런스**입니다. 의도한 시각·동작을 보여주는 프로토타입이며, 그대로 가져다 쓸 프로덕션 코드가 아닙니다.

작업의 본질은 **이 HTML 디자인을 타겟 코드베이스의 환경에서 재구현하는 것**입니다 — 기존 코드베이스가 React Native / Flutter / Kotlin Compose / SwiftUI 등 어떤 환경이든 그쪽의 패턴·라이브러리·디자인 시스템을 사용해 픽셀 단위로 재현하세요. 코드베이스가 아직 없다면 프로젝트 성격에 가장 맞는 프레임워크를 선택해 구현하세요. (모바일 앱 컨텍스트에서는 React Native + Expo, 또는 Flutter, 또는 Kotlin Compose Multiplatform 권장.)

## Fidelity

**High-fidelity (hifi).** 색·타이포·간격·인터랙션이 최종 의도에 가깝게 정의되어 있습니다. 토큰(`tokens.css`)에 정의된 값을 그대로 변수화해 사용하세요.

다만 다음은 명시적 placeholder 입니다:

- **영상 썸네일** — gradient + 색깔 점으로 그려진 가짜 클라이밍 벽. 실제 구현에서는 영상의 첫 프레임 또는 사용자 지정 썸네일을 사용.
- **이용권 가격** (예: 22,000원), **이용권 잔여 일수** — 백엔드 계산값.
- **AI 분석 결과 본문** — 실제로는 LLM 출력. 디자인은 형식(섹션 구조 + 메타데이터)만 정의.
- **달력의 dot 분포** — mock 데이터.

## Screens / Views

총 **8개 화면 + 1개 모달** 입니다. 각 화면은 `app/screens.jsx` 안에 별도 컴포넌트로 정의되어 있습니다. 모두 412×892 (Galaxy S25+) 안드로이드 디바이스 프레임에 들어갑니다 — 상단에 Android status bar(40px, 중앙 펀치홀 카메라), 하단에 제스처 네비게이션 바.

각 화면 공통:

- 자체 `<TopBar>` 또는 sticky 헤더 (54px) — 디바이스 status bar 아래에 자동 배치.
- 메인 화면들은 `<BottomNav>` (5탭: 홈 / 기록 / [+ FAB] / 훈련 / 캘린더). FAB은 중앙에 떠있고 SessionAddModal을 트리거.

---

### 01 — 홈 / 피드 (`HomeScreen`)

**Purpose:** 앱 첫 화면. 이번 주 활동 요약 + 본인 또는 팔로우한 사람의 최근 영상 피드.

**Layout (위→아래):**

1. **TopBar** (54px) — 좌: `TheRoute` 로고(The는 primary 컬러). 우: 알림 벨 아이콘.
2. **Hero Stats Card** — `padding 14/16/8/16`. primary 컬러 그라데이션 배경 (`linear-gradient(135deg, var(--primary) 0%, oklch(58% 0.18 28) 100%)`), 흰색 텍스트, `border-radius: var(--r-md)`, `padding: 16px 18px`.
   - 라벨: "이번 주" (11px, 600, opacity .85, letter-spacing .4)
   - 큰 숫자: `9 완등 · 3 방문` (32px 800, baseline 정렬, 점은 opacity .4)
   - 7일 막대 그래프 — 7개 칸 flex, 각 height 36px, gap 4px. 활동한 날(월/수/금)은 `rgba(255,255,255,.85)`, 나머지는 `.18`. 아래에 요일 라벨(10px).
3. **Tabs** — `피드` / `내 영상`. 탭바 padding `10/16/4`, gap 18px, 하단 1px border-line. active 탭은 14px 700 + bottom 2px ink-1 보더, 비활성은 14px 500 + ink-3.
4. **Filter Chips** — `전체 · V3 이하 · V4-V5 · V6+ · 최근 1주`. `display:flex; gap:6; padding:12/16/8; overflow-x:auto`. (Chip 컴포넌트 — 아래 "Components" 참조)
5. **Feed Grid** — `display:grid; grid-template-columns: 1fr 1fr; gap:10; padding: 8px 16px`. 카드는 `<RouteCard>`.
6. **BottomNav** (absolute bottom)

**State:**
- `tab: 'feed' | 'mine'`
- `filter: 'all' | 'v3' | 'v4' | 'v6' | 'recent'`

---

### 02 — 영상 상세 (`RouteDetail`)

**Purpose:** 한 시도(Route)의 영상 + 메타 + 메모 + 같은 색의 다른 영상.

**Layout:**

1. **Video Player** — `aspect-ratio: 9/13.5` (포트레이트), 풀-블리드. 배경은 색깔 dot 그라데이션 (`linear-gradient(160deg, ${dot}55, ${dot}aa)`). 위에 absolute로:
   - 좌상단 (top:14, left:14): 36×36 원형 글래스 버튼 (`background: rgba(0,0,0,.45); backdrop-filter: blur(8px)`) + 좌향 chevron — 뒤로가기.
   - 우상단: 같은 스타일 원형 + more(⋯) 아이콘.
   - 영상 위에 5개 색깔 hold 점 — `position:absolute`, 12-16px square, border-radius 5, drop-shadow `0 2px 6px rgba(0,0,0,.3)`. (placeholder. 실제로는 영상 첫 프레임)
   - 정중앙: 64×64 원형 재생 버튼 (`rgba(0,0,0,.55)` + blur 10) + play 아이콘 22.
   - 하단 (bottom:14): timeline — `0:08` (12px 600 흰색) + flex 1 progress bar (3px 높이, 34% 진행) + `0:23`.
2. **Meta Block** — surface 배경, padding `14/16`, 하단 1px line.
   - ColorBadge + `진행중 · 8회 시도` Pill (warn 톤).
   - 18px 700 제목: `빨강🔴 (V5)`.
   - 13px ink-3: 📍 더클라임 강남 · 슬랩 · 2026-05-07.
   - 태그 chips: `#슬랩 #하이스텝 #밸런스` (11px, padding 4/9, surface-2 bg, r-pill).
   - Action 버튼 2개 (좋아요 / 스크랩) — flex 1 각, height 42, surface-2 bg, r-sm. 아이콘 + 라벨 + 카운트.
3. **Memo Block** — surface, padding `14/16`. 라벨 "메모" (12px 700 ink-3, letter-spacing .4) + 본문 13px ink-2 line-height 1.55.
4. **같은 색 다른 영상** — padding `14/16`. 헤더(14px 700) + 카운트(12px ink-3). 3-col grid, RouteCard `compact={true}`.

---

### 04 — 암장 목록 (`GymList`)

**Purpose:** 거리/즐겨찾기 기준으로 암장 검색 + 목록.

**Layout:**

1. **TopBar** "기록" — 핸드오프 시점에는 `기록` 탭이 BottomNav의 두번째 탭이고 진입 화면이 이 GymList.
2. **Search Bar** — `padding:10/14`, surface 배경, 1px line, `r-pill`. 검색 아이콘(16) + input(14px placeholder "암장 이름 검색").
3. **Quick Filter Chips** — `내 위치 5km` (active, pin 아이콘) / `최근 방문` / `주 암장`.
4. **Result Count** — 12px ink-3 600. "검색 결과 5".
5. **Gym Cards** — `flex-direction:column; gap:10; padding:0/16`. 각 카드:
   - surface bg, 1px line, `r-md`, padding `14/14/12`.
   - 상단 row: 이름(15px 700) + (주 암장이면) "★ 주" Pill (primary 톤). 우측에 chevron.
   - 주소 (12px ink-3, ellipsis 1줄).
   - 메타 row (11px ink-3, gap 10): 🕐 hours · 📍 1.2km · 🎬 18 영상.
   - **하단 thumb strip** — 최근 영상 4개의 미니 썸네일 (48×60 r-8, 색깔 그라데이션 + 좌상단 dot 5×5).

---

### 05 — 암장 상세 (`GymDetail`)

**Purpose:** 한 암장의 상세 정보 + 그 암장에서 찍은 영상/문제 목록.

**Layout:**

1. **TopBar** "암장 상세" + 뒤로가기.
2. **Header Block** — surface, padding 16. 제목(20px 800, letter-spacing -.4), 주소(13px ink-3), 운영시간 (12px), 가격(12px). 액션 2개: `지도 보기` (ghost) + `주 암장 빼기` (soft, 채워진 별 아이콘).
3. **Tabs (sticky)** — `영상 (8)` / `문제 (6)`. sticky top:54, bg surface.
4. **영상 탭 콘텐츠:**
   - 정렬/필터 row (정렬: 최신순, 필터: 전체).
   - 2-col grid RouteCard (4개 노출).
5. **문제 탭 콘텐츠:**
   - 카드 리스트, 각 카드 surface + 1px line + r-md, `padding:12/14`, `display:flex; gap:10; align-items:center`. ColorBadge + `· 메인 벽` (12px ink-3) + 우측 `5개 영상` (12px ink-3) + chevron.
   - 마지막에 "+ 새 문제 등록" 점선 보더 버튼 (1px dashed line-2, r-md, ink-2).

---

### 06 — 캘린더 (`CalendarScreen`)

**Purpose:** 월별 활동 보기 + 선택한 날짜의 세션 상세.

**Layout:**

1. **TopBar** "캘린더".
2. **Month Header** — `padding:14/16/6`, center-aligned, gap 24. 좌 chevron + "2026년 5월" (18px 700) + 우 chevron.
3. **Week Day Labels** — 7-col grid, 11px 600. 일=danger, 토=blue, 평일=ink-3.
4. **Date Grid** — 7-col grid, gap 2, padding 4/12. 각 셀 `aspect-ratio:1`, 세로 정렬 (날짜 + dot). Empty offset 셀 5칸 (May 1 = Friday).
   - 일반 날짜: 14px 500.
   - 오늘(8일): primary-soft 배경, 14px 700.
   - 선택 날짜: ink-1 배경, surface 텍스트, 14px 700.
   - dot: 활동 있는 날 5×5 원, 미선택 시 primary, 선택 시 surface.
5. **Selected Day Panel** — 헤더(14px 700) + 완등 카운트 Pill(primary 톤).
6. **Day Detail Card** — surface + 1px line + r-md.
   - 헤더 row (padding 12/14 + 1px bottom): 암장 이름(14px 700) + 이용권 정보(11px ink-3, 🎫 10회권 잔여 6회) + more 버튼.
   - 메모 row: padding 10/14, 12.5px ink-2. 라벨 "메모" (11px ink-4) + 본문.
   - 문제 리스트: padding 8/14/12. 각 행 `display:flex; gap:10; padding:8/0`, between rows 1px line. ColorBadge sm + ✓ 완등(success, 12px 600) 또는 "도전 중"(ink-4) + `· N회` (tabnum) + 영상 있으면 우측 film 아이콘 (primary).
7. **+ 기록 추가** ghost full-width 버튼.
8. **BottomNav** (active: cal).

**State:**
- `selected: number` (선택된 날짜)

---

### 07 — 마이페이지 (`MyPage`)

**Purpose:** 프로필 + 내 영상 / 북마크 / 이용권.

**Layout:**

1. **TopBar** "마이페이지" + 뒤로가기.
2. **Profile Block** — surface, padding 18/16.
   - 상단 row (gap 14): 64×64 원형 아바타 (primary 그라데이션, 흰색 "나" 24px 800) + 이름(18px 800) + 한줄소개(11px ink-3) + "편집" 버튼(7/11 padding, r-pill, 1px line-2).
   - 스탯 row (3개, 13px, gap 8 세로 8px):
     - 🏆 최고 레벨 — ColorBadge sm + "· 더클라임 강남" (11px ink-4)
     - 🔥 경력 — "2년 2개월차 (792일)"
     - 📍 주 암장 — Chip 풍 태그들 (12px, padding 3/9, r-pill, surface-2 bg + 1px line)
3. **Tabs** — `내 영상 (8)` / `북마크 (3)` / `이용권 (3)`.
4. **이용권 탭 콘텐츠:**
   - 각 이용권 카드 surface + 1px line + r-md, padding 14.
   - 헤더: 암장이름(14px 700) + Pill (정기권=primary, 횟수권=neutral).
   - **정기권**: `📅 시작 ~ 종료` + `⏳ 잔여 N일` (13px 600 primary).
   - **횟수권**: `🎟️ 잔여 7 / 10회` + 6px progress bar (background surface-2, fill primary) + `📅 만료일: ...` 또는 "만료일 없음 (무기한)" + 우측에 "1회 사용" soft 버튼.
   - 하단 "+ 이용권 등록" ghost full 버튼.
5. **내 영상 / 북마크 탭**: 2-col grid RouteCard.

**State:**
- `tab: 'routes' | 'bookmarks' | 'passes'`

---

### 08 — 훈련 (`TrainingScreen`)

**Purpose:** 클라이밍 외 보강 훈련 + 목표 + AI 분석.

**Layout:**

1. **TopBar** "훈련".
2. **Tabs** — `목표` / `기록` / `분석`.

**목표 탭:**
- 헤더 "진행 중 (3)" (12px ink-3 600).
- 각 목표 카드 surface + 1px line + r-md + padding 14:
  - "🎯 V6 첫 완등" (14px 700)
  - 마감일 (11px ink-3): "마감: 2026-08-31 (118일 남음)"
  - 측정 단위 + 현재→목표 (12px ink-2): "측정 단위: 초 · 현재 38 → 목표 60"
  - 6px progress bar
  - 하단: 메모(좌, 11px ink-3) + 진행률(우, 11px 700, tabnum)
- "+ 새 목표" ghost full.

**기록 탭:**
- **이번 주 요약 카드** — 카테고리별 (볼더링/지구력/컨디셔닝) row "3회 · 4시간". 하단에 굵은 합계 row.
- "최근 세션" 헤더.
- 세션 카드들. 카드 헤더: 날짜 + Pill (자동 = primary "볼더링 · 자동" / 수동 = neutral "지구력").
  - **자동(synthetic)**: 한 줄 요약만 — "더클라임 강남 · 6완등 / 11시도".
  - **수동**: ⏱ duration + 📍 gym + 항목 리스트 (· 핑거보드 데드행 38sec × 3세트) + 메모.

**분석 탭:**
- **분석 요청 카드** surface + 1px line + r-md + padding 14:
  - "분석 요청" 라벨(12px 700 ink-3).
  - Range chips: `1주 · 최근 4주(active) · 3개월 · 직접`.
  - Checkbox 옵션 4개 (약점·강점/진행 추세/추천 메뉴/부상 리스크). 18×18 r-5, 체크 시 primary 배경 + 흰색 ✓.
  - "AI 분석 요청" accent full 버튼 (sparkles 아이콘).
- **분석 결과 카드**:
  - 헤더: "2026-05-08 분석" + Pill "완료 · 8.4s" (success 톤).
  - 메타 (11px ink-3): "engine: claude-cli · template: analysis_meta_v1 (v2)".
  - 본문 (12.5px ink-2, line-height 1.65): **강점 / 약점 / 이번 주 추천** 섹션, 각 헤더 13px 700 ink-1, bullet `·` prefix. 추천은 번호 매기기.

---

### 09 — 통합 세션 추가 모달 (`SessionAddModal`)

**Purpose:** 한 번의 운동 = 클라이밍 시도 + 훈련 + 이용권 차감 + 메모를 한 번에 입력. 가장 복잡한 화면.

**Layout (바텀 시트, 90% 높이):**

배경 `rgba(0,0,0,.5)` overlay, 모달은 `bg: var(--bg)`, top corner radius 24px.

1. **Sticky Header** — surface, 1px bottom line, padding `12/16/14`. 좌 "취소"(14px ink-3), 중앙 "운동 기록 추가"(15px 700), 우 "저장"(14px 700 primary).

2. **기본 섹션** — 라벨 "기본" (11px 700 ink-3, letter-spacing .4).
   - Form group 카드 (surface + 1px line + r-md, overflow hidden):
     - **Field** rows (12/14, 1px between): 라벨(13px ink-3, width 60) + 값(13.5px ink-1 600 또는 placeholder ink-4 500) + 선택적 chevron.
     - 날짜 / 암장 / 이용권 / 메모.
   - **이용권**은 특별 — `<RadioOpt>` 3개 (정기권/횟수권/일일이용권):
     - 정기권: disabled, "해당 암장 정기권 없음".
     - 횟수권: checked, "10회권 (잔여 7회)".
     - 일일이용권: "1회용 — 22,000원".
     - 라벨에 `*` (danger) 표시.

3. **완등·시도 섹션** — 라벨 + 카운트(2개).
   - 각 시도 카드 surface + 1px line + r-md + padding 12/14:
     - 헤더: ColorBadge sm + "기존 문제" 또는 "카탈로그 외" (11px ink-4) + X 닫기.
     - Row: `완등` 체크박스(success 톤, 18×18) + `시도 [-] N [+]` 스테퍼(border 1px line, r-sm, 28×28 버튼).
     - **영상 옵션** 3개 RadioOpt (mini variant):
       - "영상 없음"
       - "새로 업로드" (선택 시 sub-text "video_3293.mp4 (24MB) · 9:16")
       - "기존 영상 연결"
   - "+ 완등·시도 추가" ghost full.

4. **훈련 섹션** — 라벨 + "+ 추가" (12px 600 primary, 우측).
   - 빈 상태: 1px dashed line-2, r-md, padding 14, center 12.5px ink-3 "훈련 항목을 추가하면 분석에 반영됩니다."

---

## Components

### `<TopBar>` (54px)

```
height: 54
padding: 0 16
display: flex; align-items: center; gap: 8
border-bottom: 1px solid var(--line)
background: var(--surface)
position: sticky; top: 0; z-index: 5
```

Props: `title`, `back?: bool` (좌측 chevron), `right?: ReactNode`, `brand?: bool` (TheRoute 로고 표시).

브랜드 모드일 때 제목: `<span style="color: var(--primary)">The</span>Route` (18px 800, letter-spacing -.4).

기본 우측: 36×36 원형 surface-2 + user 아이콘.

### `<BottomNav>`

```
position: absolute; bottom: 0; left: 0; right: 0
border-top: 1px solid var(--line); background: var(--surface)
padding: 8 8 28
display: grid; grid-template-columns: repeat(5, 1fr)
```

5탭: `홈 / 기록 / [+ FAB] / 훈련 / 캘린더`.

- 일반 탭: column flex, gap 3, 아이콘 22px + 라벨 10px. active 시 ink-1 / 700, 비활성 ink-4 / 500 + opacity .78.
- **FAB (3번째)**: 52×52 원형, primary bg, 흰색 plus 아이콘, `box-shadow: 0 6px 18px color-mix(in oklch, var(--primary) 50%, transparent)`, `margin-top: -22px` (위로 튀어나옴).

### `<RouteCard>`

```
background: var(--surface)
border: 1px solid var(--line)
border-radius: var(--r-md)
overflow: hidden
```

- **Thumbnail** `aspect-ratio: 9/13`:
  - 색깔 그라데이션 배경.
  - radial-gradient overlay (white .25 / black .18).
  - 4개 hold 점 (절대좌표).
  - 중앙 42×42 원형 재생 버튼 (`rgba(0,0,0,.55)` + blur 8).
  - 좌상단 Pill: `✓ 완등` (success) 또는 `진행중` (warn) + `· N회`.
  - 우상단 bookmark 아이콘 (흰색, 저장 시 fill).
- **Body** padding 10/11/12:
  - ColorBadge sm.
  - `compact={false}` 일 때 메타 row: ❤ likes · 🔖 bookmarks · 우측 날짜.

### Atoms

- **`<ColorDot>`** — `display:inline-block; width/height: size; border-radius: 50%`. `흰색` 일 때만 `1px solid line-2`.
- **`<ColorBadge color level size>`** — pill. surface-2 + 1px line + r-pill. `sm`: 11px / padding 2/8 / dot 7. `md`: 12px / 4/10 / dot 9.
- **`<Chip active onClick icon>`** — `padding: 7/12, r-pill, 1px border, 12px 600`. active: bg ink-1 + color surface. inactive: bg surface + color ink-2 + border line.
- **`<Pill tone>`** — `padding: 2/8, r-pill, 11px 600, 1px border`. Tones: `neutral / primary / success / warn / danger`.
- **`<Btn variant size icon full>`** — variants: `primary` (ink-1), `accent` (primary), `ghost` (transparent + line-2), `soft` (surface-2). sizes: `sm` (32px), `md` (42px), `lg` (50px).
- **`<RadioOpt label sub checked disabled mini>`** — 16×16 원형 radio. checked 시 안쪽 8×8 primary dot. 일반 모드는 padding 8/10, primary-soft bg + primary-line border. mini는 padding 5/0, no bg.

### Icons (line, stroke 1.6)

`I.search / bell / user / home / map / plus / dumbbell / cal / heart / bookmark / chev / play / more / pin / clock / film / star / sparkles / ticket / check / x / flame`. 모두 24×24 viewBox, currentColor stroke. SVG 정의는 `app/ui.jsx`에 인라인.

---

## Interactions & Behavior

### 네비게이션 흐름

- **홈 → RouteCard 탭** → 02 영상 상세
- **홈 BottomNav `기록`** → 04 암장 목록
- **04 GymList → 카드 탭** → 05 암장 상세 (해당 암장 영상 뜸)
- **04/05 → +FAB** → 09 SessionAddModal (바텀 시트)
- **05 → 영상 탭의 RouteCard 탭** → 02 영상 상세
- **BottomNav `캘린더`** → 06 CalendarScreen
- **06 → 날짜 탭** → 우측 패널이 그 날짜의 세션으로 업데이트
- **TopBar 우측 user 아이콘** → 07 MyPage
- **BottomNav `훈련`** → 08 TrainingScreen
- **08 → "+ 새 목표"** → 목표 추가 모달 (이번 디자인엔 미포함, 동일 패턴으로 별도 모달)

### 인터랙션 디테일

- **탭 전환** — 즉시 (transition 없음). 활성 탭 indicator는 선이라 transform 가능.
- **Chip 토글** — 즉시 색 반전.
- **Progress bar** — 값 변경 시 `transition: width .3s`.
- **포커스 / hover** — 모바일이라 hover는 무시 가능. `:active` 시 opacity .7 정도.
- **바텀 시트 모달 (09)** — 등장 시 `transform: translateY(100%) → 0`, easing `cubic-bezier(0.32, 0.72, 0, 1)`, duration 280ms. 배경 overlay opacity 0→1 동시. 닫을 때 역방향. iOS sheet pattern.
- **시도 카운터** `[-]` `[+]` — 즉시 증감, min 0.
- **체크박스** — 클릭 시 즉시 토글, primary fill + 흰색 ✓.
- **Radio (이용권/영상 옵션)** — 그룹 안에서만 단일 선택.

### 폼 검증

09 SessionAddModal 저장 시:
- **이용권 선택 필수** (`*` 표시된 항목).
- 적어도 한 가지 — 클라이밍 시도 또는 훈련 항목 — 있어야 함. 둘 다 비면 저장 비활성.

### 빈 상태

- 피드 비었을 때 — "아직 기록한 영상이 없어요. + 버튼으로 첫 영상을 추가하세요." 일러스트 + ghost 버튼.
- 이용권 없음 — "이 암장의 이용권이 없어요. + 등록하기".

### 로딩

- AI 분석 요청 시 — 결과 카드 자리에 skeleton (line, line-2 그라데이션 shimmer 1.5s loop).

---

## State Management

각 화면은 독립적인 로컬 상태(`useState`)만 사용. 전역 상태는 다음을 권장:

```ts
type AppState = {
  user: User
  gyms: Gym[]
  problems: Problem[]      // gym 별로 색·난이도 정의된 문제 카탈로그
  routes: Route[]          // 한 시도 = 영상
  passes: Pass[]
  goals: Goal[]
  sessions: Session[]
  climbLogs: ClimbLog[]
  ui: {
    tab: 'home' | 'gyms' | 'training' | 'cal' | 'me'
    sessionModal: { open: boolean, draft: SessionDraft }
  }
}
```

관계:
- `Problem.gym_id → Gym.id`
- `Route.problem_id → Problem.id` AND `Route.gym_id → Gym.id` (denormalized)
- `Session.gym_id → Gym.id`, `Session.pass_id → Pass.id` (차감)
- `ClimbLog`은 `Session`의 일부 — climbing-attempts 컬렉션.

데이터 페칭은 화면 entry 시점에 lazy + cache. mutation 후 invalidate.

타입 스키마는 `app/data.js` 의 mock 데이터 형태를 그대로 따르세요.

---

## Design Tokens

`tokens.css` 가 단일 출처입니다 — 코드베이스의 토큰 시스템에 1:1 매핑하세요.

### Colors (light)

```
--bg:        #f6f5f3
--surface:   #ffffff
--surface-2: #faf9f7
--ink-1:     #131313
--ink-2:     #3a3a39
--ink-3:     #6b6b68
--ink-4:     #9a9a96
--line:      #ececea
--line-2:    #e0dfdb

--primary:      oklch(67% 0.18 38)   /* ≈ #ff6b3a, 클라이밍 hold 오렌지 */
--primary-ink:  oklch(46% 0.16 38)
--primary-soft: oklch(96% 0.04 38)
--primary-line: oklch(88% 0.08 38)

--success: oklch(64% 0.15 155)
--warn:    oklch(72% 0.16 75)
--danger:  oklch(60% 0.20 25)
```

### Colors (dark)

```
--bg:        #0e0e0d
--surface:   #18181a
--surface-2: #1f1f22
--ink-1:     #f1efea
--ink-2:     #d2cfc8
--ink-3:     #918f88
--ink-4:     #5e5d57
--line:      #2a2a2c
--line-2:    #34343a
```

`primary-soft / primary-line` 은 dark 모드에서 `color-mix(in oklch, var(--primary) 14%, #18181a)` 처럼 동적으로 계산됨.

### 클라이밍 색깔 dot (Climbing route colors)

문제의 색은 enum 입니다. 한국 클라이밍 색-체계 기반:

```
red:    #e84a4a  빨강  🔴
orange: #f08736  주황  🟠
yellow: #f3c94a  노랑  🟡
green:  #4aa760  초록  🟢
blue:   #4a86e8  파랑  🔵
navy:   #2b3e7a  남색  🟦
purple: #8b5cb8  보라  🟣
black:  #1a1a1a  검정  ⚫
white:  #f7f7f5  흰색  ⚪  (border 필요)
gray:   #8c8c88  회색  ⬛
```

### Spacing / Radius

```
--r-xs: 6px
--r-sm: 10px
--r-md: 14px
--r-lg: 20px
--r-pill: 999px
```

간격은 4의 배수: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 24.

### Shadows

```
--shadow-1: 0 1px 0 rgba(15,15,15,.04), 0 1px 3px rgba(15,15,15,.04)
--shadow-2: 0 4px 14px rgba(15,15,15,.06)
--shadow-3: 0 12px 32px rgba(15,15,15,.10)
```

### Typography

```
--font-sans: "Pretendard", "Pretendard Variable", -apple-system,
             system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif
--font-mono: ui-monospace, "SF Mono", Menlo, monospace
```

스케일:

| 용도 | size | weight | letter-spacing |
|---|---|---|---|
| Hero number (heroes) | 32 | 800 | -1 |
| Page title (모달 헤더) | 20 | 800 | -.4 |
| Brand logo | 18 | 800 | -.4 |
| Section title (large card title) | 18 | 700 | -.2 |
| Card title | 15 | 700 | 0 |
| Tab label | 14 | 700 (active) / 500 | 0 |
| Body | 13 / 13.5 | 500-700 | 0 |
| Caption | 12 / 12.5 | 500-700 | 0 |
| Micro (meta, labels) | 11 | 600-700 | .4 (라벨 only) |
| Tiny | 10 | 500-700 | -.2 |

숫자는 `font-variant-numeric: tabular-nums` (`.tabnum` class).

---

## Assets

- **font** — Pretendard Variable (https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css). MIT 라이선스, 한국어 + 라틴 통합 산세리프.
- **icons** — 자체 SVG, 24×24 viewBox, currentColor stroke 1.6. 대체 라이선스 아이콘셋(Lucide / Phosphor light)으로 1:1 매핑 가능.
- **emoji** — 일부 라벨에 의도적으로 사용 (🏆 🔥 📍 📅 🎟️ ⏳ 🎯 ⏱). 한국어 UI에서 흔하고 의미 보강 효과. 제거하지 마세요.
- **사진/일러스트 없음** — 모든 영상 썸네일은 색깔 그라데이션 placeholder. 실제 구현엔 영상 첫 프레임 캡처 필요.

---

## Files

이 핸드오프 폴더 안 디자인 레퍼런스 파일:

```
TheRoute Prototype.html      메인 엔트리 (디자인 캔버스, 8개 화면 + 모달 합본)
tokens.css                   디자인 토큰 (CSS variable)
app/
  data.js                    Mock 데이터 (스키마 참고용)
  ui.jsx                     공통 UI primitives + 아이콘 + 앱 셸 (TopBar, BottomNav, RouteCard)
  screens.jsx                8개 화면 + SessionAddModal 컴포넌트 정의
ios-frame.jsx                (참고용) iOS 디바이스 프레임
android-frame.jsx            Galaxy S25+ 디바이스 프레임 (실제 사용 중)
design-canvas.jsx            화면 레이아웃 캔버스 (구현 시 불필요)
tweaks-panel.jsx             디자인 토글 패널 (구현 시 불필요)
```

**확인 방법**: `TheRoute Prototype.html` 을 브라우저에서 열면 8개 화면이 한 캔버스에 나열됩니다. 각 화면을 클릭하면 풀스크린으로 확대됩니다.

---

## 구현 권장 순서

1. **토큰** — `tokens.css` 의 모든 변수를 코드베이스의 디자인 토큰에 매핑.
2. **Atoms** — `ColorDot`, `ColorBadge`, `Chip`, `Pill`, `Btn`, `RadioOpt`. 디자인 시스템에 등록.
3. **Shell** — `TopBar`, `BottomNav`, 라우터 골조. (Stack navigator + 5-tab bar.)
4. **데이터 모델** — TypeScript 인터페이스 정의 (`app/data.js` 형태 기반).
5. **Core loop** — 01 홈 / 02 영상 상세 / 09 세션 추가. 가장 자주 쓰임.
6. **Discovery** — 04 암장 목록 / 05 암장 상세.
7. **Records** — 06 캘린더 / 07 마이 / 08 훈련. 분석은 LLM 연동 별도 작업.

---

## 질문 생기면 확인할 것

- **AI 분석 엔진** — Claude Haiku/Sonnet API? 토큰 한도? 결과 캐싱 정책?
- **영상 업로드 / 저장** — 백엔드(S3/GCS) + 트랜스코딩 파이프라인 필요. 압축 spec(9:16, ≤30MB?)
- **이용권 차감 시점** — 세션 저장 시 즉시 차감? 취소 가능 시간?
- **달력 dot 의미** — 클라이밍한 날만? 모든 세션? 컨디셔닝만 한 날도?
- **소셜 / 팔로우** — 홈 피드 "내 영상" / "피드" 구분이 있다는 건 다른 사람 피드가 있다는 뜻. 친구 시스템 필요?

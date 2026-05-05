# 06. 클라이밍 캘린더

> 경로: `/calendar` | 공통 규칙: [00-overview.md](./00-overview.md)

---

## 1. 목적·사용 흐름

**목적:** 본인의 클라이밍 방문일·완등 문제를 캘린더로 한눈에 확인하고 기록.

> **추가 동작:** `[+ 기록 추가]` 버튼은 [09 통합 세션 추가 모달](./09-add-session.md)을 호출합니다. 본 문서의 "기록 추가 모달" 섹션(와이어/필드/이용권 선택/완등·시도 행/영상 연결)은 **통합 모달의 한 모드**로 흡수되었으며, 입력 필드와 검증 규칙은 그대로 유지됩니다.

**사용 흐름:**
1. BottomNav `📅 캘린더` → `/calendar` 진입
2. 현재 월 캘린더가 표시되며 방문 일자에 dot 마커
3. 좌우 화살표로 월 이동, 헤더 클릭 시 월 선택 모달
4. 날짜 클릭 → 하단에 해당 날짜의 기록 상세 패널 펼침
5. 기록 없는 날짜 클릭 → "[+ 기록 추가]" CTA
6. 기록 추가 모달:
   - 암장 선택
   - **사용한 이용권 선택 (필수)** — 3가지 타입 중 반드시 1개 선택. 디폴트 없음, 미선택 시 저장 비활성:
     - **정기권** — 마이페이지에서 등록한 본인 정기권 중 해당 암장 + 유효기간 내 항목만 셀렉트에 노출
     - **횟수권** — 마이페이지에서 등록한 본인 횟수권 중 해당 암장 + 잔여>0 + 만료 전 항목만 노출
     - **일일이용권** — 별도 등록 없이 모달에서 선택만 함 (1회용). 추가 입력 필드 없음
   - 메모 (방문 단위 자유 텍스트 — 컨디션·동행자·전반 인상 등)
   - 완등 문제 행 추가 — 각 행에 **선택적으로 본인 등록 영상 1개 연결 가능**
7. 저장 시:
   - climb_log 생성과 함께 이용권 정보 기록 (셋 중 정확히 1개)
     - 정기권/횟수권: `gym_pass_id` FK 연결
     - 일일이용권: `used_day_pass=true` 플래그
   - 선택된 이용권이 **횟수권**이면 `remaining_count`를 1 차감
   - 정기권/일일이용권은 차감 없이 기록만 (사용 이력 추적용)
8. 기존 기록의 ⋯ 메뉴 → 삭제 (삭제 시 횟수권은 자동 복구되지 않음 — 운영 단순화)

## 2. 레이아웃 와이어프레임

```
┌────────────────────────────────────────┐
│ [TopBar]                               │
│ TheRoute                       👤 마이 │
├────────────────────────────────────────┤
│                                        │
│       ◀  2026년 5월  ▶                 │
│                                        │
│  일 월 화 수 목 금 토                  │
│           1  2  3  4                   │
│   5  6  7  8• 9 10 11•                │  ← • = 방문일
│  12•13 14 15 16 17 18                  │
│  ...                                   │
│  ┌────────────────────────────────────┐│
│  │ 5월 8일 (목) 기록                  ││
│  ├────────────────────────────────────┤│
│  │ 더클라임 강남                  ⋯   ││
│  │ 🎟️ 이용권: 10회권 (잔여 6회)       ││  ← 횟수권 사용 시
│  │   또는 🎟️ 이용권: 월정기권          ││  ← 정기권 사용 시
│  │   또는 🎟️ 이용권: 일일이용권        ││  ← 일일이용권 사용 시
│  │   (이용권은 필수이므로 항상 노출됨)  ││
│  │ 메모: 슬랩 위주로 풀었음           ││
│  │  · 노랑🟡 (V3)  ☑ 완등  · 2회  🎬 ││
│  │  · 파랑🔵 (V4)  ☑ 완등  · 5회  🎬 ││
│  │  · 빨강🔴 (V5)  ☐ 미완등 · 8회      ││
│  └────────────────────────────────────┘│
│                                        │
│  (다른 기록이 있으면 카드 추가)         │
│                                        │
│  [+ 기록 추가]   (해당 날짜 기준)       │
│                                        │
├────────────────────────────────────────┤
│ [BottomNav] 🏠 🗺️ ➕ 💪 📅*             │
└────────────────────────────────────────┘
```

**기록 추가 모달:**
```
┌──────────────────────────────────────────┐
│ 기록 추가              [취소]  [저장]    │
├──────────────────────────────────────────┤
│ 날짜: 2026-05-08                         │
│ 암장 *: [더클라임 강남     ▼]            │
│ 사용 이용권 *:                           │
│   ( ) 정기권:                             │
│       [월정기권 (~05.31, 12일 남음)  ▼]  │  ← 등록된 정기권 중 active만
│   (●) 횟수권:                             │
│       [10회권 (잔여 7회)            ▼]   │  ← 등록된 횟수권 중 active만
│       ※ 저장 시 잔여 -1 차감             │
│   ( ) 일일이용권 (1회용)                  │  ← 별도 등록 없음, 단순 플래그
│                                           │
│   ※ 3지선다 라디오 (필수). 미선택 시 저장 │
│     버튼 비활성. 정기권/횟수권은 해당 암장 │
│     등록된 이용권만 옵션에 노출 (없으면    │
│     라디오 자체 disabled).                 │
│ 메모(방문 단위 자유 텍스트):             │
│  ┌────────────────────────────────────┐  │
│  │ 슬랩 위주로 풀었음                  │  │
│  └────────────────────────────────────┘  │
│                                          │
│ 시도한 문제                              │
│  ┌─ 행 1 ────────────────────────────┐  │
│  │ 문제: [노랑🟡 (V3)        ▼]      │  │
│  │ ☑ 완등  ·  시도 [ 2 ] 회           │  │
│  │ 영상 연결: [노랑🟡 (V3) #7   ▼]   │  │
│  │                              [✕]   │  │
│  └────────────────────────────────────┘  │
│  ┌─ 행 2 ────────────────────────────┐  │
│  │ 문제: [파랑🔵 (V4)        ▼]      │  │
│  │ ☑ 완등  ·  시도 [ 5 ] 회           │  │
│  │ 영상 연결: [+ 영상 선택]           │  │
│  │                              [✕]   │  │
│  └────────────────────────────────────┘  │
│  ┌─ 행 3 ────────────────────────────┐  │
│  │ 문제: [빨강🔴 (V5)        ▼]      │  │
│  │ ☐ 완등  ·  시도 [ 8 ] 회           │  │
│  │                              [✕]   │  │
│  └────────────────────────────────────┘  │
│  [+ 문제 추가]                            │
└──────────────────────────────────────────┘
```

**영상 연결 동작:**
- "영상 연결" 셀렉트는 **선택사항**
- 셀렉트 옵션 풀: **본인이 등록한 영상 중 같은 (gym_id, problem_id) 조합** 우선 → 그다음 같은 gym 전체 영상
- "영상 연결 안 함"이 default
- custom_level/custom_color로 입력한 카탈로그 외 문제(problem_id 없음)는 영상 연결 비활성

**이용권 선택 동작 (3 타입 중 필수 1택):**

| 옵션 | 데이터 흐름 | 차감 | 라디오 활성 조건 |
|------|------------|------|-----------------|
| 정기권 | gym_pass_id={선택한 정기권 id}, used_day_pass=false | 없음 | 해당 gym의 본인 정기권 중 (start_date ≤ visited_at ≤ end_date) + is_active 1건 이상 있을 때만 활성 |
| 횟수권 | gym_pass_id={선택한 횟수권 id}, used_day_pass=false | **자동 -1** | 해당 gym의 본인 횟수권 중 (remaining_count > 0) + (end_date IS NULL OR end_date ≥ today) + is_active 1건 이상 있을 때만 활성 |
| 일일이용권 | gym_pass_id=NULL, used_day_pass=true | 없음 | 항상 활성 (별도 등록 없음, 1회성 플래그) |

- **이용권 선택은 필수**. 셋 중 어느 것도 선택되지 않으면 저장 버튼 비활성 + 인라인 안내 ("이용권을 선택하세요")
- 정기권/횟수권 라디오는 옵션 풀이 0개면 disabled + 보조 안내 텍스트 ("등록된 정기권 없음" / "등록된 횟수권 없음. 마이페이지에서 등록")
- 정기권/횟수권 라디오 선택 시 옆에 셀렉트가 펼쳐져 구체 이용권 1개 선택 (셀렉트 미선택 시에도 저장 비활성)
- 옵션 라벨:
  - 정기권: `월정기권 (~2026.05.31, 12일 남음)`
  - 횟수권: `10회권 (잔여 7회)` 또는 `10회권 (잔여 7회, ~2026.12.31)` (만료일 있을 때)
- 암장 변경 시: 라디오 선택과 셀렉트를 모두 초기화. 정기권/횟수권 옵션 풀을 새 암장 기준으로 재fetch
  - 새 암장에 정기권·횟수권 모두 0건이면 일일이용권만 선택 가능
  - 사용자가 이전에 정기권/횟수권을 선택했었더라도, 새 암장에서 해당 라디오가 disabled로 전환되면 선택 초기화 (저장 비활성 상태로)
- 일일이용권은 암장에 무관하게 항상 선택 가능 (암장에 다른 이용권이 등록되어 있지 않을 때의 안전한 fallback 옵션)

**완등 / 시도 횟수 입력 동작:**
- **완등 체크박스** (`is_cleared`): default 미체크. 체크 시 ✓ 표시, 미체크 시 "도전 중"
- **시도 횟수 입력** (`attempts`): number input, 최소 1, default 1
  - 키보드 직접 입력 또는 `[-] [+]` 스테퍼로 증감
  - "1회 = 한 번 시도" (= 플래시 또는 첫 시도 실패)
  - 빈 값 또는 0 입력 시 저장 비활성 (행 단위 검증)
- 완등 미체크 + attempts 입력은 자연스러운 조합 ("8회 시도 후 미완등 = 도전 중")
- 완등 체크 + attempts=1 → 플래시(첫 시도 성공) 의미. UI에 작은 "FL" 뱃지 보조 표시(선택)

## 3. 사용 API

### 3.1 GET `/api/climb-logs?year=&month=` (캘린더 dot)
**응답:**
```json
{ "success": true, "data": { "dates": ["2026-05-08", "2026-05-11", "2026-05-12"] } }
```

### 3.2 GET `/api/climb-logs?date=YYYY-MM-DD` (날짜별 상세)
**응답:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 14,
        "gym_id": 2,
        "gym_name": "더클라임 강남",
        "gym_address": "...",
        "visited_at": "2026-05-08",
        "memo": "슬랩 위주로 풀었음",
        "gym_pass_id": 6,
        "gym_pass": {
          "id": 6,
          "pass_type": "count",
          "label": "10회권",
          "remaining_count": 6,
          "total_count": 10,
          "end_date": "2026-12-31"
        },
        "used_day_pass": false,
        "problems": [
          {
            "id": 1, "problem_id": 3,
            "level": "V3", "color": "yellow",
            "is_cleared": true,
            "attempts": 2,
            "ar_route_id": 7,
            "ar_route": {
              "id": 7,
              "title": "노랑🟡 (V3)",
              "video_url": "https://.../1234.mp4",
              "thumbnail_url": null
            }
          }
        ]
      }
    ]
  }
}
```
- `section`은 응답·UI 모두에서 미사용 (벽 정보 비노출 규약)
- `ar_route_id`: 연결된 영상 id (없으면 `null`)
- `ar_route`: ar_route_id가 있을 때 join하여 핵심 필드 포함 (재생/썸네일용)

### 3.3 POST `/api/climb-logs`
**요청:**
```json
{
  "gym_id": 2,
  "visited_at": "2026-05-08",
  "memo": "...",
  "gym_pass_id": 6,
  "problems": [
    { "problem_id": 3, "is_cleared": true,  "attempts": 2, "ar_route_id": 7 },
    { "problem_id": 5, "is_cleared": true,  "attempts": 5, "ar_route_id": null },
    { "custom_level": "V5", "custom_color": "red", "is_cleared": false, "attempts": 8 }
  ]
}
```
- `problem_id` 또는 `custom_*`을 선택적으로 사용 (오프-카탈로그 문제 기록 가능)
- `is_cleared`: 체크박스 값 (boolean, default false)
- `attempts`: 시도 횟수 (정수, 최소 1, default 1)
- `ar_route_id`: 본인이 등록한 영상의 id (선택, 미연결 시 `null` 또는 생략)
- **`gym_pass_id`** *(필수 그룹 1/2)*: 정기권/횟수권 사용 시 등록 이용권 id
- **`used_day_pass`** *(필수 그룹 2/2)*: 일일이용권 사용 시 `true`
- 두 필드 중 **정확히 하나**가 truthy여야 함. 둘 다 비어 있거나 둘 다 채워져 있으면 400
- 백엔드 처리 (트랜잭션):
  1. 이용권 입력 정합성 검증:
     - `gym_pass_id` 비어 있고 `used_day_pass !== true` → 400 ("이용권을 선택하세요")
     - `gym_pass_id`와 `used_day_pass=true` 동시 → 400 ("이용권 종류는 한 가지만 선택")
  2. `gym_pass_id`가 있으면 GymPass 조회 → 본인 소유 + active + gym_id 일치 + 미만료 + (정기권은 visited_at이 기간 내) 검증
  3. ClimbLog INSERT (`gym_pass_id`, `used_day_pass` 포함)
  4. ClimbLogProblem bulk INSERT
  5. **GymPass가 `count` 타입이면 `remaining_count -= 1`** (`save()`)
  6. 정기권/일일이용권은 차감 없음 (기록만)
- 백엔드 검증:
  - `attempts`가 1 미만이면 400
  - `ar_route_id`가 들어왔을 때 그 영상의 `user_id`가 요청자 본인(현재는 디폴트 user)인지 확인 → 다르면 400
  - `gym_pass_id`의 `user_id !== req.user.id` → 403
  - `gym_pass_id`의 `gym_id !== req.body.gym_id` → 400 (다른 암장의 이용권 사용 불가)
  - 횟수권의 `remaining_count <= 0` 또는 만료일 경과 → 400 ("이용권이 만료되었습니다")
  - 정기권의 `visited_at`이 `start_date~end_date` 범위 밖 → 400 ("이용권 유효 기간 외")

### 3.4 DELETE `/api/climb-logs/:id`
- 본인 소유만 삭제 가능 (백엔드 검증)

### 3.5 GET `/api/gyms?q=` (모달 내 암장 검색)
- 04 페이지와 동일

### 3.6 GET `/api/gyms/:id/problems` (모달 내 문제 선택)
- 03 페이지와 동일

### 3.7 GET `/api/routes?gym_id=:id&problem_id=:pid&user_id=me` (모달 내 영상 연결 셀렉트)
- 영상 연결 셀렉트 옵션 풀 조회
- 우선순위: **(gym_id + problem_id 일치)** → 그다음 (gym_id만 일치)
- 본인 영상으로 제한하기 위해 `user_id=me` (또는 `mine=true`) 필터 사용
- **백엔드 보강 필요**: `listRoutes`에 `user_id=me` 또는 `mine=true` 인식 (req.user.id로 매핑)
- 응답은 01 피드와 동일 형태

### 3.8 GET `/api/passes?gym_id=:id&status=active&pass_type=period|count` (모달 내 이용권 셀렉트)
- 기록 추가 모달의 정기권/횟수권 라디오 옵션 풀 조회
- 본인 이용권 중 해당 암장 + active + 지정 type만 반환
- **백엔드 보강 필요**: 기존 `listPasses`에 `gym_id`, `pass_type` 쿼리 파라미터 추가
- 정기권/횟수권 라디오마다 별도 호출 (또는 한 번에 받아 클라이언트에서 분류)
- 일일이용권은 등록 데이터가 없으므로 본 API와 무관 (클라이언트 라디오만의 플래그)
- 응답 예 (`pass_type=period`):
  ```json
  {
    "success": true,
    "data": {
      "passes": [
        { "id": 5, "pass_type": "period", "label": "월정기권",
          "start_date": "2026-04-01", "end_date": "2026-04-30",
          "days_remaining": 12 }
      ]
    }
  }
  ```
- 응답 예 (`pass_type=count`):
  ```json
  {
    "success": true,
    "data": {
      "passes": [
        { "id": 6, "pass_type": "count", "label": "10회권",
          "remaining_count": 7, "total_count": 10, "end_date": "2026-12-31" }
      ]
    }
  }
  ```

## 4. 컴포넌트 분해

```
<CalendarPage>
  ├── <MonthHeader year month onPrev onNext onPick />
  ├── <CalendarGrid year month dotDates onDayClick />
  │     └── <DayCell date hasDot isSelected />*
  ├── <SelectedDayPanel date logs onAdd onDelete>
  │     ├── <LogCard log onMore>*               # 방문 메모 + 이용권 + 문제 리스트
  │     │     ├── <UsedPassBadge pass usedDayPass />
  │     │     │     # 이용권은 필수이므로 항상 1개 표시됨
  │     │     │     # 우선순위: gym_pass(정기/횟수) > used_day_pass
  │     │     │     # 정기권: "🎟️ 이용권: 월정기권"
  │     │     │     # 횟수권: "🎟️ 이용권: 10회권 (잔여 6회)"
  │     │     │     # 일일이용권: "🎟️ 이용권: 일일이용권"
  │     │     └── <LoggedProblemRow problem>*
  │     │           ├── <ColorBadge level />     # 노랑🟡 (V3)
  │     │           ├── <ClearedIndicator value={is_cleared} />   # ☑ 완등 / ☐ 미완등
  │     │           ├── <AttemptsBadge value={attempts} />        # · N회
  │     │           └── 🎬 (연결 영상 있을 때) → 인라인 미리보기 / /routes/:id
  │     └── <AddLogButton />
  └── <SessionAddModal open initialPrefill={{ visited_at: date, gym_id?: defaultGymId }} mode="full" />
        # ※ 본 페이지의 [+ 기록 추가]는 09 통합 모달을 호출
        # 아래 인라인 정의는 통합 모달이 흡수한 입력 필드 리스트 — 동일하게 적용됨
        ├── <DatePickerReadonly date />
        ├── <GymPickerField />                  # 04와 동일 컴포넌트 재사용
        ├── <PassUsageSelector gymId value onChange required />
        │     # 라디오 3지선다 (필수): 정기권 / 횟수권 / 일일이용권
        │     # 디폴트 선택 없음. 미선택 시 모달의 [저장] 버튼 비활성
        │     # value 형태:
        │     #   null                                  ← 미선택 (저장 비활성)
        │     #   { kind: 'period', gym_pass_id: N }
        │     #   { kind: 'count',  gym_pass_id: N }
        │     #   { kind: 'day' }
        │     # 정기권/횟수권 라디오:
        │     #   GET /api/passes?gym_id=&status=active&pass_type=period|count 호출
        │     #   결과 0건이면 라디오 disabled + 안내
        │     # 일일이용권: 별도 fetch 없이 단순 플래그, 항상 활성
        │     # gymId 변경 시 정기/횟수 옵션 풀 재fetch + 선택 초기화 (value=null로 reset)
        │     # 저장 직전 변환: kind에 따라 폼 필드 gym_pass_id, used_day_pass 매핑
        │     #   period/count → gym_pass_id 세팅, used_day_pass=false
        │     #   day         → gym_pass_id=null, used_day_pass=true
        ├── <MemoTextarea />                    # visit-level memo (자유 텍스트)
        ├── <ProblemRowsEditor>
        │     └── <ProblemRowEditor>*
        │           ├── <ProblemPickerInline />            # problem_id 선택 또는 custom_level/color 입력
        │           ├── <ClearedCheckbox value onChange />  # ☐/☑ 완등 체크박스 (default 미체크)
        │           ├── <AttemptsInput value onChange min=1 default=1 />
        │           │     # number input + [-]/[+] 스테퍼, 빈 값 또는 0 시 행 검증 실패
        │           └── <ArRouteLinkSelect gymId problemId value onChange />
        │                 # GET /api/routes?gym_id=&problem_id=&mine=true 호출
        │                 # 옵션: "영상 연결 안 함" + 본인 영상 N개
        │                 # custom_* 입력 시 비활성 (problem_id 없으면 연결 불가)
        └── [저장] / [취소]
```

**`<CalendarGrid>` 구현 메모:**
- 외부 라이브러리 의존 없이 직접 구현 (week 시작은 일요일)
- 오늘 날짜 강조, 선택일 강조, dot 마커
- BJJ의 calendar.css 변수 차용 가능

## 5. 상태 / 데이터 모델

```ts
type CalendarState = {
  year: number;
  month: number;            // 1~12
  dotDates: Set<string>;    // YYYY-MM-DD
  selectedDate: string;     // 기본: 오늘
  logs: LogItem[];
  addModalOpen: boolean;
  loading: { dots, logs };
};
```

**fetch 트리거:**
- `(year, month)` 변경 → `getLogDates`
- `selectedDate` 변경 → `getLogsByDate`
- 추가/삭제 성공 → 양쪽 invalidate (해당 월 dots + 해당 날짜 logs)

## 6. 빈 상태 / 에러 / 로딩

| 상태 | 처리 |
|------|------|
| 첫 로딩 | 그리드는 즉시 렌더, dots만 spinner |
| 선택일에 기록 없음 | "기록이 없습니다 [+ 기록 추가]" |
| 기록 추가 실패 | 모달 유지 + 토스트 |
| 삭제 확인 | `<ConfirmModal>` "이 기록을 삭제할까요?" |
| 미래 날짜 클릭 | 기록 추가는 가능 (선택 트레이닝 계획용으로 사용 여부 결정 필요) |

## 7. 추후 인증 도입 시 변경점

- 백엔드 `req.user.id`가 자동으로 본인 user로 잡힘 — 코드 변경 불필요
- 추후 다중 사용자 시: URL을 `/users/:id/calendar`로 확장 가능
- `ar_route_id` 본인 영상 검증 로직(POST `/api/climb-logs`)도 인증 활성 시 그대로 작동

## 7.1 백엔드 보강 항목 (영상 연결·시도 횟수·이용권 연동 도입에 따른 추가)

1. **`climb_log_problems` 테이블에 컬럼 2개 추가**
   - Sequelize 모델 `ClimbLogProblem.js`에:
     - `ar_route_id: { type: BIGINT.UNSIGNED, allowNull: true }`
     - `attempts: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 1, validate: { min: 1 } }`
   - 마이그레이션 (idempotent 체크):
     - `ALTER TABLE climb_log_problems ADD COLUMN ar_route_id BIGINT UNSIGNED NULL`
     - `ALTER TABLE climb_log_problems ADD COLUMN attempts INT UNSIGNED NOT NULL DEFAULT 1`
   - FK 제약: `ar_route_id` `ON DELETE SET NULL` (영상 삭제 시 연결만 끊김)

2. **`climb_logs` 테이블에 컬럼 2개 추가**
   - Sequelize 모델 `ClimbLog.js`에:
     - `gym_pass_id: { type: BIGINT.UNSIGNED, allowNull: true }` — 정기권/횟수권 사용 시
     - `used_day_pass: { type: BOOLEAN, allowNull: false, defaultValue: false }` — 일일이용권 사용 시
   - 마이그레이션 (idempotent):
     - `ALTER TABLE climb_logs ADD COLUMN gym_pass_id BIGINT UNSIGNED NULL`
     - `ALTER TABLE climb_logs ADD COLUMN used_day_pass BOOLEAN NOT NULL DEFAULT 0`
   - FK 제약: `gym_pass_id` `ON DELETE SET NULL` (이용권 삭제 시 연결만 끊김, 기록은 보존)
   - association: `ClimbLog.belongsTo(GymPass, { as: 'gym_pass', foreignKey: 'gym_pass_id' })`
   - 무결성 규칙(애플리케이션 레벨): `gym_pass_id != NULL`이면 `used_day_pass`는 false여야 함

3. **`createLog` 컨트롤러 — 이용권(필수)·attempts·ar_route_id 통합 처리**
   - 트랜잭션으로 감쌈 (DB transaction)
   - **이용권 입력 정합성 (XOR)**:
     - `gym_pass_id`가 비어 있고 `used_day_pass !== true` → 400 ("이용권을 선택하세요")
     - `gym_pass_id`와 `used_day_pass=true` 둘 다 → 400 ("이용권 종류는 한 가지만 선택")
   - body에 `gym_pass_id`가 있으면:
     - GymPass 조회 (소유자/암장/만료/잔여/유효기간 검증)
     - **검증 실패 시 트랜잭션 ROLLBACK + 적절한 4xx 응답**
     - ClimbLog INSERT 시 `gym_pass_id`, `used_day_pass=false`
     - GymPass.pass_type === 'count'이면 `pass.remaining_count -= 1; await pass.save({ transaction })`
   - body에 `used_day_pass=true`면:
     - 추가 검증 없이 ClimbLog INSERT 시 `gym_pass_id=NULL`, `used_day_pass=true`
     - 차감 없음
   - 각 problems 항목 매핑 시 `attempts`·`ar_route_id` 포함
   - 검증:
     - `attempts < 1` → 400
     - `ar_route_id`가 있을 때 ArRoute의 `user_id !== req.user.id` → 400
     - `gym_pass_id` 본인 소유 아니면 → 403
     - `gym_pass_id`의 gym_id != body.gym_id → 400
     - 횟수권 만료/소진 시 → 400
     - 정기권 visited_at이 유효 기간 외 → 400

4. **`getLogsByDate` 응답에 attempts·ar_route·gym_pass·used_day_pass 추가**
   - 매핑된 problem 객체에 `attempts` 포함
   - ClimbLogProblem include에 `{ model: ArRoute, as: 'ar_route', attributes: ['id', 'title', 'video_url', 'thumbnail_url'], required: false }` 추가
   - ClimbLog include에 `{ model: GymPass, as: 'gym_pass', attributes: ['id', 'pass_type', 'label', 'remaining_count', 'total_count', 'end_date', 'start_date'], required: false }` 추가
   - 응답의 log 객체에 `used_day_pass` (boolean) 그대로 포함

5. **`listRoutes` 본인 영상 필터** (모달 셀렉트용)
   - `?mine=true` 또는 `?user_id=me` 인식 → `where.user_id = req.user.id`
   - 인증 비활성 상태에서도 디폴트 user(id=1) 기준으로 동작

6. **`listPasses`에 `gym_id`, `pass_type` 쿼리 파라미터 추가**
   - 기록 추가 모달의 PassUsageSelector 라디오별 옵션 풀 조회용
   - `where.gym_id = req.query.gym_id` 적용 (있을 때)
   - `where.pass_type = req.query.pass_type` 적용 (`period` 또는 `count`)
   - `status=active` 기존 동작 유지

7. **`deleteLog` 동작 (보충)**
   - 기록 삭제 시 차감된 횟수권은 자동 복구 안 함 (운영 단순화)
   - 추후 "차감 복구" 옵션이 필요하면 별도 엔드포인트로 추가 가능

## 8. 수용 기준

- [ ] `/calendar` 진입 시 이번 달 + 오늘 자동 선택, dots 표시
- [ ] 좌우 화살표로 월 이동, dots 갱신
- [ ] 날짜 클릭 시 하단 패널에 해당 일 기록 상세 노출
- [ ] 메모는 visit 단위 자유 텍스트로 입력·표시 (문제별 메모 X)
- [ ] [+ 기록 추가] → 모달에서 암장·**이용권**·메모·완등 문제 입력 → 저장 시 dots/logs 즉시 갱신
- [ ] **이용권 라디오는 3지선다 (필수): 정기권 / 횟수권 / 일일이용권**
- [ ] **이용권을 선택하지 않으면 모달의 [저장] 버튼이 비활성** + 인라인 안내 ("이용권을 선택하세요")
- [ ] **정기권 라디오 선택 시 셀렉트에는 본인 정기권 중 (visited_at이 기간 내) + active만 노출**
- [ ] **횟수권 라디오 선택 시 셀렉트에는 본인 횟수권 중 잔여>0 + (만료일 NULL 또는 ≥오늘) + active만 노출**
- [ ] **정기권/횟수권 라디오 선택 후 셀렉트에서 구체 이용권 미선택 시에도 저장 비활성**
- [ ] **일일이용권은 별도 등록 없이 라디오 단일 클릭만으로 선택 가능 (1회용 플래그)**
- [ ] **암장 변경 시 정기권/횟수권 옵션 풀이 새 암장 기준으로 재fetch + 라디오·셀렉트 모두 초기화 (저장 비활성 상태로 복귀)**
- [ ] **선택된 암장에 정기권 옵션이 0건이면 정기권 라디오 비활성, 횟수권도 동일**
- [ ] **암장에 정기/횟수 둘 다 0건이어도 일일이용권 라디오는 항상 활성 (안전한 fallback 옵션)**
- [ ] **횟수권을 선택해 저장 시 잔여 횟수가 1 차감됨**
- [ ] **정기권/일일이용권을 선택해 저장 시 차감 없이 기록만 됨**
- [ ] **타인 이용권/다른 암장 이용권/만료 이용권 선택 시 백엔드가 400/403 응답**
- [ ] **`gym_pass_id`와 `used_day_pass=true`가 동시에 들어오면 백엔드 400**
- [ ] **`gym_pass_id`도 비어 있고 `used_day_pass !== true`면 백엔드 400 ("이용권을 선택하세요")**
- [ ] **기록 카드에 🎟️ 이용권 라인이 정기/횟수/일일에 따라 다른 라벨로 항상 표시됨 (필수이므로 미노출 케이스 없음)**
- [ ] **기록 삭제 시 차감된 횟수권은 자동 복구되지 않음 (현 운영 정책)**
- [ ] **각 문제 행에 완등 여부를 체크박스로 토글** (`is_cleared`, default 미체크)
- [ ] **각 문제 행에 시도 횟수를 number input + [-][+] 스테퍼로 입력** (`attempts`, 최소 1, default 1)
- [ ] 시도 횟수 빈 값 또는 0 입력 시 저장 비활성 + 인라인 에러 표시
- [ ] 완등 미체크 + 시도 횟수만 입력 가능 (예: `☐ 8회` = 도전 중)
- [ ] 기록 카드 표시에 `☑ 완등 · N회` 또는 `☐ 미완등 · N회` 형식으로 둘 다 노출
- [ ] **각 문제 행에 본인 등록 영상을 1개 선택적으로 연결 가능** (`ar_route_id`)
- [ ] **영상 연결 셀렉트는 같은 (gym, problem) 본인 영상을 우선 노출**, 그다음 같은 gym 본인 영상
- [ ] **custom_level/custom_color로 입력한 문제는 영상 연결 셀렉트가 비활성**
- [ ] 기록 카드의 문제 row에 영상이 연결되어 있으면 🎬 아이콘 표시, 클릭 시 인라인 미리보기 또는 `/routes/:id`로 이동
- [ ] 영상이 삭제되면 연결만 끊기고 기록·완등 표시는 보존됨 (`ON DELETE SET NULL`)
- [ ] `ar_route_id`로 타인 영상을 보내면 백엔드가 400 응답
- [ ] 기록 ⋯ 메뉴에서 삭제 → 확인 → 즉시 반영
- [ ] custom_level/custom_color로 카탈로그 외 문제 기록 가능
- [ ] 모바일 폭에서 7열 그리드 깨지지 않음

## 9. 의존 페이지

- ⤴ **04 암장 목록**의 GymPicker 컴포넌트 재사용
- ⤴ **05 암장 상세**의 ProblemPicker 로직 재사용 (모달 내 문제 선택)
- ➡ 향후 기록 카드에서 "이 암장 보기" → **05 암장 상세** 링크 추가 가능

# 07. 마이페이지 (이용권 통합)

> 경로: `/me` | 공통 규칙: [00-overview.md](./00-overview.md)

---

## 1. 목적·사용 흐름

**목적:** 본인 프로필·내 영상·북마크·이용권을 **한 페이지의 탭 구조**로 통합 관리.

**사용 흐름:**
1. TopBar 우상단 `👤` 클릭 → `/me` 진입
2. 상단 프로필 카드에서 닉네임/최고레벨/주암장 확인 및 [편집]
3. 탭으로 `내 영상 / 북마크 / 이용권` 전환
4. **내 영상**: 등록한 영상 그리드, 클릭 시 상세
5. **북마크**: 스크랩한 영상 그리드, 클릭 시 상세
6. **이용권**: 정기권/횟수권 카드 리스트, [+ 이용권 등록] / [횟수 사용] / [삭제]
7. 프로필 편집 → 저장 시 인플레이스 갱신

## 2. 레이아웃 와이어프레임

```
┌────────────────────────────────────────┐
│ [TopBar]                               │
│ ← (뒤로)        마이페이지              │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────────┐│
│  │ 👤 (프로필 이미지)                  ││
│  │ 나                                 ││
│  │ 🏆 최고 레벨: 노랑🟡 (V3)           ││  ← 색상 + 자동 매핑 V등급
│  │ 🧗 클라이밍 시작: 2024.03.05        ││  ← 처음 시작일
│  │     · 2년 2개월차 (792일)           ││  ← 자동 계산되는 경력
│  │ 🏟️ 주 암장:                         ││  ← 복수 선택, 칩 형태
│  │   [더클라임 강남] [클라이밍파크 신촌]││
│  │   [+ 더보기]                         ││
│  │ 자기소개 한 줄…                     ││
│  │                          [편집]     ││
│  └────────────────────────────────────┘│
│                                        │
│  [내 영상 (8)] [북마크 (3)] [이용권 (2)]│  ← 탭
│  ────────────                          │
│                                        │
│  ▼ 내 영상 / 북마크 (그리드)            │
│  ┌────────┐ ┌────────┐                │
│  │ 썸네일 │ │ 썸네일 │   <RouteCard 재사용>
│  └────────┘ └────────┘                 │
│  ...                                   │
│                                        │
│  ▼ 이용권 탭                           │
│  ┌────────────────────────────────────┐│
│  │ 더클라임 강남 · 정기권              ││
│  │ 📅 2026.04.01 ~ 2026.04.30          ││
│  │ ⏳ 잔여 12일                    ⋯   ││
│  └────────────────────────────────────┘│
│  ┌────────────────────────────────────┐│
│  │ 클라이밍파크 신촌 · 횟수권          ││
│  │ 🎟️ 잔여 7 / 10회                    ││
│  │ 📅 만료일: 2026.12.31  (240일 남음) ││  ← 만료일 + days_remaining
│  │                  [1회 사용]    ⋯   ││
│  └────────────────────────────────────┘│
│  ┌────────────────────────────────────┐│
│  │ 볼더스 홍대 · 횟수권                ││
│  │ 🎟️ 잔여 3 / 10회                    ││
│  │ 📅 만료일 없음 (무기한)             ││  ← end_date NULL일 때
│  │                  [1회 사용]    ⋯   ││
│  └────────────────────────────────────┘│
│  [+ 이용권 등록]                        │
│                                        │
├────────────────────────────────────────┤
│ [BottomNav] 🏠 🗺️ ➕ 💪 📅             │
└────────────────────────────────────────┘
```

**프로필 편집 모달:**
```
┌────────────────────────────────────────┐
│ 프로필 편집           [취소]  [저장]   │
├────────────────────────────────────────┤
│  📷 (이미지 업로드)                    │
│  닉네임 *: [____________]              │
│  최고 레벨:                            │
│   색상: 🔴 🟠 🟡* 🟢 🔵 🟦 🟣 ⚫ ⚪ ⬛ │  ← 단일 선택 칩, * = 현재 선택
│   기준 암장: [더클라임 강남  ▼]        │  ← 매핑 기준 (main_gyms 중 1택, 없으면 비활성)
│   V등급: [V3  ▼]    (자동 추론됨)      │  ← 색상·기준 암장 변경 시 자동 default
│   미리보기: 노랑🟡 (V3)                │  ← formatRouteTitle 라이브
│                                        │
│  주 암장 (복수 선택):                  │
│   ┌──────────────────────────────────┐ │
│   │ [더클라임 강남 ✕]                 │ │
│   │ [클라이밍파크 신촌 ✕]             │ │
│   │ [+ 암장 추가]                      │ │
│   └──────────────────────────────────┘ │
│  클라이밍 시작일:                      │
│   [2024-03-05]   (date picker)         │
│  자기소개:                             │
│  [_________________________]           │
└────────────────────────────────────────┘
```

**최고 레벨 선택 동작:**
- **색상 칩이 1차 선택자** — 02·03 등 다른 메뉴와 동일한 10색 매핑(`utils/color.js`) 사용
- **기준 암장 셀렉트** — `main_gyms` 중 1개. 단일 암장 등록 시 자동 그 암장. main_gyms가 0개면 셀렉트 비활성 + 안내 ("기준 암장이 필요합니다. 먼저 주 암장을 추가하세요")
- **V등급 자동 추론** — 색상 또는 기준 암장 변경 시 `GET /api/gyms/:gymId/problems`로 받은 problems 중 동일 색상의 가장 빈번한 V등급을 default로 설정 (03 영상 등록의 `<LevelSuggester>` 로직 재사용)
- **사용자 수동 변경** — V등급 셀렉트로 수동 변경 가능. 변경 시 `userOverridden=true`로 마킹, 색상 변경 전까지 자동 추론 적용 안 함
- **미리보기**: `formatRouteTitle({ color, level })` 결과 라이브 표시 — 카드에서 보일 형식 미리 확인
- **선택 안 함 가능** — 색상도 V등급도 비울 수 있음 → 카드의 🏆 라인 자체 미노출

**기타 필드:**
- 주 암장 0개 선택 가능 (없으면 카드의 🏟️ 라인 자체 미노출)
- 같은 암장 중복 선택 방지 (이미 추가된 암장은 GymPicker 결과에서 disabled)
- 추가 순서대로 표시

**이용권 등록 모달:**
```
┌──────────────────────────────────┐
│ 이용권 등록        [취소]  [저장]│
├──────────────────────────────────┤
│  암장 *: [선택  ▼]                │
│  종류 *: ( ) 정기권  ( ) 횟수권   │
│  별칭: [________________]        │
│                                  │
│  ▼ 정기권 선택 시                 │
│  시작일 *: [2026-05-01]          │
│  종료일 *: [2026-05-31]          │
│                                  │
│  ▼ 횟수권 선택 시                 │
│  총 횟수 *: [10]                 │
│  만료일: [2026-12-31]   (선택)   │  ← 비우면 무기한
│                                  │
└──────────────────────────────────┘
```

**횟수권 만료일 동작:**
- **선택사항** — 비우면 잔여 횟수만 소진하면 만료, 만료일 없음 (무기한)
- 만료일 입력 시 `잔여 횟수 0` **또는** `만료일 < 오늘` 중 하나라도 충족되면 만료 처리
- 만료일은 시작일(또는 등록일) 이후만 가능 (과거 날짜 거부, 백엔드 400)
- 표시 우선순위(카드): 만료일이 가까우면(7일 이내) 강조, 잔여 횟수 0이면 그게 우선

## 3. 사용 API

### 3.1 GET `/api/users/:id` (id=me 또는 1)
**응답:** users 테이블 row + **main_gyms 배열** + 최고 레벨(색상/등급/기준 암장) + `climbing_started_at`(date, nullable)

```json
{
  "success": true,
  "data": {
    "id": 1,
    "nickname": "나",
    "max_level_color": "yellow",
    "max_level_grade": "V3",
    "max_level_gym_id": 2,
    "max_level_gym": { "id": 2, "name": "더클라임 강남" },
    "main_gyms": [
      { "id": 2, "name": "더클라임 강남" },
      { "id": 3, "name": "클라이밍파크 신촌" }
    ],
    "climbing_started_at": "2024-03-05",
    "bio": "...",
    "profile_image": null,
    "created_at": "..."
  }
}
```

- 기존 `max_level: "V5"` (단일 문자열) → **3개 필드로 분리**: `max_level_color`, `max_level_grade`, `max_level_gym_id`
- 셋 다 nullable. 모두 NULL이면 카드의 🏆 라인 미노출
- 표시는 `formatRouteTitle({ color, level })` 결과 사용

- `main_gyms`는 빈 배열일 수 있음 (선택사항)
- 기존 `main_gym_id`(단일 FK)는 deprecated → 데이터 마이그레이션 시 기존 값을 `user_main_gyms` 조인 테이블의 1행으로 이전

> **참고:** 백엔드에 `/users/me`(GET) 단축 라우트가 없음. 클라이언트에서 `useAuth().user.id`(=1)로 호출.
> 또는 백엔드에 `GET /api/users/me`를 추가하는 것이 깔끔. **백엔드 보강 항목**.

### 3.2 PUT `/api/users/me` (multipart/form-data)
**요청 form fields:**
- `nickname`, `bio`
- **`max_level_color`** (string, 빈 문자열 → NULL — 예: `"yellow"`)
- **`max_level_grade`** (string, 빈 문자열 → NULL — 예: `"V3"`)
- **`max_level_gym_id`** (number, 빈 문자열 → NULL)
- `main_gym_ids` (JSON array of number, 예: `"[2,3]"`, 빈 배열 허용)
- `climbing_started_at` (YYYY-MM-DD, 빈 문자열 허용 → NULL)
- `profile_image` (File, 선택)
- multipart 한계상 배열은 **JSON 직렬화 문자열**로 전송 (백엔드에서 JSON.parse)
- 검증:
  - `climbing_started_at`이 미래 날짜면 400
  - `main_gym_ids`의 모든 id가 실제 `gyms` 테이블에 존재하는지 확인 (없으면 400)
  - 중복 id dedupe
  - `max_level_color`가 알려진 색상 키(빨/주/노/초/파/남/보/검/백/회)에 속하는지 확인 (속하지 않으면 raw 값 그대로 저장 허용 — color.js의 fallback 규칙과 동일)
  - `max_level_gym_id`가 NULL이 아닌 경우 해당 gym이 존재해야 함
  - 셋(`color`/`grade`/`gym_id`)은 **부분 입력 허용** — 색상만 있고 V등급 비어 있어도 OK (표시는 `노랑🟡 (V?)` 또는 색상만 표시)

### 3.3 GET `/api/users/me/routes`
- 내가 등록한 영상 페이지네이션 응답

### 3.4 GET `/api/users/me/bookmarks`
- 내가 스크랩한 영상

### 3.5 GET `/api/passes?status=all|active|expired`
**응답:**
```json
{
  "success": true,
  "data": {
    "passes": [
      {
        "id": 5, "gym_id": 2, "gym_name": "더클라임 강남",
        "pass_type": "period", "label": "월정기권",
        "start_date": "2026-04-01", "end_date": "2026-04-30",
        "days_remaining": 12, "is_expired": false, "is_active": true
      },
      {
        "id": 6, "gym_id": 3, "gym_name": "클라이밍파크 신촌",
        "pass_type": "count", "label": "10회권",
        "total_count": 10, "remaining_count": 7,
        "end_date": "2026-12-31", "days_remaining": 240,
        "is_expired": false, "is_active": true
      }
    ]
  }
}
```
- 횟수권은 `end_date`(만료일, nullable)·`days_remaining` 추가 응답
- `is_expired` 계산: `remaining_count <= 0 || (end_date && end_date < today)`

### 3.6 POST `/api/passes`
**요청:**
```json
// 정기권
{ "gym_id": 2, "pass_type": "period", "label": "월정기권",
  "start_date": "2026-05-01", "end_date": "2026-05-31" }

// 횟수권 (만료일 없음 — 무기한)
{ "gym_id": 3, "pass_type": "count", "label": "10회권", "total_count": 10 }

// 횟수권 (만료일 있음)
{ "gym_id": 3, "pass_type": "count", "label": "10회권 (12월말까지)",
  "total_count": 10, "end_date": "2026-12-31" }
```
- 횟수권에서 `end_date`는 선택사항 (비우면 NULL)
- `end_date`가 오늘 이전이면 400

### 3.7 POST `/api/passes/:id/use` (횟수권 1회 차감)
**응답:** `{ data: { remaining_count, is_expired, ... } }`

### 3.8 DELETE `/api/passes/:id`

## 4. 컴포넌트 분해

```
<MyPage>
  ├── <MyTopBar back title="마이페이지" />
  ├── <ProfileCard user onEdit>
  │     ├── <ProfileMain />                    # 닉네임/프로필 이미지
  │     ├── <MaxLevelDisplay color grade gym />   # "🏆 최고 레벨: 노랑🟡 (V3)"
  │     │     # color/grade가 모두 NULL이면 컴포넌트 자체 미렌더
  │     │     # 02·03·05 등에서 사용한 utils/color.js + utils/routeTitle.js 동일 사용
  │     ├── <ClimbingTenure startedAt />       # "🧗 클라이밍 시작: 2024.03.05 · N년 N개월차"
  │     │     # startedAt이 NULL이면 컴포넌트 자체 미렌더 (라인 사라짐)
  │     └── <MainGymList gyms />               # 주 암장 칩 리스트 (복수)
  │           # gyms.length === 0 이면 컴포넌트 자체 미렌더
  │           # 칩 클릭 시 → /gyms/:id 이동
  │     └── <ProfileEditModal />
  │           ├── <ImageUpload />
  │           ├── <input nickname />
  │           ├── <MaxLevelEditor>                                  # V등급 단일 셀렉트 대체
  │           │     ├── <ColorPicker single value={color} clearable />   # 10색 칩, 비울 수 있음
  │           │     ├── <GymSelect options={user.main_gyms} value={gymId} />
  │           │     │     # main_gyms가 0개면 disabled + 안내
  │           │     ├── <LevelSuggester gymId color value={grade} onChange />
  │           │     │     # 03 등록 페이지의 동일 컴포넌트 재사용
  │           │     │     # 색상·기준 암장 변경 시 default V등급 추론, 수동 변경 시 userOverridden 마킹
  │           │     └── <RouteTitlePreview color={color} level={grade} />   # 라이브 미리보기
  │           ├── <MultiGymPicker value={gymIds} onChange />   # 04 GymPicker 다중 선택 변형
  │           │     # 칩 형태로 선택된 암장 표시, [+ 암장 추가]로 모달 호출
  │           │     # 모달 내 검색 결과에서 이미 추가된 암장은 disabled 표시
  │           │     # 각 칩에 ✕ 버튼으로 개별 제거
  │           ├── <DatePicker name="climbing_started_at" max={today} clearable />
  │           └── <textarea bio />
  ├── <Tabs value={tab}>
  │     ├── tab="routes"
  │     │     └── <RouteCardGrid routes />     # 01 컴포넌트 재사용
  │     ├── tab="bookmarks"
  │     │     └── <RouteCardGrid routes />
  │     └── tab="passes"
  │           ├── <PassCard pass onUse onDelete />*
  │           │     ├── period: 📅 시작 ~ 종료 / ⏳ 잔여 N일
  │           │     └── count:
  │           │           ├── 🎟️ 잔여 N / 총 N회
  │           │           ├── 📅 만료일: YYYY.MM.DD (D일 남음)
  │           │           │     # end_date NULL이면 "만료일 없음 (무기한)" 라인 표시
  │           │           │     # 만료일 ≤ 7일 남음 시 강조 색상
  │           │           └── [1회 사용] 버튼  (잔여 0 또는 만료 시 비활성)
  │           └── <AddPassButton />
  └── <AddPassModal>
        ├── <GymPickerField />
        ├── <PassTypeRadio />
        ├── <PeriodFields />            # 정기권: start_date, end_date 모두 필수
        └── <CountFields>               # 횟수권
              ├── <input total_count />        # 필수
              └── <DatePicker end_date min={today} clearable />   # 만료일 선택사항
```

## 5. 상태 / 데이터 모델

```ts
type MyPageState = {
  user: User | null;
  tab: 'routes' | 'bookmarks' | 'passes';
  routes: Route[];          // tab='routes'일 때만
  bookmarks: Route[];       // tab='bookmarks'일 때만
  passes: Pass[];           // tab='passes'일 때만
  passFilter: 'all' | 'active' | 'expired';
  modal: 'profile' | 'addPass' | null;
  loading: { user, routes, bookmarks, passes };
};

type User = {
  id: number;
  nickname: string;
  max_level_color: string | null;              // 'red'|'yellow'|... — utils/color.js 키
  max_level_grade: string | null;              // 'V1'~'V12' | null
  max_level_gym_id: number | null;             // 매핑 기준 암장
  max_level_gym?: { id: number; name: string } | null;  // include로 들어옴
  main_gyms: { id: number; name: string }[];   // 복수 선택, 빈 배열 가능
  climbing_started_at: string | null;          // 'YYYY-MM-DD' | null
  bio: string | null;
  profile_image: string | null;
  created_at: string;
};
```

**경력 계산 (`utils/climbingTenure.js`):**
```js
// formatTenure('2024-03-05') → "2년 2개월차 (792일)"
function formatTenure(startedAt, today = new Date()) {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  const days = Math.floor((today - start) / 86400000);
  if (days < 0) return null;                    // 미래 날짜는 표시 안 함
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (days < 30) return `${days}일차`;
  if (years === 0) return `${months}개월차 (${days}일)`;
  return `${years}년 ${months}개월차 (${days}일)`;
}
```

- 진입 시 `user`만 fetch, 탭 데이터는 lazy
- 횟수 차감: 낙관적 업데이트 후 응답으로 확정
- 정기권 만료일 임박(7일 이내) 시 카드 색상 강조

## 6. 빈 상태 / 에러 / 로딩

| 상태 | 처리 |
|------|------|
| 내 영상 0건 | "[+ 첫 영상 등록하기]" → `/routes/new` |
| 북마크 0건 | "관심있는 영상을 스크랩 해보세요" |
| 이용권 0건 | "[+ 이용권 등록]" 강조 |
| 횟수권 잔여 0 | 카드 흐림 처리, 사용 버튼 비활성 |
| 정기권 만료 | 카드 흐림 + "만료" 뱃지 |
| 프로필 저장 실패 | 모달 유지 + 토스트 |

## 7. 추후 인증 도입 시 변경점

- `useAuth().user.id`로 자동 라우팅 (현재는 항상 1)
- 인증 활성 시 본인 외 다른 사용자 프로필 보기는 `/users/:id`로 분리 가능 (현재는 자기 자신만)
- 프로필 편집은 인증 활성 시에만 활성

## 8. 백엔드 보강 항목

본 페이지 구현을 위해 추가 권장:

1. **`users` 테이블에 `climbing_started_at DATE NULL` 컬럼 추가**
   - Sequelize 모델 `User.js`에 `climbing_started_at: { type: DataTypes.DATEONLY, allowNull: true }`
   - 마이그레이션 (idempotent): `ALTER TABLE users ADD COLUMN climbing_started_at DATE NULL`

1.1 **`users` 테이블의 `max_level` 컬럼을 3개로 분리**
   - 기존 `max_level VARCHAR(20)` 컬럼 deprecated, 신규 컬럼 추가:
     - `max_level_color VARCHAR(30) NULL`
     - `max_level_grade VARCHAR(20) NULL`
     - `max_level_gym_id BIGINT UNSIGNED NULL` (FK to gyms.id, ON DELETE SET NULL)
   - 마이그레이션 (idempotent):
     - `ALTER TABLE users ADD COLUMN max_level_color VARCHAR(30) NULL`
     - `ALTER TABLE users ADD COLUMN max_level_grade VARCHAR(20) NULL`
     - `ALTER TABLE users ADD COLUMN max_level_gym_id BIGINT UNSIGNED NULL`
     - 데이터 이전: 기존 `max_level` 값이 V등급 형식이면 `max_level_grade`에만 복사 (color는 NULL로 두고 사용자가 재입력하도록 안내)
     - 한 사이클 후 기존 `max_level` 컬럼 DROP
   - Sequelize 모델 `User.js`에 세 필드 정의 + `belongsTo(Gym, { as: 'max_level_gym', foreignKey: 'max_level_gym_id' })`
2. **`user_main_gyms` 조인 테이블 신설 (주 암장 복수화)**
   - 스키마:
     ```sql
     CREATE TABLE IF NOT EXISTS user_main_gyms (
       user_id BIGINT UNSIGNED NOT NULL,
       gym_id  BIGINT UNSIGNED NOT NULL,
       sort_order SMALLINT UNSIGNED DEFAULT 0,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (user_id, gym_id),
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
       FOREIGN KEY (gym_id)  REFERENCES gyms(id)  ON DELETE CASCADE
     );
     ```
   - Sequelize: `User.belongsToMany(Gym, { through: 'user_main_gyms', as: 'main_gyms' })`
   - **데이터 마이그레이션**: 기존 `users.main_gym_id`가 NOT NULL인 행을 조인 테이블의 1행으로 이전 (`INSERT INTO user_main_gyms (user_id, gym_id) SELECT id, main_gym_id FROM users WHERE main_gym_id IS NOT NULL`)
   - 기존 `users.main_gym_id` 컬럼은 deprecated. 한 마이그레이션 사이클 후 DROP. 그 전까지는 호환 위해 유지하되 새 코드는 사용하지 않음
3. **`updateProfile` 컨트롤러 변경**
   - body에서 `main_gym_ids`(JSON 문자열 또는 array) 받아 처리
   - 트랜잭션 내에서: 기존 `user_main_gyms` 행 전체 DELETE → 새 ids로 일괄 INSERT (sort_order는 배열 인덱스)
   - 모든 id가 `gyms` 테이블에 존재하는지 검증 (없으면 400)
   - 중복 dedupe
   - **`max_level_color`, `max_level_grade`, `max_level_gym_id`도 함께 처리**:
     - 빈 문자열 → NULL
     - `max_level_gym_id`가 NULL이 아닐 때 gyms 존재 검증 (없으면 400)
     - 부분 입력 허용 (셋 중 일부만 NULL이어도 OK)
   - `climbing_started_at`도 동일 컨트롤러에서 함께 처리 (빈 문자열 → NULL, 미래 날짜 → 400)
4. **`getProfile` 응답 변경**
   - Sequelize include로 `main_gyms` + `max_level_gym` association 첨부 (attributes: id, name)
   - `main_gym_id`/`max_level` 단일 필드는 응답에서 제거 (또는 deprecated 표기)
   - `max_level_color`, `max_level_grade`, `max_level_gym_id`, `climbing_started_at` 포함
5. **05 암장 상세의 [⭐ 주 암장 설정] 동작 변경**
   - 기존: `main_gym_id` 단일 갱신
   - 신규: 토글 버튼 (`[⭐ 주 암장 추가]` ↔ `[★ 주 암장에서 빼기]`) — 현재 user의 `main_gyms`에 포함되어 있으면 빼기, 아니면 추가
   - 백엔드 엔드포인트: `POST /api/users/me/main-gyms/:gymId` (추가), `DELETE /api/users/me/main-gyms/:gymId` (제거) — 또는 PUT으로 전체 갱신 재사용
6. **`GET /api/users/me` 단축 라우트** (선택)
   - 현재는 `/users/:id`로만 조회 가능. `useAuth().user.id` 직접 사용으로 우회 가능하지만, `/users/me`가 깔끔
7. **이용권 자동 비활성화 배치** (장기 운영 시)
   - 만료된 정기권을 `is_active=false`로 자동 전환하는 cron (현재는 days_remaining 계산만)
   - 횟수권 만료일도 동일 cron에서 처리

8. **횟수권 만료일 도입에 따른 GymPass 컨트롤러/모델 보강**
   - 기존 `GymPass.js` 모델에 `end_date DATEONLY NULL`은 이미 정의되어 있음 (정기권 전용으로 명시되어 있지만 컬럼 자체는 공용)
   - **컨트롤러 변경**:
     - `createPass`에서 `pass_type==='count'`일 때 `end_date` 받아 저장 (기존엔 `period`에서만 set)
     - 검증: count + end_date가 오늘 이전이면 400
     - `listPasses`/`createPass` 응답의 count 항목에 `end_date`, `days_remaining`(있을 때) 포함
     - `is_expired` 계산:
       ```js
       // count
       is_expired = remaining_count <= 0 || (end_date && new Date(end_date) < today)
       ```
   - 마이그레이션 불필요 (컬럼 이미 존재)

## 9. 수용 기준

- [ ] `/me` 진입 시 프로필 카드 + 기본 탭(내 영상) 노출
- [ ] 프로필 [편집] → 모달 → 닉네임/**최고 레벨(색상+V등급+기준 암장)**/**주 암장(복수)**/**클라이밍 시작일**/소개 변경 → 저장 시 즉시 반영
- [ ] **최고 레벨이 입력되어 있으면 카드에 `🏆 최고 레벨: 노랑🟡 (V3)` 형식으로 표시** (`utils/color.js` + `utils/routeTitle.js` 동일 사용)
- [ ] **최고 레벨 색상·V등급 모두 NULL이면 🏆 라인 자체 미노출**
- [ ] **편집 모달의 색상 칩에서 단일 선택, ✕ 또는 재클릭으로 비울 수 있음**
- [ ] **기준 암장 셀렉트는 main_gyms 중에서만 선택 가능, main_gyms가 0개면 비활성 + 안내**
- [ ] **색상 또는 기준 암장 변경 시 V등급이 자동 추론되어 default로 채워짐 (해당 암장 problems의 동일 색상 빈도 최다)**
- [ ] **사용자가 V등급을 수동 변경 시 자동 추천이 사용자 입력을 덮어쓰지 않음**
- [ ] **편집 모달에 미리보기 라인이 라이브로 갱신됨 (예: 색상 변경 즉시 `노랑🟡 (V3)` 형태 변경)**
- [ ] V등급만 입력되고 색상이 없거나 그 반대 케이스도 저장 가능 (부분 입력 허용)
- [ ] **주 암장은 0개 ~ N개까지 복수 선택 가능, 칩으로 표시**
- [ ] **편집 모달의 [+ 암장 추가] 클릭 시 GymPicker 모달 열림, 이미 추가된 암장은 disabled로 중복 선택 차단**
- [ ] **각 칩의 ✕ 버튼으로 개별 제거 가능**
- [ ] **주 암장 0개 선택 시 카드의 🏟️ 라인 자체 미노출**
- [ ] **카드의 주 암장 칩 클릭 시 `/gyms/:id` 이동**
- [ ] **백엔드 PUT 시 `main_gym_ids` JSON 배열로 전송, 백엔드 트랜잭션으로 전체 교체**
- [ ] **존재하지 않는 gym_id가 포함되면 백엔드 400 응답**
- [ ] **클라이밍 시작일이 입력되어 있으면 카드에 `🧗 클라이밍 시작: YYYY.MM.DD · N년 N개월차 (D일)` 형식으로 표시**
- [ ] **클라이밍 시작일이 비어 있으면 해당 라인 자체가 미노출** (카드 레이아웃 안전)
- [ ] **편집 모달에서 미래 날짜 선택 시 저장 비활성** + 인라인 에러 메시지
- [ ] **시작일 datepicker는 비우기(clear) 버튼으로 NULL 처리 가능**
- [ ] 30일 미만이면 "N일차", 1년 미만이면 "N개월차 (D일)", 1년 이상이면 "N년 M개월차 (D일)"로 자동 포맷
- [ ] 프로필 이미지 업로드 가능 (multipart)
- [ ] 탭 전환 시 해당 데이터만 lazy fetch
- [ ] 내 영상/북마크 탭에서 카드 클릭 시 `/routes/:id` 이동
- [ ] 이용권 탭에서 [+ 등록] → 정기권/횟수권 모달 → 저장 시 카드 추가
- [ ] **횟수권 등록 시 만료일은 선택사항으로 입력 가능, 비우면 무기한**
- [ ] **횟수권 만료일이 오늘 이전이면 저장 비활성 + 인라인 에러**
- [ ] **만료일이 있는 횟수권은 잔여 횟수가 남아 있어도 만료일 경과 시 만료로 표시**
- [ ] **횟수권 카드에 `🎟️ 잔여 N / 총 N회` 라인이 항상 표시됨**
- [ ] **만료일이 있는 횟수권 카드에 `📅 만료일: YYYY.MM.DD (D일 남음)` 라인이 함께 표시됨**
- [ ] **만료일이 없는(NULL) 횟수권 카드에는 `📅 만료일 없음 (무기한)` 라인이 표시됨**
- [ ] **만료일이 7일 이내면 카드의 만료일 라인이 강조 색상으로 표시됨**
- [ ] **정기권 카드에 `📅 시작 ~ 종료` + `⏳ 잔여 N일` 라인이 표시됨**
- [ ] 횟수권 카드 [1회 사용] 클릭 시 잔여 횟수 차감, 0이 되거나 만료일 경과 시 사용 버튼 비활성
- [ ] 이용권 카드 ⋯ 메뉴 → 삭제 → 확인 후 즉시 제거
- [ ] 만료된 정기권/소진된 횟수권/만료일 경과 횟수권은 시각적으로 구분
- [ ] 우상단 `👤`(TopBar)에서 진입, 뒤로가기로 이전 페이지 복귀

## 10. 의존 페이지

- ⬅ 모든 페이지의 TopBar `👤` 아이콘에서 진입
- ➡ **02 영상 상세** (영상/북마크 탭의 카드 클릭)
- ➡ **03 영상 등록** (영상 0건 CTA)
- ⤴ **04 암장 목록**의 `<GymPickerField>` 재사용 (프로필 주암장, 이용권 등록)

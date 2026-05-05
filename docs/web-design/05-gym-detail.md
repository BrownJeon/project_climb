# 05. 암장 상세

> 경로: `/gyms/:id` | 공통 규칙: [00-overview.md](./00-overview.md)

---

## 1. 목적·사용 흐름

**목적:** 특정 암장의 기본 정보 + 등록된 문제 목록 + **해당 암장에 사용자가 등록한 영상 모음**을 한 페이지에서 조회.

> **추가 동작 분리:**
> - **영상·완등 기록 추가** → `<SessionAddModal>` ([09-add-session.md](./09-add-session.md)) 호출 (gym prefill)
> - **암장 카탈로그에 새 문제 등록** → 별도의 `<NewProblemModal>` (메타 등록만)
> - 본 페이지 자체는 view·진입 hub 역할

**사용 흐름:**
1. 04 암장 목록에서 카드 클릭 → `/gyms/:id` 진입
2. 상단에서 암장 메타 정보(주소·영업시간·가격·전화) 확인
3. 탭으로 `영상 / 문제 목록`을 전환 — **영상 탭이 기본 활성**
4. **영상 탭**: 해당 암장에 등록된 모든 영상을 최신순 그리드로 표시. 카드 클릭 → `/routes/:id` 상세
5. **문제 탭**: 문제 row 클릭 → 그 문제의 영상만 필터링된 그리드 (inline 또는 `/?gym_id=&problem_id=` 이동)
6. 본 암장을 "주 암장"으로 설정 (👤 마이의 main_gym_id 업데이트)

## 2. 레이아웃 와이어프레임

```
┌────────────────────────────────────────┐
│ [TopBar]                               │
│ ← (뒤로)        암장 상세              │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────────┐│
│  │ 더클라임 강남                       ││
│  │ 서울 강남구 테헤란로 …              ││
│  │ ☎ 02-1234-5678                     ││
│  │ ⏰ 평일 10–24, 주말 10–22           ││
│  │ 💴 1일권 22,000원                   ││
│  │                                    ││
│  │ [📍 지도 보기]   [⭐ 주 암장 설정]   ││
│  └────────────────────────────────────┘│
│                                        │
│  [영상 (8)]  [문제 (24)]              │ ← 탭 (영상이 default)
│  ─────────                             │
│                                        │
│  ▼ 영상 탭 (기본)                      │
│  정렬: 최신순 ▼   필터: 전체 ▼         │  ← 정렬·문제 필터
│  ┌────────┐ ┌────────┐                │
│  │ ▶ 썸네일│ │ ▶ 썸네일│   (RouteCard 재사용)
│  │ 노랑🟡 │ │ 파랑🔵 │                │
│  │ (V3)   │ │ (V4)   │                │
│  │ ❤︎12 🔖│ │ ❤︎4 🔖 │                │
│  └────────┘ └────────┘                 │
│  ┌────────┐ ┌────────┐                │
│  │ ▶ 썸네일│ │ ▶ 썸네일│                │
│  └────────┘ └────────┘                 │
│  (스크롤 끝 → 다음 페이지 자동 로드)    │
│                                        │
│  ▼ 문제 탭 (전환 시)                   │
│  ┌────────────────────────────────────┐│
│  │ 노랑🟡 (V3)              (3 영상) ›││  ← section 미표시
│  └────────────────────────────────────┘│
│  ┌────────────────────────────────────┐│
│  │ 파랑🔵 (V4)              (1 영상) ›││
│  └────────────────────────────────────┘│
│  ...                                   │
│  [+ 새 문제 등록]                      │
│                                        │
├────────────────────────────────────────┤
│ [BottomNav] 🏠 🗺️* ➕ 💪 📅             │
└────────────────────────────────────────┘
```

## 3. 사용 API

### 3.1 GET `/api/gyms/:id`
**응답:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "더클라임 강남",
    "address": "...",
    "lat": 37.4979,
    "lng": 127.0276,
    "phone": "...",
    "hours": "{\"mon\":\"10-24\", ...}",
    "price_info": "..."
  }
}
```

### 3.2 GET `/api/gyms/:id/problems?active=true`
**응답:**
```json
{
  "success": true,
  "data": {
    "problems": [
      { "id": 3, "level": "V3", "color": "yellow", "section": "메인 벽", "is_active": true }
    ]
  }
}
```
- 각 problem에 영상 수를 함께 보여주려면 백엔드에 `route_count` 집계 컬럼 추가 필요 (별도 쿼리 또는 JOIN COUNT). **백엔드 보강 항목**.

### 3.3 GET `/api/routes?gym_id=:id&problem_id=&sort=&page=&limit=`
- 본 암장 영상 탭에서 사용 (페이지의 핵심 데이터 소스)
- **백엔드 보강 필요**: `listRoutes`에 `gym_id` 필터 추가 (Problem.gym_id = ? join)
  - 추가 쿼리: `gym_id`, `problem_id`(이미 있음), `sort=latest|popular`, 페이지네이션
- 응답은 01 피드와 동일 형태 (`{ total, page, routes: [...] }`)
- 본 페이지는 user_id 필터를 사용하지 않음 — **단일 사용자(현재 1인용) 환경에서는 곧 본인 영상이지만**, 추후 다중 사용자 도입 시에도 "이 암장의 모든 사용자 영상"이 자연스러우므로 그대로 유지

### 3.4 POST `/api/gyms/:id/problems` (새 문제 등록)
- 03 등록 페이지와 동일

### 3.5 주 암장 추가/제거 (복수 지원)

07 마이페이지에서 주 암장이 **복수 선택**으로 변경되었으므로, 본 페이지의 [⭐ 주 암장 설정] 버튼은 **현재 암장의 멤버십 토글**로 동작:

- 본 암장이 user.main_gyms에 포함되어 있으면 → 버튼 라벨 `[★ 주 암장에서 빼기]` → `DELETE /api/users/me/main-gyms/:gymId`
- 포함되어 있지 않으면 → 버튼 라벨 `[⭐ 주 암장 추가]` → `POST /api/users/me/main-gyms/:gymId`
- 응답: 갱신된 main_gyms 배열 또는 단순 success
- 인증 비활성 상태에서는 디폴트 user(id=1)에 적용
- 단일 PUT 갱신(`main_gym_ids` 배열 전송)으로 동일 효과 가능 — 본 페이지는 토글 단발성 액션이라 add/remove 엔드포인트가 더 직관적

## 4. 컴포넌트 분해

```
<GymDetailPage>
  ├── <DetailTopBar back title="암장 상세" />
  ├── <GymHeader gym>
  │     ├── <HoursDisplay hours={parsedHours} />
  │     ├── <MapLink lat lng />              # 외부 지도 새 창 (네이버/카카오)
  │     └── <SetMainGymButton onClick />
  ├── <Tabs value={tab} onChange defaultValue="routes">
  │     ├── tab="routes"  (default)
  │     │     ├── <RouteListToolbar sort problemFilter />   # 정렬/문제 필터
  │     │     ├── <RouteCardGrid routes />                   # 01 피드와 동일 컴포넌트
  │     │     └── <InfiniteScrollSentinel />
  │     └── tab="problems"
  │           ├── <ProblemList problems />
  │           │     └── <ProblemRow problem onClick />*     # 클릭 시 routes 탭으로 이동 + problem_id 필터
  │           └── <NewProblemButton />
  └── <NewProblemModal />
```

**탭 동기화:**
- 문제 row 클릭 → `tab='routes'` + `problemFilter=problemId` 자동 전환 (URL: `/gyms/:id?tab=routes&problem_id=N`)
- URL query string으로 탭/필터/정렬 상태 보존 (뒤로가기·공유 가능)

**`<ProblemRow>`:**
- level 칩, color 도트, section, route_count
- 클릭 시 → `/?gym_id={gymId}&problem_id={problemId}` (피드 페이지에 필터 적용)
  - 또는 inline 확장으로 해당 문제의 영상 카드 4개만 펼치기 (UX 결정 사항)

## 5. 상태 / 데이터 모델

```ts
type GymDetailState = {
  gym: Gym | null;
  tab: 'routes' | 'problems';      // default 'routes'
  problemFilter: number | null;    // 영상 탭 내 문제 필터 (problem_id)
  sort: 'latest' | 'popular';      // 영상 탭 정렬
  routes: Route[];
  routesPage: number;
  routesTotal: number;
  problems: Problem[];             // 문제 탭 + 모달용
  loading: { gym, routes, problems };
};
```

- 진입 시 `gym` + `routes`(영상 탭 default) 병렬 fetch
- 문제 탭 첫 진입 시에만 problems lazy fetch (이미 있으면 캐시 사용)
- problemFilter / sort 변경 시 routes page=1 리셋 후 재fetch
- 주 암장 설정 성공 시 토스트 "주 암장으로 설정되었습니다"

## 6. 빈 상태 / 에러 / 로딩

| 상태 | 처리 |
|------|------|
| gym 404 | 큰 안내 + "← 암장 목록으로" |
| problems 0건 | 안내 텍스트 + "[+ 새 문제 등록]" CTA |
| routes 0건 | 안내 + "[+ 영상 등록]" → `/routes/new`로 이동 (gym 자동 선택) |
| hours JSON 파싱 실패 | "영업시간 정보 없음" |

## 7. 추후 인증 도입 시 변경점

- 주 암장 설정 버튼은 인증 활성 시에만 활성
- 본인 영상 vs 타인 영상 구분 표시 (현재 1인용에서는 모두 본인)

## 8. 수용 기준

- [ ] `/gyms/:id` 진입 시 메타 정보 + **영상 탭 기본 활성** + 해당 암장 영상 그리드 즉시 노출
- [ ] 영상 탭에서 정렬(최신/인기) 변경 시 page=1 리셋 후 재fetch
- [ ] 영상 탭에서 문제 필터(problem_id) 적용 시 해당 문제 영상만 노출
- [ ] 영상 카드 클릭 시 `/routes/:id` 이동
- [ ] 영상 탭 무한 스크롤 동작
- [ ] 문제 탭 전환 시 problems 목록 노출 (lazy fetch)
- [ ] 문제 row 클릭 시 영상 탭으로 자동 이동 + 해당 문제 필터 적용 (URL `?tab=routes&problem_id=N`)
- [ ] [+ 새 문제 등록] 모달에서 문제 추가 후 즉시 목록 갱신
- [ ] [⭐ 주 암장 추가] / [★ 주 암장에서 빼기] 토글 버튼이 현재 user.main_gyms 포함 여부에 따라 동적으로 표시되며 클릭 시 추가/제거됨, 토스트로 피드백
- [ ] 지도 보기 클릭 시 네이버/카카오 지도 새 창 (`https://map.kakao.com/?q=...` 등)
- [ ] 잘못된 :id 접근 시 404 안내
- [ ] URL query string(`?tab=&problem_id=&sort=`)로 상태 동기화 (뒤로가기/공유 시 동일 상태 복원)

## 9. 백엔드 보강 항목 (정리)

본 페이지 구현을 위해 백엔드에 추가해야 할 사항:

1. **`listRoutes`에 `gym_id` 필터 추가**
   - Problem 테이블 join, `where[Problem.gym_id] = req.query.gym_id`
2. **`getGymProblems`에 영상 수 집계 추가** (선택)
   - LEFT JOIN ar_routes, `COUNT(ar_routes.id) AS route_count`
3. **`updateUser`(PATCH /api/users/me) 확인**
   - 이미 존재하지만 main_gym_id 업데이트 가능 여부 확인 (없으면 보강)

## 10. 의존 페이지

- ⬅ **04 암장 목록** (카드 클릭)
- ➡ **02 영상 상세** (영상 탭에서 카드 클릭)
- ➡ **01 피드 (gym 필터 적용)** (문제 row 클릭)
- ➡ **03 영상 등록** (영상 0건 시 CTA, gym/problem 자동 선택)

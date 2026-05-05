# 01. 홈 / 영상 피드

> 경로: `/` | 공통 규칙: [00-overview.md](./00-overview.md)

---

## 1. 목적·사용 흐름

**목적:** 등록된 모든 루트 영상을 한눈에 훑어보고, 보고 싶은 영상으로 빠르게 진입.

**사용 흐름:**
1. 앱 진입 시 자동으로 `/`로 이동 → 영상 카드 그리드 노출
2. 정렬 토글: `최신순(default) ↔ 인기순` 선택
3. (선택) 암장 필터 칩으로 좁히기
4. 카드 클릭 → `/routes/:id` 상세
5. 카드의 좋아요/북마크 아이콘으로 빠른 토글 가능 (상세 진입 없이)
6. 하단 끝 도달 시 다음 페이지 자동 로드 (infinite scroll)

## 2. 레이아웃 와이어프레임

```
┌────────────────────────────────────────┐
│ [TopBar]                               │
│  TheRoute                      👤 마이 │
├────────────────────────────────────────┤
│                                        │
│ ┌────────────────────────────────────┐ │
│ │ 최신순 ▼          [전체 ▼]  필터   │ │  ← 정렬·필터 바
│ └────────────────────────────────────┘ │
│                                        │
│ ┌────────────┐  ┌────────────┐         │
│ │  ▶ 썸네일  │  │  ▶ 썸네일  │         │  ← 2열 카드 그리드
│ │            │  │            │         │
│ │ 제목       │  │ 제목       │         │
│ │ 암장·V3    │  │ 암장·V5    │         │
│ │ ❤︎12 🔖   │  │ ❤︎4 🔖    │         │
│ └────────────┘  └────────────┘         │
│ ┌────────────┐  ┌────────────┐         │
│ │  ▶ 썸네일  │  │  ▶ 썸네일  │         │
│ │ ...                                  │
│                                        │
│  (스크롤 끝 → loading spinner)         │
│                                        │
├────────────────────────────────────────┤
│ [BottomNav] 🏠* 🗺️ ➕ 💪 📅             │
└────────────────────────────────────────┘
```

**빈 상태:**
```
┌────────────────────────────────────────┐
│                                        │
│        등록된 영상이 없습니다           │
│                                        │
│         [ + 첫 영상 등록하기 ]          │
│                                        │
└────────────────────────────────────────┘
```

## 3. 사용 API

### 3.1 GET `/api/routes` (최신순)
**요청:**
- query: `page` (기본 1), `limit` (기본 20), `gym_id?` (암장 필터 — **백엔드에 추가 필요**)

**응답:**
```json
{
  "success": true,
  "data": {
    "total": 42,
    "page": 1,
    "routes": [
      {
        "id": 7,
        "title": "노란 V3",
        "video_url": "https://.../1234.mp4",
        "thumbnail_url": null,
        "like_count": 12,
        "view_count": 80,
        "created_at": "2026-05-04T10:11:00.000Z",
        "author": { "id": 1, "nickname": "나", "profile_image": null },
        "problem": {
          "id": 3, "level": "V3", "color": "yellow", "section": "메인 벽",
          "gym": { "id": 2, "name": "더클라임 강남" }
        }
      }
    ]
  }
}
```

### 3.2 GET `/api/feed/popular` (인기순)
- 별도 엔드포인트. 응답 페이로드는 `routes`와 동일 형태 가정 (필요 시 백엔드 확인).

### 3.3 POST `/api/routes/:id/like` (토글)
응답: `{ data: { liked: boolean } }`

### 3.4 POST `/api/routes/:id/bookmark` (토글)
응답: `{ data: { bookmarked: boolean } }`

### 3.5 백엔드 보강 필요 항목
- `listRoutes` 컨트롤러에 `gym_id` 필터 추가 (Problem.gym_id로 join 필터)
- `gym_id` 미지정 시 전체 반환 (현재 그대로)
- 썸네일 URL: `ar_routes.thumbnail_url` 컬럼 신설 권장 (없으면 video 첫 프레임을 클라이언트에서 추출)

## 4. 컴포넌트 분해

```
<FeedPage>
  ├── <FeedToolbar>
  │     ├── <SortToggle />          # 최신순/인기순
  │     └── <GymFilterChip />        # 전체 또는 특정 암장
  ├── <RouteCardGrid>                # CSS grid 2열
  │     └── <RouteCard route />*
  │           ├── <VideoThumb />     # poster 또는 첫 프레임
  │           ├── <RouteCardMeta />  # 제목/암장/난이도
  │           └── <RouteCardActions> # ❤︎ 🔖 (낙관적 업데이트)
  ├── <InfiniteScrollSentinel />     # IntersectionObserver
  └── <EmptyState />                 # routes.length === 0
```

**재사용 컴포넌트:**
- `<RouteCard>` — 02 상세, 05 암장상세, 07 마이의 내영상/북마크 탭에서 동일 사용
- `<EmptyState>` — 모든 페이지 공통

## 5. 상태 / 데이터 모델

```ts
type FeedState = {
  sort: 'latest' | 'popular';        // URL query string과 동기화 (?sort=)
  gymId: number | null;
  page: number;
  routes: Route[];
  total: number;
  loading: boolean;
  error: string | null;
};
```

- 정렬·필터 변경 시: page=1로 리셋, routes=[]
- 추가 로딩: `routes = [...prev, ...next]`
- 좋아요/북마크 토글은 **낙관적 업데이트** (즉시 UI 반영, 실패 시 롤백)

**캐싱:** 페이지 단위 단순 in-memory. 다른 페이지 다녀와도 첫 페이지는 다시 fetch (단순 정책). 추후 SWR/React Query 도입 시 변경 가능.

## 6. 빈 상태 / 에러 / 로딩

| 상태 | 처리 |
|------|------|
| 첫 로딩 | 카드 4개 분량 스켈레톤 |
| 무한스크롤 추가 로딩 | 하단 spinner |
| 데이터 0건 | EmptyState + 등록 CTA |
| API 실패 | 토스트 + "다시 시도" 버튼 |
| 좋아요/북마크 실패 | 토스트, UI 롤백 |

## 7. 추후 인증 도입 시 변경점

- 카드의 좋아요/북마크 아이콘 활성 상태는 **현재 표시되지 않음** (피드 응답에 isLiked/isBookmarked 미포함). 인증 도입 시:
  - 백엔드 `listRoutes`에서 `req.user`가 있을 때 각 route별 isLiked/isBookmarked 함께 반환
  - 카드에서 활성 색상으로 표시
- 정렬/필터 위에 "팔로우 피드 / 인기 / 전체" 탭 분기 추가 가능 (`GET /api/feed`는 이미 존재)

## 8. 수용 기준 (구현 완료 체크리스트)

- [ ] `/` 진입 시 최신 영상 20개 카드 그리드 노출
- [ ] 카드 클릭 시 `/routes/:id` 이동
- [ ] 정렬 토글 변경 시 페이로드 갱신, URL `?sort=popular` 반영
- [ ] 암장 필터 칩 선택 시 해당 암장 영상만 표시 (`gym_id` 백엔드 보강 후)
- [ ] 스크롤 끝에서 다음 페이지 자동 로드 (IntersectionObserver)
- [ ] 카드의 ❤︎/🔖 클릭 시 즉시 토글, 백엔드 응답으로 확정
- [ ] 데이터 0건 시 EmptyState + 등록 CTA 노출
- [ ] API 실패 시 토스트 + 재시도 가능
- [ ] 모바일 폭(360px) ~ 데스크톱(480px max) 모두에서 레이아웃 깨짐 없음

## 9. 의존 페이지 / 다음 흐름

- ➡ **02 영상 상세** (카드 클릭)
- ➡ **03 영상 등록** (EmptyState CTA, BottomNav ➕)
- ⬅ **05 암장 상세** (해당 암장의 영상으로 들어왔다가 피드로 복귀 가능)

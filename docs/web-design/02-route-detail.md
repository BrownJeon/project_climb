# 02. 영상 상세

> 경로: `/routes/:id` | 공통 규칙: [00-overview.md](./00-overview.md)

---

## 1. 목적·사용 흐름

**목적:** 특정 루트 영상을 끝까지 시청하고 메모/공감/스크랩/댓글로 상호작용.

**사용 흐름:**
1. 피드/암장상세/마이의 카드를 클릭 → 진입
2. HTML5 video로 영상 재생 (자동재생 X, 사용자 클릭 시 재생)
3. 영상 아래 메타정보(제목/설명/암장/문제/난이도) 확인
4. ❤︎ 좋아요 / 🔖 북마크 토글
5. 댓글 영역에서 댓글 작성·조회
6. 본인이 등록한 영상이면 우상단 ⋯ 메뉴에서 삭제 가능
7. 뒤로가기로 이전 페이지 복귀

## 2. 레이아웃 와이어프레임

```
┌────────────────────────────────────────┐
│ [TopBar]                               │
│ ← (뒤로)         영상 상세       ⋯     │  ← 본인 글이면 ⋯ 표시
├────────────────────────────────────────┤
│      ┌──────────────────────┐          │
│      │                      │          │
│      │                      │          │
│      │                      │          │
│      │  <video controls />  │          │  ← 세로 9:16 비율
│      │                      │          │  (클라이밍 영상 특성상 세로)
│      │                      │          │
│      │                      │          │
│      │                      │          │
│      └──────────────────────┘          │
│                                        │
│  노랑🟡 (V3)                           │  ← title: 색상라벨+이모지(V등급)
│  더클라임 강남                         │  ← problem meta (암장명만)
│  👤 나 · 2시간 전 · 조회 80            │
│                                        │
│  ┌──────────┬──────────┐               │
│  │ ❤︎ 12   │ 🔖 스크랩 │               │  ← 액션 바
│  └──────────┴──────────┘               │
│                                        │
│  ─── 설명 ───                          │
│  처음에 왼손으로 …                     │
│                                        │
│  ─── 댓글 (3) ───                      │
│  👤 나                                 │
│  발 위치를 더 낮게 가져가니 잡힘       │
│  · 1시간 전                            │
│  ───                                   │
│  ┌────────────────────────────────┐    │
│  │ 댓글 입력…              [등록] │    │
│  └────────────────────────────────┘    │
│                                        │
├────────────────────────────────────────┤
│ [BottomNav] 🏠 🗺️ ➕ 💪 📅             │
└────────────────────────────────────────┘
```

## 3. 사용 API

### 3.1 GET `/api/routes/:id`
**응답:**
```json
{
  "success": true,
  "data": {
    "id": 7,
    "user_id": 1,
    "title": "노란 V3",
    "description": "처음에 왼손으로 …",
    "video_url": "https://.../1234.mp4",
    "ar_data": null,
    "like_count": 12,
    "view_count": 80,
    "created_at": "2026-05-04T10:11:00.000Z",
    "author": { "id": 1, "nickname": "나", "profile_image": null },
    "problem": {
      "id": 3, "level": "V3", "color": "yellow", "section": "메인 벽",
      "gym": { "id": 2, "name": "더클라임 강남" }
    },
    "isLiked": true,
    "isBookmarked": false
  }
}
```
- `view_count`는 백엔드가 자동 increment (응답 즉시)

### 3.2 POST `/api/routes/:id/like` (토글)
응답: `{ data: { liked: boolean } }`

### 3.3 POST `/api/routes/:id/bookmark` (토글)
응답: `{ data: { bookmarked: boolean } }`

### 3.4 GET `/api/routes/:id/comments`
**응답:**
```json
{
  "success": true,
  "data": {
    "comments": [
      {
        "id": 11,
        "ar_route_id": 7,
        "content": "발 위치를 더 낮게…",
        "created_at": "...",
        "author": { "id": 1, "nickname": "나", "profile_image": null }
      }
    ]
  }
}
```

### 3.5 POST `/api/routes/:id/comments`
**요청:** `{ "content": "…" }` (trim, 빈 문자열 불가 — 백엔드 검증 있음)
**응답:** 생성된 comment 객체 (author 포함)

### 3.6 DELETE `/api/routes/:id`
- 본인 영상만 삭제 가능 (백엔드에서 `user_id` 검증)
- 응답 200 → `/`로 navigate replace

## 4. 컴포넌트 분해

```
<RouteDetailPage>
  ├── <DetailTopBar back title="영상 상세" rightSlot={<MoreMenu />} />
  ├── <VideoPlayer src={video_url} overlayData={ar_data} />   # 현재 overlayData는 무시
  ├── <RouteHeader>                  # title (자동 포맷), 암장명, author, 메타
  │     └── <RouteTitle color={problem.color} level={problem.level} />
  │           # 표시 형식: `{한글색상}{색상이모지} ({V등급})` 예: "노랑🟡 (V3)"
  │           # 사용자가 입력한 title은 부제(설명)로 활용하거나 미사용
  │           # section은 표시하지 않음 (벽 정보 제거)
  ├── <RouteActionBar>               # 좋아요/북마크
  │     ├── <LikeButton isLiked count />
  │     └── <BookmarkButton isBookmarked />
  ├── <RouteDescription text={description} />
  ├── <CommentSection>
  │     ├── <CommentList>
  │     │     └── <CommentItem comment />*
  │     └── <CommentInput onSubmit />
  └── <ConfirmDeleteModal />         # MoreMenu에서 삭제 클릭 시
```

**재사용:**
- `<VideoPlayer>` — 기본 HTML5 `<video controls>` 래퍼. props에 `overlayData`를 받지만 현재는 사용 안 함 (AR 확장 포인트)
  - **종횡비: 9:16 세로 비율 고정** (클라이밍 영상이 대부분 세로 촬영)
  - CSS: `aspect-ratio: 9 / 16; max-height: 70vh; margin: 0 auto;` (가운데 정렬, 좌우 여백)
  - `<video object-fit: contain>`로 가로 영상이 들어와도 잘리지 않고 letterbox 처리
- `<LikeButton>`, `<BookmarkButton>` — 피드 카드와 공유 가능

## 5. 상태 / 데이터 모델

```ts
type DetailState = {
  route: Route | null;        // null = loading
  comments: Comment[];
  isLiked: boolean;
  isBookmarked: boolean;
  likeCount: number;
  submitting: boolean;        // 댓글 등록 중
  error: string | null;
};
```

- 좋아요/북마크: 낙관적 토글 후 응답으로 확정. 실패 시 롤백 + 토스트.
- 댓글: 등록 성공 시 응답을 그대로 list 끝에 push.
- `useAuth().user.id === route.user_id`이면 ⋯ 메뉴 활성 (현재는 항상 1=1로 true)

## 6. 빈 상태 / 에러 / 로딩

| 상태 | 처리 |
|------|------|
| 영상 로딩 중 | 비디오 영역 dark placeholder + 메타 스켈레톤 |
| 404 (없는 ID) | 큰 안내 + "← 피드로 돌아가기" 버튼 |
| 댓글 0건 | "첫 댓글을 남겨보세요" 회색 텍스트 |
| 댓글 등록 실패 | 입력 텍스트 보존 + 토스트 |
| 영상 재생 실패 | `<video>`의 onError → 안내 + 다운로드 링크 |
| 삭제 실패 | 모달 닫지 않고 토스트 |

## 7. 추후 인증 도입 시 변경점

- 좋아요/북마크/댓글 작성/삭제 버튼은 인증 활성 시에만 노출 (혹은 비활성+로그인 유도)
- `isLiked`/`isBookmarked`는 백엔드가 `req.user` 기반으로 이미 반환 → 코드 변경 불필요
- 본인 영상 판단 로직 (`user.id === route.user_id`)은 그대로 작동

## 8. 수용 기준

- [ ] `/routes/:id` 진입 시 영상·메타·댓글 함께 로드
- [ ] 비디오 영역이 9:16 세로 비율로 가운데 정렬되어 표시 (max-height 70vh)
- [ ] 가로 영상이 업로드되어도 잘리지 않고 letterbox로 표시 (object-fit: contain)
- [ ] 비디오 controls로 재생/일시정지/볼륨/전체화면 가능
- [ ] 제목이 `{한글색상}{이모지} (V등급)` 형식으로 자동 포맷되어 표시 (예: `노랑🟡 (V3)`)
- [ ] 문제 메타 영역에 암장명만 표시되고 `section`(벽 정보)는 노출되지 않음
- [ ] 색상 매핑은 빨강/주황/노랑/초록/파랑/남색/보라/검정/하양/회색을 지원
- [ ] V등급 또는 color가 누락된 경우에도 fallback 포맷으로 깨지지 않음
- [ ] 좋아요 클릭 시 카운트 즉시 증가, 응답 후 확정
- [ ] 북마크 클릭 시 아이콘 토글
- [ ] 댓글 입력 → 등록 → 리스트에 즉시 추가
- [ ] 본인 영상에서만 ⋯ 삭제 메뉴 노출, 삭제 시 `/`로 이동
- [ ] 잘못된 id로 접근 시 404 안내
- [ ] 뒤로가기로 이전 페이지 정확히 복귀

## 9. 색상 난이도 + 제목 포맷 규약

암장은 **홀드 색상으로 난이도를 구분**하고 V등급은 보조 정보로 사용. 본 페이지의 제목은 색상과 V등급을 결합한 자동 포맷을 따른다.

### 9.1 색상 매핑 (`utils/color.js`)

| color 값 | 도트 | 한글 라벨 |
|---------|------|----------|
| `red` | 🔴 | 빨강 |
| `orange` | 🟠 | 주황 |
| `yellow` | 🟡 | 노랑 |
| `green` | 🟢 | 초록 |
| `blue` | 🔵 | 파랑 |
| `navy` | 🟦 | 남색 |
| `purple` | 🟣 | 보라 |
| `black` | ⚫ | 검정 |
| `white` | ⚪ | 하양 |
| `gray` | ⬛ | 회색 |
| 기타 | ◯ | (raw 값 그대로) |

### 9.2 제목 포맷 (`utils/routeTitle.js`)

```js
// formatRouteTitle({ color, level }) → "노랑🟡 (V3)"
function formatRouteTitle(problem) {
  const { label, dot } = colorMap(problem.color);   // {label:"노랑", dot:"🟡"}
  const lv = problem.level || 'V?';                  // V1~V12
  return `${label}${dot} (${lv})`;
}
```

- 표시 형식: **`{한글색상}{색상이모지} ({V등급})`**
- 예시: `노랑🟡 (V3)`, `빨강🔴 (V5)`, `검정⚫ (V8)`
- V등급 누락 시 `(V?)`로 fallback
- color 누락 시 `◯ (V?)` 또는 raw 값 사용
- `routeTitle` 유틸은 01 피드 카드, 05 암장상세, 07 마이페이지 등 **모든 영상 카드에서 동일하게 사용**
- 사용자가 입력한 `ar_routes.title` 컬럼은 부제/메모 용도로 활용하거나 향후 필요 시 표기 (현재 메인 타이틀에는 사용 X)

## 10. 의존 페이지

- ⬅ **01 피드 / 04 암장상세 / 07 마이(내영상·북마크)** 에서 진입
- ➡ 본인 영상 삭제 시 → **01 피드** (replace)
- ➡ color chip 클릭 시 → **05 암장상세** (해당 색상 필터) (선택 기능)

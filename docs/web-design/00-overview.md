# 00. 전체 개요 (TheRoute Web 재설계)

> 본 문서는 페이지별 상세 설계의 **공통 토대**다. 각 페이지 문서(`01-` ~ `07-`)는 이 문서의 규칙을 전제로 작성한다.

**최종 승인 plan:** `~/.claude/plans/flickering-roaming-badger.md`
**기존 모바일 기획서:** `../../기획서_V0.1.md`
**관련 코드:** `../../backend/src/`, 신설 예정 `../../web/`

---

## 1. 프로젝트 정의 (재정의)

| 항목 | 모바일(기존) | 웹(이번 재구성) |
|------|-------------|----------------|
| 형태 | RN + Expo 앱 | Vite + React SPA |
| 사용자 | 다수 (소셜) | 1인용 (BJJ 패턴, 추후 인증 추가 가능) |
| 핵심 기능 | AR 루트 그리기 + 소셜 피드 | 영상 시청 + 북마크 + 클라이밍 기록 |
| 차별화 | AR 오버레이 | 본인 클라이밍 데이터 통합 관리 |
| 배포 도메인 | Expo Go | `https://climb.미라클펭귄.com/` |

**한줄 정의:** "내가 등반한 루트 영상·암장·이용권·일자별 기록을 한 곳에서 관리하는 1인용 웹앱"

## 2. 전체 페이지 지도

```
                ┌────────── (우상단) 👤 마이 ──────────┐
                │                                      │
   [/]  홈                ─→  /routes/:id  영상 상세
   [/gyms]  기록          ─→  /gyms/:id  암장 상세 (라벨: 기록, 기존 탐색)
   ➕ (모달)  추가         ─→  통합 세션 추가 모달 (영상·완등·훈련 일괄)
   [/training]  훈련      ─→  목표·훈련기록·AI분석 탭 (신규)
   [/calendar]  캘린더    ─→  날짜별 climb_logs
   [/me]  마이페이지 (프로필/내영상/북마크/이용권 탭)
                │
                └─ (하단 고정 5슬롯) 🏠 / 🗺️ / ➕ / 💪 / 📅 ─┘
```

## 3. 레이아웃 규칙

### 3.0 통합 추가 모달 (`<SessionAddModal>`)

영상 등록 / 캘린더 기록 추가 / 훈련 기록 추가가 모두 **하나의 모달**로 통합. 상세는 [09-add-session.md](./09-add-session.md). 결정의 영향:
- BottomNav `➕` 클릭 → 모달 (라우트 변경 없음)
- 캘린더 [+ 기록 추가], 훈련 [+ 훈련 기록], 05 [+ 영상] 등 모든 추가 CTA → 동일 모달 (prefill만 다름)
- 05 [+ 새 문제 등록]은 카탈로그 메타만 등록하는 별도 모달로 유지
- 백엔드: 신규 `POST /api/sessions`가 단일 트랜잭션으로 climb_logs / climb_log_problems / ar_routes / training_sessions / gym_passes(차감)을 일괄 처리

### 3.1 전역 레이아웃 (`<Layout>`)

```
┌─────────────────────────────────────────────────┐
│  [TopBar]                                       │  ← 56px 고정
│  TheRoute                            👤 마이    │
├─────────────────────────────────────────────────┤
│                                                 │
│                                                 │
│            <Outlet />  (페이지 콘텐츠)          │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│  [BottomNav]                                    │  ← 64px 고정
│   🏠 홈    🗺️ 기록    ➕  💪 훈련   📅 캘린더   │
└─────────────────────────────────────────────────┘
```

- 전체 너비: 모바일 우선 디자인 (max-width 480px on desktop, 가운데 정렬, 양옆 회색 배경)
- TopBar/BottomNav는 `position: fixed`, 콘텐츠 영역은 `padding: 56px 0 64px 0`
- BJJ의 `.page` 토글 → React Router `<Route>`로 대체. `.page.active` 패턴은 사용하지 않음

### 3.2 BottomNav (5슬롯)

| 슬롯 | 아이콘 | 라벨 | 라우트/액션 |
|------|--------|------|-------------|
| 1 | 🏠 | 홈 | `/` |
| 2 | 🗺️ | 기록 | `/gyms` (암장 목록 — 라벨만 "기록", 기존 "탐색") |
| 3 | ➕ | 추가 | **통합 세션 추가 모달 오픈** (라우트 변경 없음) |
| 4 | 💪 | 훈련 | `/training` (신규) |
| 5 | 📅 | 캘린더 | `/calendar` (climb_logs) |

- 활성 라우트는 primary color로 강조
- **➕ 슬롯은 라우트 이동이 아닌 모달 오픈 액션** — `<SessionAddModal>`을 글로벌 진입점으로 띄움. 모든 운동 기록(영상·완등·훈련)이 한 모달에서 통합 입력 ([09-add-session.md](./09-add-session.md))
- ➕는 5슬롯의 정중앙. 원형 floating 느낌 (CSS `border-radius: 50%`, 양옆보다 살짝 위로 띄움)
- **훈련(💪)은 4번째 슬롯에 위치** — 추가(3)와 캘린더(5) 사이
- "기록" 라벨은 암장 탐색·문제 카탈로그 진입점이라는 의미 (기존 "탐색"의 라벨만 변경)
- "캘린더" 라벨은 본인의 일자별 클라이밍 기록(climb_logs)
- 기존 `/routes/new` 단독 라우트는 deprecated — 진입 시 모달 자동 오픈 후 직전 페이지로 replace

### 3.3 TopBar

- 좌측: 로고 텍스트 "TheRoute" (홈 링크)
- 우측: 👤 아이콘 (`/me`로 이동) + 사용자 닉네임 (선택)
- 페이지에 따라 우측에 추가 액션 버튼이 들어갈 수 있음 (페이지 문서에서 명시)

## 4. 디자인 토큰 (CSS 변수)

`src/styles/base.css`에 정의. BJJ 패턴 차용 + 클라이밍 컬러 톤.

```css
:root {
  /* 색상 */
  --bg: #fafafa;
  --bg-card: #ffffff;
  --text: #1a1a1a;
  --text-muted: #6b7280;
  --border: #e5e7eb;
  --primary: #ff5a3c;        /* 클라이밍 홀드 오렌지 */
  --primary-hover: #e54a30;
  --like: #ef4444;
  --bookmark: #f59e0b;

  /* 그림자/모서리 */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-card: 0 1px 3px rgba(0,0,0,.08);

  /* 타이포 */
  --font-sans: -apple-system, "Pretendard", system-ui, sans-serif;

  /* 간격 */
  --gap-xs: 4px;
  --gap-sm: 8px;
  --gap-md: 16px;
  --gap-lg: 24px;
}
```

## 5. API 클라이언트 규약

### 5.1 응답 형식
백엔드는 일관되게 다음 형식을 반환:
```json
{ "success": true, "data": <payload>, "message": "..." }
```

### 5.2 axios 인스턴스 (`src/api/client.js`)

```js
import axios from 'axios';
import { getAuthToken } from '../hooks/useAuth';

export const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((cfg) => {
  const token = getAuthToken();   // 현재는 항상 null
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || err)
);
```

### 5.3 도메인별 API 모듈
각 페이지는 `api/{도메인}.js`만 import하여 사용. 컴포넌트에서 axios 직접 호출 금지.

| 모듈 | 사용 페이지 |
|------|------------|
| `api/routes.js` | 01 피드 / 02 영상상세 / 03 등록 / 07 마이(내영상) |
| `api/gyms.js` | 04 암장목록 / 05 암장상세 / 03 등록 / 07 마이(주암장) |
| `api/climbLogs.js` | 06 캘린더 |
| `api/passes.js` | 07 마이(이용권 탭) |
| `api/users.js` | 07 마이(프로필) |
| `api/training.js` | 08 훈련 (목표·세션·분석) |

## 6. 인증 추상화 (`src/hooks/useAuth.js`)

**현재(무인증):**
```js
export function useAuth() {
  return {
    user: { id: 1, nickname: '나', max_level: null, main_gym_id: null },
    token: null,
    isAuthenticated: true,    // 1인용에서는 항상 true 취급
    login: () => {},
    logout: () => {},
  };
}
export function getAuthToken() { return null; }
```

**추후 인증 도입 시:** Context Provider + localStorage 토큰 저장, OAuth redirect 처리 추가. 페이지 코드는 `useAuth().user`만 사용하므로 변경 불필요.

## 7. 백엔드 옵셔널 인증 (보충)

기존 `backend/src/middleware/auth.js`에 이미 `optionalAuth`가 있으나 user 주입은 없음. **수정 방향:**

```js
// 신규 또는 기존 optionalAuth 보강
function optionalAuth(req, res, next) {
  const authEnabled = process.env.AUTH_ENABLED === 'true';
  const header = req.headers.authorization;

  if (header?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET); }
    catch { /* ignore */ }
  }

  if (!req.user) {
    if (authEnabled) {
      return res.status(401).json({ success: false, message: '인증 필요', data: null });
    }
    // AUTH_ENABLED=false → 디폴트 사용자 주입
    req.user = { id: 1, nickname: '나' };
  }
  next();
}
```

각 라우트의 `authenticate` 호출을 `optionalAuth`로 일괄 치환. `authenticate` 함수는 보존(추후 OAuth 라우트용).

## 8. 공통 UX 원칙

- **로딩**: 전역 `<LoadingOverlay>` 또는 페이지별 스켈레톤 (페이지 문서에서 명시)
- **에러**: API 실패 시 토스트 (`<Toast>`) — 우상단 4초 자동 닫힘
- **빈 상태**: 일러스트 없이 단순 텍스트 + 액션 버튼 (예: "등록한 영상이 없습니다 [+ 영상 등록]")
- **확인 모달**: 삭제·되돌릴 수 없는 액션은 `<ConfirmModal>` 사용
- **날짜 포맷**: `YYYY.MM.DD` (UI), API에는 `YYYY-MM-DD` (ISO)

## 9. 라우팅 구조 (`src/main.jsx`)

```jsx
<BrowserRouter>
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<FeedPage />} />
      <Route path="/routes/new" element={<RouteUploadPage />} />
      <Route path="/routes/:id" element={<RouteDetailPage />} />
      <Route path="/gyms" element={<GymListPage />} />
      <Route path="/gyms/:id" element={<GymDetailPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/training" element={<TrainingPage />} />
      <Route path="/me" element={<MyPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
</BrowserRouter>
```

## 10. 페이지 문서 색인

| # | 파일 | 페이지 | 핵심 API |
|---|------|--------|---------|
| 01 | `01-feed.md` | 홈/영상 피드 | `GET /api/routes`, `GET /api/feed/popular` |
| 02 | `02-route-detail.md` | 영상 상세 | `GET /api/routes/:id`, like/bookmark/comments |
| 03 | `03-route-upload.md` | 영상 등록 | `POST /api/routes` (multipart), `GET /api/gyms` |
| 04 | `04-gym-list.md` | 암장 목록 (BottomNav 🗺️ 기록) | `GET /api/gyms` |
| 05 | `05-gym-detail.md` | 암장 상세 | `GET /api/gyms/:id`, `/:id/problems`, `/api/routes?gym_id=` |
| 06 | `06-calendar.md` | 클라이밍 캘린더 (BottomNav 📅 캘린더) | `GET /api/climb-logs?year=&month=`, `?date=` |
| 07 | `07-mypage.md` | 마이페이지 | `GET /api/users/me`, `/api/passes`, `/api/routes?mine`, `/api/routes?bookmarked` |
| 08 | `08-training.md` | 훈련 (BottomNav 💪 훈련, 신규) | `GET /api/training/goals`, `/sessions`, `POST /api/training/analyze` |
| 09 | `09-add-session.md` | 통합 세션 추가 모달 (BottomNav ➕ 메인 진입) | `POST /api/sessions` (multipart, 단일 트랜잭션) |

## 11. 변경 이력

- 2026-05-05 — 초안 작성 (plan flickering-roaming-badger 기반)

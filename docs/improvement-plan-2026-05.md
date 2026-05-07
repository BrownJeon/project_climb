# TheRoute 개선 작업 계획 (2026-05)

## 개요

사용자 피드백 4건을 4개 작업 단위로 분해하여 순차 진행한다.

| # | 항목 | 영향 범위 | 우선순위 |
|---|------|----------|---------|
| 1 | 방문횟수 표기 이상 수정 | summary 로직(소) | 🟢 1순위 (단순 버그) |
| 2 | 캘린더 상세기록 화면 (placeholder) | 라우트 추가(소) | 🟢 2순위 |
| 3 | 정기권 일시정지 기능 | DB·API·UI(중) | 🟡 3순위 |
| 4 | 문제·영상 분리 (영상 단독 관리) | 데이터 모델·다수 화면(대) | 🔴 4순위 |

권장 진행 순서는 **단순한 것 → 구조 변경**으로 가서, 큰 변경(작업 4) 전에 안정적인 기반을 다진다.

---

## 작업 1. 방문횟수 표기 이상 수정 🟢

### 현상
홈 헤로 카드의 `방문 N · 볼더링 N / 지구력 N / 컨디셔닝 N`에서 횟수 합과 카테고리별 카운트가 일치하지 않음.

### 원인 분석 가설
- `visits` = `climb_logs.visited_at` distinct (방문일 수)
- `training_by_category.*` = 기간 내 `training_sessions` 카테고리별 row 수
- 같은 날 ClimbLog 1개 + 그 안의 training rows 여러 개가 생성되면 `visits=1`, `training_sessions=N`이 되어 합이 안 맞아 보임
- 또는 통합 등록(`POST /api/sessions`)에서 attempts(climb_log)만 추가하고 training row를 안 넣었을 때 카테고리 카운트가 0이 되는 문제

### 작업 단계
1. **사례 재현**: 한 사용자의 한 주간 데이터로 climb_logs + training_sessions 직접 조회해 가설 확인
2. **명세 결정** (사용자 확인 필요):
   - **A안**: 방문 = 운동한 일자 수(중복 제거), 카테고리 카운트는 같은 일자에 여러 카테고리도 모두 카운트
   - **B안**: 방문 = 한 번의 등록(climb_log + training_session 묶음) 단위
   - **C안**: 카테고리 카운트도 일자별 distinct (한 날 같은 카테고리 여러 row여도 1)
3. **backend [climbLogController.getSummary](backend/src/controllers/climbLogController.js)** 수정 — A안 권장
4. **검증**: 의도된 케이스 3가지 직접 측정 후 응답 매칭

### 검증 항목
- [ ] 같은 날 볼더링·컨디셔닝 둘 다 한 경우 카테고리별 1·1, 방문 1
- [ ] 같은 날 같은 카테고리 2번 한 경우 — 명세에 따라 일관
- [ ] climb_log 없이 training_session만 등록한 경우도 방문 카운트되는지 명시

---

## 작업 2. 캘린더 상세기록 화면 (placeholder) 🟢

### 요구
- 캘린더의 날짜를 **두 번째로 클릭(이미 선택된 날짜 다시 클릭)** 시 상세 화면으로 라우팅
- 우선은 화면 placeholder만, 상세 기능 설계는 다음 단계

### 작업 단계
1. **라우트 신설**: `/calendar/:date` (예: `/calendar/2026-05-07`)
2. **CalendarPage 핸들러**: `setSelected(d)` 동작 변경
   - 첫 클릭 = 선택만 (`selected !== d`)
   - 두 번째 클릭 = `nav('/calendar/' + ymd)` (`selected === d`)
3. **CalendarDetailPage 신규 생성** ([web/src/pages/CalendarDetailPage.jsx](web/src/pages/CalendarDetailPage.jsx))
   - TopBar(좌상단 TheRoute, 우측 뒤로가기 chev) — 다른 상세 페이지와 동일 패턴
   - 헤더: 선택 날짜 + 요일
   - placeholder 섹션: "상세 기록 (설계 예정)" + 추후 들어갈 슬롯 — 시간라인 / 영상 갤러리 / 분석 차트 / 메모 풀텍스트
4. **App 라우터 등록**

### 후속 설계 (별도 작업)
- 상세 화면 컴포넌트 트리
- 시간라인 (HH:MM ~ 운동 흐름)
- 영상 인라인 재생
- AI 한 줄 요약 (분석 endpoint 재활용)

### 검증 항목
- [ ] 미선택 날짜 클릭 → 선택만, URL 변경 없음
- [ ] 선택된 날짜 재클릭 → `/calendar/YYYY-MM-DD`로 이동
- [ ] 상세 페이지 뒤로가기 → 캘린더 복귀

---

## 작업 3. 정기권 일시정지 기능 🟡

### 명세 (사용자 입력 기반)
- 1개월권: 1회 일시정지 가능
- 3개월권: 3회 일시정지 가능
- 6개월권: **확인 필요 (6회 추정)**
- 각 일시정지 최대 15일
- 일시정지는 **연속 사용 가능** (해제 후 즉시 재정지)
- 일시정지 사용 시 정기권 `end_date` 자동 연장 (일시정지 일수만큼)

### 결정 사항 (사용자 확인 필요)
1. 6개월권 정지 횟수 = 6회로 가정해도 되는지
2. 만료일 연장 시점 — **해제 시점에 일수 추가** (안전, 권장) vs **시작 시점에 +15일 가정**
3. 횟수권에도 일시정지 적용? (현재 명세는 정기권만 — 그대로 정기권만 가정)

### DB 변경
- 신규 테이블 `gym_pass_pauses`:
  ```sql
  CREATE TABLE gym_pass_pauses (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    gym_pass_id BIGINT UNSIGNED NOT NULL,
    started_at DATE NOT NULL,
    ended_at DATE NULL,        -- 진행 중이면 NULL
    days_used INT UNSIGNED NULL, -- 종료 시 계산
    note VARCHAR(200) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX(gym_pass_id),
    FOREIGN KEY (gym_pass_id) REFERENCES gym_passes(id) ON DELETE CASCADE
  );
  ```
- `gym_passes`에 `paused_until DATE NULL` (현재 정지 중인 경우 정지 종료 예정일, NULL이면 활성) — 또는 기록 테이블만 사용하고 동적 계산

### API
- `POST /api/passes/:id/pause` — 정지 시작 (body: `{started_at?: ISO, days?: 15}`)
  - 검증: 남은 정지 횟수 ≥ 1, 현재 정지 중 아님, pass_type='period'
- `POST /api/passes/:id/resume` — 정지 해제 (body: `{ended_at?: ISO}`)
  - `days_used = ended_at - started_at`, `gym_passes.end_date += days_used` 트랜잭션
- `GET /api/passes/:id/pauses` — 정지 이력
- 또는 `passes.list` 응답에 `pause_count_used`, `pause_max`, `is_paused`, `current_pause_until` 포함

### UI
- **이용권 카드** (마이페이지)
  - "일시정지 N/M" 정보 표시
  - 활성 상태: `[일시정지]` 버튼
  - 정지 중: `정지중 (해제일 YYYY-MM-DD)` + `[정지 해제]` 버튼
- **PassEditModal** — 정지 이력 표시 + (관리자형) 수동 추가/수정 옵션 (선택)

### 검증
- [ ] 1개월권 1회 정지 후 2회 시도 시 거부
- [ ] 3개월권 3회 정지 가능, 4회 거부
- [ ] 정지 7일 → 해제 시 end_date +7일 검증
- [ ] 정지 중 사용 시도(횟수권 use)는 차단 (정기권은 사용 자체 차감 X)
- [ ] 연속 정지 — 해제 직후 재정지 가능

---

## 작업 4. 문제·영상 분리 (영상 단독 관리) 🔴

### 변경 방향
- **현재**: 영상 등록 시 problem_id 필수, ar_routes는 problem 1:1로 묶임
- **변경**: 영상은 단독 자산 (color/level 메타만), 운동 기록 시 기록한 시도(`climb_log_problems`)에 영상을 검색·링크
- ar_routes.problem_id를 nullable 활용, 또는 별도 테이블 분리

### 데이터 모델
- `ar_routes`: `problem_id` NULL 허용 유지, `color`/`level` 직접 컬럼화 (현재는 problem 통해 간접) 또는 NULL 시 `tags`/`title` 활용
- `climb_log_problems.ar_route_id`: 기존 컬럼 활용 — 사용자가 영상 검색 후 link
- 마이그레이션: 기존 영상은 그대로 유지 (problem_id 채워진 채), 신규 등록은 problem_id NULL 허용

### 영상 단독 등록 — 새 모달
- **VideoUploadModal** (마이페이지 → 내영상 → `+`)
  - 영상 파일
  - 색상 (color)
  - V등급 (level) — 선택
  - 메모(description), 태그
- API: 기존 `POST /api/routes` (problem_id 필요했던 부분 → 선택)
  - 또는 신규 endpoint `POST /api/routes/standalone`

### 운동 기록 시 영상 링크
- **SessionAddModal / RecordEditModal — attempts row**
  - color/level/cleared/attempts 입력 후
  - "영상 연결" 버튼 → `<VideoLinkPicker>` 모달
    - 사용자 본인 영상 검색 (color/level 자동 필터)
    - 클릭 시 `ar_route_id` 설정
  - "새 영상 업로드" 옵션도 유지 (현재 video_mode='upload')
- 백엔드: `attempts[i]`에 `link_ar_route_id` 옵션 추가
  - sessionController가 climb_log_problems 생성 시 `ar_route_id`로 set

### UI 변경
- **MyPage 내 영상**
  - 우측 상단 `+` 버튼 → VideoUploadModal
  - 카드 클릭 → 기존 RouteDetailPage (편집/삭제 가능, 이미 구현됨)
- **SessionAddModal**
  - attempts row에 "영상 연결" 토글 — `link_existing` / `upload_new` / `none`
  - link_existing 선택 시 picker 노출
- **RouteCard** — 영상이 problem 무관해도 색상·V등급 표시 가능하도록 필드 보강

### 검증
- [ ] 영상 단독 등록 (problem 없이) 가능
- [ ] 운동 기록 추가 시 같은 색상/V등급 영상 자동 추천
- [ ] 한 영상을 여러 시도(climb_log_problems)에 링크 가능
- [ ] 마이페이지 영상 삭제 시 링크된 climb_log_problems의 ar_route_id는 NULL로 (기존 ON DELETE 동작 유지)

---

## 진행 체크리스트 (한눈에)

### Phase 1 — 작업 1 (방문 카운트 명세 확정·수정)
- [ ] 사용자에게 "방문/카테고리" 정의 명세 확인 받음
- [ ] backend `getSummary` 수정
- [ ] 검증 케이스 3건 통과

### Phase 2 — 작업 2 (캘린더 상세 placeholder)
- [ ] `/calendar/:date` 라우트 등록
- [ ] CalendarDetailPage 컴포넌트 (placeholder) 작성
- [ ] CalendarPage 두 번째 클릭 처리
- [ ] 후속 상세 설계 문서 신규 작성: `docs/web-design/06-calendar-detail.md`

### Phase 3 — 작업 3 (정기권 일시정지)
- [ ] 명세 미확정 항목 사용자 확인 (6개월권 횟수, 연장 시점)
- [ ] DB 마이그레이션 (gym_pass_pauses, paused_until)
- [ ] passesApi.pause/resume + backend 컨트롤러
- [ ] 카드 UI: 정지/해제 버튼, 횟수 표시
- [ ] PassEditModal에 이력 노출 (선택)
- [ ] end_date 자동 연장 검증

### Phase 4 — 작업 4 (영상 단독 관리)
- [ ] 데이터 모델 결정 (ar_routes.problem_id NULL 허용 / 별도 테이블)
- [ ] VideoUploadModal 신규
- [ ] MyPage 내 영상에 + 버튼
- [ ] VideoLinkPicker 컴포넌트
- [ ] SessionAddModal/RecordEditModal attempts row에 "영상 연결" 옵션
- [ ] backend: POST /api/sessions의 attempts[]에 link_ar_route_id 처리
- [ ] 기존 영상 마이그레이션 검증
- [ ] e2e: 영상 단독 등록 → 운동 기록에서 검색·링크

---

## 사용자 확정 사항 (2026-05-07)

1. **작업 1**: "방문 1회" = **등록된 운동(climb_log/training_session) 단위**. 같은 날 여러 번 등록하면 여러 번 카운트.
2. **작업 3**: 6개월권 = **6회** 일시정지
3. **작업 3**: 만료일 연장 로직
   - 정지 시작 시점에는 연장하지 **않음**
   - 연속 정지 가능
   - **정지 중 해당 정기권으로 운동이 등록되면** → 그 등록일을 "정지 해제일"로 간주하여 만료일 재계산
   - **정지 해제 시점**에 `end_date += (해제일 - 정지시작일)`
4. **작업 4**: 기존 영상은 모두 **테스트 데이터 → 삭제 후 새 구성**. 마이그레이션 부담 없음.

---

## 단계별 작업 시작 시 발생 위험

- **작업 4**가 가장 위험. 기존 영상 데이터·UI 흐름 모두 영향. Phase 4 진입 전 백업 권장.
- **작업 3**의 일시정지 트랜잭션이 end_date 갱신과 함께 atomic하게 처리되어야 함. 동시성 고려.

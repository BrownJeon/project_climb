# TheRoute Web 구현 작업절차서

> 본 문서는 [00-overview.md](./00-overview.md) ~ [09-add-session.md](./09-add-session.md)의 설계안을 기반으로 한 단계별 구현 가이드입니다.
> 각 Phase 종료 시 검증 → 다음 Phase 진행. 각 Phase는 하나의 commit 단위로 운영합니다.
>
> **백엔드(theroute-api) 상세 구현안:** [BACKEND-IMPLEMENTATION.md](./BACKEND-IMPLEMENTATION.md) 참조 — 파일·함수 단위 변경 사항.

## 프로젝트 구조 (monorepo, 단일 프로젝트)

API와 SPA를 **하나의 프로젝트(`TheRoute/`) 안**에서 모두 구현. pm2 단일 프로세스(`theroute-api`)가 API + SPA 정적 서빙을 함께 담당.

```
TheRoute/
├── backend/   # theroute-api (Express + Sequelize)
├── web/       # 신규 Vite + React SPA
├── uploads/
├── ecosystem.config.js   # pm2 단일 등록 (backend/src/index.js 진입)
└── docs/web-design/      # 본 문서
```

- **dev 모드:** backend(3100) + web(5173) 각각 실행, vite proxy로 `/api/*` 포워딩
- **prod 모드:** backend가 `web/dist/`를 정적 서빙, 단일 포트 3100. nginx → 3100 proxy
- pm2는 **`theroute-api` 1개만 등록** (별도 프로세스로 분리하지 않음)

---

## 작업 원칙

- **모듈 격리:** Phase는 의존성 순서대로 진행. 백엔드 → 프론트엔드 → 인프라 → 검증
- **Commit 단위:** 각 Phase 완료 시 1 commit. Phase 안에서도 의미 단위로 분할 가능
- **검증 우선:** 코드 작성 후 매번 `pm2 logs` / `curl` / 브라우저 확인. 실패 시 다음 단계 차단
- **호환성 보존:** 기존 단독 엔드포인트(`POST /api/routes`, `/api/climb-logs` 등)는 유지. 모달은 `POST /api/sessions`로 일원화
- **idempotent 마이그레이션:** `setupDB()`나 마이그레이션 파일 모두 재실행 안전하게 작성 (`CREATE IF NOT EXISTS`, `ALTER ... ADD COLUMN`은 information_schema 체크)

---

## NFS 환경 노트 (중요)

**NFS의 noexec/권한 이슈로 `npm install` 시 esbuild 등 platform-specific 바이너리 spawn이 실패합니다.** 다른 프로젝트(TradingInvest/StockInvest/n8n)와 동일하게 `~/.node-local` 패턴을 사용:

```bash
# 한 번만: ext4 위에 node_modules 컨테이너 생성
mkdir -p ~/.node-local/theroute-web

# bind mount (sudo 필요)
sudo mount --bind ~/.node-local/theroute-web /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web/node_modules
# 또는 부팅 시 자동 마운트는 /etc/fstab에 등록

# 그 후 정상 install
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
npm install
npm run build
```

backend는 기존 node_modules가 정상 동작 중이라 그대로 유지.

---

## Phase 0. 사전 점검 및 정리

**목표:** 작업 시작 전 환경 정상성 확인.

1. 현재 백엔드 운영 상태 확인
   ```bash
   pm2 status theroute-api
   curl -s http://localhost:3100/api/gyms | head -c 200
   ```
2. `backend/.env` 확인 — DB 접속·MEDIA 경로 등 누락 없는지
3. `backend/src/` 구조 재확인 (config/controllers/middleware/models/routes)
4. `mobile/` 디렉토리는 마지막 Phase에서 삭제 (아직 보존)

**완료 조건:** API 200 응답, DB 연결 정상, .env 검증

---

## Phase 1. 백엔드 — 옵셔널 인증 + 디폴트 사용자

**대상 파일:**
- `backend/src/middleware/auth.js` (수정)
- `backend/src/config/database.js` 또는 `setupDB` 위치 (수정)
- `backend/src/routes/*.js` (라우트 미들웨어 일괄 치환)
- `backend/.env.example` (수정)
- `backend/src/server.js` 또는 라우트 등록부 (`/api/auth` 조건부 mount)

**작업:**
1. `optionalAuth` 보강: env `AUTH_ENABLED=false`이면 `req.user = { id: 1, nickname: '나' }` 자동 주입. true이면 기존 JWT 검증 수행
2. `users` 테이블 시드: `INSERT IGNORE INTO users (id, nickname, ...) VALUES (1, '나', ...)`
3. 모든 라우트의 `authenticate` → `optionalAuth` 치환 (`auth.js`의 sns/refresh 라우트는 제외)
4. follow/followers/followings 라우트 비활성 (mount 주석 처리 또는 conditional)
5. `feed.js`의 `getFeed` 의존성 제거 또는 단순 최신 정렬로 변경
6. `.env.example`에 `AUTH_ENABLED=false` 추가

**검증:**
- `pm2 restart theroute-api --update-env`
- `curl http://localhost:3100/api/users/1` → 200 + 디폴트 사용자 row
- `curl http://localhost:3100/api/climb-logs?year=2026&month=5` → 200 (인증 없이도 본인 데이터 응답)
- `AUTH_ENABLED=true` 토글 후 401 응답 확인

---

## Phase 2. 백엔드 — 스키마 확장 (도메인별 컬럼)

**대상 파일:**
- `backend/src/models/*.js` (수정·신규)
- `backend/src/config/database.js` 마이그레이션 헬퍼

**작업 (idempotent ALTER + 모델 정의):**

1. **`ar_routes`**
   - `tags JSON NULL` 추가
2. **`climb_log_problems`**
   - `attempts INT UNSIGNED NOT NULL DEFAULT 1`
   - `ar_route_id BIGINT UNSIGNED NULL` (FK to ar_routes ON DELETE SET NULL)
3. **`climb_logs`**
   - `gym_pass_id BIGINT UNSIGNED NULL` (FK to gym_passes ON DELETE SET NULL)
   - `used_day_pass BOOLEAN NOT NULL DEFAULT 0`
4. **`users`**
   - `climbing_started_at DATE NULL`
   - `max_level_color VARCHAR(30) NULL`
   - `max_level_grade VARCHAR(20) NULL`
   - `max_level_gym_id BIGINT UNSIGNED NULL` (FK to gyms ON DELETE SET NULL)
   - 기존 `max_level` 데이터를 `max_level_grade`로 복사 (1회 마이그레이션)
5. **`user_main_gyms`** (신규 조인)
6. **훈련 도메인 테이블 5개 신규**: `training_goals`, `training_sessions`, `training_session_items`, `training_prompt_templates`, `training_analyses`
7. **시드 데이터**:
   - `analysis_meta_v1` 메타 템플릿 INSERT IGNORE (본문은 [08-training.md §8.7](./08-training.md))
   - 기존 `users.main_gym_id` → `user_main_gyms` 1회 백필

**검증:**
- DB에 `DESCRIBE` 또는 `SHOW COLUMNS` 로 모든 신규 컬럼 존재 확인
- `pm2 restart theroute-api` 후 setupDB 로그 무에러
- `SELECT * FROM training_prompt_templates;` 1건 이상

---

## Phase 3. 백엔드 — 도메인별 엔드포인트 보강

**대상 파일:**
- `backend/src/controllers/routeController.js` (수정)
- `backend/src/controllers/gymController.js` (수정)
- `backend/src/controllers/gymPassController.js` (수정)
- `backend/src/controllers/userController.js` (수정)
- `backend/src/controllers/climbLogController.js` (수정)
- `backend/src/routes/users.js` (라우트 추가)

**작업:**
1. `listRoutes`: `gym_id`, `user_id=me|mine=true`, `sort` 쿼리 처리. Problem JOIN으로 gym_id 필터
2. `listGyms`: `include_recent_routes=true` 시 각 gym에 최근 3건 ar_routes 첨부 (sub-select)
3. `getGymProblems`: `?color` 필터 추가 (선택)
4. `listPasses`: `gym_id`, `pass_type` 쿼리 추가
5. `createPass`: count 타입에 `end_date` 허용, 검증
6. `gymPassController.calcCountStatus` 신설 (잔여+end_date 기반 is_expired)
7. `users.me/main-gyms`: POST/DELETE 엔드포인트 신설 (gym 추가/제거)
8. `userController.updateProfile`: `main_gym_ids` 배열, `climbing_started_at`, `max_level_color/grade/gym_id` 처리
9. `getProfile`: `main_gyms` association include, `max_level_gym` include
10. `climbLogController.createLog`: `gym_pass_id`, `used_day_pass`, `attempts`, `ar_route_id` 모두 처리. 트랜잭션, 횟수권 차감
11. `climbLogController.getLogsByDate`: gym_pass / ar_route include, attempts·used_day_pass 응답에 포함

**검증:**
- 각 변경 컨트롤러에 대한 curl 테스트:
  ```bash
  curl 'http://localhost:3100/api/routes?gym_id=1&sort=latest'
  curl 'http://localhost:3100/api/passes?gym_id=1&pass_type=count'
  curl 'http://localhost:3100/api/gyms?include_recent_routes=true'
  ```

---

## Phase 4. 백엔드 — 훈련 도메인 신설

**대상 파일:**
- `backend/src/models/Training*.js` (신규 5개)
- `backend/src/controllers/trainingController.js` (신규)
- `backend/src/routes/training.js` (신규)
- `backend/src/server.js` (마운트)
- `backend/src/services/claudeCli.js` (신규)
- `backend/src/services/trainingPromptBuilder.js` (신규)
- `backend/src/services/trainingAnalyzer.js` (신규)

**작업:**
1. Sequelize 모델 5개 + associations
2. `routes/training.js` 마운트: goals CRUD, sessions CRUD + 자동 합성, analyze, analyses CRUD, prompt-templates 조회
3. `claudeCli.js`: `child_process.spawn(CLI_PATH, ['-p'], {shell:false})`, stdin 전달, 비스트림/스트림 분기, 타임아웃, ENOENT 처리
4. `trainingPromptBuilder.js`: `fillMetaPrompt` + `serialize{Profile,Goals,TrainingSessions,ClimbLogs}`
5. `trainingAnalyzer.js`: 2단계 오케스트레이션 (메타 템플릿 로드 → 1단계 호출 → 2단계 호출)
6. `trainingController.analyze`: SSE 스트리밍 분기, training_analyses 저장 (입출력 + 단계별 duration + template 스냅샷)
7. `getSessions`: climb_logs를 read-time에 bouldering 세션으로 합성

**검증:**
- `curl http://localhost:3100/api/training/goals` → `[]`
- `curl -X POST http://localhost:3100/api/training/analyze -H 'Content-Type: application/json' -d '{"from":"2026-04-01","to":"2026-05-01","perspectives":["strength_weakness"]}'` → 응답 확인 (CLI 인증 안 되어 있으면 503)
- `claude --version` 서버에서 실행 가능 확인

---

## Phase 5. 백엔드 — 통합 세션 엔드포인트

**대상 파일:**
- `backend/src/controllers/sessionController.js` (신규)
- `backend/src/routes/sessions.js` (신규)
- `backend/src/server.js` (마운트)
- 기존 `createRoute`/`createLog`/`createTrainingSession`을 헬퍼로 추출 (`services/sessionHelpers.js`)

**작업:**
1. `multer.any()` 사용 또는 fields 동적 등록 (`video_0` ~ `video_19`)
2. `POST /api/sessions` 컨트롤러:
   - body 파싱 (`attempts`, `training` JSON 디코드)
   - 검증 (XOR 이용권, 본인 영상, attempts >= 1, file 200MB 이하 등)
   - `sequelize.transaction(async (t) => {...})` 시작
   - climb_logs INSERT
   - 횟수권 차감
   - attempts 행 순회: new_problem INSERT → ar_routes INSERT (file이 있으면) → climb_log_problems INSERT
   - training 항목 순회: training_sessions INSERT + training_session_items bulk
   - COMMIT 후 응답 (`climb_log_id`, `ar_route_ids[]`, `training_session_ids[]`, `remaining_pass_count`)
3. 단독 컨트롤러는 통합 헬퍼를 호출하도록 리팩터 (DRY)

**검증:**
- multipart curl 테스트:
  ```bash
  curl -X POST http://localhost:3100/api/sessions \
    -F 'visited_at=2026-05-08' -F 'gym_id=1' \
    -F 'used_day_pass=true' -F 'memo=테스트' \
    -F 'attempts=[{"problem_id":1,"is_cleared":true,"attempts":2,"video_mode":"none"}]' \
    -F 'training=[]'
  ```
- 응답 200 + DB 행 생성 확인

---

## Phase 6. 프론트엔드 — Vite + React 부트스트랩

**대상 파일:**
- `web/` 디렉토리 신규 (전체 트리)

**작업:**
1. `cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute && npm create vite@latest web -- --template react`
2. 의존성: `react-router-dom axios react-markdown remark-gfm rehype-sanitize`
3. `vite.config.js`: dev 프록시 `/api/*` → `http://localhost:3100`
4. 디자인 토큰: `src/styles/base.css` (CSS 변수), `src/styles/components.css`
5. `src/api/client.js` axios 인스턴스
6. `src/hooks/useAuth.js` stub
7. `src/components/Layout.jsx`, `TopBar.jsx`, `BottomNav.jsx` (5슬롯, ➕은 모달 액션)
8. `src/main.jsx` 라우터 부트스트랩
9. `src/utils/color.js`, `src/utils/routeTitle.js`, `src/utils/climbingTenure.js`, `src/utils/distance.js`
10. `src/constants/routeTags.js`, `src/constants/trainingExercises.js`

**검증:**
- `cd web && npm run dev` → http://localhost:5173 에서 빈 Layout + 5슬롯 BottomNav 표시
- 활성 슬롯 강조, ➕ 클릭 시 (아직 모달 없으므로) 콘솔 placeholder

---

## Phase 7. 프론트엔드 — 읽기 전용 페이지 1차 구현

**대상 파일:**
- `web/src/pages/FeedPage.jsx`
- `web/src/pages/RouteDetailPage.jsx`
- `web/src/pages/GymListPage.jsx`
- `web/src/pages/GymDetailPage.jsx`
- `web/src/pages/CalendarPage.jsx`
- `web/src/pages/MyPage.jsx`
- `web/src/pages/TrainingPage.jsx`
- `web/src/api/{routes,gyms,passes,users,climbLogs,training,sessions}.js`
- 공통 컴포넌트: `RouteCard`, `GymCard`, `Calendar`, `LoadingOverlay`, `Toast`, `EmptyState`, `ConfirmModal`

**작업:**
1. 각 페이지의 GET fetch + 렌더 (수정·삭제·업로드는 후속 Phase)
2. 영상 상세: 9:16 video, color 자동 제목, 좋아요/북마크/댓글 (이건 추가 가능 — Phase 10에서 묶어도 OK)
3. 캘린더: 월별 dots + 선택일 패널 (read)
4. 마이페이지: 프로필 카드 + 4탭 (read)
5. 훈련 페이지: 3탭 골격 (read), 분석 폼은 Phase 10
6. 무한스크롤·검색 디바운스 등 UX 디테일

**검증:**
- 브라우저에서 각 페이지 진입 + 데이터 로딩 정상

---

## Phase 8. 프론트엔드 — 통합 세션 추가 모달 (09)

**대상 파일:**
- `web/src/components/modals/SessionAddModal.jsx`
- 하위 컴포넌트: `GymPickerField`, `PassUsageSelector`, `ProblemPickerInline`, `NewProblemInline`, `ClearedCheckbox`, `AttemptsInput`, `VideoLinkOrUpload`, `RouteTagsField`, `TrainingItemEditor`
- BottomNav `➕` 핸들러, Calendar [+ 기록 추가], Training [+ 운동 기록 추가] 등 모든 진입점 연결
- `web/src/contexts/SessionAddModalContext.jsx` (글로벌 모달 컨트롤)

**작업:**
1. 모달 골격 + mode prop (full/video/training)
2. 기본 섹션 (날짜·암장·이용권 라디오)
3. 완등·시도 섹션 (행 N개, 영상 모드 3택, tags)
4. 훈련 섹션 (카테고리, 항목 N개)
5. 검증·제출 가능 조건
6. multipart 전송 + onUploadProgress
7. 성공 시 콜백 (진입 페이지 갱신)

**검증:**
- BottomNav ➕ → 모달 열림
- 영상만/훈련만/풀 입력 케이스 모두 저장 → DB 검증
- 횟수권 차감 동작
- prefill 시나리오: 캘린더 빈 날짜, 훈련 [+ 운동 기록] 등

---

## Phase 9. 프론트엔드 — 분석 탭 (2단계 CLI)

**대상 파일:**
- `web/src/pages/training/AnalysisTab.jsx`
- `web/src/components/training/AnalysisRequestForm.jsx`
- `web/src/components/training/AnalysisStageIndicator.jsx`
- `web/src/components/training/AnalysisResult.jsx`
- `web/src/components/training/RawPromptModal.jsx`
- `web/src/components/training/PastAnalysesList.jsx`
- `web/src/api/training.js` (analyze SSE 클라이언트)

**작업:**
1. 분석 폼 (기간 프리셋, 관점 체크박스, 템플릿 셀렉트, extra prompt)
2. 요청 시 SSE EventSource로 stage='meta' → 'analysis' → 'done' 순으로 누적 markdown
3. `react-markdown` + `remark-gfm` + `rehype-sanitize`로 마크다운 렌더
4. 과거 분석 리스트 + 클릭 시 본문 표시
5. raw 보기 모달

**검증:**
- 기간 선택 → 분석 요청 → 1단계 진행 표시 → 2단계 스트리밍 → 완료 마크다운 표시
- raw 모달에서 메타·생성 프롬프트 본문 확인

---

## Phase 10. 프론트엔드 — 쓰기·편집 마무리

**대상 파일:**
- ProfileEditModal (MultiGymPicker, MaxLevelEditor, DatePicker)
- AddPassModal (period/count + 만료일)
- 영상 상세의 좋아요/북마크/댓글 폼
- NewProblemModal (05의 카탈로그 등록 별도)
- 캘린더 기록 ⋯ 메뉴 (삭제), 훈련 세션 삭제

**작업:** 각 모달·액션 구현 + API 연동

**검증:** 각 흐름 e2e 동작

---

## Phase 11. 인프라 — 도메인 + nginx + 정적 서빙

**대상 파일:**
- `HOME-SERVER_CONFIG/servers/linux/nginx/sites-available/climb.미라클펭귄.com.conf` (신규)
- `HOME-SERVER_CONFIG/network/port-map.md` (1행 추가)
- `backend/src/server.js` 또는 `index.js` (web/dist 정적 서빙)
- `web/package.json` build 스크립트 점검

**작업:**
1. `cd web && npm run build` → `web/dist/`
2. Express에서 `app.use(express.static(path.join(__dirname, '../web/dist')))` + SPA fallback (`app.get('*', ...)`)
3. nginx vhost 작성 (`client_max_body_size 250M`, ModSecurity 9002001 룰)
4. `sudo ln -s` + `sudo nginx -t && sudo systemctl reload nginx`
5. Cloudflare DNS 레코드: `climb` → 외부 IP A 레코드
6. `port-map.md`에 1행 추가

**검증:**
- `curl -I https://climb.미라클펭귄.com/` → 200 또는 Authelia 리다이렉트
- 브라우저로 SPA 접속 → 피드 표시
- 200MB 영상 업로드 시 413 에러 없음

---

## Phase 12. 정리 + E2E 검증

**작업:**
1. `mobile/` 디렉토리 삭제 (별도 archive 원하면 zip)
2. `CLAUDE.md` 갱신 (스택 React Native → Vite + React)
3. `docs/architecture.md`, `docs/db-schema.md` 갱신
4. `기획서_Web_V1.0.md` 작성 (간단 요약 + 09 모달 흐름)
5. `pm2 restart theroute-api` 최종

**검증 (PROCEDURE 마지막 체크리스트):**
- [ ] BottomNav 5슬롯 정상 (홈/기록/➕/훈련/캘린더)
- [ ] ➕ 클릭 시 통합 모달 + 영상/완등/훈련 통합 입력 → 단일 트랜잭션
- [ ] 캘린더 + 훈련 탭이 동일 모달 호출
- [ ] 횟수권 자동 차감, 만료일 검증
- [ ] 영상 9:16 letterbox + 자동 제목 (`노랑🟡 (V3)`)
- [ ] 마이페이지 주암장 복수 선택 + 최고 레벨 색상 + 시작일 경력 표시
- [ ] 훈련 분석 2단계 CLI 호출 + 메타 템플릿 DB 저장 + raw 보기
- [ ] climb.미라클펭귄.com 외부 접속 + Authelia
- [ ] 200MB 영상 업로드 정상
- [ ] AUTH_ENABLED 토글 시 401 동작 (옵셔널 인증 검증)

---

## 진행 상태 추적

| Phase | 상태 | 비고 |
|-------|------|------|
| 0  사전 점검 | ✅ | backend 부팅 가능 확인 |
| 1  옵셔널 인증 | ✅ | optionalAuth 보강 + 디폴트 user 시드, AUTH_ENABLED 토글 검증 |
| 2  스키마 확장 | ✅ | 컬럼 ALTER + 신규 6테이블 + 메타 템플릿 시드, 스키마 검증 통과 |
| 3  엔드포인트 보강 | ✅ | routes(gym_id/mine/sort/tags) / gyms(recent_routes) / passes(gym_id/pass_type/count.end_date) / users(main_gyms·max_level_*·climbing_started_at) / climb-logs(트랜잭션·차감·attempts·ar_route) |
| 4  훈련 도메인 | ✅ | claudeCli + trainingPromptBuilder + trainingAnalyzer + 컨트롤러/라우트 + DB 시드 |
| 5  통합 세션 엔드포인트 | ✅ | POST /api/sessions 단일 트랜잭션 + sessionHelpers (DRY), 정합성 검증 통과 |
| 6  Vite 부트스트랩 | ✅(코드)/⚠ npm install | 모든 코드 작성 완료. NFS의 esbuild spawn 권한 이슈로 install은 ~/.node-local 패턴으로 후속 |
| 7  read-only 페이지 | ✅(코드) | Feed/RouteDetail/GymList/GymDetail/Calendar/MyPage/Training 작성 |
| 8  통합 세션 모달 | ✅(코드) | SessionAddModal + Provider, BottomNav ➕에서 호출 |
| 9  분석 탭 (2단계 CLI) | ✅(코드) | AnalysisTab + analyzeStream(SSE) + 과거 분석 목록 |
| 10  쓰기·편집 마무리 | 🟡 일부 | 좋아요/북마크/댓글/세션 추가 OK. 프로필 편집 모달은 향후 추가 (API는 동작) |
| 11  도메인 + 정적 서빙 | ✅ | nginx vhost 갱신(250M·SSE), port-map.md, ecosystem.config.js 신설 |
| 12  정리 + E2E | 🟡 부분 | 백엔드 16개 엔드포인트 일괄 200 OK 검증. 프론트는 npm install 후 검증 |

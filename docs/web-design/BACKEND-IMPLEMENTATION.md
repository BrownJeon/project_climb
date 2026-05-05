# theroute-api (백엔드) 구현안

> 본 문서는 [PROCEDURE.md](./PROCEDURE.md)의 백엔드 구현 부분(Phase 1~5)을 파일·함수 단위로 상세화한 가이드입니다.
> 모든 백엔드 코드는 **단일 프로젝트(`TheRoute/`)** 의 `backend/` 서브디렉토리에 위치합니다 (web과 monorepo 구성).

---

## 0. 프로젝트 구조 (monorepo)

```
TheRoute/                                       # 프로젝트 루트
├── package.json                                # (선택) 루트 통합 스크립트 — backend·web 일괄 실행/빌드
├── ecosystem.config.js                         # pm2 단일 진입점 (backend/src/index.js)
├── CLAUDE.md
├── docs/
│   └── web-design/                             # 본 문서가 위치한 폴더
├── backend/                                    # ⬅ theroute-api (Node + Express)
│   ├── package.json                            # backend 독립 의존성
│   ├── .env                                    # DB / JWT / AUTH_ENABLED / CLAUDE_CLI_PATH 등
│   ├── .env.example
│   └── src/
│       ├── index.js                            # 부팅 (DB 연결 → setupDB → app.listen)
│       ├── server.js                           # Express app 구성 + 라우트 마운트
│       ├── config/
│       │   ├── database.js                     # Sequelize 인스턴스
│       │   └── setupDB.js                      # 신규: idempotent 마이그레이션 + 시드
│       ├── middleware/
│       │   ├── auth.js                         # optionalAuth 보강
│       │   └── upload.js                       # multer (videoUpload, imageUpload, sessionAny)
│       ├── models/                             # Sequelize 모델 (기존 + 신규)
│       ├── controllers/                        # 도메인별 컨트롤러
│       ├── routes/                             # Express 라우터
│       └── services/                           # claudeCli, trainingPromptBuilder, trainingAnalyzer, sessionHelpers
├── web/                                        # 신규 Vite + React SPA (별도 패키지)
│   ├── package.json
│   └── ...
└── uploads/                                    # multer 저장 경로 (기존 유지)
```

**운영 모드 (단일 포트):**
- prod: `backend`가 `web/dist/`를 정적 서빙 (BJJ 패턴). 포트 3100 단일
- dev: `backend`(3100) + `web`(5173) 병행 실행, vite 프록시로 `/api/*` 포워딩

**pm2 단일 등록:** `theroute-api` 1개 프로세스에서 API + SPA 정적 서빙 모두 처리

---

## 1. 의존성

`backend/package.json`에 **추가 또는 업그레이드 대상**:

| 패키지 | 용도 | 비고 |
|--------|------|------|
| `express` | (기존) | 유지 |
| `sequelize` / `mysql2` | (기존) | 유지 |
| `multer` | (기존) | 단일/다중 파일 모두 처리 |
| `jsonwebtoken` | (기존) | optionalAuth용 |
| `cors` | (기존) | 유지 |
| `dotenv` | (기존) | 유지 |
| (신규 없음) Claude CLI는 `child_process` 표준 라이브러리로 호출 — npm 의존성 0 |

> **`@anthropic-ai/sdk` 등 API 클라이언트는 추가하지 않음** (구독 기반 CLI 사용 정책).

---

## 2. 환경변수 (`backend/.env.example`)

```
# 기존 유지
DB_HOST=192.168.1.40
DB_PORT=3306
DB_NAME=theroute
DB_USER=...
DB_PWD=...
JWT_SECRET=...
MEDIA_UPLOAD_PATH=/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/uploads
MEDIA_BASE_URL=https://climb.미라클펭귄.com/uploads

# 신규
AUTH_ENABLED=false                  # true 시 JWT 검증, false 시 디폴트 user(id=1) 자동 주입
CLAUDE_CLI_PATH=claude              # subprocess 경로 (PATH 또는 절대경로)
TRAINING_ANALYZE_DAILY_LIMIT=50     # 부하 보호용 일일 호출 한도
PORT=3100
```

---

## 3. Phase 1 — 옵셔널 인증 + 디폴트 사용자

### 3.1 `middleware/auth.js` 보강

**변경 내역:**
- 기존 `authenticate` 보존 (인증 활성화 라우트용)
- `optionalAuth` 함수를 다음과 같이 교체:
  - `AUTH_ENABLED=true` + 토큰 유효 → `req.user`에 jwt payload 주입
  - `AUTH_ENABLED=true` + 토큰 누락/실패 → 401 응답
  - `AUTH_ENABLED=false` → `req.user = { id: 1, nickname: '나' }` 무조건 주입
- 두 분기 모두 `next()` 호출

### 3.2 `config/setupDB.js` 신규

**역할:** 서버 부팅 시 idempotent 마이그레이션 + 시드 실행. BJJ의 `db.js`/`setupDB()` 패턴 차용.

**구성:**
```js
async function setupDB() {
  await ensureColumns();          // 기존 테이블 신규 컬럼 ALTER (information_schema 체크)
  await createTablesIfNeeded();   // 신규 테이블 CREATE IF NOT EXISTS
  await migrateMaxLevel();        // users.max_level → max_level_grade 1회 백필
  await migrateMainGym();         // users.main_gym_id → user_main_gyms 1회 백필
  await seedDefaultUser();        // INSERT IGNORE id=1
  await seedPromptTemplate();     // analysis_meta_v1 INSERT IGNORE
}
module.exports = { setupDB };
```

`backend/src/index.js`에서 `await sequelize.authenticate()` 다음에 `await setupDB()` 호출.

### 3.3 라우트 일괄 치환

`grep -l "authenticate" backend/src/routes/*.js` → 각 파일에서 `authenticate` import 제거 또는 `optionalAuth` 추가, 미들웨어 인자 일괄 치환.

**예외:**
- `routes/auth.js`(SNS 로그인) — 그대로 보존, 단 `server.js`에서 mount는 `process.env.AUTH_ENABLED === 'true'`일 때만 조건부
- 영상 단독 업로드 등 file 처리는 `optionalAuth, videoUpload.single('video')` 순서 유지

### 3.4 `server.js` 수정

```js
// auth 라우트는 인증 모드일 때만 마운트
if (process.env.AUTH_ENABLED === 'true') {
  app.use('/api/auth', require('./routes/auth'));
}
app.use('/api/users', require('./routes/users'));
app.use('/api/gyms', require('./routes/gyms'));
app.use('/api/routes', require('./routes/routes'));
app.use('/api/feed', require('./routes/feed'));
app.use('/api/climb-logs', require('./routes/climb-logs'));
app.use('/api/passes', require('./routes/passes'));
app.use('/api/training', require('./routes/training'));         // Phase 4
app.use('/api/sessions', require('./routes/sessions'));         // Phase 5

// SPA 정적 서빙 (Phase 11)
const distDir = path.join(__dirname, '../../web/dist');
app.use(express.static(distDir));
app.get(/^\/(?!api|uploads).*$/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
```

---

## 4. Phase 2 — 스키마 확장

### 4.1 ALTER 컬럼 (`config/setupDB.js` 의 `ensureColumns()`)

| 테이블 | 추가 컬럼 | 비고 |
|--------|----------|------|
| `ar_routes` | `tags JSON NULL` | 03 영상 등록의 wall_type/techniques/custom |
| `climb_log_problems` | `attempts INT UNSIGNED NOT NULL DEFAULT 1` | 06 시도 횟수 |
| `climb_log_problems` | `ar_route_id BIGINT UNSIGNED NULL` (FK SET NULL) | 06 영상 연결 |
| `climb_logs` | `gym_pass_id BIGINT UNSIGNED NULL` (FK SET NULL) | 06 이용권 사용 |
| `climb_logs` | `used_day_pass BOOLEAN NOT NULL DEFAULT 0` | 06 일일이용권 |
| `users` | `climbing_started_at DATE NULL` | 07 클라이밍 시작일 |
| `users` | `max_level_color VARCHAR(30) NULL` | 07 색상 기반 |
| `users` | `max_level_grade VARCHAR(20) NULL` | 07 V등급 |
| `users` | `max_level_gym_id BIGINT UNSIGNED NULL` (FK SET NULL) | 07 기준 암장 |

`information_schema.COLUMNS`에서 컬럼 존재 여부 확인 후 없을 때만 ALTER.

### 4.2 신규 테이블 (`createTablesIfNeeded()`)

```sql
-- 주 암장 복수 매핑
CREATE TABLE IF NOT EXISTS user_main_gyms (
  user_id BIGINT UNSIGNED NOT NULL,
  gym_id  BIGINT UNSIGNED NOT NULL,
  sort_order SMALLINT UNSIGNED DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, gym_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (gym_id)  REFERENCES gyms(id)  ON DELETE CASCADE
);

-- 훈련 도메인
CREATE TABLE IF NOT EXISTS training_goals (...);            -- 08 §8.1
CREATE TABLE IF NOT EXISTS training_sessions (...);
CREATE TABLE IF NOT EXISTS training_session_items (...);
CREATE TABLE IF NOT EXISTS training_prompt_templates (...);
CREATE TABLE IF NOT EXISTS training_analyses (...);
```

본문은 [08-training.md §8](./08-training.md) 참조.

### 4.3 시드

- `seedDefaultUser`: `INSERT IGNORE INTO users (id, nickname, sns_provider, sns_id) VALUES (1, '나', 'local', 'default')`
- `seedPromptTemplate`: `INSERT IGNORE INTO training_prompt_templates (key, name, meta_prompt_text, version, is_active) VALUES ('analysis_meta_v1', '기본 분석 메타 프롬프트', :seed_text, 1, 1)`
  - `:seed_text`는 [08-training.md §8.7](./08-training.md)의 본문 골격

### 4.4 일회성 백필

- `migrateMaxLevel`: 기존 `users.max_level`이 NULL이 아니고 `max_level_grade`가 NULL인 row에 대해 `max_level_grade = max_level` 복사
- `migrateMainGym`: `users.main_gym_id IS NOT NULL` row에 대해 `user_main_gyms`에 INSERT IGNORE
- 다음 사이클에서 `max_level`, `main_gym_id` 컬럼 DROP은 별도 cleanup 단계로 (지금은 보존)

### 4.5 Sequelize 모델 추가/수정

| 모델 | 작업 |
|------|------|
| `User.js` | `climbing_started_at`, `max_level_color`, `max_level_grade`, `max_level_gym_id` 필드 추가. `belongsTo(Gym, { as: 'max_level_gym' })`, `belongsToMany(Gym, { through: 'user_main_gyms', as: 'main_gyms' })` |
| `ArRoute.js` | `tags: DataTypes.JSON, allowNull: true` |
| `ClimbLog.js` | `gym_pass_id`, `used_day_pass` 필드 추가. `belongsTo(GymPass, { as: 'gym_pass' })` |
| `ClimbLogProblem.js` | `attempts`(default 1, validate min 1), `ar_route_id` 필드. `belongsTo(ArRoute, { as: 'ar_route' })` |
| `TrainingGoal.js` | 신규 |
| `TrainingSession.js` | 신규. `hasMany(TrainingSessionItem, { as: 'items' })`, `belongsTo(Gym, { as: 'gym' })` |
| `TrainingSessionItem.js` | 신규 |
| `TrainingPromptTemplate.js` | 신규 |
| `TrainingAnalysis.js` | 신규. `belongsTo(TrainingPromptTemplate, { as: 'template' })` |
| `models/index.js` | 신규 모델 export 추가 |

---

## 5. Phase 3 — 도메인별 엔드포인트 보강

### 5.1 `controllers/routeController.js`

- `listRoutes`:
  - `gym_id` 처리: Problem JOIN, `where[Op.and].push({ '$problem.gym_id$': gym_id })`
  - `mine=true` 또는 `user_id=me` 처리: `where.user_id = req.user.id`
  - `bookmarked=true`: Bookmark JOIN으로 본인 북마크 영상만
  - `sort=latest|popular`: `order = [['created_at','DESC']]` 또는 `[['like_count','DESC']]`
- `createRoute`: `tags` 필드 처리 (JSON.parse 후 모델에 저장)

### 5.2 `controllers/gymController.js`

- `listGyms`:
  - `include_recent_routes=true`: 응답 매핑 시 각 gym에 대해 별도 batch 쿼리(`ArRoute.findAll where: { '$problem.gym_id$': IN gymIds }, limit per gym = 3`) — 또는 lateral join 대체로 단순 sub-select
  - `route_count` 집계: `LEFT JOIN ar_routes via problems`, `COUNT()`
- `getGymProblems`: `?color`, `?active=true` 필터 추가

### 5.3 `controllers/gymPassController.js`

- `listPasses`:
  - `gym_id`, `pass_type` 쿼리 인식
- `createPass`:
  - `pass_type='count'`일 때 `end_date` 허용. `end_date < today`면 400
- `calcCountStatus(pass)`: 신규 헬퍼. `is_expired = remaining_count <= 0 || (end_date && end_date < today)`. `days_remaining` 계산
- 응답 매핑에서 count 항목에 `end_date`, `days_remaining` 포함

### 5.4 `controllers/userController.js`

- `getProfile`:
  - `include`에 `main_gyms`(belongsToMany), `max_level_gym`(belongsTo) 추가
  - 응답에 `climbing_started_at`, `max_level_color/grade/gym_id` 포함
- `updateProfile` (multipart):
  - `nickname`, `bio`, `profile_image` (기존 유지)
  - `climbing_started_at`: 빈 문자열 → null, 미래 날짜 → 400
  - `max_level_color`, `max_level_grade`, `max_level_gym_id`: 빈 문자열 → null, gym_id 존재 검증
  - `main_gym_ids` (JSON 문자열): JSON.parse → 트랜잭션 내에서 `user_main_gyms` 전체 DELETE → 일괄 INSERT (sort_order=index), gym_id 모두 존재 검증, dedupe

### 5.5 `routes/users.js` 추가 라우트

```js
router.post('/me/main-gyms/:gymId', optionalAuth, addMainGym);
router.delete('/me/main-gyms/:gymId', optionalAuth, removeMainGym);
```

`userController.addMainGym` / `removeMainGym` 신규.

### 5.6 `controllers/climbLogController.js`

- `createLog`:
  - 트랜잭션으로 감쌈
  - `attempts`, `ar_route_id` 매핑 (검증: attempts >= 1, ar_route 본인 소유)
  - `gym_pass_id` XOR `used_day_pass=true` 검증 (Phase 5의 통합 컨트롤러와 동일 로직)
  - 횟수권 차감
- `getLogsByDate`:
  - ClimbLogProblem include에 `ar_route` 추가
  - ClimbLog include에 `gym_pass` 추가
  - 응답 매핑에 `attempts`, `used_day_pass`, `ar_route`, `gym_pass` 포함

---

## 6. Phase 4 — 훈련 도메인 신설

### 6.1 신규 라우트 `routes/training.js`

```js
const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const c = require('../controllers/trainingController');

const r = Router();
// 목표
r.get   ('/goals',                optionalAuth, c.listGoals);
r.post  ('/goals',                optionalAuth, c.createGoal);
r.patch ('/goals/:id',            optionalAuth, c.updateGoal);
r.delete('/goals/:id',            optionalAuth, c.deleteGoal);
// 세션
r.get   ('/sessions',             optionalAuth, c.listSessions);   // climb_logs 자동 합성
r.post  ('/sessions',             optionalAuth, c.createSession);  // 호환용 (deprecated)
r.delete('/sessions/:id',         optionalAuth, c.deleteSession);
// 분석 (2단계 CLI)
r.post  ('/analyze',              optionalAuth, c.analyze);        // SSE 분기 지원
r.get   ('/analyses',             optionalAuth, c.listAnalyses);
r.get   ('/analyses/:id',         optionalAuth, c.getAnalysis);    // ?include=raw
r.delete('/analyses/:id',         optionalAuth, c.deleteAnalysis);
// 메타 템플릿 (운영자 보조)
r.get   ('/prompt-templates',     optionalAuth, c.listTemplates);  // ?include=body=true

module.exports = r;
```

### 6.2 `controllers/trainingController.js`

각 핸들러는 Sequelize 직접 호출 + 본인 user 필터. `analyze`는 `services/trainingAnalyzer.analyze`로 위임.

`listSessions` 핵심 로직:
```js
const direct = await TrainingSession.findAll({ ... });
const climb = await ClimbLog.findAll({ ..., include: ['gym', { model: ClimbLogProblem, as: 'problems' }] });
const synthetic = climb.map(cl => ({
  id: null,
  synthetic_from_climb_log_id: cl.id,
  session_date: cl.visited_at,
  category: 'bouldering',
  gym_id: cl.gym_id, gym_name: cl.gym?.name,
  duration_minutes: null,
  memo: cl.memo,
  items: cl.problems.map(p => ({
    exercise_name: `볼더링 시도 (${formatRouteTitle({color:p.color, level:p.level})})`,
    sets: 1, reps_or_seconds: p.attempts, metric_unit: 'count',
  })),
}));
return res.json({ data: { sessions: [...direct, ...synthetic], summary: ... }});
```

### 6.3 `services/claudeCli.js`

```js
const { spawn } = require('node:child_process');

const CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';

function runClaude({ prompt, stream = false, timeoutMs = 120000 }) {
  const args = stream ? ['-p', '--output-format', 'stream-json'] : ['-p'];
  const proc = spawn(CLI_PATH, args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'] });

  // ENOENT 가드
  proc.on('error', (err) => { /* err.code === 'ENOENT' → 콜러에게 전달 */ });

  // 타임아웃
  const timer = setTimeout(() => {
    proc.kill('SIGTERM');
    setTimeout(() => proc.kill('SIGKILL'), 5000);
  }, timeoutMs);

  // stdin으로 prompt 전달
  proc.stdin.write(prompt);
  proc.stdin.end();

  if (!stream) {
    return new Promise((resolve, reject) => {
      let out = '', err = '';
      proc.stdout.on('data', (c) => { out += c.toString(); });
      proc.stderr.on('data', (c) => { err += c.toString(); });
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(out);
        else reject(new Error(`claude exit ${code}: ${err}`));
      });
    });
  }
  // 스트리밍: AsyncIterable 반환
  return (async function* () {
    for await (const chunk of proc.stdout) {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === 'assistant' && obj.message?.content) {
            const text = obj.message.content
              .filter(c => c.type === 'text').map(c => c.text).join('');
            yield text;
          }
        } catch { yield line; }     // fallback: raw line
      }
    }
    clearTimeout(timer);
  })();
}
module.exports = { runClaude };
```

### 6.4 `services/trainingPromptBuilder.js`

```js
function fillMetaPrompt({ template, user, range, perspectives, extraPrompt, data }) {
  const map = {
    '{{from}}': range.from,
    '{{to}}':   range.to,
    '{{profile}}':    serializeProfile(user),
    '{{goals}}':      serializeGoals(data.goals),
    '{{sessions}}':   serializeTrainingSessions(data.trainingSessions),
    '{{climb_logs}}': serializeClimbLogs(data.climbLogs),
    '{{perspectives}}': perspectives.map(toKoLabel).join(', '),
    '{{extra_prompt}}': extraPrompt
      ? '```user_input\n' + extraPrompt + '\n```'
      : '(추가 요청 없음)',
  };
  return Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(v), template);
}
// 직렬화 헬퍼들도 동일 모듈에 정의
```

### 6.5 `services/trainingAnalyzer.js`

```js
async function analyze({ user, range, perspectives, extraPrompt, templateKey, stream }) {
  // 1) 메타 템플릿 로드
  const tpl = await TrainingPromptTemplate.findOne({
    where: templateKey ? { key: templateKey } : { is_active: true },
  });
  if (!tpl) { const e = new Error('NO_ACTIVE_TEMPLATE'); e.statusCode = 503; throw e; }

  // 2) 사용자 데이터 수집
  const data = await collectAnalyzeData(user.id, range);
  if ((data.trainingSessions.length + data.climbLogs.length) < 3) {
    const e = new Error('INSUFFICIENT_DATA'); e.statusCode = 400; throw e;
  }

  // 3) 1단계 메타 프롬프트
  const metaPrompt = fillMetaPrompt({ template: tpl.meta_prompt_text, user, range, perspectives, extraPrompt, data });

  // 4) 1단계 CLI 호출 (비스트리밍)
  const t1 = Date.now();
  const generatedPrompt = await runClaude({ prompt: metaPrompt, stream: false, timeoutMs: 60000 });
  const stage1Ms = Date.now() - t1;

  // 5) 2단계 CLI 호출
  const t2 = Date.now();
  const result = stream
    ? runClaude({ prompt: generatedPrompt, stream: true, timeoutMs: 180000 })
    : await runClaude({ prompt: generatedPrompt, stream: false, timeoutMs: 180000 });
  // (스트리밍이면 호출자가 chunk forward + 누적해 final markdown 보관)

  return { template: tpl, metaPrompt, generatedPrompt, result, stage1Ms, stage2StartedAt: t2 };
}
module.exports = { analyze };
```

### 6.6 컨트롤러의 SSE 처리 (`trainingController.analyze`)

```js
async function analyze(req, res, next) {
  try {
    const wantStream = (req.headers.accept || '').includes('text/event-stream');
    if (wantStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.flushHeaders();
    }

    const { from, to, perspectives, extra_prompt, template_key } = req.body;
    const r = await trainingAnalyzer.analyze({
      user: req.user,
      range: { from, to },
      perspectives, extraPrompt: extra_prompt, templateKey: template_key,
      stream: wantStream,
    });

    if (!wantStream) {
      const stage2Ms = Date.now() - r.stage2StartedAt;
      const saved = await TrainingAnalysis.create({
        user_id: req.user.id,
        period_from: from, period_to: to,
        perspectives,
        engine: 'claude-cli',
        template_id: r.template.id, template_key: r.template.key, template_version: r.template.version,
        meta_prompt_text: r.metaPrompt,
        generated_prompt_text: r.generatedPrompt,
        result_markdown: r.result,
        stage1_duration_ms: r.stage1Ms,
        stage2_duration_ms: stage2Ms,
        duration_ms: r.stage1Ms + stage2Ms,
      });
      return res.json({ success: true, data: formatAnalysis(saved) });
    }

    // SSE 스트리밍
    res.write(`event: meta-ready\ndata: {"stage1_ms":${r.stage1Ms}}\n\n`);
    let acc = '';
    for await (const chunk of r.result) {
      acc += chunk;
      res.write(`event: chunk\ndata: ${JSON.stringify({ delta: chunk })}\n\n`);
    }
    const stage2Ms = Date.now() - r.stage2StartedAt;
    const saved = await TrainingAnalysis.create({ ...형동일, result_markdown: acc });
    res.write(`event: done\ndata: ${JSON.stringify({ id: saved.id, stage2_ms: stage2Ms })}\n\n`);
    res.end();
  } catch (err) { next(err); }
}
```

---

## 7. Phase 5 — 통합 세션 엔드포인트

### 7.1 `routes/sessions.js` 신규

```js
const multer = require('multer');
const upload = multer({
  dest: process.env.MEDIA_UPLOAD_PATH,
  limits: { fileSize: 200 * 1024 * 1024 },   // 200MB per file
});
const { Router } = require('express');
const { optionalAuth } = require('../middleware/auth');
const { createSession } = require('../controllers/sessionController');

const r = Router();
r.post('/', optionalAuth, upload.any(), createSession);
module.exports = r;
```

### 7.2 `controllers/sessionController.js` 신규 (단일 트랜잭션)

핵심 흐름:
```js
async function createSession(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { visited_at, gym_id, memo, gym_pass_id, used_day_pass } = req.body;
    const attempts = JSON.parse(req.body.attempts || '[]');
    const training = JSON.parse(req.body.training || '[]');

    // (a) 검증
    validateXorPass(gym_pass_id, used_day_pass);
    validateAttempts(attempts);
    if (gym_pass_id) await validatePassUsage(gym_pass_id, gym_id, visited_at, req.user.id, t);

    // (b) climb_log
    const log = await ClimbLog.create({
      user_id: req.user.id, gym_id, visited_at, memo,
      gym_pass_id: gym_pass_id || null,
      used_day_pass: !!used_day_pass,
    }, { transaction: t });

    // (c) 횟수권 차감
    if (gym_pass_id) await decrementCountPassIfNeeded(gym_pass_id, t);

    // (d) attempts 행
    const filesByIndex = req.files.reduce((acc, f) => {
      const m = f.fieldname.match(/^video_(\d+)$/);
      if (m) acc[Number(m[1])] = f;
      return acc;
    }, {});
    const arRouteIds = [];
    for (let i = 0; i < attempts.length; i++) {
      const row = attempts[i];
      let problemId = row.problem_id || null;
      if (row.new_problem) {
        const np = await Problem.create({ gym_id, ...row.new_problem }, { transaction: t });
        problemId = np.id;
      }
      let arRouteId = row.ar_route_id || null;
      if (row.video_mode === 'upload' && filesByIndex[i]) {
        const file = filesByIndex[i];
        const url = `${process.env.MEDIA_BASE_URL}/${file.filename}`;
        const ar = await ArRoute.create({
          user_id: req.user.id, problem_id: problemId,
          title: formatRouteTitle({ color: row.color, level: row.level }),
          description: row.description || null,
          video_url: url, tags: row.tags || null,
        }, { transaction: t });
        arRouteId = ar.id;
        arRouteIds.push(ar.id);
      } else if (row.video_mode === 'link' && row.ar_route_id) {
        await validateArRouteOwnership(row.ar_route_id, req.user.id, gym_id, t);
      }
      await ClimbLogProblem.create({
        log_id: log.id,
        problem_id: problemId,
        custom_level: row.custom_level || null,
        custom_color: row.custom_color || null,
        is_cleared: !!row.is_cleared,
        attempts: row.attempts || 1,
        ar_route_id: arRouteId,
      }, { transaction: t });
    }

    // (e) 훈련 항목
    const trainingSessionIds = [];
    for (const tr of training) {
      const ts = await TrainingSession.create({
        user_id: req.user.id, session_date: visited_at,
        category: tr.category, gym_id, duration_minutes: tr.duration_minutes,
        memo: tr.memo || null,
      }, { transaction: t });
      trainingSessionIds.push(ts.id);
      if (tr.items?.length) {
        await TrainingSessionItem.bulkCreate(
          tr.items.map((it, idx) => ({ session_id: ts.id, sort_order: idx, ...it })),
          { transaction: t }
        );
      }
    }

    await t.commit();

    // 응답에 잔여 횟수 포함
    let remaining = null;
    if (gym_pass_id) {
      const updated = await GymPass.findByPk(gym_pass_id);
      remaining = updated?.pass_type === 'count' ? updated.remaining_count : null;
    }

    return res.status(201).json({
      success: true,
      message: '운동 기록이 저장되었습니다.',
      data: {
        climb_log_id: log.id,
        ar_route_ids: arRouteIds,
        training_session_ids: trainingSessionIds,
        remaining_pass_count: remaining,
      },
    });
  } catch (err) {
    await t.rollback();
    next(err);
  }
}
```

### 7.3 헬퍼 추출 (`services/sessionHelpers.js`)

기존 `createRoute`, `createLog`, `createTrainingSession`의 핵심 로직을 함수로 분리:

- `validateXorPass(gymPassId, usedDayPass)`
- `validateAttempts(rows)` — 각 행 problem 식별자 정확히 1개, attempts >= 1
- `validatePassUsage(passId, gymId, visitedAt, userId, t)` — 본인/암장/만료/유효기간
- `validateArRouteOwnership(arRouteId, userId, gymId, t)`
- `decrementCountPassIfNeeded(passId, t)`

위 헬퍼는 단독 컨트롤러(`createLog`, `createRoute`)도 import하여 재사용 (DRY).

---

## 8. Phase 11 — SPA 정적 서빙 통합 (백엔드 측)

### 8.1 `server.js` 변경

```js
const path = require('path');
// ... 기존 미들웨어 + 라우트 ...

// API 다음, SPA 정적 서빙
const distDir = path.join(__dirname, '../../web/dist');
if (require('fs').existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback — /api 와 /uploads 경로는 제외
  app.get(/^\/(?!api|uploads).*$/, (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// 에러 미들웨어는 마지막
app.use(errorMiddleware);
```

### 8.2 `ecosystem.config.js`

```js
module.exports = {
  apps: [{
    name: 'theroute-api',
    script: 'backend/src/index.js',
    cwd: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute',
    instances: 1, exec_mode: 'fork',
    env: { NODE_ENV: 'production', PORT: 3100 },
    watch: false, max_memory_restart: '512M',
  }],
};
```

### 8.3 빌드·배포 절차

```bash
# 프론트 빌드
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
npm install
npm run build                 # → web/dist/

# pm2 등록 (최초 1회)
cd ..
pm2 start ecosystem.config.js
pm2 save

# 이후 갱신
pm2 restart theroute-api --update-env
```

---

## 9. 테스트·검증 절차 (백엔드 단독)

### 9.1 단위 검증 (curl 기반)

각 Phase 종료 시:
```bash
# Phase 1
curl -i http://localhost:3100/api/users/1
AUTH_ENABLED=true pm2 restart theroute-api --update-env
curl -i http://localhost:3100/api/climb-logs?year=2026  # 401 기대
AUTH_ENABLED=false pm2 restart theroute-api --update-env

# Phase 3
curl 'http://localhost:3100/api/routes?gym_id=1&sort=latest'
curl 'http://localhost:3100/api/passes?gym_id=1&pass_type=count'
curl 'http://localhost:3100/api/gyms?include_recent_routes=true&limit=2'

# Phase 4
curl http://localhost:3100/api/training/goals
curl http://localhost:3100/api/training/prompt-templates

# Phase 5 (multipart)
curl -X POST http://localhost:3100/api/sessions \
  -F 'visited_at=2026-05-08' -F 'gym_id=1' \
  -F 'used_day_pass=true' -F 'memo=테스트' \
  -F 'attempts=[{"problem_id":1,"is_cleared":true,"attempts":2,"video_mode":"none"}]' \
  -F 'training=[]'
```

### 9.2 DB 직접 확인

```sql
SHOW COLUMNS FROM ar_routes LIKE 'tags';
SHOW COLUMNS FROM climb_log_problems LIKE 'attempts';
SHOW COLUMNS FROM climb_logs LIKE 'used_day_pass';
SHOW COLUMNS FROM users LIKE 'climbing_started_at';
SHOW TABLES LIKE 'training_%';
SELECT id, key, version FROM training_prompt_templates;
SELECT id, nickname FROM users WHERE id = 1;
```

### 9.3 Claude CLI 검증

```bash
# 서버에 CLI 설치·인증 확인
claude --version
echo "ping" | claude -p

# 분석 호출
curl -X POST http://localhost:3100/api/training/analyze \
  -H 'Content-Type: application/json' \
  -d '{"from":"2026-04-01","to":"2026-05-01","perspectives":["strength_weakness"]}'
```

---

## 10. 코드 변경 파일 일람표

| 분류 | 파일 | 작업 |
|------|------|------|
| 신규 | `backend/src/config/setupDB.js` | 마이그레이션 + 시드 |
| 수정 | `backend/src/middleware/auth.js` | optionalAuth 보강 |
| 수정 | `backend/src/server.js` | auth 조건부 mount, SPA 정적 서빙, 신규 라우트 마운트 |
| 수정 | `backend/src/index.js` | setupDB 호출 |
| 수정 | `backend/src/routes/*.js` | authenticate → optionalAuth |
| 수정 | `backend/src/models/User.js` | 신규 컬럼 + association |
| 수정 | `backend/src/models/ArRoute.js` | tags 추가 |
| 수정 | `backend/src/models/ClimbLog.js` | gym_pass_id, used_day_pass + association |
| 수정 | `backend/src/models/ClimbLogProblem.js` | attempts, ar_route_id + association |
| 수정 | `backend/src/models/index.js` | 신규 모델 export |
| 신규 | `backend/src/models/TrainingGoal.js` | |
| 신규 | `backend/src/models/TrainingSession.js` | |
| 신규 | `backend/src/models/TrainingSessionItem.js` | |
| 신규 | `backend/src/models/TrainingPromptTemplate.js` | |
| 신규 | `backend/src/models/TrainingAnalysis.js` | |
| 수정 | `backend/src/controllers/routeController.js` | listRoutes 필터, createRoute tags |
| 수정 | `backend/src/controllers/gymController.js` | listGyms recent_routes, getGymProblems color |
| 수정 | `backend/src/controllers/gymPassController.js` | count end_date 등 |
| 수정 | `backend/src/controllers/userController.js` | profile 확장 + main_gyms |
| 수정 | `backend/src/controllers/climbLogController.js` | attempts, gym_pass, ar_route 처리 |
| 수정 | `backend/src/routes/users.js` | main-gyms 엔드포인트 |
| 신규 | `backend/src/controllers/trainingController.js` | |
| 신규 | `backend/src/routes/training.js` | |
| 신규 | `backend/src/services/claudeCli.js` | |
| 신규 | `backend/src/services/trainingPromptBuilder.js` | |
| 신규 | `backend/src/services/trainingAnalyzer.js` | |
| 신규 | `backend/src/controllers/sessionController.js` | |
| 신규 | `backend/src/routes/sessions.js` | |
| 신규 | `backend/src/services/sessionHelpers.js` | |
| 수정 | `backend/.env.example` | AUTH_ENABLED, CLAUDE_CLI_PATH 등 |
| 수정 | `ecosystem.config.js` | 단일 진입점 등록 |

---

## 11. 진행 상태 (백엔드)

| Phase | 영역 | 상태 |
|-------|------|------|
| 1 | optionalAuth + 디폴트 사용자 시드 | ⬜ |
| 2 | 스키마 ALTER + 신규 테이블 + 시드 | ⬜ |
| 3 | 도메인별 엔드포인트 보강 (routes/gyms/passes/users/climb-logs) | ⬜ |
| 4 | 훈련 도메인 (모델/라우트/CLI/2단계 분석) | ⬜ |
| 5 | 통합 세션 엔드포인트 + 헬퍼 추출 (DRY) | ⬜ |
| 11 | SPA 정적 서빙 통합 + ecosystem 갱신 | ⬜ |

각 Phase 완료 시 `pm2 logs theroute-api`에서 setupDB 정상 + curl 검증 통과 → 다음 Phase 진행.

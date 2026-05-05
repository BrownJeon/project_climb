# 09. 통합 운동 기록 추가 (Session Add Modal)

> 진입: BottomNav `➕` (메인) / 캘린더 [+ 기록 추가] / 훈련 [+ 훈련 기록] / 화면별 컨텍스트 진입
> 공통 규칙: [00-overview.md](./00-overview.md)
> 관련: [05-gym-detail.md](./05-gym-detail.md), [06-calendar.md](./06-calendar.md), [08-training.md](./08-training.md)

---

## 1. 목적·배경

기존에 흩어져 있던 4개의 추가 진입점(영상 등록 / 암장 문제 / 캘린더 기록 / 훈련 기록)을 **하나의 운동 세션 단위**로 통합. 사용자는 한 번의 모달에서 모든 활동을 한 번에 입력하고, 다른 화면들은 그 데이터를 각자의 관점으로 보여주는 view 역할만 담당한다.

**핵심 원칙:**
- 운동 1회 = 1 session (날짜 + 암장 + 활동 묶음)
- 진입점 N개, 모달 1개 (`<SessionAddModal>`)
- 백엔드는 단일 트랜잭션으로 관련 테이블 일괄 INSERT
- 영상 단독 업로드, 훈련 단독 등 "부분 입력 모드"도 동일 모달이 흡수

## 2. 진입점 매트릭스

| 진입 위치 | 동작 | 사전 채움(prefill) |
|----------|------|-------------------|
| BottomNav `➕` (메인) | 모달 오픈 | date=오늘 |
| 캘린더 빈 날짜 [+ 기록 추가] | 모달 오픈 | date=선택일 |
| 캘린더 기존 카드 [+ 추가 기록] | 모달 오픈 | date=선택일, gym=같은 암장 |
| 05 암장 상세 [+ 영상] | 모달 오픈 (영상 모드) | date=오늘, gym=현재 암장 |
| 05 암장 상세의 [+ 새 문제 등록] | **별도 모달 유지** (카탈로그 등록만, 본 모달 아님) | — |
| 02 영상 상세 "이 문제 영상 추가" | 모달 오픈 | gym=영상의 gym, problemId=영상의 problem |
| 08 훈련 [+ 훈련 기록] | 모달 오픈 (훈련만 모드) | date=오늘 |
| 03 `/routes/new` (구 단독 페이지) | **deprecated** — 라우트 진입 시 모달을 자동 오픈하고 직전 페이지로 replace |

## 3. 레이아웃 와이어프레임

```
┌──────────────────────────────────────────┐
│ 운동 기록 추가              [취소] [저장] │
├──────────────────────────────────────────┤
│ ── 기본 ───────────────────────────────  │
│ 날짜 *      [2026-05-08]                  │
│ 암장 *      [더클라임 강남 ▼]            │
│ 이용권 *    ( ) 정기권 [▼]               │
│             (●) 횟수권 [10회권 (잔여 7) ▼]│
│             ( ) 일일이용권                │
│ 메모        [______________________]     │
│                                          │
│ ── 완등·시도 (선택, N개) ────────────── │
│ ┌─ 행 1 ──────────────────────────────┐ │
│ │ 문제: [노랑🟡 (V3) ▼] 또는 [+ 새 문제]│ │
│ │ ☑ 완등  ·  시도 [-][2][+] 회         │ │
│ │ 영상:                                │ │
│ │   ( ) 없음                            │ │
│ │   (●) 새로 업로드:                    │ │
│ │       [📎 영상 파일 선택]             │ │
│ │       [▶ 미리보기 9:16]               │ │
│ │       자동 제목: 노랑🟡 (V3)          │ │
│ │       태그: 벽[오버행] 기술[다이나믹] │ │
│ │       기타: [점핑무브, 슬로퍼]        │ │
│ │   ( ) 기존 영상 연결: [목록 ▼]        │ │
│ │                                  [✕] │ │
│ └──────────────────────────────────────┘ │
│ [+ 완등·시도 추가]                       │
│                                          │
│ ── 훈련 (선택, N개) ─────────────────── │
│ ┌─ 훈련 1 ────────────────────────────┐ │
│ │ 카테고리: ( )볼더링 (●)지구력 ( )컨디 │ │
│ │ 소요시간(분): [60]                    │ │
│ │ 운동: [핑거보드 데드행 ▼ / 직접입력] │ │
│ │ 세트 [3] · 반복/시간 [38] [sec ▼]     │ │
│ │ 추가 무게(kg) [0]                     │ │
│ │ 메모 [_________________________]     │ │
│ │                                  [✕] │ │
│ └──────────────────────────────────────┘ │
│ [+ 훈련 항목 추가]                       │
│                                          │
└──────────────────────────────────────────┘
```

**부분 입력 모드:**
- "완등·시도 0건 + 훈련 0건" → 단순 방문 기록만 저장 가능
- "완등·시도만 입력" → 클라이밍 세션 (영상 없을 수 있음)
- "훈련만 입력" → 훈련-only 세션 (08 훈련에서 진입한 경우 default 모드)
- "영상만 추가" → 완등·시도 1행에 영상 업로드, 시도 횟수·완등은 입력해도 됨 (구 03 단독 업로드 흡수)

## 4. 사용 API

### 4.1 POST `/api/sessions` (multipart/form-data, 신규 통합 엔드포인트)

**요청 form fields:**

| 필드 | 타입 | 필수 | 비고 |
|------|------|------|------|
| `visited_at` | string | ✓ | YYYY-MM-DD |
| `gym_id` | number | ✓ | |
| `gym_pass_id` | number | XOR | 정기권/횟수권 사용 시 |
| `used_day_pass` | boolean | XOR | 일일이용권 사용 시 |
| `memo` | string | ○ | |
| `attempts` | string(JSON) | ○ | 완등·시도 행 배열, 아래 4.1.1 |
| `training` | string(JSON) | ○ | 훈련 항목 배열, 아래 4.1.2 |
| `video_<n>` | File | ○ | 완등 행 n번째에 업로드한 영상 파일 (n은 attempts 배열 인덱스) |

**참고:** multipart 한계상 배열·복잡 객체는 JSON 문자열로 전송. 파일은 attempts 배열의 인덱스와 매칭되도록 `video_0`, `video_1` 등 키로 첨부.

#### 4.1.1 `attempts` JSON 스키마
```json
[
  {
    "problem_id": 3,
    "is_cleared": true,
    "attempts": 2,
    "video_mode": "upload",          // 'none' | 'upload' | 'link'
    "ar_route_id": null,             // 'link' 모드일 때 기존 영상 id
    "video_index": 0,                // 'upload' 모드일 때 form의 video_<n> 인덱스
    "tags": {
      "wall_type": "overhang",
      "techniques": ["dynamic"],
      "custom": ["점핑무브"]
    }
  },
  {
    "new_problem": { "color": "red", "level": "V5" },   // 신규 문제 인라인 등록
    "is_cleared": false,
    "attempts": 8,
    "video_mode": "none"
  },
  {
    "custom_level": "V?", "custom_color": "any",        // 카탈로그 외 문제
    "is_cleared": true,
    "attempts": 3,
    "video_mode": "none"
  }
]
```
- 행은 `problem_id` / `new_problem` / `custom_*` 셋 중 하나의 형태
- `attempts >= 1`, default 1
- `video_mode='link'` + `ar_route_id`: 기존 영상 연결 (06 캘린더의 영상 연결 기능 흡수)
- `video_mode='upload'` + `video_index`: 새 영상 업로드 (03 영상 등록 기능 흡수)

#### 4.1.2 `training` JSON 스키마
```json
[
  {
    "category": "endurance",
    "duration_minutes": 60,
    "items": [
      { "exercise_name": "핑거보드 데드행", "sets": 3, "reps_or_seconds": 38, "metric_unit": "sec", "weight_kg": 0 },
      { "exercise_name": "트래버스",       "sets": 5, "reps_or_seconds": 180, "metric_unit": "sec" }
    ],
    "memo": "..."
  }
]
```
- 카테고리는 `bouldering | endurance | conditioning`
- 한 세션에 여러 카테고리의 훈련을 함께 입력 가능 (배열로 묶음)

### 4.2 백엔드 처리 (단일 트랜잭션)

`createSession` 컨트롤러에서:

1. **유효성 검증** (실패 시 즉시 4xx, 트랜잭션 시작 전)
   - `visited_at`, `gym_id` 필수
   - `gym_pass_id` XOR `used_day_pass=true` (둘 다 또는 둘 다 없음 → 400)
   - 이용권 본인 소유·gym 일치·만료 검증
   - 각 attempts 행: problem_id|new_problem|custom_* 중 정확히 1개
   - `attempts >= 1`
2. **트랜잭션 시작**
3. `climb_logs` INSERT (id 받음)
4. 이용권이 횟수권이면 `gym_passes.remaining_count -= 1`
5. **각 attempts 행 처리** (순회):
   - `new_problem`이면 `problems` INSERT → 그 id 사용
   - `video_mode='upload'`이면 multer 업로드된 파일을 `ar_routes` INSERT (`title`은 `formatRouteTitle({color, level})`로 자동), `tags` JSON 저장
   - `video_mode='link'`이면 `ar_route_id`의 본인 소유·해당 gym 검증
   - `climb_log_problems` INSERT (problem_id|null, custom_*|null, is_cleared, attempts, ar_route_id)
6. **각 training 항목 처리**:
   - `training_sessions` INSERT (gym_id 동일 적용)
   - `training_session_items` bulk INSERT
7. **트랜잭션 COMMIT**
8. 응답: 생성된 climb_log_id, ar_route_ids[], training_session_ids[], gym_pass(차감 후 잔여)

### 4.3 응답 형식
```json
{
  "success": true,
  "message": "운동 기록이 저장되었습니다.",
  "data": {
    "climb_log_id": 14,
    "ar_route_ids": [7, 8],
    "training_session_ids": [11],
    "remaining_pass_count": 6
  }
}
```

### 4.4 영상 단독 업로드 케이스 (03 흡수)

사용자가 단순히 영상만 올리고 싶다면:
- 모달 진입 → 기본 섹션 (날짜·암장·이용권) 채우고
- 완등·시도 1행에서 [+ 새 문제 또는 기존 선택] → video_mode='upload'
- 시도 횟수 1, 완등 미체크여도 OK
- 훈련 0건
- 저장 시 백엔드는 climb_log + climb_log_problems(1행) + ar_routes(1건) 생성

### 4.5 deprecated/유지 엔드포인트

| 엔드포인트 | 처리 |
|----------|------|
| `POST /api/routes` (단독 영상 업로드) | **유지** (외부 API 호환). 내부 모달은 `/api/sessions` 사용 |
| `POST /api/climb-logs` | **유지** (06 단순 추가 흐름이 모달로 옮겨가지만 API는 호환) |
| `POST /api/training/sessions` | **유지** (08 단독 추가 흐름 흡수되지만 API는 호환) |
| `POST /api/gyms/:id/problems` | **유지** (05 카탈로그 등록은 별도 모달 유지) |

내부적으로 모든 신규 추가는 `POST /api/sessions`로 일원화. 기존 엔드포인트는 호환·외부 자동화·테스트 용도로 보존.

## 5. 컴포넌트 분해

```
<SessionAddModal open onClose initialPrefill>
  ├── <SessionBasicSection>
  │     ├── <DatePicker name="visited_at" />
  │     ├── <GymPickerField name="gym_id" />        # 04와 동일 컴포넌트
  │     ├── <PassUsageSelector gymId required />    # 06의 컴포넌트 그대로 재사용
  │     └── <MemoTextarea />
  ├── <AttemptsSection>
  │     ├── <AttemptRowEditor>*
  │     │     ├── <ProblemPickerInline />            # 기존 + [+ 새 문제] (모달 안에서 인라인)
  │     │     ├── <ClearedCheckbox />
  │     │     ├── <AttemptsInput min=1 default=1 />
  │     │     └── <VideoLinkOrUpload>
  │     │           ├── <RadioVideoMode />          # none/upload/link
  │     │           ├── <VideoFileInput />          # upload 모드: 03의 컴포넌트
  │     │           ├── <RouteTagsField />          # 03의 컴포넌트 (tags JSON)
  │     │           └── <ArRouteLinkSelect gymId problemId />   # link 모드: 06의 컴포넌트
  │     └── [+ 완등·시도 추가]
  ├── <TrainingSection>
  │     ├── <TrainingItemEditor>*                    # 08의 NewSessionModal 내부 그대로 흡수
  │     │     ├── <CategoryRadio />
  │     │     ├── <input duration_minutes />
  │     │     └── <SessionItemsEditor>
  │     │           └── <SessionItemRowEditor />*
  │     └── [+ 훈련 항목 추가]
  └── <SubmitButton uploading progress />
```

**모드 prop:**
- `<SessionAddModal mode='full' | 'video' | 'training' />` — 진입점에 따라 섹션 가시성 조정
  - `full` (default): 모든 섹션 표시
  - `video`: 기본 + 완등·시도(1행 자동 추가) 강조, 훈련 섹션 접힘
  - `training`: 기본 + 훈련 섹션 강조, 완등·시도 섹션 접힘
- 접힌 섹션도 사용자가 펼쳐 입력 가능 (모드는 강조일 뿐 제한 아님)

## 6. 상태 / 데이터 모델

```ts
type SessionAddState = {
  // 기본
  visited_at: string;
  gym_id: number | null;
  gym_name: string;
  passUsage: PassUsage;            // 06의 PassUsageSelector value
  memo: string;

  // 완등·시도
  attempts: AttemptRow[];

  // 훈련
  training: TrainingItem[];

  // 업로드 진행
  uploading: boolean;
  progress: number;
  error: string | null;
};

type AttemptRow = {
  problemSelection: { kind: 'existing' | 'new' | 'custom', ... };
  is_cleared: boolean;
  attempts: number;
  video: { mode: 'none' | 'upload' | 'link', file?: File, previewUrl?: string,
           ar_route_id?: number, tags?: TagState };
};

type TrainingItem = {
  category: 'bouldering' | 'endurance' | 'conditioning';
  duration_minutes: number | null;
  items: SessionItemEditState[];
  memo: string;
};
```

**저장 가능 조건:**
- `visited_at`, `gym_id`, `passUsage` 채워짐
- attempts 각 행: problem 식별자 정확히 1개, attempts >= 1
- attempts 각 행 video.mode='upload'면 file 존재, 200MB 이하
- training 각 항목: category 선택, items 배열은 0개 허용
- 한 모달의 attempts와 training이 모두 0개여도 저장 허용 (단순 방문 기록)

## 7. 빈 상태 / 에러 / 로딩

| 상태 | 처리 |
|------|------|
| 모달 열림 직후 | 기본 prefill 적용된 상태 |
| 영상 파일 200MB 초과 | 인라인 에러 + 다시 선택 유도 |
| 업로드 진행 중 | 저장 버튼이 진행률 표시 (`업로드 중 35%`) + 모든 입력 잠금 |
| 부분 실패 (드물게) | 백엔드 트랜잭션이 모두 ROLLBACK → 사용자에게 단일 에러 메시지 |
| 이용권 미선택 | 저장 비활성 + 인라인 안내 |
| 백엔드 검증 실패 (4xx) | 실패한 행 강조 + 메시지 |
| 페이지 이탈(uploading 중) | `beforeunload` 경고 |

## 8. 추후 인증 도입 시 변경점

- 모달 자체는 `useAuth().user.id`만 사용 → 코드 변경 불필요
- 추후 인증 활성 시 `<RequireAuth>` 가드로 모달 호출 자체 차단

## 9. 백엔드 보강 항목

1. **신규 라우트 `routes/sessions.js`** + 컨트롤러 `controllers/sessionController.js`
   - `POST /api/sessions` (multer.fields 사용 — `video_0`, `video_1`, ... 동적 파일 필드)
   - `optionalAuth` 통과
2. **트랜잭션 처리**
   - Sequelize `sequelize.transaction(async (t) => { ... })` 사용
   - 모든 INSERT에 `{ transaction: t }` 명시
   - 실패 시 자동 ROLLBACK
3. **multer.fields 동적 파일** — `video_0`, `video_1` 등을 fields 배열에 미리 등록(예: 최대 20개) 또는 `multer().any()` 사용 후 필드명 패턴 검증
4. **응답 시 영상 url, climb_log 메타 등 핵심 정보** 포함 (위 4.3)
5. **기존 단독 컨트롤러 재사용**: `createRoute`, `createLog`, `createTrainingSession` 내부 로직을 함수로 추출하여 `createSession`이 호출하도록 리팩터 (DRY)

## 10. 수용 기준

### 10.1 진입점 통합
- [ ] BottomNav `➕` 클릭 시 통합 세션 추가 모달 오픈
- [ ] 캘린더 [+ 기록 추가] / [+ 추가 기록] 클릭 시 동일 모달 오픈 (defaultDate 적용)
- [ ] 05 암장 상세 [+ 영상] 진입 시 모달 오픈 (gym prefill, 모드='video')
- [ ] 08 훈련 [+ 훈련 기록] 진입 시 모달 오픈 (모드='training')
- [ ] 02 영상 상세에서 "이 문제 영상 추가" 진입 시 모달 오픈 (gym/problem prefill)
- [ ] `/routes/new` 진입 시 모달이 자동 오픈되고 라우트는 직전 페이지로 replace
- [ ] 05의 [+ 새 문제 등록] 별도 모달은 그대로 유지(카탈로그 등록만)

### 10.2 모달 입력
- [ ] 기본 섹션(날짜·암장·이용권)은 항상 표시·필수
- [ ] 완등·시도 행 N개 추가 가능, 0개도 저장 허용
- [ ] 각 행에서 기존 문제 선택 / 새 문제 등록 / 카탈로그 외(custom) 입력 모두 지원
- [ ] 각 행에 영상 모드 3택: 없음 / 새 업로드 / 기존 영상 연결
- [ ] 새 업로드 시 9:16 미리보기, 200MB 초과 거부, tags 입력
- [ ] 기존 영상 연결 시 (gym, problem) 일치 본인 영상 우선 노출
- [ ] 훈련 항목 N개 추가 가능, 0개도 저장 허용
- [ ] 훈련 카테고리 라디오, 운동 프리셋+자유 입력, 메트릭 단위 선택

### 10.3 저장
- [ ] [저장] 클릭 시 단일 multipart 요청으로 백엔드 호출
- [ ] 업로드 진행률(0→100) 표시, 모든 입력 잠금
- [ ] 성공 시 모달 닫힘 + 진입 페이지가 적절히 갱신 (캘린더는 dots/logs 즉시 갱신, 훈련은 sessions 갱신, 영상 상세에서 등록한 경우 새 영상의 상세로 이동)
- [ ] 실패 시 트랜잭션 ROLLBACK + 입력값 보존 + 에러 메시지

### 10.4 백엔드 통합
- [ ] `POST /api/sessions` 단일 트랜잭션으로 climb_logs / climb_log_problems / ar_routes / training_sessions / training_session_items / gym_passes(차감) 일괄 처리
- [ ] 횟수권 차감은 트랜잭션 내에서만 발생, 실패 시 복원
- [ ] 기존 엔드포인트(`POST /api/routes`, `POST /api/climb-logs`, `POST /api/training/sessions`, `POST /api/gyms/:id/problems`)는 호환을 위해 유지
- [ ] 단독 컨트롤러 로직을 헬퍼로 추출하여 통합 컨트롤러가 호출(DRY)

## 11. 의존 페이지

- ⤴ **04 GymPickerField**, **06 PassUsageSelector**, **03 RouteTagsField/VideoFileInput**, **08 TrainingItemEditor** 모두 재사용
- ➡ 저장 후 진입 페이지 갱신 — 캘린더(06), 훈련(08), 영상 상세(02) 등에서 즉시 반영
- ⬅ BottomNav `➕`, 캘린더, 훈련, 영상 상세, 암장 상세에서 진입

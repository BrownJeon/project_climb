# 03. 영상 등록 (deprecated — [09 통합 세션 추가 모달](./09-add-session.md)에 흡수)

> 경로: `/routes/new` (deprecated) | 공통 규칙: [00-overview.md](./00-overview.md)

> ⚠️ **이 페이지는 단독 화면으로는 더 이상 사용하지 않습니다.** BottomNav `➕` / 캘린더 / 훈련 등 모든 추가 진입점은 [09-add-session.md](./09-add-session.md)의 `<SessionAddModal>`을 호출합니다. 영상 단독 업로드는 모달의 "완등·시도" 행에 영상 업로드 옵션으로 흡수되었습니다.
>
> 본 문서의 와이어/컴포넌트/검증 로직은 **모달의 "영상 업로드 영역"으로 이전**되어 그대로 재사용됩니다.
>
> 라우트 호환성: `/routes/new` 직접 접근 시 모달을 자동으로 열고 직전 페이지로 replace합니다. 외부 호환을 위해 `POST /api/routes` 단독 엔드포인트는 유지(deprecated). 내부 클라이언트는 모두 `POST /api/sessions`로 일원화.

---

## 1. 목적·사용 흐름

**목적:** 본인이 등반한 루트 영상을 업로드하고 어떤 암장의 어떤 문제인지 메타데이터를 부착.

**사용 흐름:**
1. BottomNav `➕ 등록` 또는 EmptyState CTA → `/routes/new` 진입
2. 영상 파일 선택 (mp4/mov/webm, 최대 200MB) — 세로 영상 권장
3. 미리보기 재생으로 영상 확인 (9:16 비율 컨테이너)
4. 암장 선택 (검색 또는 최근 사용 목록)
5. 문제 선택 — 색상(난이도) + V등급으로 식별. 해당 암장 목록에서 선택하거나 새로 등록
6. **문제 타입 태그 선택** (선택사항)
   - 벽 타입 (단일): 슬랩 / 버티컬 / 오버행 / 루프 / 동굴
   - 무브·기술 (다중): 스태틱 / 다이나믹 / 데드포인트 / 점프 / 플립 / 사이퍼 / 캠퍼스 / 토훅 / 힐훅 / 맨틀 / 매치
   - 기타 (자유 입력): 추가 키워드를 직접 작성 (콤마로 구분)
7. **제목은 입력 불필요** — 색상·V등급에서 자동 포맷 (`노랑🟡 (V3)`) 미리보기로 노출
8. 설명/메모 입력 (선택, 자유 텍스트)
9. [등록] 클릭 → 업로드 진행률 표시 → 성공 시 `/routes/:id`로 replace

## 2. 레이아웃 와이어프레임

```
┌────────────────────────────────────────┐
│ [TopBar]                               │
│ ← (취소)        영상 등록              │
├────────────────────────────────────────┤
│                                        │
│ ┌────────────────────────────────────┐ │
│ │   [영상 파일 선택]                  │ │  ← 미선택 시
│ │   클릭 또는 드래그                  │ │
│ │   mp4/mov/webm, 최대 200MB          │ │
│ └────────────────────────────────────┘ │
│  ↓ 선택 후                             │
│      ┌──────────────────────┐          │
│      │                      │          │
│      │  <video preview      │          │  ← 9:16 세로 컨테이너
│      │   controls />        │          │     (가로 영상은 letterbox)
│      │                      │          │
│      └──────────────────────┘          │
│                  [✕ 변경]               │
│                                        │
│  암장 *                                │
│  ┌────────────────────────────────────┐│
│  │ 더클라임 강남              ▼       ││  ← 클릭 시 모달
│  └────────────────────────────────────┘│
│                                        │
│  문제 *                                │
│  ┌────────────────────────────────────┐│
│  │ 노랑🟡 (V3)                 ▼      ││
│  └────────────────────────────────────┘│
│  [+ 새 문제 등록]                      │
│                                        │
│  자동 제목: 노랑🟡 (V3)                 │  ← 라이브 미리보기
│                                        │
│  벽 타입                                │
│  [슬랩] [버티컬] [오버행*] [루프] [동굴]│  ← 단일 선택 칩 (선택사항)
│                                        │
│  무브·기술 (복수 선택)                  │
│  [스태틱]   [다이나믹*]  [데드포인트]   │
│  [점프]    [플립]      [사이퍼]        │
│  [캠퍼스]  [토훅*]     [힐훅]          │
│  [맨틀]    [매치]                       │
│                                        │
│  기타 키워드 (콤마로 구분)              │
│  ┌────────────────────────────────────┐│
│  │ 점핑 무브, 슬로퍼 잡기              ││
│  └────────────────────────────────────┘│
│                                        │
│  설명                                  │
│  ┌────────────────────────────────────┐│
│  │ 처음에 왼손으로 …                  ││
│  │                                    ││
│  └────────────────────────────────────┘│
│                                        │
│  ┌────────────────────────────────────┐│
│  │           [ 등록 ]                  ││  ← 업로드 중에는 진행률
│  └────────────────────────────────────┘│
│                                        │
├────────────────────────────────────────┤
│ [BottomNav] (등록 페이지에서는 ➕ 강조) │
└────────────────────────────────────────┘
```

**진행 상태:**
- 업로드 중: 버튼이 `[ ⠿ 업로드 중 35% ]`로 변경, 비활성
- 성공: `/routes/:id`로 replace
- 실패: 토스트 + 버튼 다시 활성

## 3. 사용 API

### 3.1 POST `/api/routes` (multipart/form-data)
**요청 form fields:**
| 필드 | 타입 | 필수 | 비고 |
|------|------|------|------|
| `video` | File | ✓ | mp4/mov/webm/avi, ≤200MB |
| `title` | string | ○(자동) | 클라이언트가 `formatRouteTitle({color, level})`로 자동 생성하여 전송 (예: `"노랑🟡 (V3)"`) |
| `description` | string | ○ | TEXT (자유 메모) |
| `problem_id` | number | ✓ | 기존 또는 신규 등록한 problem의 id |
| `tags` | string(JSON) | ○ | 문제 타입 태그. 아래 3.1.1 스키마 |
| `ar_data` | string(JSON) | ○ | 현재는 미전송 (AR 미사용) |

**응답:** 생성된 ArRoute 객체 (id 포함)

#### 3.1.1 `tags` JSON 스키마
```json
{
  "wall_type": "overhang",
  "techniques": ["dynamic", "heel-hook"],
  "custom": ["점핑 무브", "슬로퍼 잡기"]
}
```
- `wall_type`: `"slab" | "vertical" | "overhang" | "roof" | "cave" | null` (단일, 미선택 가능)
- `techniques`: 미리 정의된 키 배열. 비어 있을 수 있음
- `custom`: 자유 입력 키워드 배열 (콤마로 split, trim, 빈 문자열 제외)
- 모두 미입력이면 `tags` 자체를 form에서 생략 (백엔드 NULL)

**상수 정의 (`src/constants/routeTags.js`):**
```js
export const WALL_TYPES = [
  { key: 'slab',     label: '슬랩' },
  { key: 'vertical', label: '버티컬' },
  { key: 'overhang', label: '오버행' },
  { key: 'roof',     label: '루프' },
  { key: 'cave',     label: '동굴' },
];

export const TECHNIQUES = [
  { key: 'static',     label: '스태틱' },
  { key: 'dynamic',    label: '다이나믹' },
  { key: 'deadpoint',  label: '데드포인트' },
  { key: 'jump',       label: '점프' },
  { key: 'flip',       label: '플립' },
  { key: 'cypher',     label: '사이퍼' },
  { key: 'campus',     label: '캠퍼스' },
  { key: 'toe-hook',   label: '토훅' },
  { key: 'heel-hook',  label: '힐훅' },
  { key: 'mantle',     label: '맨틀' },
  { key: 'match',      label: '매치' },
];
```
- 추후 항목 추가는 본 상수에만 수정 → 모든 페이지 일괄 반영

### 3.2 GET `/api/gyms?query=`
- 암장 선택 모달에서 검색에 사용
- 응답: `{ data: { gyms: [...] } }` (실제 컨트롤러 확인 필요, listGyms 응답 형태)

### 3.3 GET `/api/gyms/:id/problems`
- 선택한 암장의 문제 목록
- 응답: `{ data: { problems: [...] } }`

### 3.4 POST `/api/gyms/:id/problems` (새 문제 등록)
**요청:** `{ "level": "V3", "color": "yellow" }`
- `section`(벽 정보)은 **본 페이지에서 입력하지 않으며 전송하지 않음** (백엔드 컬럼은 NULL 허용 유지)
- `color`는 필수, `level`은 자동 추론 + 사용자 수정 가능 (4.1 참조)

**응답:** 생성된 Problem 객체

### 3.5 POST `/api/gyms` (새 암장 등록 — 선택 기능)
- 암장 검색 결과가 없을 때 직접 등록 옵션
- 요청: `{ "name", "address", "lat", "lng", ... }`
- MVP에서는 선택사항. 운영 데이터 풍부해지면 비활성화 가능.

## 4. 컴포넌트 분해

```
<RouteUploadPage>
  ├── <UploadTopBar back="cancel" title="영상 등록" />
  ├── <VideoFileInput onChange={file => ...} />
  │     └── <VideoPreview src={objectURL} aspectRatio="9/16" onClear />
  ├── <GymPickerField value={gymId} onChange />
  │     └── <GymPickerModal />              # 검색 + 결과 리스트
  ├── <ProblemPickerField value={problemId} disabled={!gymId}>
  │     ├── <ProblemPickerModal>             # gymId의 problems 목록
  │     │     └── 표시 형식: "노랑🟡 (V3)"   # section 미표시
  │     └── <NewProblemModal>                # + 새 문제 등록 (4.1 참조)
  │           ├── <ColorPicker />            # 10색 칩 그리드 (필수)
  │           └── <LevelSuggester gymId color value onChange />
  │                 # 색상 선택 시 동일 (gym, color)의 과거 V등급을 default로 자동 설정
  │                 # 사용자가 수동 변경하면 추천 무시
  ├── <RouteTitlePreview color={problemColor} level={problemLevel} />
  │     # formatRouteTitle 결과 라이브 표시 (예: "노랑🟡 (V3)")
  ├── <RouteTagsField value={tags} onChange={setTags}>     # 신설
  │     ├── <WallTypeChips single value onChange />        # 슬랩~동굴 단일 선택
  │     ├── <TechniqueChips multi value onChange />        # 스태틱~매치 다중 선택
  │     └── <CustomTagInput value onChange />              # 콤마 구분 자유 입력
  ├── <FormField label="설명">
  │     └── <textarea />
  └── <SubmitButton onClick uploading progress />
```

### 4.1 V등급 자동 추론 (LevelSuggester)

**원칙:** 같은 암장의 같은 홀드 색상은 보통 같은 V등급. 시스템이 과거 데이터로 default 값을 추론하고, 사용자가 필요하면 즉시 변경 가능.

**구현:**
- 새 문제 모달이 열리고 사용자가 `color`를 선택하면, 이미 메모리에 있는 해당 암장 problems 리스트(3.3 응답)에서 동일 색상 항목을 필터
- 가장 빈번한 `level`(또는 가장 최근) 값을 LevelSelect의 default로 설정
- 동일 색상이 0건이면 default 비움 → 사용자가 V1~V12 중 직접 선택
- 사용자가 LevelSelect를 한 번이라도 직접 변경하면 `userOverridden=true`로 마킹, 이후 색상 변경에도 추천 로직이 사용자 값을 덮어쓰지 않음 (단, 색상 다시 변경 시에는 새 추천을 default로 다시 적용 — 단순화)
- 별도 백엔드 호출 없음 (보강 0)

**검증 (클라이언트):**
- `video` 미선택, `gymId` 미선택, `problemId` 미선택 → 등록 버튼 비활성
- 파일 크기 200MB 초과 → 즉시 에러 메시지
- 새 문제 모달: `color` 미선택 또는 `level` 미선택 → 저장 비활성
- title은 자동 생성으로 항상 존재하므로 검증 대상이 아님

## 5. 상태 / 데이터 모델

```ts
type UploadState = {
  videoFile: File | null;
  videoPreviewUrl: string | null;     // URL.createObjectURL
  description: string;
  gymId: number | null;
  gymName: string;                    // 표시용
  problemId: number | null;
  problemColor: string | null;        // 자동 제목 생성용 (problem 선택/등록 시 함께 보관)
  problemLevel: string | null;        // 자동 제목 생성용
  tags: {
    wall_type: string | null;         // 'slab'|'vertical'|'overhang'|'roof'|'cave'|null
    techniques: string[];             // ['dynamic','heel-hook',...]
    customRaw: string;                // 콤마로 구분된 입력 원문 (전송 시 split/trim)
  };
  uploading: boolean;
  progress: number;                   // 0~100
  error: string | null;
};

// 새 문제 모달 내부 상태
type NewProblemState = {
  color: string | null;
  level: string | null;
  userOverriddenLevel: boolean;       // 사용자가 LevelSelect 수동 변경 여부
};

// 자동 생성: 전송 직전 title = formatRouteTitle({ color, level })
```

**업로드:**
- axios `onUploadProgress` 사용 → progress 갱신
- 성공 시 응답의 `data.id`로 `navigate('/routes/' + id, { replace: true })`
- 페이지 이탈 방지: `videoFile`이 있고 `uploading`이면 `beforeunload` 경고

**`tags` 직렬화 로직 (전송 직전):**
```js
function buildTagsField(tags) {
  const custom = tags.customRaw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const payload = {
    wall_type: tags.wall_type || null,
    techniques: tags.techniques,
    custom,
  };
  // 모두 빈 값이면 form에 추가하지 않음
  if (!payload.wall_type && payload.techniques.length === 0 && custom.length === 0) {
    return null;
  }
  return JSON.stringify(payload);
}
```

**메모리 정리:**
- 컴포넌트 unmount 시 `URL.revokeObjectURL(videoPreviewUrl)`

## 6. 빈 상태 / 에러 / 로딩

| 상태 | 처리 |
|------|------|
| 파일 미선택 | 드롭존 안내 |
| 파일 형식/크기 오류 | 인라인 에러 + 다시 선택 유도 |
| 암장 검색 결과 0건 | 모달 안에 "[+ 새 암장 등록]" 버튼 |
| 문제 목록 0건 | "[+ 새 문제 등록]" CTA 강조 |
| 네트워크 오류 (업로드 중) | 토스트 + 재시도 버튼 (영상은 메모리에 있음) |
| 서버 응답 5xx | 토스트, 진행률 멈춤, 재시도 가능 |

## 7. 추후 인증 도입 시 변경점

- 미인증 시 `/routes/new` 진입 자체 차단 (`<RequireAuth>` 가드)
- `useAuth().user.id`가 자동으로 user_id로 들어감 — 코드 변경 없음
- 업로드 진행률은 그대로

## 7.1 백엔드 보강 항목 (tags 도입에 따른 추가)

문제 타입 태그 저장을 위해:

1. **`ar_routes` 테이블에 `tags` JSON 컬럼 추가**
   - Sequelize 모델 `ArRoute.js`에 `tags: { type: DataTypes.JSON, allowNull: true }`
   - `setupDB`/마이그레이션에서 `ALTER TABLE ar_routes ADD COLUMN tags JSON NULL` (idempotent 체크)
2. **`createRoute` 컨트롤러에서 `tags` 파싱·저장**
   ```js
   const { title, description, problem_id, tags, ar_data } = req.body;
   const parsedTags = tags ? JSON.parse(tags) : null;
   await ArRoute.create({ ..., tags: parsedTags });
   ```
3. **`getRoute`/`listRoutes` 응답에 `tags` 포함** — Sequelize는 컬럼 자동 포함이므로 별도 작업 불필요
4. **추후 필터링** (선택): `GET /api/routes?wall_type=overhang` 또는 `?technique=dynamic` 쿼리 — 본 페이지 범위 외, 향후 검색 페이지에서 검토

## 8. AR 확장 시 변경점 (현재는 미구현)

- VideoPreview 위에 캔버스 레이어 추가 → 클릭으로 손/발 마커 찍기
- 폼에 `ar_data` (JSON) 필드 자동 생성하여 multipart에 포함
- 백엔드는 이미 `ar_data` 컬럼 처리 가능

## 9. 수용 기준

- [ ] 영상 파일 선택 후 9:16 컨테이너에서 미리보기 재생 (가로 영상은 letterbox)
- [ ] 200MB 초과 파일 거부
- [ ] **제목 입력 필드가 화면에 노출되지 않음** (자동 포맷)
- [ ] 영상/암장/문제 미입력 시 등록 버튼 비활성 (제목은 검증 대상 아님)
- [ ] 암장 선택 모달에서 검색·선택
- [ ] 문제 선택 모달의 row 표시는 `노랑🟡 (V3)` 형식, **`section`(벽 정보)는 화면에 일절 노출되지 않음**
- [ ] 새 문제 등록 모달에 **벽(`section`) 입력 항목이 존재하지 않음**
- [ ] 새 문제 등록 모달에서 색상(필수) + V등급 입력 후 저장
- [ ] **색상 선택 시 동일 암장의 과거 동일 색상 V등급이 LevelSelect에 default로 자동 설정**
- [ ] **사용자가 V등급을 수동으로 다른 값으로 변경 시 자동 추천이 사용자 입력을 덮어쓰지 않음**
- [ ] **동일 암장·색상 과거 데이터가 없으면 V등급 빈 상태에서 사용자가 직접 선택**
- [ ] 색상·V등급 입력에 따라 `자동 제목` 미리보기가 라이브 갱신 (예: `노랑🟡 (V3)`)
- [ ] **벽 타입 칩 영역에서 슬랩/버티컬/오버행/루프/동굴 중 하나만 선택 가능 (선택사항)**
- [ ] **무브·기술 칩 영역에서 스태틱~매치 항목을 다중 선택 가능**
- [ ] **기타 키워드 input에 콤마 구분 자유 입력 → 전송 시 trim·빈 항목 제거**
- [ ] 벽 타입·기술·기타 모두 미입력이어도 등록 가능 (모두 선택사항)
- [ ] 등록 클릭 시 진행률 표시 (0→100), title은 자동 포맷 문자열로 multipart에 포함되어 전송
- [ ] **`tags` JSON이 multipart로 함께 전송되고 백엔드 `ar_routes.tags` 컬럼에 저장됨**
- [ ] 성공 시 `/routes/:id`로 이동, 영상 재생 가능
- [ ] 실패 시 입력값 유지 + 재시도 가능
- [ ] 페이지 이탈 시 미저장 경고 (uploading 중)

## 10. 의존 페이지

- ⬅ **01 피드 / EmptyState** / BottomNav `➕`
- ➡ 등록 성공 시 **02 영상 상세** (replace)
- ⤴ **04 암장 목록 / 05 암장 상세**의 데이터 (gym/problem 선택용)

---
task_id: T003
title: 문제 회고(review_tags) + 홀드 색상 자동 감지
slug: problem-review-tags
project: TheRoute
status: done
roles_involved: developer
created: 2026-08-09
updated: 2026-08-16
provenance: git-reconstructed
tags:
  - type/task
  - domain/record
  - domain/photo-annotation
---

# T003 · 문제 회고(review_tags) + 홀드 색상 자동 감지

> ⚠️ **소급 작성 문서**: 실제 세션 기록이 아니라 `feature/problem-review` 브랜치 커밋 17건(2026-08-09)을 역추적해 2026-08-16에 재구성했다. 설계 의도·논의 과정은 복원 불가하며, **코드에서 확인 가능한 사실만** 담았다.

## 배경

기존 문제 사진에는 실패 원인(`failure_tags`, `failure_memo`)만 기록할 수 있었다. T003은 여기에 **"왜 기억에 남았는가"라는 긍정 축을 추가**하고, 사진 위 홀드를 손으로 표시하던 작업을 **색상 기반 자동 감지**로 대체한다.

브랜치: `feature/problem-review` → `main` 머지(`381d164`)

---

## 구현 내용

### 1. DB · 모델 — `review_tags` 컬럼
| 커밋 | 파일 | 변경 |
|------|------|------|
| `a54f44c` | `backend/src/config/setupDB.js` | `climb_log_problem_photos.review_tags VARCHAR(500) NULL` 추가 (`addColumnIfMissing` 멱등 마이그레이션) |
| `9052f7f` | `backend/src/models/ClimbLogProblemPhoto.js` | `review_tags` 필드 추가 |

태그는 **콤마 구분 문자열**로 단일 컬럼에 저장 (정규화 테이블 없음).

### 2. 태그 체계 — `reviewTags.js` (`b608004`)
**파일**: `web/src/utils/reviewTags.js` (88줄)

2그룹 태그 시스템:

| 그룹 | label | 색상 | 태그 |
|------|-------|------|------|
| `positive` | 기억에 남은 이유 | `--success` | `pos_beta`(잘된 베타) · `pos_foot`(발기술 성공) · `pos_read`(루트 리딩) · `pos_power`(파워 활용) · `pos_balance`(밸런스 성공) |
| `improve` | 다음에 고칠 점 | `--warn` | `imp_foot`(발 위치) · `imp_balance`(밸런스/코어) · `imp_reach`(리치/손잡기) · `imp_grip`(그립력) · `imp_power`(파워 부족) · `imp_read`(루트 리딩) |

내보내는 함수: `parseReviewTags()` / `joinReviewTags()` / `reviewTagLabel()` / `reviewTagColor()`

**하위 호환**: `LEGACY_TAG_MAP`이 구 `failure_tags`(`footwork`, `balance`, `reach`, `grip`, `power`, `reading`, `other`)를 신규 `imp_*` 키로 매핑 → 기존 기록이 깨지지 않음.

### 3. 홀드 색상 자동 감지 — `holdDetection.js` (`89670ee`)
**파일**: `web/src/utils/holdDetection.js` (272줄, Canvas 기반, 외부 라이브러리 없음)

파이프라인:
```
사용자가 사진의 홀드 하나를 클릭
  └─ sampleAverageColor(imageData, cx, cy, radius=6)     ← 클릭 지점 평균 RGB 추출
       └─ findSimilarPixelMask(imageData, tr,tg,tb, threshold=50)  ← 유사 색 픽셀 마스크
            └─ findConnectedBlobs(mask, w, h, minArea=80)          ← 연결 요소(blob) 추출
                 └─ blobToCircleAnnotation(blob, canvasW, canvasH) ← 원형 어노테이션 변환
```
진입점: `detectHoldsByColor(imgElement, clickClientX, clickClientY, imgRect, threshold)`

### 4. backend — 읽기/쓰기 · 필터 · 썸네일 (`bc941b8`, `325f5ef`)
**파일**: `backend/src/controllers/climbLogController.js`, `web/src/api/climbLogs.js`

- `uploadProblemPhoto`에 `review_tags` 수신 추가
- 문제 목록 응답에 파생 필드 2개:
  - `first_photo_url` — `(p.photos||[])[0]?.photo_url || null` (썸네일 폴백용)
  - `has_review` — `photos.some(ph => ph.review_tags || ph.failure_tags || ph.failure_memo)`
- 쿼리 파라미터 `has_review=true` 필터 지원

### 5. frontend — UI 연결
| 커밋 | 파일 | 변경 |
|------|------|------|
| `dfe1124` | `ProblemPhotoModal.jsx` | 홀드 색상 감지 모드 + 회고 태그 UI |
| `bf14711` | `RecordEditModal.jsx` | 회고 배지(`review_tags`\|`failure_tags`\|`failure_memo`) + "회고" 버튼 |
| `cb7926b` | `LogDetailPage.jsx` PhotoAnalysis | `review_tags` 표시 + legacy 폴백 + 역할 라벨 |
| `c504ed2` | `RecordsPage.jsx` | `has_review` 필터 칩 + `first_photo_url` 썸네일 폴백 |
| `1c4cfa8` | `TrainingPage.jsx` AnalysisTab | "기억한 문제" 섹션 (`has_review` 필터, limit 10) |

### 6. ProblemPhotoModal 안정화 (머지 후 연속 수정)
이 컴포넌트가 T003에서 가장 손이 많이 간 지점 — blob 상호작용 관련 버그가 반복 발생했다:

| 커밋 | 증상 → 수정 |
|------|------------|
| `4c43898` | 역할 지정 클릭이 재감지를 트리거 → blob `<g>`에 `stopPropagation` |
| `f15c630` | 감지 도구에서 벗어나도 blob이 남음 → 도구 전환 시 `detectedBlobs` 초기화 |
| `8f3d0b4` | blob 좌표 어긋남 → 좌표 변환 수정 + 역할 지정 UX 개선 |
| `e0d780a` | blob 크기 조절 슬라이더 + 선택 상태 시각 표시 추가 |
| `03e4b3a` | `selectedBlobIdx` state 선언 순서 오류 → 순서 수정 + 선택 표시 가시성 개선 |
| `4d75e70` | 최종 리팩터링 (707줄 변경: +471/-239, 현재 786줄) |

---

## 주요 설계 결정

- **태그를 콤마 문자열 단일 컬럼에 저장**: 정규화 테이블 대신 `VARCHAR(500)`. 태그 수가 적고 검색 요구가 단순해 조인 비용을 피함.
- **긍정/개선 2축 분리**: 기존 `failure_tags`(실패 원인)만으로는 "잘된 이유"를 남길 수 없었음. `pos_*`/`imp_*` 접두사로 색상까지 자동 분기(`reviewTagColor`).
- **legacy 폴백 유지**: 구 `failure_tags`를 삭제하지 않고 `LEGACY_TAG_MAP`으로 매핑 — [[T001-sector-record-edit]]의 `style` 컬럼과 동일한 하위 호환 전략.
- **홀드 감지는 순수 Canvas**: 외부 CV 라이브러리 없이 색상 유사도 + 연결 요소 탐색으로 구현. 번들 크기 부담 없음.
- **`has_review`는 저장 컬럼이 아닌 파생 필드**: 3개 필드 중 하나라도 있으면 true. 별도 플래그 관리 불필요.

## 검증 결과

**미확인.** 소급 작성 문서로 당시 빌드·QA 기록이 없다. 다만 머지 후 `8f3d0b4`~`03e4b3a` 4건이 연속 버그 수정인 점으로 보아 **머지 시점에는 실기 검증이 충분치 않았던 것으로 보인다.** ProblemPhotoModal blob 상호작용은 회귀 위험이 남아 있는 영역으로 판단.

## 남은 리스크 / 후속 후보

- `ProblemPhotoModal.jsx` 786줄 단일 컴포넌트 — blob 편집·회고 태그·업로드가 한 파일에 혼재. 분해 후보.
- blob 좌표/선택 로직은 커밋 4건에 걸쳐 수정됨 → **회귀 테스트 없음.** QA 실기 검증 권장.
- `review_tags` `VARCHAR(500)` 상한: 태그 11종 기준 여유 있으나 태그 증가 시 재검토 필요.

## 최종 요약 (사용자용)

**문제 사진에 "회고"를 남기고, 홀드를 색상으로 자동 감지하는 기능이 추가되었습니다.**

- 사진마다 **기억에 남은 이유**(잘된 베타·발기술 성공 등 5종)와 **다음에 고칠 점**(발 위치·그립력 등 6종)을 태그로 기록할 수 있습니다
- 사진 속 홀드 하나를 클릭하면 **같은 색 홀드를 자동으로 찾아 원으로 표시**합니다 (크기 조절 슬라이더 포함)
- 기록 목록에서 "회고 있는 문제"만 필터링할 수 있고, 훈련 페이지에 **"기억한 문제"** 섹션이 생겼습니다
- 기존에 남긴 실패 원인 태그는 새 체계로 자동 매핑되어 그대로 보입니다
- ⚠️ 사진 위 홀드 편집 기능은 머지 이후 버그 수정이 4번 이어진 영역이라, **실제 사용 검증을 한 번 거치시는 것을 권합니다**

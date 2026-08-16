---
task_id: T002
title: 섹터 정보 요약·상세 화면 노출
slug: sector-summary-display
project: TheRoute
status: done
roles_involved: developer
created: 2026-07-19
updated: 2026-08-16
provenance: git-reconstructed
tags:
  - type/task
  - domain/record
  - domain/gym-management
---

# T002 · 섹터 정보 요약·상세 화면 노출

> ⚠️ **소급 작성 문서**: 이 이력서는 실제 세션 기록이 아니라 git 커밋(`b71b816`, 2026-07-19)을 역추적해 2026-08-16에 재구성한 것이다. 설계 의도·논의 과정은 복원 불가하며, 아래 내용은 **코드 diff에서 확인 가능한 사실만** 담고 있다.

## 배경

[[T001-sector-record-edit]]에서 기록 추가/수정 모달의 "벽 형태"를 섹터 선택으로 교체해 `sector_id`를 **저장**할 수 있게 만들었으나, 저장된 섹터가 **조회 화면에 표시되지 않는** 상태였다. T002는 그 표시 경로를 연결한다.

## 구현 내용

### 1. backend — `getLogsByDate` 응답에 섹터 추가
**파일**: `backend/src/controllers/climbLogController.js`

- `Problem` include에 `sector_id` 속성 추가 + `GymSector`(as: `sector`) 중첩 include (`required: false` — 섹터 미지정 문제도 조회되도록 LEFT JOIN 유지)
- 응답 매핑에 `sector_id`, `sector_name` 필드 추가 (`p.problem?.sector?.name || null`)

### 2. frontend — 섹터 배지 표시
| 파일 | 변경 |
|------|------|
| `web/src/components/ClearedSummary.jsx` | 1행에 `sector_name` pill 배지 추가 (기존 `style` 배지 앞) |
| `web/src/pages/LogDetailPage.jsx` | 문제 항목에 `sector_name` pill 배지 추가 |

두 곳 모두 `p.sector_name &&` 조건부 렌더 — 섹터 없으면 배지 자체가 안 나옴 ([[T001-sector-record-edit]]의 "섹터 없으면 미표시" UX 원칙 계승).

### 3. bugfix — `SessionAddModal.jsx` 타입 불일치
```diff
- section_name: sectors.find(s => s.id === a.sector_id)?.name || null,
+ section_name: sectors.find(s => Number(s.id) === a.sector_id)?.name || null,
```
`sectors[].id`와 `a.sector_id`의 타입이 달라 `===` 비교가 실패 → `section_name`이 `null`로 저장되던 버그. `Number()` 캐스팅으로 해결.

## 검증 결과

**미확인.** 소급 작성 문서로, 당시 빌드/실기 검증 기록이 남아 있지 않다. 이후 8월 작업([[T003-problem-review-tags]], [[T004-auth-flow]])이 이 코드 위에 정상 적층된 것으로 보아 최소한 빌드는 통과한 것으로 추정된다.

## 최종 요약 (사용자용)

**기록 요약·상세 화면에 섹터 이름 배지가 표시되도록 연결되었습니다.**

- T001에서 저장만 되던 섹터 정보가 이제 기록 요약(`ClearedSummary`)과 상세 페이지(`LogDetailPage`)에 배지로 노출됩니다
- 섹터가 지정되지 않은 기록에는 배지가 나타나지 않습니다
- 덤으로, 세션 추가 모달에서 섹터 이름이 저장되지 않던 타입 비교 버그를 함께 고쳤습니다

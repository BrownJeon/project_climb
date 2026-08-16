---
task_id: T001
title: 섹터 선택 + 기록 수정 모달 개선
slug: sector-record-edit
project: TheRoute
status: done
roles_involved: developer
created: 2026-07-12
updated: 2026-07-12
tags:
  - type/task
  - domain/gym-management
  - domain/record
---

# T001 · 섹터 선택 + 기록 수정 모달 개선

## 배경 / 요청

암장 관리 화면에서 섹터(A벽, B벽 등)를 등록·관리하는 기능이 이전 세션에서 추가되었음.
이번 세션의 핵심 요청:

> "볼더링 항목에 벽 형태가 아직도 존재하는데, 이것을 각 암장에 등록되어 있는 섹터를 선택할 수 있도록 변경해줘. 암장에 등록된 섹터가 없을 경우 선택항목이 없는 채로 유지해도 돼."

추가로 이전 세션에서 미완료 상태였던 작업들을 포함하여 연속 처리:
- `getLogById` 응답에 `sector_id`, `sector_name` 추가 (이전 세션 완료)
- `updateLogProblem` sector_id 지원 추가 (이번 세션)
- `addLogProblem` sector_id 지원 추가 (이번 세션)
- `RecordEditModal.jsx` 벽 형태 → 섹터 선택 교체 (이번 세션)

---

## 구현 내용

### 1. backend — `updateLogProblem` 수정
**파일**: `backend/src/controllers/climbLogController.js` (line 455~)

- `ClimbLog.findByPk` 쿼리에 `gym_id` 추가 (`attributes: ['user_id', 'gym_id']`)
- `sector_id` 파라미터 수신 처리:
  - `problem_id`가 있으면 → `Problem.update({ sector_id })` 호출
  - `problem_id`가 null(커스텀 항목)이고 `newSectorId`와 `gym_id`가 있으면 → Problem 레코드 생성 후 `cp.problem_id` 링크
- 빈 업데이트 체크 조건에 `!sectorIdProvided` 추가

```js
if (sectorIdProvided) {
  if (cp.problem_id) {
    await Problem.update({ sector_id: newSectorId }, { where: { id: cp.problem_id } });
  } else if (newSectorId && parent.gym_id) {
    const problem = await Problem.create({
      gym_id: parent.gym_id, sector_id: newSectorId,
      color: cp.custom_color || null, level: cp.custom_level || null, section: null,
    });
    await cp.update({ problem_id: problem.id });
  }
}
```

### 2. backend — `addLogProblem` 수정
**파일**: `backend/src/controllers/climbLogController.js` (line 538~)

- `sector_id`, `gym_id` 파라미터 추가 수신
- `ClimbLog.findByPk` 쿼리에 `gym_id` 추가
- `sector_id`가 있으면 Problem 레코드 생성 후 `problem_id`에 링크:
  - 링크된 경우: `custom_color`/`custom_level`은 null (Problem에서 color/level 조회)
  - 링크 안 된 경우: 기존 커스텀 항목 흐름 유지

```js
let linkedProblemId = null;
if (sector_id && gymId) {
  const problem = await Problem.create({ gym_id: gymId, sector_id, color, level, section: null });
  linkedProblemId = problem.id;
}
const cp = await ClimbLogProblem.create({
  problem_id: linkedProblemId,
  custom_color: linkedProblemId ? null : (color || null),
  custom_level: linkedProblemId ? null : (level || null),
  ...
});
```

### 3. frontend — `RecordEditModal.jsx` 전면 개선
**파일**: `web/src/components/modals/RecordEditModal.jsx`

| 변경 위치 | 이전 | 이후 |
|-----------|------|------|
| import | `STYLE_KEYS, styleMeta` from utils/style | `gymSectorsApi` from api/gymSectors |
| state | (없음) | `sectors` useState([]) |
| useEffect | (없음) | `gymSectorsApi.list(initial.gym_id)` 로드 |
| `problemToEntry()` | `_origStyle`, `style` | `_origSectorId`, `sector_id` |
| `addEntry()` | `style: ''` | `sector_id: null` |
| handleSave 신규 | `style: e.style` 전송 | `sector_id`, `gym_id` 전송 |
| handleSave 기존 | `style` 변경 감지 | `sector_id` 변경 감지 |
| JSX 볼더링 | "벽 형태" select (슬랩/오버/복합) | 섹터 select (sectors.length > 0 조건부 렌더) |

---

## 데이터 흐름 요약

```
RecordEditModal 열림
  └─ initial.gym_id 있으면 gymSectorsApi.list() 호출
       └─ sectors[] 로드 → 볼더링 항목에 섹터 드롭다운 표시

사용자 섹터 선택 후 저장
  ├─ 기존 항목: climbLogsApi.updateProblem(logId, cpId, { sector_id })
  │     └─ updateLogProblem:
  │           ├─ problem_id 있음 → Problem.update({ sector_id })
  │           └─ problem_id 없음 → Problem.create({ gym_id, sector_id }) + cp.problem_id 링크
  └─ 신규 항목: climbLogsApi.addProblem(logId, { sector_id, gym_id })
        └─ addLogProblem:
              ├─ sector_id 있음 → Problem.create() + problem_id 링크
              └─ sector_id 없음 → 기존 커스텀 항목 (problem_id: null)
```

---

## 주요 설계 결정

- **sector_id는 Problem 테이블에 저장**: ClimbLogProblem에 직접 컬럼을 추가하지 않고 기존 구조 활용
- **커스텀 항목에 섹터 지정 시 Problem 레코드 자동 생성**: problem_id가 null인 항목도 섹터 선택 가능하도록 처리
- **style 컬럼 유지**: DB/백엔드에서 style 컬럼은 하위 호환성을 위해 유지. UI에서만 제거.
- **섹터 없으면 드롭다운 미표시**: `sectors.length > 0` 조건부 렌더로 깔끔한 UX

---

## 검증 결과

- `pm2 restart theroute-api --update-env` → `[setupDB] 완료`, 서버 정상 기동
- `npm run build` → 142 modules transformed, 빌드 성공 (오류/경고 없음)

---

## 최종 요약 (사용자용)

**볼더링 기록 추가/수정 모달에서 "벽 형태"(슬랩/오버/복합) 선택이 제거되고, 암장에 등록된 섹터를 선택하는 드롭다운으로 교체되었습니다.**

- 암장에 등록된 섹터가 있을 때만 드롭다운이 표시됩니다 (섹터 없으면 항목 자체가 안 보임)
- 기존 기록 수정 시 섹터를 변경하면 백엔드 Problem 테이블의 sector_id가 즉시 업데이트됩니다
- 새 항목 추가 시 섹터를 선택하면 Problem 레코드가 자동 생성되어 sector_id가 저장됩니다
- 섹터를 선택하지 않은 기존 커스텀 항목(벽 형태만 있던 기록)은 그대로 유지됩니다

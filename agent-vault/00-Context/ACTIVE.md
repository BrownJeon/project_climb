---
project: TheRoute
updated: 2026-07-12
tags:
  - type/context
---
# 현재 상태

## 지금 상태

암장관리 3대 개선(섹터 관리, 문제 세팅주기 캘린더, 기간별 통계) 구현 완료.
- 섹터 CRUD + 스케줄(주기) 등록·캘린더 표시 → Done
- 통계 탭(난이도/색상/섹터별) → Done
- 볼더링 기록 추가/수정 모달의 "벽 형태" → "섹터 선택"으로 교체 → Done (T001)

## 다음 할 일

- 브라우저 실기 검증: 섹터 드롭다운 노출, 저장 후 sector_id DB 반영 확인
- nginx vhost 활성화 (climb.미라클펭귄.com) — memory project_theroute.md 참조

## 열린 결정

- style 컬럼(ClimbLogProblem)은 하위 호환 유지 중. 제거 여부는 추후 판단.

---
tags:
  - type/board
---
# 칸반 보드

## Backlog

> 🅿️ **보류 (사용자 판단 2026-08-16)**: 모바일 앱 관련 작업은 당분간 진행하지 않고 **웹 우선**으로 간다. 아래 모바일 항목은 알려진 이슈로 남겨둔 것이며, 모바일 재개 시점에 Todo로 승격한다.

- 🅿️ **모바일 SNS 로그인 404** — `POST /auth/sns` 제거됐으나 `mobile/src/api/auth.js:8`이 계속 호출. 모바일 로그인 전면 불가 상태. 복구 시 선택지: ① 라우트 복원 ② 신규 OAuth로 이관 ([[T004-auth-flow]])
- `ProblemPhotoModal.jsx`(786줄) 컴포넌트 분해 — blob 편집·회고 태그·업로드 혼재. 기능은 정상 확인됨([[T006-blob-edit-verification]])이므로 순수 구조 개선 과제 ([[T003-problem-review-tags]])
- 저장 데이터에 내부 플래그 `_detected: true`가 DB에 영속화됨 — 의도 확인 필요 ([[T006-blob-edit-verification]])
- 이메일/비밀번호 로그인 사용 불가 — 두 계정 모두 `password` NULL, `seedOwnerCredentials()` 미실행. 사용 계획 시 `OWNER_EMAIL`/`OWNER_PASSWORD` 설정 필요 ([[T004-auth-flow]])

## Todo

- `JWT_SECRET` 처리 일원화 + 기동 시 fail-fast — **우선순위 낮음** (`.env`에 이미 설정돼 실질 위험 없음). `routes/auth.js`·`authController.js`는 `'theroute-dev-secret'` 폴백이 있고 `middleware/auth.js`는 없어, env 누락 시 서명/검증 불일치로 인증 전체가 깨지는 구조 ([[T004-auth-flow]])

## Doing

## Review

## Done

- [[T006-blob-edit-verification]] · 홀드 감지 blob 편집 실기 검증 — 결함 0건 (2026-08-16)
- [[T005-remove-kakao-login]] · 카카오 로그인 제거 (지도 API는 유지) (2026-08-16)
- [[T004-auth-flow]] · 웹 인증 플로우 (이메일/비밀번호 + OAuth) (2026-08-09)
- [[T003-problem-review-tags]] · 문제 회고(review_tags) + 홀드 색상 자동 감지 (2026-08-09)
- [[T002-sector-summary-display]] · 섹터 정보 요약·상세 화면 노출 (2026-07-19)
- [[T001-sector-record-edit]] · 볼더링 기록 모달 벽 형태 → 섹터 선택 교체 (2026-07-12)

---
project: TheRoute
updated: 2026-08-16
tags:
  - type/context
---
# 현재 상태

## 지금 상태

**섹터 기능 라인 (7월) — 완료**
- 섹터 CRUD + 스케줄(주기) 캘린더 + 통계 탭 → Done
- 기록 모달 "벽 형태" → 섹터 선택 교체 → Done ([[T001-sector-record-edit]])
- 섹터 이름 배지를 요약·상세 화면에 노출 → Done ([[T002-sector-summary-display]])

**문제 회고 라인 (8월) — 완료, 검증 미흡**
- `review_tags` 2그룹 태그(기억에 남은 이유 / 다음에 고칠 점) + legacy 폴백 → Done
- Canvas 기반 홀드 색상 자동 감지(`holdDetection.js`) → Done
- `has_review` 필터 · 훈련 페이지 "기억한 문제" 섹션 → Done ([[T003-problem-review-tags]])
- ⚠️ 머지 후 blob 상호작용 버그 수정 4건 연속 — 실기 검증 필요

**웹 인증 라인 (8월) — 완료, 회귀 있음**
- 이메일 가입/로그인 + Google·GitHub OAuth(공용 패키지 `@workspace/auth-oauth`) → Done ([[T004-auth-flow]])
- ⚠️ **모바일 SNS 로그인 파손** — `POST /auth/sns` 제거됨, 모바일은 계속 호출 중

**인프라**
- nginx vhost `climb.xn--lh0b87pnudm10a4vd.com.conf` 활성 확인 (2026-08-16) — 기존 "다음 할 일" 항목이었으나 이미 완료 상태였음

## 작업 방침

**웹 우선 (사용자 판단 2026-08-16)** — 모바일 앱(`mobile/`) 작업은 당분간 보류. 모바일 SNS 로그인이 파손된 상태이나 의도적으로 미해결로 둔다. 모바일 재개 시 [[board]] Backlog의 🅿️ 항목부터 확인할 것.

## 다음 할 일

우선순위 순 — 상세는 [[board]] Todo 참조.

1. **[높음] 카카오 로그인 경로 확보** — 기획서상 주요 로그인 수단인데 웹에도 없음 (웹 우선 방침에서도 유효)
2. 홀드 감지 blob 편집 실기 검증 (QA)
3. `JWT_SECRET` 하드코딩 폴백 제거 + fail-fast

## 열린 결정

- `style` 컬럼(ClimbLogProblem)은 하위 호환 유지 중. 제거 여부 추후 판단. (동일 전략이 `failure_tags` → `LEGACY_TAG_MAP`에도 적용됨)
- `@workspace/auth-oauth`가 `file:../../shared/auth-oauth` — 저장소 외부 의존. 배포·CI에서 해당 경로 보장 방식 미정.
- 모바일 앱의 향후 처우 — 보류 중이나 폐기인지 일시 중단인지 미정. `mobile/` 코드는 그대로 유지 중.

## 문서 이력 주의

T002·T003·T004 이력서는 **2026-08-16에 git 커밋을 역추적해 소급 작성**한 것(frontmatter `provenance: git-reconstructed`). 각 문서의 "검증 결과" 절은 당시 실제 검증 기록이 아니므로 그대로 신뢰하지 말 것. T001만 실시간 작성분.

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

**문제 회고 라인 (8월) — 완료, 검증까지 통과**
- `review_tags` 2그룹 태그(기억에 남은 이유 / 다음에 고칠 점) + legacy 폴백 → Done
- Canvas 기반 홀드 색상 자동 감지(`holdDetection.js`) → Done
- `has_review` 필터 · 훈련 페이지 "기억한 문제" 섹션 → Done ([[T003-problem-review-tags]])
- ✅ 머지 후 버그 수정 4건이 연속됐던 blob 상호작용을 **운영에서 실기 검증 — 결함 0건** ([[T006-blob-edit-verification]])
  - 홀드 감지는 **1초 롱프레스** 인터랙션. blob 좌표는 퍼센트 정규화(0–100), SVG에 viewBox 없음

**웹 인증 라인 (8월) — 완료, 회귀 있음**
- 이메일 가입/로그인 + Google·GitHub OAuth(공용 패키지 `@workspace/auth-oauth`) → Done ([[T004-auth-flow]])
- ⚠️ **모바일 SNS 로그인 파손** — `POST /auth/sns` 제거됨, 모바일은 계속 호출 중

**카카오 로그인 제거 (8/16) — 완료**
- 사용자 결정: 카카오 로그인은 구현하지 않고 **제거**. `sns_provider` ENUM에서 `kakao` 삭제, 모바일 로그인 버튼·`getKakaoProfile` 제거 → Done ([[T005-remove-kakao-login]])
- ⚠️ **카카오 지도 API(`KAKAO_REST_API_KEY`)는 유지** — 암장 위치 검색 실사용. 향후 "카카오 제거" 작업 시 반드시 구분할 것

**인프라**
- nginx vhost `climb.xn--lh0b87pnudm10a4vd.com.conf` 활성 확인 (2026-08-16) — 기존 "다음 할 일" 항목이었으나 이미 완료 상태였음

## 작업 방침

**웹 우선 (사용자 판단 2026-08-16)** — 모바일 앱(`mobile/`) 작업은 당분간 보류. 모바일 SNS 로그인이 파손된 상태이나 의도적으로 미해결로 둔다. 모바일 재개 시 [[board]] Backlog의 🅿️ 항목부터 확인할 것.

## 다음 할 일

우선순위 순 — 상세는 [[board]] Todo 참조.

1. `JWT_SECRET` 처리 일원화 + fail-fast — **우선순위 낮음**. `backend/.env`에 이미 설정돼 있어 실질 위험 없음. 다만 세 파일(`routes/auth.js`·`authController.js`는 폴백 有, `middleware/auth.js`는 폴백 無)의 처리가 불일치해 env 누락 시 인증이 전부 깨지는 구조.

> 급한 과제가 사실상 비었다. 다음 세션은 새 기능 방향을 사용자와 정하는 것부터 시작하는 게 맞다.

## 검증 환경 메모 (재사용)

- 운영 웹 검증 가능: vhost → `127.0.0.1:3100` 프록시, `web/dist` 존재, Chrome DevTools MCP로 조작
- **자동화 브라우저는 사용자 로그인 세션과 분리**되어 있다. 두 계정 모두 `password` NULL이라 폼 로그인 불가 → 앱 `JWT_SECRET`으로 단기 토큰을 발급해 `localStorage.theroute_token`에 주입하는 방식으로 진입 (사용자 승인 필요, 권한 분류기가 기본 차단함)
- 운영 데이터를 건드리는 검증은 **착수 직전 백업을 별도로** 남길 것 ([[T006-blob-edit-verification]]의 사고 참조)

## 열린 결정

- `style` 컬럼(ClimbLogProblem)은 하위 호환 유지 중. 제거 여부 추후 판단. (동일 전략이 `failure_tags` → `LEGACY_TAG_MAP`에도 적용됨)
- `@workspace/auth-oauth`가 `file:../../shared/auth-oauth` — 저장소 외부 의존. 배포·CI에서 해당 경로 보장 방식 미정.
- 모바일 앱의 향후 처우 — 보류 중이나 폐기인지 일시 중단인지 미정. `mobile/` 코드는 그대로 유지 중.

## 문서 이력 주의

T002·T003·T004 이력서는 **2026-08-16에 git 커밋을 역추적해 소급 작성**한 것(frontmatter `provenance: git-reconstructed`). 각 문서의 "검증 결과" 절은 당시 실제 검증 기록이 아니므로 그대로 신뢰하지 말 것. T001만 실시간 작성분.

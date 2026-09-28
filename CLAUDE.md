# TheRoute 프로젝트

**더 루트 (The Route)** - 클라이머를 위한 소셜 네트워킹 및 AR 루트 공유 플랫폼

## 프로젝트 개요

클라이밍 문제(루트) 공략법을 AR로 공유하고, 클라이머 간 소통을 지원하는 모바일 앱.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 모바일 | React Native (Expo) |
| 백엔드 | Node.js + Express |
| 데이터베이스 | MariaDB (Synology NAS) |
| AR | ViroReact / expo-camera + canvas overlay |
| 인증 | JWT + SNS OAuth (Google, GitHub) |
| 미디어 저장 | AWS S3 or NAS 로컬 스토리지 |

## 디렉토리 구조

```
TheRoute/
├── 기획서_V0.1.md
├── CLAUDE.md
├── docs/
│   ├── architecture.md       # 아키텍처 설계
│   └── db-schema.md          # DB 스키마 설계
├── backend/                  # Node.js API 서버
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── config/           # DB 연결, 환경설정
│       ├── routes/           # API 라우터
│       ├── controllers/      # 비즈니스 로직
│       ├── models/           # DB 모델 (Sequelize)
│       └── middleware/       # 인증, 에러 핸들링
└── mobile/                   # React Native 앱
    ├── src/
    │   ├── screens/          # 화면 컴포넌트
    │   ├── components/       # 공통 컴포넌트
    │   ├── navigation/       # 네비게이션 설정
    │   ├── store/            # 상태 관리 (Zustand)
    │   ├── api/              # API 호출 레이어
    │   └── utils/            # 유틸리티
    └── assets/
```

## DB 연결 규정

- **엔진:** MariaDB (Synology NAS)
- **환경 변수:** `.env` 파일로 관리 (절대 하드코딩 금지)
- **Connection Pool + Retry 로직** 필수 적용

## 주요 기능 (MVP v1.0)

1. **사용자 시스템** - SNS 로그인, 프로필, 마이페이지
2. **클라이밍장 탐색** - 위치 기반 검색, 암장 상세 정보
3. **AR 공략 시스템** - 영상 위 AR 루트 그리기/공유 (핵심)
4. **소셜 피드** - 팔로우 피드, 좋아요, 댓글

## 코딩 규칙

- API 응답 형식: `{ success: boolean, data: any, message: string }`
- 에러는 미들웨어에서 중앙 처리
- 모든 DB 쿼리는 Sequelize ORM 사용
- 민감 정보는 반드시 .env로 관리

## 빠른 시작

**백엔드** (pm2로 운영 중, 보통 재시작 불필요):
```bash
pm2 restart theroute-api --update-env   # 재시작 필요 시
pm2 logs theroute-api                   # 로그 확인
```
- 포트: 3100, 프로세스명: `theroute-api`

**웹(`web/`, Vite+React)** — backend 가 `web/dist` 를 직접 `express.static` 으로 서빙(별도 서빙
경로 없음, `backend/src/index.js`). NFS가 `noexec` 라 `vite build`는 NFS 위에서 못 돈다 — ext4
미러(`~/.node-local/theroute-web-work`)에서 빌드한 뒤 산출물을 NFS `web/dist` 로 되돌려 복사한다.
`git push`로 자동 배포 시 `webhook-deploy/deploy-climb.sh`(2026-09-19 갱신)가 이 절차를 그대로
수행한다 — **수동으로 `web/dist`를 복사해 둘 필요 없음.** 로컬 개발 실행만 필요하면:
```bash
rsync -a web/src/ ~/.node-local/theroute-web-work/src/ --delete
cd ~/.node-local/theroute-web-work && npm run dev   # http://localhost:5173 (또는 vite 기본 포트)
```

**모바일 앱** (Claude 터미널은 비대화형 → 사용자가 직접 실행):
```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile
REACT_NATIVE_PACKAGER_HOSTNAME=125.177.194.26 npx expo start --lan --clear
```
- Expo Go 접속: `exp://125.177.194.26:8081`

## 현재 완료 항목

- 백엔드 API 전체 + JWT 인증 (카카오/구글/비회원 로그인)
- 모바일 5개 탭 화면: HomeScreen, ExploreScreen, CommunityScreen(캘린더), NotificationScreen(이용권), MyPageScreen
- 추가 API: `/api/climb-logs`, `/api/passes`

**현재 상태 및 다음 작업은 memory `project_theroute.md` 참조**

## 배포

배포 절차의 **정본은 [`docs/deploy-order.md`](docs/deploy-order.md)** 다. 배포 전에 그 문서를 먼저 읽는다.

| 항목 | 값 |
|---|---|
| 배포 명령 | `scripts/deploy.sh TheRoute` |
| 실행 주체 | `.claude/agents/deployer.md` (QA PASS 이후에만 기동) |
| 대상 프로세스 | theroute-api |
| 현재 상태 | ✅ **blue/green 컷오버 완료 (2026-09-19, 릴리스 `20260919-223933-51ae8e9e`)**. 배포는 `scripts/deploy.sh` 로만 한다 — 종전의 "NFS/미러에 빌드하면 반영" 은 더 이상 동작하지 않는다 |

- 배포는 **`origin` 의 ref 기준**이다 — push 되지 않은 커밋은 나가지 않는다.
- `--with-migrate`(DB 마이그레이션)는 **사용자 승인 사항**이다. 개발과 운영이 같은 NAS MariaDB 를 보고, 롤백은 코드만 되돌린다.
- 배포 실패로 수정했다면 곧바로 재배포하지 않고 **Reviewer 부터 전체 재순환**한다.

워크스페이스 공통: [배포 메커니즘](../docs/dev-deploy-workflow.md) · [연계 정책](../docs/deployer-integration-procedure.md) · [롤아웃 순서](../docs/deploy-rollout-order.md)

## 에이전트 팀 세션 프로토콜

이 CLAUDE.md 로드 및 현재 상태 요약 완료 후, 아래 팀 소집 문구를 자동 출력한다.

```
---
🚀 에이전트 팀 소집
프로젝트: 클라이밍기록 (TheRoute)
팀 구성:
  - leader    (Opus)   — 사양 해석·작업 분배·Agent Vault 이력 큐레이션·최종 보고
  - designer  (Opus)   — 화면 설계·API 호출 계획·구현 가이드 산출
  - developer (Opus)   — web/src(React)·backend/src(Express) 구현
  - reviewer  (Sonnet) — 의도 검증 + 인증 분기·타인 데이터 노출·조용한 실패 독립 감사
  - qa        (Haiku)  — 체크리스트 실행 검증 (배포 게이트)
  - deployer  (Haiku)  — QA PASS 후 scripts/deploy.sh 로 운영 배포 (선결 과제 4건 미해소 — deploy.yml 주석 참고)
  - judge     (Haiku)  — Jev 판정: 작업 접수 분류·developer 모델·Codex 개입(C1 설계·C2 리뷰 후·C3 재발)
  - codex     (Haiku)  — judge 판정 시에만 Codex 읽기 전용 외부 검토, 실패는 보고 후 진행

워크플로우: Leader(→Judge 접수) → Designer → [Judge C1 → Codex?] → Developer → Reviewer → [Judge C2 → Codex? → Reviewer 판정] → QA → Deployer → Leader
  ※ QA 결함·배포 실패 시 Developer 수정 후 **Reviewer부터** 재순환합니다.
작업 지시 방법:
  → leader에게 요청하면 팀이 역할별로 분담해서 처리합니다.
  → 팀 정리 시: "팀 정리해줘" 또는 "Clean up the team"
---
```

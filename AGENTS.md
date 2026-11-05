<!-- TASK-TOOL-CONTEXT:BEGIN -->
## 작업문서의 시작 도구·현재 담당·적용 절차 (2026-11-05)

새 작업문서 작성·기존 작업 재개·주 작업 인수 시 `execution_context`와 본문의 `실행 도구·절차 이력`을 확인·기록한다. 필드는 `schema_version: 1`, `origin_tool`, `current_tool`, `current_procedure`, `current_scope`, `last_event_id`다. 도구 값은 `codex | claude | unknown`, 절차 값은 `codex_scoped | claude_standard | unknown`이다.

- `origin_tool`은 최초 시작 도구로 보존한다. `current_tool`은 현재 주 작업을 실제 인수한 도구이며, 현재 절차는 최초 도구만이 아니라 **현재 주 작업 담당과 인수 범위**로 판단한다.
- 현재 Codex 담당이면 `codex_scoped`: 분석·설계와 명시적으로 맡긴 작은 구현, 필요한 구현·최종 테스트·검증·배포는 Claude에 인계한다. 현재 Claude 담당이면 `claude_standard`: 기존 Claude의 분석부터 배포까지 작업 방식을 유지한다. Claude 시작 → Codex 주 작업 인수 → Claude 재인수도 최초 시작값은 바꾸지 않고 단계별로 기록한다.
- 인계 요청·문서 열람·다른 도구의 검토/서브에이전트 호출만으로 현재 담당을 바꾸지 않는다. 실제 주 작업 인수 때 현재 메타데이터를 갱신하고 시각·이전/현재 도구·적용 절차·맡은 범위·사용자 지시/수신 근거·남은 일을 이력에 append한다. 이미 허용된 인수를 재승인받지 않으며, 실제 범위가 불명확할 때만 질문한다.
- 과거 시작 도구를 추측하지 않는다. 확인 불가하면 `origin_tool: unknown`과 이유를 남기고 현재 담당은 실제 근거대로 기록한다. 나중에 근거를 찾으면 정정 이력을 추가한다. 과거 task 전체 일괄 수정이나 완료/승인 상태 변경은 하지 않는다.
- 공통 실행 메타데이터와 전환 이력은 현재 메인 세션/조율 역할이 관리한다. 자식 역할은 자기 기록의 실제 실행 도구만 밝히며 다른 역할 기록을 대리 작성하지 않는다. 기존 승인·데모·운영·회사 자료 전송 제한을 이 필드로 대체하거나 우회하지 않는다.

정본: 워크스페이스 루트의 `docs/task-tool-context.md` 및 `docs/agent-vault-protocol.md`. 이 기록 규칙은 적용하되, 상세 역할 재정의·자동 인계 실행기의 변경은 기존처럼 사용자 초안 검토 후 진행한다.
<!-- TASK-TOOL-CONTEXT:END -->

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
├── AGENTS.md
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

**모바일 앱** (Codex 터미널은 비대화형 → 사용자가 직접 실행):
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

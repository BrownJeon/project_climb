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
| 인증 | JWT + SNS OAuth (Google, Kakao) |
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

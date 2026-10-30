# TheRoute 프로젝트

**더 루트 (The Route)** - 클라이머를 위한 소셜 네트워킹 및 AR 루트 공유 플랫폼

## 프로젝트 개요

클라이밍 문제(루트) 공략법을 AR로 공유하고, 클라이머 간 소통을 지원하는 모바일 앱.

## 기술 스택

| 영역 | 기술 |
|------|------|
| 모바일 | Capacitor 7 안드로이드 셸 (운영 웹을 WebView 로 로드, `mobile/`) |
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
└── mobile/                   # Capacitor 7 안드로이드 셸 (T009, 아래 "모바일 앱" 절)
    ├── capacitor.config.ts   # 앱 정체성·server.url — 바꾸면 네이티브 변경
    ├── app-shell/index.html  # 연결 실패 안내(APK 안 독립 파일 — 바꾸면 네이티브 변경)
    ├── android/              # 안드로이드 프로젝트(소스만 커밋 — APK·키스토어·빌드 산출물은 gitignore)
    └── scripts/              # build-apk.sh · sync-local.sh · gen-app-icons.mjs · expected-cert-sha256.txt
```
웹 쪽 앱 연결부는 `web/src/native/`(브리지·앱 로그인·뒤로가기) — 웹 코드는 `@capacitor/*` 를 import 하지 않는다.

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

**모바일 앱 (APK)** — 아래 "모바일 앱 (더 루트)" 절. 옛 React Native Expo 앱(`expo start`)은 2026-10-30 삭제했다.

## 현재 완료 항목

- 백엔드 API 전체 + JWT 인증 (카카오/구글/비회원 로그인)
- (옛 React Native 모바일 5개 탭 화면은 폐기·삭제 — 웹 SPA 가 단일 진실, 앱은 Capacitor 셸)
- 추가 API: `/api/climb-logs`, `/api/passes`

**현재 상태 및 다음 작업은 memory `project_theroute.md` 참조**

## 모바일 앱 (더 루트)

안드로이드 앱 **"더 루트"**(T009)는 Capacitor 7 **원격 URL 셸**이다 — 운영 웹(`climb.미라클펭귄.com`)을 WebView 로 띄우는 껍데기이고 화면·API 는 서버에 그대로 있다.

| 항목 | 값 |
|---|---|
| appId / 앱 이름 | `com.miraclepenguin.theroute` / 더 루트 (첫 설치 뒤에는 appId 를 바꿀 수 없다) |
| 로드 주소 | `server.url` = `https://climb.xn--lh0b87pnudm10a4vd.com`(퓨니코드), `androidScheme: 'https'`, `allowNavigation` 없음 — `mobile/capacitor.config.ts` |
| 버전 | `mobile/android/app/build.gradle` 의 `routeVersionCode`·`routeVersionName` — 줄어들면 안 된다. 현재 1 / 1.0.0 |
| 서명 키 | 전용 키스토어 `~/.android/theroute-release.keystore`·서명 설정 `~/.android/theroute-signing.env`(권한 600, 저장소 밖), 백업 `NFS/homes/brownjeon/backup/android-signing/theroute/`. **경로만 적는다 — 비밀번호·값은 어떤 문서·로그에도 적지 않는다.** 키를 잃으면 덮어쓰기 설치가 막히고, 새면 위조 업데이트가 가능하다. 디버그 키로는 서명되지 않는다(`build.gradle` 가드) |
| 인증서 SHA-256(공개 정보) | `BA:B3:EF:3F:68:8D:8E:47:0B:F1:38:9A:C6:F9:76:17:C4:1F:3E:69:D8:D5:D5:26:55:9B:8C:E9:C1:F5:38:CE` — `build-apk.sh` 가 다르면 실패한다(`mobile/scripts/expected-cert-sha256.txt`) |
| 빌드 | `bash mobile/scripts/build-apk.sh` — 우분투, JDK 21, `ANDROID_HOME=~/.node-local/android-sdk`, 작업 디렉터리 `~/.node-local/theroute-mobile`(`THEROUTE_APK_WORK`). **스스로 무거운 작업 잠금을 잡으므로 바깥에서 같은 잠금으로 감싸지 않는다**(감쌀 때만 `THEROUTE_HEAVY_LOCK_HELD=1`). 출력은 로그 파일로(파이프로 자르면 SIGPIPE). 중단하려면 자식(gradle) 프로세스까지 PID 로 종료 |
| 전달 | 직접 전달(사이드로드). DB·다운로드 페이지 없음 |

- **웹 변경 = 웹 배포**(push=배포). **네이티브 변경** — `mobile/android/**`·`capacitor.config.ts`·`AndroidManifest.xml`·아이콘·`app-shell/index.html`·`@capacitor/*` 추가·버전 변경 — 은 웹 배포로 반영되지 않는다: **APK 재빌드 + `routeVersionCode` 증가 + 사용자 재설치**. 착수 전에 사용자에게 "재설치 필요"를 먼저 알린다.
- 앱/웹 분기는 `window.Capacitor`(`web/src/native/bridge.js`)로 하는 **화면 표시 전용**이다. 웹 코드는 `@capacitor/*` 를 import 하지 않고, 앱 판별을 서버 권한 판단에 쓰지 않는다(누구나 흉내 낼 수 있다).
- **앱 로그인**: Google 은 WebView 안 로그인을 거부하므로 Custom Tab(외부 브라우저) + 60초 1회용 코드 + PKCE(S256) + 딥링크 `theroute://auth/callback` → `POST /api/auth/app-exchange {code, verifier}`. 서버 코드는 메모리 저장소(DB 없음, pm2 단일 프로세스 전제). **설계 한계**: 악성 앱이 자기 challenge 로 직접 시작한 로그인 흐름은 PKCE 로 막지 못한다 — 근본 대책은 Android App Links(후속 과제).
- 정본: 개정 문서 `docs/superpowers/plans/2026-10-30-android-apk-addendum.md`(09-18 계획·스펙보다 우선) · 스펙 `docs/superpowers/specs/2026-09-18-android-apk-design.md` · task `agent-vault/10-Flow/tasks/T009-android-apk.md` · 승인 데모 `docs/demo/T009-android-apk-v1.html`.

## 배포

배포 절차의 **정본은 [`docs/deploy-order.md`](docs/deploy-order.md)** 다. 배포 전에 그 문서를 먼저 읽는다.

| 항목 | 값 |
|---|---|
| 배포 명령 | `scripts/deploy.sh TheRoute` |
| 실행 주체 | `.claude/agents/deployer.md` (QA PASS 이후에만 기동) |
| 대상 프로세스 | theroute-api |
| 현재 상태 | ✅ **blue/green 컷오버 완료 (2026-09-19, 릴리스 `20260919-223933-51ae8e9e`)**. 종전의 "NFS/미러에 빌드하면 반영" 은 더 이상 동작하지 않는다. **2026-10-30 실측: Gitea webhook(`project_climb`, hook id 5)이 살아 있어 `git push` 가 곧 blue/green 배포다**(수신기 매핑 `~/.local/webhook-deploy/server.js`, 로그 `project_climb.log` 마지막 갱신 10-04 23:22 = 현재 릴리스 `20261004-232235-84456285` 생성 시각). `scripts/deploy.sh TheRoute` 를 push 와 따로 돌리면 이중 배포이므로 둘 중 하나만 쓴다 — 이전 문구("deploy.sh 로만")는 낡았다 |

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

화면 신규·구조 변경 작업은 데모 검토 게이트(워크스페이스 [`docs/demo-review-gate.md`](../docs/demo-review-gate.md))를 거친다 — designer 버전별 데모(`docs/demo/<task-id>-<slug>-v<N>.html`) → 사용자 승인 → 구현 (2026-09-28, ADP-001 D-09).

## AI 대화·작업 공통 원칙 (할루시네이션 방지·명확한 소통)

> 워크스페이스 `CLAUDE.md`의 같은 이름 절과 동일한 내용이다(2026-10-05 사용자 지시). 정본은 워크스페이스 쪽이며, 바꿀 때는 정본을 먼저 고치고 이 절을 맞춘다. 메인 세션과 서브에이전트 모두에 적용한다.

1. **동의로 시작하지 않는다.** 첫 문장에서 사용자의 가정에 의문을 제기하거나, 놓친 점을 짚거나, 생각의 허점을 드러내는 질문을 한다.
2. **확신 수준을 표시한다.** 주장 앞에 `[확실]`(근거가 확실) · `[가능성 높음]`(강한 추론) · `[추측]`(빈틈을 추측으로 메우는 중)을 붙인다. 답변 대부분이 추측이면 먼저 그렇게 밝힌다.
3. **금지 표현:** '좋은 질문이에요', '전적으로 맞아요', '말씀하신 게 맞습니다', '정말 그렇습니다', '분명히 그렇습니다'. 쓰려는 걸 알아차리면 지우고 다시 쓴다.
4. **반대는 논리적으로 설명한다.** 사용자가 틀렸다면 "이런 이유로 동의하기 어렵습니다. 대신 이 방법을 권합니다: [대안]. 지금 접근법의 구체적인 위험은 [단점]입니다." 형태로 말한다.
5. **중요한 답부터, 불편한 사실도 먼저.** 사용자가 듣고 싶어 하지 않을 사실은 세 번째 문단에 숨기지 않고 앞에 둔다.
6. **서론을 길게 쓰지 않는다.** "여러 관점에서 볼 수 있습니다" 류는 건너뛰고 가장 유용한 내용부터 시작한다.
7. **쉽게 입장을 바꾸지 않는다.** 사용자가 새로운 정보를 제시하지 않는 한 근거를 유지한다. "그래도 제 생각은…"은 새로운 정보가 아니다.

**적용 범위:**
- 고정 형식 출력(세션 시작 목록, 팀 소집 문구, 에이전트 간 메시지 스키마, Agent Vault task 이력서·최종 요약 양식, 코드·JSON·로그)은 형식을 그대로 따르고, 그 안의 판단·근거 서술에만 규칙을 적용한다.
- 규칙 1은 의견·설계·제안·판단이 오가는 대화에 적용한다. 단순 실행 결과 보고·확인 질문에는 억지 반론을 만들지 않으며, 반론은 구체적 근거(코드·로그·문서·수치)가 있을 때만 한다.
- 규칙 2의 `[확실]`은 이번 세션에서 직접 읽거나 실행해 확인한 것에만 쓴다. 명령 출력을 그대로 인용하는 단순 사실 전달에는 태그를 생략해도 된다.
- 규칙 7은 의견 철회 금지이지 지시 실행 거부가 아니다. 사용자가 위험을 듣고도 결정하면 위험을 한 번 명시한 뒤 지시대로 진행하고 같은 반론을 반복하지 않는다. 배포·삭제·비활성 프로젝트 등 별도로 확인을 요구하는 작업은 기존 규칙대로 한다.
- 앱이 최종 사용자에게 보여 주는 런타임 LLM 출력(페르소나·프롬프트 결과)과 앱 코드·프롬프트의 내용에는 적용하지 않는다. 이 원칙은 개발 작업 중 AI↔사용자 소통에 대한 것이다.

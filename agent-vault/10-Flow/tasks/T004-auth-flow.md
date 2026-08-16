---
task_id: T004
title: 웹 인증 플로우 (이메일/비밀번호 + OAuth)
slug: auth-flow
project: TheRoute
status: done
roles_involved: developer
created: 2026-08-09
updated: 2026-08-16
provenance: git-reconstructed
tags:
  - type/task
  - domain/auth
  - domain/infra
---

# T004 · 웹 인증 플로우 (이메일/비밀번호 + OAuth)

> ⚠️ **소급 작성 문서**: 실제 세션 기록이 아니라 커밋 `f3736e4`(2026-08-09)를 역추적해 2026-08-16에 재구성했다. **코드에서 확인 가능한 사실만** 담았다.

## 배경

`mobile/`은 SNS(카카오·구글) 로그인이 이미 있었으나 `web/`에는 인증이 없었다. T004는 웹앱에 이메일/비밀번호 가입·로그인과 OAuth를 도입한다.

## 구현 내용

### 1. 공용 OAuth 패키지 도입 (⚠️ 저장소 외부 의존)
```json
"@workspace/auth-oauth": "file:../../shared/auth-oauth"
```
**실제 경로**: `/home/brownjeon/NFS/homes/brownjeon/project/shared/auth-oauth` — **TheRoute 저장소 바깥**의 워크스페이스 공용 패키지 (Express·Next.js 어댑터 제공, Google·GitHub 지원).

`file:` 프로토콜 의존이므로 **이 디렉터리가 없는 환경에서는 `npm install`이 실패**한다. 배포·CI 시 주의.

### 2. DB 스키마 변경 — `backend/src/config/setupDB.js`
- `users.password VARCHAR(255) NULL` 추가 (bcryptjs 해시 저장)
- `users.sns_provider` ENUM 확장: `('google','kakao','local')` → `('google','kakao','local','github')`
  - 가드 조건도 `current.includes("'local'")` → `"'github'"`로 변경 (재실행 멱등성 유지)
- `seedOwnerCredentials()` 신규 — env `OWNER_EMAIL` / `OWNER_PASSWORD`가 있을 때만 소유자 계정 시드 (미설정 시 조용히 skip)

### 3. backend — 라우트·컨트롤러 재구성
**`backend/src/routes/auth.js`**

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/auth/register` | 이메일 가입 |
| POST | `/auth/login` | 이메일 로그인 |
| GET | `/auth/me` | 현재 사용자 (`authenticate` 미들웨어) |
| POST | `/auth/refresh` | 토큰 갱신 |
| GET | `/auth/:provider` | OAuth 시작 (공용 패키지) |
| GET | `/auth/:provider/callback` | OAuth 콜백 (공용 패키지) |

OAuth 공급자는 **env가 설정된 것만 조건부 활성화** (`GOOGLE_CLIENT_ID`/`SECRET`, `GITHUB_CLIENT_ID`/`SECRET`). 미설정 시 기동 로그에 `[auth] OAuth 비활성화` 출력.

**`backend/src/controllers/authController.js`** — exports: `register`, `login`, `me`, `refreshToken`, `findOrCreateUser`

### 4. frontend (web) — 신규 파일
| 파일 | 역할 |
|------|------|
| `web/src/contexts/AuthContext.jsx` | 인증 상태 전역 관리 |
| `web/src/components/ProtectedRoute.jsx` | 라우트 가드 |
| `web/src/components/OAuthButtons.jsx` | OAuth 진입 버튼 |
| `web/src/pages/LoginPage.jsx` | 로그인 화면 |
| `web/src/pages/SignupPage.jsx` | 가입 화면 |
| `web/src/pages/OAuthCallbackPage.jsx` | OAuth 콜백 수신 |

수정: `web/src/hooks/useAuth.js`(AuthContext 위임으로 축소), `web/src/main.jsx`(라우팅), `web/src/api/client.js`, `web/src/api/auth.js`, `web/src/pages/MyPage.jsx`

---

## ⚠️ 확인된 회귀 — 모바일 SNS 로그인 파손

**이 커밋은 `POST /auth/sns` 라우트와 `snsLogin` 컨트롤러를 제거했으나, 모바일 앱은 여전히 이 엔드포인트를 호출한다.**

근거 (2026-08-16 코드 확인):
- `mobile/src/api/auth.js:8` → `client.post('/auth/sns', { provider, accessToken })`
- `mobile/src/store/authStore.js:31` → `snsLogin(provider, accessToken)` 호출
- `backend/src/routes/auth.js` → `/sns` 라우트 없음
- `backend/src/controllers/authController.js:130` → `module.exports`에 `snsLogin` 없음
- 공용 OAuth 라우터는 `GET /:provider`·`GET /:provider/callback`만 등록 → **POST 요청은 매칭 불가**

**결론: 모바일 앱의 카카오·구글 로그인은 현재 404를 받는다.** 또한 `sns_provider` ENUM에는 `kakao`가 남아 있으나 백엔드 OAuth 공급자 설정에는 `google`/`github`만 있어 **카카오 경로 자체가 없다.**

> 미해결 상태. 후속 작업 필요 — 아래 "남은 리스크" 참조.

---

## 주요 설계 결정

- **워크스페이스 공용 OAuth 패키지 사용**: 프로젝트별 OAuth 중복 구현 대신 `shared/auth-oauth` 재사용. 대가로 저장소 외부 의존이 생김.
- **OAuth 공급자 조건부 활성화**: env 미설정 시 기동 실패가 아니라 비활성화로 degrade — 로컬 개발 편의.
- **소유자 계정 env 시드**: 하드코딩 대신 `OWNER_EMAIL`/`OWNER_PASSWORD` env 기반.

## 남은 리스크 / 후속 후보

1. **[높음] 모바일 SNS 로그인 404** — 위 회귀 항목. 선택지: ① `POST /auth/sns` 복원 ② 모바일을 신규 OAuth 플로우로 이관.
2. **[높음] 카카오 로그인 경로 부재** — ENUM에는 있으나 공급자 미구성. 기획서상 카카오는 주요 로그인 수단.
3. **[중간] `JWT_SECRET` 하드코딩 폴백** — `routes/auth.js`에 `'theroute-dev-secret'` 기본값. 운영에서 env 누락 시 알려진 시크릿으로 서명됨. 기동 시 검증(fail-fast) 권장.
4. **[중간] `file:` 의존 배포 취약성** — CI/배포 대상에 `shared/auth-oauth`가 없으면 설치 실패.

## 검증 결과

**미확인.** 소급 작성 문서로 당시 빌드·QA 기록이 없다. 위 모바일 회귀는 2026-08-16 코드 재확인으로 **정적 검증된 사실**이나, 실제 런타임 404는 미재현.

## 최종 요약 (사용자용)

**웹앱에 회원가입·로그인 기능이 들어갔습니다.** 이메일/비밀번호 가입과 Google·GitHub 소셜 로그인을 지원하고, 로그인이 필요한 페이지는 자동으로 보호됩니다.

**다만 확인이 필요한 문제가 있습니다:**
- 이 작업에서 백엔드의 기존 `POST /auth/sns` 엔드포인트가 제거됐는데, **모바일 앱은 아직 그 주소를 호출하고 있습니다.** 지금 상태로는 모바일 카카오·구글 로그인이 동작하지 않습니다.
- **카카오 로그인은 웹에도 없습니다** (Google·GitHub만 연결됨). 기획서상 카카오가 주요 로그인 수단인 점과 어긋납니다.
- 운영 배포 시 `JWT_SECRET` 환경변수를 반드시 설정해야 합니다 (미설정 시 개발용 기본값이 쓰임).

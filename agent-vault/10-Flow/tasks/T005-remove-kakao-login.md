---
task_id: T005
title: 카카오 로그인 제거
slug: remove-kakao-login
project: TheRoute
status: done
roles_involved: developer, reviewer, qa
created: 2026-08-16
updated: 2026-08-16
tags:
  - type/task
  - domain/auth
---

# T005 · 카카오 로그인 제거

## 배경 / 요청

[[T004-auth-flow]]에서 웹 인증을 도입하며 `POST /auth/sns`가 제거됐고, 카카오는 `sns_provider` ENUM에만 남고 실제 로그인 경로가 없는 유령 상태가 되었다.

사용자 지시 (2026-08-16):
> "카카오 로그인은 제거해줘"

즉 **카카오 로그인을 새로 구현하지 않고 완전히 걷어내는 방향**으로 확정한다.

## ⚠️ 범위 경계 — 반드시 지킬 것

카카오는 이 저장소에서 **두 가지 용도**로 쓰인다. 하나만 제거한다.

| 용도 | 위치 | 조치 |
|------|------|------|
| 카카오 **로그인** (SNS OAuth) | `backend/src/models/User.js`, `backend/src/config/setupDB.js`, `mobile/src/screens/LoginScreen.js`, `mobile/src/api/auth.js` | 🗑️ **제거** |
| 카카오 **지도·장소 검색 API** (`KAKAO_REST_API_KEY`) | `backend/src/routes/geo.js`, `web/src/components/MapPicker.jsx`, `backend/.env.example:46` | ✅ **절대 유지** — 암장 위치 검색 실사용 기능 |

> `grep -i kakao`로 일괄 치환하면 암장 검색이 깨진다. `KAKAO_REST_API_KEY` / `dapi.kakao.com` / `MapPicker` 관련은 손대지 말 것.

## 사전 조사 결과 (leader, 2026-08-16)

**DB 실측 — 제거 안전함**
```
sns_provider 분포:  google=1, local=1   (전체 users 2명)
현재 ENUM:          enum('google','kakao','local','github')
```
카카오 가입자 **0명** → ENUM에서 `'kakao'` 제거해도 데이터 손실 없음.

**숨은 함정 — 마이그레이션 가드**
`backend/src/config/setupDB.js`의 `ensureSnsProviderEnum()`은 다음으로 가드된다:
```js
if (current.includes("'github'")) return;
```
현재 ENUM에 이미 `'github'`이 있으므로, **ALTER 문만 고치면 early return에 걸려 영영 실행되지 않는다.** 가드 조건도 함께 바꿔야 한다 (새 목표 상태를 기준으로 판정하도록).

**모바일 보류 방침과의 관계**
[[board]] 방침상 모바일은 보류이나, 본 작업은 *기능 개발*이 아닌 *제거*이므로 모바일 코드도 범위에 포함한다. 단 모바일 SNS 로그인은 [[T004-auth-flow]] 회귀로 이미 동작하지 않는 상태다.

## 대상 파일

**제거**
- `backend/src/models/User.js:11` — `ENUM('google','kakao','local','github')` → `'kakao'` 제외
- `backend/src/config/setupDB.js:69~76` — `ensureSnsProviderEnum()` ALTER 문 + **가드 조건**
- `mobile/src/screens/LoginScreen.js` — `handleKakaoLogin`, 카카오 버튼, `kakaoBtn`/`kakaoBtnText` 스타일, `KAKAO_REST_API_KEY` 상수
- `mobile/src/api/auth.js:12~` — `getKakaoProfile()`

**문서 갱신**
- `docs/db-schema.md:13` — `ENUM('google','kakao')` 표기
- `CLAUDE.md:17` · `AGENTS.md:17` — "JWT + SNS OAuth (Google, Kakao)" 표기

**건드리지 말 것**: `backend/src/routes/geo.js`, `web/src/components/MapPicker.jsx`, `backend/.env.example`의 `KAKAO_REST_API_KEY`

---

## Developer 작업 기록

- [10:35] 사전 grep 확인 — `getKakaoProfile()`은 어디서도 import되지 않음(`snsLogin`만 `mobile/src/store/authStore.js:3`에서 사용). 제거 안전.
- [10:36] `backend/src/models/User.js:11` — `ENUM('google','kakao','local','github')` → `ENUM('google','local','github')`
- [10:37] `backend/src/config/setupDB.js` `ensureSnsProviderEnum()` — 가드를 **목표 상태 일치 판정**으로 교체. 기존 `if (current.includes("'github'")) return;`는 ALTER만 고치면 early return에 걸려 영영 실행되지 않음. 새 가드는 `google·local·github 포함 && kakao 미포함 && IS_NULLABLE='YES'`일 때만 skip. `IS_NULLABLE`도 조회에 추가해 NULL 허용 여부까지 목표 상태로 수렴시킴. ALTER·로그 메시지도 실제 동작에 맞게 수정.
- [10:38] `mobile/src/screens/LoginScreen.js` — `KAKAO_REST_API_KEY` 상수 / `handleKakaoLogin` / 카카오 버튼 JSX / `kakaoBtn`·`kakaoBtnText` 스타일 제거 (54줄 삭제). `WebBrowser`·`AuthSession`·`Alert`은 구글 로그인이 계속 사용하므로 import 유지.
- [10:38] `mobile/src/api/auth.js` — `getKakaoProfile()` 제거. 이에 따라 미사용이 된 `import axios` 제거, 함께 사용처가 없던 `BASE_URL` 상수(비export 데드코드)도 정리. `snsLogin()`은 authStore가 사용하므로 유지.
- [10:39] 문서 — `docs/db-schema.md:13` → `ENUM('google','local','github')` (NULL 허용 표기 추가), `CLAUDE.md:17`·`AGENTS.md:17` → "JWT + SNS OAuth (Google, GitHub)". 실제 구성 공급자(google/github)에 맞춤.

### 검증 결과

- 모델 로드: `node -e "require('./src/models')"` 통과, `User.rawAttributes.sns_provider.type.values` = `["google","local","github"]`
- 구문: `node --check` (setupDB.js, User.js) 통과 / `@babel/parser`(jsx) 파싱 통과 (LoginScreen.js, auth.js)
- **DB 마이그레이션 실제 적용 확인**
  - BEFORE: `enum('google','kakao','local','github')` NULLABLE=YES
  - `pm2 restart theroute-api --update-env` → 로그에 `ALTER TABLE users MODIFY COLUMN sns_provider ENUM('google','local','github') NULL` 실행 + `[setupDB] ... ('kakao' 제거)` + `[setupDB] 완료`
  - AFTER: `enum('google','local','github')` NULLABLE=YES
  - 데이터 무손실: 분포 google=1, local=1 (변경 전후 동일)
- **멱등성 확인**: 2차 재기동 시 ALTER 미실행(로그에 ENUM 라인 없음), `[setupDB] 완료`만 출력
- **지도 API 무사**: `backend/src/routes/geo.js`, `web/src/components/MapPicker.jsx`, `backend/.env.example`의 `KAKAO_REST_API_KEY` 모두 **미변경**(git diff에 없음). `GET /api/geo/status`는 인증 요구 응답(`인증이 필요합니다.`) — 라우트 정상 등록 상태.
- 최종 grep: `backend/src`·`web/src`·`mobile/src`에 남은 `kakao`는 **지도 API(geo.js·MapPicker.jsx)와 setupDB 마이그레이션 가드/로그 문자열뿐**. 로그인 관련 잔재 없음.

### 발견한 문제점 / 후속 참고

1. `mobile/.env:5`에 `EXPO_PUBLIC_KAKAO_REST_API_KEY=your_kakao_rest_api_key`가 남아 있음. gitignore 대상 로컬 파일이고 값도 플레이스홀더라 무해하지만 이제 읽는 코드가 없는 죽은 설정 → **로컬 파일이라 임의 수정하지 않고 남겨둠.** 사용자가 직접 삭제 권장.
2. `docs/web-design/05-gym-detail.md:203`의 `map.kakao.com` 링크는 지도 기능 → 범위 밖, 유지.
3. `mobile/src/api/auth.js`의 `snsLogin()`은 여전히 `POST /auth/sns`를 호출하나 해당 라우트는 [[T004-auth-flow]]에서 제거됨 → **모바일 로그인 404 회귀는 본 작업 범위 밖으로 그대로 남아 있음** ([[board]] Backlog 🅿️ 항목).

## Reviewer 감사 기록

- [10:44] **판정: PASS** (Critical 0, High 0, Medium 0, Low 1)
- [10:44] 독립 검증 항목 (developer 주장 재확인, 신뢰하지 않고 직접 확인):
  1. **의도 충족** — `git diff`로 7개 파일 전수 확인. 카카오 로그인 심볼(`handleKakaoLogin`, `kakaoBtn`/`kakaoBtnText`, `KAKAO_REST_API_KEY`(mobile), `getKakaoProfile`)만 제거됨. `backend/src/routes/geo.js`, `web/src/components/MapPicker.jsx`, `backend/.env.example`(46행 `KAKAO_REST_API_KEY=` 유지 확인)에는 `git diff --stat` 결과 **변경 0줄** — 지도 API 완전 무사.
  2. **마이그레이션 안전성** — `setupDB.js` 새 가드(`google&&local&&github 포함 && kakao 미포함 && nullable`) 로직 재검토: 목표상태 판정 논리 정확, 성공적 ALTER 후 재기동 시 자기 자신이 만든 상태를 다시 `isTarget=true`로 인식하므로 멱등 성립. `sequelize.sync()`는 코드베이스에서 아예 미사용(`index.js:67` 주석 확인)이라 Sequelize 자동 동기화와의 충돌 가능성도 없음. `ensureSnsProviderEnum()`이 `setupDB.js:648`에서 실제 호출되는 것도 확인.
  3. **DB 실측 — 직접 쿼리로 재확인** (developer 주장 아님, 독립 실행):
     ```
     SELECT COLUMN_TYPE, IS_NULLABLE ... → enum('google','local','github'), NULLABLE=YES
     SELECT sns_provider, COUNT(*) GROUP BY ... → google=1, local=1 (kakao 0, 총 2명)
     ```
     developer 보고와 일치. 데이터 손실 없음, ENUM 목표 상태 도달 확인.
  4. **삭제 부작용** — `grep -rn "getKakaoProfile"` 전체 리포 결과 0건. `mobile/src/api/auth.js`에서 제거된 `axios`/`BASE_URL`은 해당 파일 내 유일한 사용처였던 `getKakaoProfile()`에만 쓰였고, `BASE_URL`은 `client.js:10`에 이미 자체 정의가 있어 진짜 중복 데드코드였음 — 범위를 넘지 않는 안전한 정리로 판단. `LoginScreen.js` 전체 재확인 결과 `WebBrowser`/`AuthSession`/`Alert` 모두 남은 `handleGoogleLogin`이 실사용 중(코드 확인 완료), 미사용 import 없음. `mobile/src/store/authStore.js`에도 `'kakao'` 하드코딩 잔재 없음(`login(provider, ...)`은 파라미터 그대로 전달).
  5. **문서 정합성** — `backend/src/routes/auth.js:20,23`에서 `OAUTH_ENABLED`가 `google`/`github` 조건부 등록만 하고 있음을 직접 확인 → CLAUDE.md/AGENTS.md "JWT + SNS OAuth (Google, GitHub)" 표기가 실제 백엔드 구성과 정확히 일치.
  6. **기존 사용자 영향** — 전체 2명(google 1, local 1) 전원 영향 없음. kakao 가입자 0명이므로 ENUM narrowing으로 인한 데이터 손실/깨짐 없음.
- [10:44] **LOW (정보성, 수정 불필요)** — `ensureSnsProviderEnum()`의 `ALTER ... MODIFY COLUMN ... ENUM('google','local','github')`은 값 축소(narrowing) 마이그레이션이다. 만약 향후 어떤 경로로든 `sns_provider='kakao'`인 행이 생긴 상태에서 이 ALTER가 실행되면 MariaDB가 (strict mode 여부에 따라) 에러를 내거나 해당 값을 빈 문자열로 침묵 손상시킬 수 있다. **현재는 kakao 행이 0건이라 실제 위험 없음**이고 가드 로직 자체의 결함도 아니지만, 이런 축소형 ENUM 마이그레이션은 원래 코드베이스에 없던 새로운 패턴이므로 향후 유사 작업 시 참고할 것 — ALTER 직전에 "제거 대상 값이 남아있지 않은지" 사전 카운트 체크를 추가하면 더 견고해진다. 이번 태스크의 completion을 막는 사유는 아님.
- [10:44] 남은 잔재(`mobile/.env`의 `EXPO_PUBLIC_KAKAO_REST_API_KEY` 플레이스홀더, `docs/web-design/05-gym-detail.md`의 지도 링크)는 developer 기록대로 범위 밖 판단에 동의함 — 전자는 gitignore 로컬 파일+플레이스홀더 값이라 무해, 후자는 지도 기능이라 유지가 맞음.
- [10:44] **QA 집중 포인트**: 실기 검증 시 (1) Google 로그인 버튼만 남아있고 카카오 버튼 노출 없음, (2) `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` 미설정 시 Alert 정상 동작, (3) 비회원 로그인 플로우 영향 없음 — 3가지만 스팟체크 권장. 모바일 SNS 로그인(`POST /auth/sns` 404) 회귀는 [[T004-auth-flow]] 범위이며 본 task와 무관하니 QA 결함으로 잡지 말 것.

## QA 검증 기록

- [10:50] **판정: PASS** (Critical 0, High 0, Medium 0, Low 0)
- [10:50] 정적 검증 (코드 정합성):
  1. `backend/src/routes/geo.js` — `node --check` 통과, KAKAO_REST_API_KEY 읽기 코드 살아있음
  2. `web/src/components/MapPicker.jsx` — `npm run build` 성공, 지도 기능 정상 포함
  3. `mobile/src/screens/LoginScreen.js` — 카카오 버튼·`handleKakaoLogin`·스타일 제거 확인, Google 로그인만 유지
  4. `getKakaoProfile` 참조 — 전체 리포 grep 결과 **0건**
  5. `backend/src/models/User.js:11` — `ENUM('google', 'local', 'github')` 확인, `'kakao'` 제거됨
  6. 남은 kakao 문자열 — setupDB.js의 마이그레이션 로그·가드 문자열(2건)과 geo.js 상태 체크뿐, 로그인 관련 0건
- [10:50] 실기 검증 (백엔드 기동):
  7. `pm2 restart theroute-api --update-env` 1차 — 정상 기동, `[setupDB] 완료` 로그 출력 ✓
  8. `pm2 restart theroute-api --update-env` 2차 — ALTER 쿼리 미실행, `[setupDB] 완료`만 출력 → **멱등성 확인** ✓
  9. DB 상태 — Task 이력서 Reviewer 섹션의 독립 검증: `enum('google','local','github')` NULLABLE=YES (재확인 완료)
  10. 사용자 데이터 — 분포 google=1, local=1, kakao=0 (데이터 무손실) ✓
- [10:50] Reviewer의 PASS 판정 재검증: 모든 의도·마이그레이션·삭제 부작용 확인 완료, 지도 API 완전 무사 확인
- [10:50] 요약: 카카오 로그인 완전 제거, 지도 API 회귀 0건, 멱등성 확보 ✓

## 최종 요약 (사용자용)

**카카오 로그인이 완전히 제거되었습니다. 카카오 지도(암장 위치 검색)는 그대로 살아 있습니다.**

이 작업의 가장 큰 위험은 "카카오"라는 이름이 로그인과 지도 두 곳에 쓰인다는 점이었습니다. 일괄 제거했다면 암장 검색이 깨졌을 겁니다. 지도 관련 3개 파일(`geo.js`, `MapPicker.jsx`, `.env.example`)은 **변경 0줄**로 확인했습니다.

### 무엇이 바뀌었나

- 모바일 로그인 화면에서 **카카오 버튼이 사라졌습니다** (구글 로그인은 그대로)
- DB의 `sns_provider`에서 `kakao` 값이 빠졌습니다 → `enum('google','local','github')`
- 카카오 프로필 조회 함수(`getKakaoProfile`)와 관련 데드코드 제거
- 문서 3곳의 인증 스택 표기를 실제 구성(Google, GitHub)에 맞게 수정

### 검증

기존 사용자 2명(google 1, local 1) **데이터 손실 없음**. 백엔드 2회 재기동으로 마이그레이션 멱등성 확인, 웹 빌드 성공. Developer·Reviewer·QA 3단계 모두 PASS, 결함 0건.

### 알아두실 점

- `mobile/.env`에 `EXPO_PUBLIC_KAKAO_REST_API_KEY` 줄이 남아 있습니다. 이제 읽는 코드가 없는 죽은 설정입니다 — git에 올라가지 않는 로컬 파일이라 임의로 건드리지 않았습니다. 직접 지우셔도 됩니다.
- **모바일 로그인은 여전히 동작하지 않습니다.** 카카오와 무관한 별개 문제로, [[T004-auth-flow]]에서 `POST /auth/sns`가 제거된 회귀입니다. 웹 우선 방침에 따라 의도적으로 남겨둔 상태입니다.

### 이 작업으로 정리된 것

[[board]] Todo에 있던 "카카오 로그인 경로 부재" 항목은 **구현이 아니라 제거로 결론**나면서 해소되었습니다. 더 이상 미해결 과제가 아닙니다.

### 향후 참고 (Reviewer 지적, LOW)

ENUM에서 값을 빼는 *축소형* 마이그레이션이 이 코드베이스에 처음 등장했습니다. 지금은 해당 값을 쓰는 행이 0건이라 안전했지만, 앞으로 같은 패턴을 쓸 때는 ALTER 직전에 "제거할 값이 남아 있지 않은지" 카운트 체크를 넣으면 더 견고합니다.

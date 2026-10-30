---
task: "[[T009-android-apk]]"
stream: N
role: developer
status: DONE
updated: 2026-10-30 22:40
tags:
  - type/handoff
  - domain/mobile
---

# T009 스트림 N — 네이티브 셸 (09-18 계획 Task 1·2·3 + 개정 §2)

작업 위치: `/home/brownjeon/.node-local/theroute-app` (ext4 worktree, 브랜치 `mobile-app-t009`). **커밋하지 않았다**(RN 삭제 `git rm -r mobile` 만 스테이징됨).
근거 문서: `docs/superpowers/plans/2026-10-30-android-apk-addendum.md`(우선) · `2026-09-18-android-apk.md` Task 1~3 · 스펙 §5·§6·§10~§13.

## 무엇을 했나

- [22:28] **RN Expo 제거**: `git rm -r mobile` — 추적 파일 19개 `D`(미추적 잔여 없음).
- [22:29] **Capacitor 셸 골격**: `mobile/package.json`(app·browser·core + android·cli·sharp·typescript), `capacitor.config.ts`(계획 그대로, 서명 주석만 전용 키로 갱신), `app-shell/index.html`(계획 기본안), `scripts/sync-local.sh`.
- [22:30] 작업 디렉터리 `~/.node-local/theroute-mobile` 에서 `npm install` → `npx cap add android`(둘 다 `nice -n 10 flock /tmp/theroute-heavy.lock`, 로그 파일) → `package-lock.json`·`android/` 를 소스로 되돌림(build·.gradle·local.properties·assets·cordova-plugins·res/xml/config.xml 제외).
  설치 버전: @capacitor/cli·core·android 7.6.10, app 7.1.2, browser 7.0.5, sharp 0.34.5, typescript 5.9.3 · AGP 8.7.2 · Gradle 8.11.1 · minSdk 23/target 35(템플릿 값 그대로).
- [22:31] **네이티브 커스터마이즈(Task 2)**: AndroidManifest(allowBackup=false·adjustResize·singleTask·`theroute://auth` intent-filter·위치 2종·CAMERA), `values/theroute_colors.xml`, `styles.xml` AppTheme.NoActionBar(창 배경 #FAFAFA·밝은 바 아이콘 어둡게), `MainActivity.java`(API 35+ IME 인셋 리스너). strings.xml 은 cap add 가 채운 값이 계획 기대와 같아 손대지 않음.
- [22:32] **geolocation 확인(스펙 §6-2)**: `@capacitor/android` 7.6.10 `BridgeWebChromeClient.java:246` 이 `onGeolocationPermissionsShowPrompt` 를 구현(앱 런타임 권한 COARSE+FINE 요청 → `callback.invoke(origin, granted, false)`, S+ 에서 COARSE 만 허용돼도 허용), `Bridge.java:280` 이 이 클라이언트를 WebView 에 건다 → **MainActivity 보강 안 함**. 교체하면 파일 선택·카메라 처리(`onShowFileChooser`)까지 잃기 때문에 오히려 해롭다. 근거를 MainActivity 주석·Manifest 주석에 남김.
- [22:33] **build.gradle 서명(개정 §2-1·§2-3)**: `routeVersionCode = 1`·`routeVersionName = "1.0.0"`, release signingConfig 를 `THEROUTE_KEYSTORE`·`THEROUTE_KEYSTORE_PASSWORD`·`THEROUTE_KEY_ALIAS`(+선택 `THEROUTE_KEY_PASSWORD`) 환경변수로만, `debuggable false`, minify/shrink 끔, taskGraph 검사로 값 없음·키스토어 없음·debug.keystore/androiddebugkey 이면 release 실패(StockInvest 방식).
- [22:33] **전용 서명 키 생성(개정 §2-1)**: 사전 확인 결과 `~/.android/theroute-*`·백업 폴더 모두 없었음 → 생성. PKCS12 · RSA 4096 · SHA256withRSA · 유효 10950일(2056-10-22) · alias `theroute` · DN `CN=TheRoute, O=miraclepenguin` · 비밀번호 `openssl rand -hex 24`(48자)를 env 파일에만 기록(keytool 은 `-storepass:env` 로 받음, 화면·로그 출력 없음).
  - `~/.android/theroute-release.keystore` (600) · `~/.android/theroute-signing.env` (600)
  - 백업 `/home/brownjeon/NFS/homes/brownjeon/backup/android-signing/theroute/` (700) — keystore·env (600, `cmp` 로 원본과 동일 확인) + `README.txt`(경로·공개 지문만)
  - **인증서 SHA-256(공개)**: `BA:B3:EF:3F:68:8D:8E:47:0B:F1:38:9A:C6:F9:76:17:C4:1F:3E:69:D8:D5:D5:26:55:9B:8C:E9:C1:F5:38:CE` → `mobile/scripts/expected-cert-sha256.txt`
- [22:34] **`build-apk.sh`(개정 §2 전부)**: 아래 "Reviewer 가 볼 곳" 참고.
- [22:34] `.gitignore`: 개정 §2-1 목록 + 계획 Step 7 목록(cap sync 생성물) + `res/xml/config.xml`. `git check-ignore` 로 키스토어·signing.env·build/·.gradle/·local.properties·app/release/·assets 생성물 전부 무시됨 확인.
- [22:36] **아이콘(Task 3)**: `mobile/scripts/gen-app-icons.mjs` 실행 → 적응형 3레이어(`ic_theroute_foreground/monochrome`·`ic_launcher_background` 색·`mipmap-anydpi-v26/ic_launcher{,_round}.xml`) + 밀도별 PNG 10개 + `web/public/{favicon.svg,favicon-32.png,apple-touch-icon.png}`. `web/index.html` 에 파비콘 링크 2줄(타이틀 바로 아래).
- [22:37] **첫 release APK 빌드** 성공(gradle rc=0, 31s) → [22:39] 보강 확인용 2차 빌드 성공(아래).

## 계획과 다르게 한 것 (이유)

1. **아이콘 홀드 3점** — 09-18 계획 코드는 `HOLDS` 4개("홀드 4점")인데 스펙 §11·Leader 지시는 "홀드 3점". 스펙·지시를 따라 3점(38,72 r7 / 60,60 r5 / 70,38 r7)으로 하고 `ROUTE` 는 HOLDS 에서 계산하게 했다(점만 바꾸면 선이 따라온다). 세 점 모두 원형 마스크 안전영역(중심 반지름 36) 안. 데모 승인 뒤 상수만 바꿔 재생성.
2. **작업 디렉터리 변수** `THEROUTE_MOBILE_LOCAL` → `THEROUTE_APK_WORK`(개정 §2-3). `sync-local.sh` 에 rsync `--delete` 대상 검증 추가: 빈 값·상대경로·`/`·`$HOME`·소스 자신·**소스의 조상(저장소 루트 등)**·소스 안쪽 거부(조상을 주면 `$WORK/scripts` 로 저장소 `scripts/` 를 지울 수 있었다).
3. **잠금은 스크립트가 스스로 잡는다** — `build-apk.sh` 가 `nice -n 10 flock /tmp/theroute-heavy.lock` 로 자신을 다시 실행. 바깥에서 같은 잠금으로 또 감싸면 flock 이 다른 open file description 이라 **교착**하므로, 감쌀 때는 `THEROUTE_HEAVY_LOCK_HELD=1` 을 같이 준다(스크립트 머리말에 적음).
4. **아이콘 3레이어 검사 경로** — release 빌드는 리소스 경로를 짧게 바꾼다(실측 `res/BW.xml`). 스펙 §13 의 `--file res/mipmap-anydpi-v26/ic_launcher.xml` 은 release APK 에서 **파일을 찾지 못한다**. 스크립트는 `aapt2 dump resources` 에서 `mipmap/ic_launcher (anydpi-v26)` 파일을 찾아 검사한다. **QA 는 스펙 명령 그대로 쓰지 말 것.**
5. **`launchMode` 검사는 MainActivity 한정** — Capacitor Browser 의 `BrowserControllerActivity` 도 `launchMode=2` 라 전체 grep 은 거짓 통과한다(첫 빌드 정적 검사에서 발견해 고침, 변이 시험: MainActivity 를 0 으로 바꾼 트리에서 `0` 추출 확인).
6. **비밀번호 문자열 검사는 압축 해제 디렉터리 없이** `unzip -p | grep -F`(pipefail 끄고 `PIPESTATUS[1]` 판정) — 변수 경로 `rm -rf` 금지 규칙 때문에 StockInvest 의 `mktemp -d` + trap 정리를 쓰지 않았다. 옛 빌드 정리도 `cd "$WORK/android"` 후 `pwd -P`·`settings.gradle`·`gradlew` 확인 → 고정 상대경로 `rm -rf -- ./app/build ./build`.
7. 권한·딥링크·capacitor.config 검사는 TheRoute 기대값으로(INTERNET·위치 2·CAMERA + androidx `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` / `<data>` 정확히 1개 theroute://auth / url·https·cleartext false·errorPath·adjustMargins auto·allowNavigation 없음). StockInvest 의 `webContentsDebuggingEnabled`·`allowMixedContent` 명시 검사는 계획 config 에 그 키가 없어 넣지 않았다(release 는 Capacitor 기본값이 디버깅 꺼짐).
8. 계획 Step 8 은 `npm install`(lock 생성), 이후 빌드는 `npm ci`(lock 해시가 바뀌거나 node_modules 없을 때만). npm 11 이 sharp 설치 스크립트를 `allowScripts` 로 건너뛰었지만 sharp 0.34.5 는 prebuilt `@img/*` 로 로드·실행됨(아이콘 생성 성공).
9. 백업 폴더에 `README.txt` 추가(경로·공개 지문·복원 방법, 비밀 없음 — StockInvest 백업과 같은 형식).
10. 템플릿 잔여물(`drawable-v24/ic_launcher_foreground.xml`·`mipmap-*/ic_launcher_foreground.png`·splash·예제 테스트)은 지우지 않았다 — 적응형 XML 이 `ic_theroute_*` 를 가리키므로 쓰이지 않는 리소스일 뿐이고, 계획도 이름 분리만 지시한다.

## 실제로 실행한 검증

| # | 검사 | 실제 결과 |
|---|---|---|
| 1 | `aapt2 dump badging` | `package: name='com.miraclepenguin.theroute' versionCode='1' versionName='1.0.0'` · `application-label:'더 루트'` · `minSdkVersion:'23'` `targetSdkVersion:'35'` · 권한 INTERNET·ACCESS_FINE_LOCATION·ACCESS_COARSE_LOCATION·CAMERA + `com.miraclepenguin.theroute.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`(androidx core 자동) · 저장소 권한 없음 · `application-debuggable` 없음 |
| 2 | manifest xmltree | `allowBackup=false` · MainActivity `launchMode=2`·`exported=true`·`windowSoftInputMode=0x10` · `scheme="theroute"` `host="auth"`(`<data>` 1개) · 그 밖의 exported=true 는 `ProfileInstallReceiver`(DUMP 권한 보호) 하나 |
| 3 | 아이콘 | `res/BW.xml`(= mipmap-anydpi-v26/ic_launcher) xmltree 에 `background`·`foreground`·`monochrome` 3요소 |
| 4 | `apksigner verify --print-certs` | rc 0 · `Verifies` · v1·v2 true · 서명자 1명 · `CN=TheRoute, O=miraclepenguin` · SHA-256 `bab3ef3f…c1f538ce` = 기대값 |
| 5 | `unzip -p … assets/capacitor.config.json` | `appId com.miraclepenguin.theroute` · `server.url https://climb.xn--lh0b87pnudm10a4vd.com` · `androidScheme https` · `cleartext false` · `errorPath index.html` · `android.adjustMarginsForEdgeToEdge auto` |
| 6 | 2차 빌드: 소스 `gradlew` 644(신선한 NFS clone 흉내) + 해시 파일 낡은 값 | "옛 빌드 산출물을 지운다" 분기 실행 → `app/build`·`build` 삭제 후 재빌드 rc 0(69 tasks executed — app 모듈 전체), 작업 사본 gradlew 755 로 바뀜, npm ci 건너뜀(lock 동일). 시험 뒤 소스 gradlew 755 로 되돌림 |
| 7 | 해시 안정성 | 빌드 후 기록된 `.native-src-hash` 와 재계산 값 동일 |
| 8 | 비밀 | APK 안 파일명·서명 비밀번호 문자열 없음(스크립트) · worktree `mobile/`·`web/public`·`.gitignore`·handoffs 에 비밀번호 문자열 없음(별도 검사) |
| 9 | `bash -n` | build-apk.sh·sync-local.sh 문법 통과 |

**산출 APK**: `/home/brownjeon/.node-local/theroute-mobile/out/theroute-1.0.0-1.apk` (3,186,105 bytes, sha256 `0d8e7c6a06b10b12d7aa456bb07e98263025a0c4c395a7498da07667aeb1c7b6`, 2차 빌드본). 원본 `…/android/app/build/outputs/apk/release/app-release.apk`. 빌드마다 sha256 은 달라진다(v1 서명 타임스탬프).

## 못 한 것 / 남은 것

- **실기기 확인 없음**(스펙 §13 7항목 — 시스템 바·키보드·위치 프롬프트·카메라·뒤로가기는 headless 로 재현 불가). APK 전달은 Leader 몫.
- 웹 빌드(`vite build`) 미실행 — 파비콘이 `web/dist` 루트로 복사되는지·`/favicon.svg` 가 SPA 폴백에 먹히지 않는지는 확인 안 함(express.static 이 먼저라 [가능성 높음] 정상). 웹 빌드는 이 스트림 범위 밖.
- 아이콘 도안·`app-shell/index.html` 은 계획 기본안 — 데모(`docs/demo/T009-android-apk-v<N>.html`) 승인 후 다르면 생성기 상수/파일만 고쳐 재빌드.
- `mobile/README` 나 `docs/mobile-*` 런북은 만들지 않았다(요청 없음).
- 관찰(다른 스트림 것, 손대지 않음): worktree 에 `backend/node_modules` 가 `??` 로 보인다 — 심볼릭 링크는 `node_modules/`(디렉터리 패턴)에 걸리지 않아서다. Leader 가 커밋할 때 제외해야 한다.

## Reviewer 가 볼 곳

1. `mobile/scripts/build-apk.sh` — ① 서명 env 를 gradle 하위 셸과 비밀번호 검사 하위 셸에서만 `source`(부모 셸·npm·cap 에 값 없음, `set +x`) ② 기대 지문 파일 비교·서명자 1명·DN·디버그 키 거부 ③ 옛 산출물 정리의 경로 검증(`cd` + `pwd -P` + 고정 상대경로) ④ 자기 재실행 잠금(`THEROUTE_HEAVY_LOCK_HELD`)과 바깥 감쌈 시 교착 ⑤ MainActivity launchMode awk 파서 ⑥ 아이콘 리소스 표 awk 파서.
2. `mobile/scripts/sync-local.sh` — `--delete` 대상 검증(조상·자신·안쪽 거부)과 exclude 목록(키스토어·signing.env 차단).
3. `mobile/android/app/build.gradle` — taskGraph 검사가 release 에서만 돌고 디버그 키 폴백이 없는지.
4. `mobile/android/app/src/main/AndroidManifest.xml` — 권한 최소·`exported` 범위·XML 주석에 `--` 없음.
5. `mobile/scripts/gen-app-icons.mjs` — 계획 대비 HOLDS 3점·ROUTE 계산식(위 1번 차이).
6. `.gitignore` — 서명 키·생성물 차단 범위.

---

## 후속 패치 (2026-10-30 23:10) — Reviewer-N 지적 + 사용자 승인 데모 v1 반영

근거: [[T009-reviewer-N]](CONDITIONAL_PASS, M-1~M-3·L-1~L-8) · 데모 `docs/demo/T009-android-apk-v1.html` · 가이드 `docs/web-design/T009-android-apk-guide.md`(사용자 승인 22:43, D1 B · D2 B · D3 B · D4 그대로) · 개정 §2-4 마지막 항목·§5-1.

### A. Reviewer 지적 수정

- [23:00] **M-1** `build-apk.sh` 비밀번호 문자열 검사: `grep -F -- "$PW"` → `grep -a -q -F -f <(printf '%s\n' "$PW")`(내장 printf + 프로세스 치환 → grep argv 는 `-f /dev/fd/63` 뿐). **L-3** 같이: `PIPESTATUS` 를 배열로 받아 grep 0 → 1(찾음), grep 1 이면서 unzip 0 → 0(없음), 그 밖(unzip 실패 등) → 3.
- [23:00] **M-2** 자기 재실행 잠금: `exec` 대신 자식으로 `flock -w $THEROUTE_HEAVY_LOCK_WAIT(기본 1800) -E 75` 를 실행해, 시간 초과면 원인 안내("바깥에서 감쌌다면 HELD=1") 후 rc 75. Reviewer 선택 제안도 반영: HELD=1 인데 `flock -n` 이 즉시 잡히면(아무도 안 잡고 있으면) 무시하고 직접 잡는다. 시험용 `--check-lock`(잠금 구간 진입 후 빌드 없이 rc 0) 추가, 알 수 없는 인자는 rc 2.
- [23:01] **M-3** Synology 메타데이터: `sync-local.sh` rsync 3곳에 `--filter='-s @eaDir/' --filter='-s *@SynoEAStream'`, 해시 `find` 2곳에 `-not -path '*/@eaDir/*' -not -name '*@SynoEAStream'`. **지시의 `--exclude` 대신 송신 쪽 숨김 `-s` 를 썼다** — `--exclude` 는 수신 쪽 삭제 보호도 겸해서, 한 번 넘어간 메타데이터가 작업 디렉터리 `res/` 에 영영 남는다. `-s` 는 보내지 않고 `--delete` 가 옛 것을 지운다(시험으로 확인).
- [23:01] **L-2** 서명 env 소유자 = `id -un` 확인(아니면 실패).
- [23:02] **L-4** `styles.xml` `AppTheme.NoActionBar` parent `Theme.AppCompat.DayNight.NoActionBar` → `Theme.AppCompat.Light.NoActionBar`(컴파일된 리소스로 확인).
- [23:02] **L-7** 템플릿 `drawable{,-land-*,-port-*}/splash.png` 11개와 예제 테스트 2개(`app/src/test`·`app/src/androidTest`, 패키지 `com.getcapacitor.myapp`) 삭제(미추적 파일, 고정 경로 `rm`). `AppTheme.NoActionBarLaunch` 의 `android:background` 를 `@drawable/splash` → `@color/theroute_window_bg`, 그리고 `windowSplashScreenBackground` 도 같은 색(Android 12+ 시스템 시작 화면 배경). APK 리소스 표에 `drawable/splash` 없음 확인, 빌드 리소스 오류 없음. 남긴 것: `drawable-v24/ic_launcher_foreground.xml`·`mipmap-*/ic_launcher_foreground.png`·`drawable/ic_launcher_background.xml`·`layout/activity_main.xml`(쓰이지 않는 템플릿 리소스 — 지시 범위 밖이라 그대로).
- [23:03] **L-6** apple-touch-icon 을 모서리 없는 꽉 찬 사각(`artSvg('full')`)으로 — 180×180 모서리 픽셀 `rgba(238,100,56,255)`(불투명) 확인. favicon.svg·favicon-32 는 둥근 사각 유지.
- [23:03] `.gitignore` 에 `node_modules`(끝 슬래시 없음) 추가 → `git check-ignore` 가 `backend/node_modules` 링크를 `.gitignore:8` 로 거름, untracked 목록에서 사라짐.
- 하지 않은 것(지시대로): L-1 표식 파일, L-8 문서류.

### B. 데모 v1 반영

- **D1 B · D3 B** `gen-app-icons.mjs` 상수를 데모 `ICONS.B` 그대로: `BRAND '#EE6438'`, `ROUTE 'M46,78 L62,56 L48,32'`(리터럴 — 이전의 HOLDS 계산식은 버림), `HOLDS (46,78,6.5)·(62,56,5.5)·(48,32,7.5)`, `STROKE 5`. 재생성 → `ic_launcher_background #EE6438`, 전경·monochrome 벡터, 밀도별 PNG, 파비콘 3종이 같은 도안. `web/index.html` 의 `theme-color` 는 건드리지 않았다.
- **D2 B** `theroute_colors.xml` `theroute_window_bg #FFFFFF`(tokens.css surface). 바 아이콘 어둡게 유지.
- **L-5** 색 단일 정의: 아이콘 주황 = 생성기 `BRAND` 한 곳, 창 배경 = `theroute_colors.xml` 한 곳(styles.xml 은 참조만). `base.css` 근거 주석을 `tokens.css` 근거로 고침(생성기·theroute_colors·styles·app-shell). app-shell 은 단독 HTML 이라 가이드 §0 대로 값을 복사하고 토큰 이름을 주석으로 단다.
- **app-shell** 가이드 §2-3 그대로: 앱 이름(13px 600 #6b6b68) → "서버에 연결할 수 없습니다"(18px 700 #131313) → "인터넷 연결을 확인한 뒤 다시 시도해 주세요." → "다시 시도"(19px 700, min-height 52, min-width 200, 패딩 0 28px, 모서리 10px, `#ee6438` 다음 줄 `oklch(67% 0.18 38)`, 누름 brightness .94, 포커스 3px #9d2800). 버튼·`online` → `#fail` 숨김, `#retrying`("다시 연결하는 중…"/"잠시만 기다려 주세요."/스피너+"연결 중") 표시, `aria-live` 에 "다시 연결하는 중입니다", `location.replace('https://climb.xn--lh0b87pnudm10a4vd.com/')`. 배경 #f6f5f3, 시스템 글꼴, 외부 요청·플러그인 없음, `prefers-reduced-motion` 에서 스피너 정지.

### C. 실제로 실행한 검증

| # | 검사 | 결과 |
|---|---|---|
| 1 | 잠금 T1 그냥 `--check-lock` | rc 0 |
| 2 | 잠금 T2 바깥 `flock` + `HELD=1` | rc 0, 0초 — 교착 없음 |
| 3 | 잠금 T3 다른 보유자 + `WAIT=2` | 2초 뒤 안내 메시지, rc 75 |
| 4 | 잠금 T4 `HELD=1` 인데 보유자 없음 | "직접 잡는다" 후 rc 0 |
| 5 | 잠금 T5 바깥 `flock` 을 HELD 없이(옛 교착 상황) + `WAIT=3` | 3초 뒤 rc 75 — 교착이 제한 시간으로 끝남 |
| 6 | 잘못된 인자·`WAIT=abc` | rc 2 / rc 2 |
| 7 | M-1 블록을 스크립트에서 그대로 떼어 더미 값(실제 비밀 아님)으로, 깨끗한 `env -i bash`(/usr/bin/grep) | 양성 rc 1 · 음성 rc 0 · unzip 실패 rc 3 · grep 이 도는 동안 argv 에 더미 값이 있는 프로세스 0개, grep argv `-f /dev/fd/63` |
| 8 | M-3 rsync 필터 시험(작은 디렉터리) | `@eaDir`·`*@SynoEAStream` 안 보냄, 수신 쪽 옛 것 삭제, `build/` 보호 유지 |
| 9 | 아이콘 생성기 2회 실행 | scratchpad 두 결과 `diff -r` 동일, 소스 산출물과도 전부 동일 |
| 10 | release 재빌드(바깥 flock 없음) | 캐시 정리 분기 1회(해시가 바뀌므로 정상) → gradle rc 0, 스크립트 검사 전부 통과 |
| 11 | 정적 5종 | badging: 패키지·라벨·1/1.0.0·min 23/target 35·권한 4종+androidx 1·debuggable 없음 / manifest: allowBackup=false·MainActivity launchMode 2·adjustResize·`theroute://auth`(data 1개) / 아이콘: `dump resources` 로 찾은 `res/BW.xml` 에 background·foreground·monochrome, `color/ic_launcher_background #ffee6438`, foreground·monochrome = `drawable/ic_theroute_*` / apksigner rc 0·`CN=TheRoute, O=miraclepenguin`·SHA-256 `bab3ef3f…c1f538ce` = 기대값 / capacitor.config.json 기대값 그대로 |
| 12 | 추가 | 테마 parent `Theme.AppCompat.Light.NoActionBar`, 창 배경 `#ffffffff`, 바 아이콘 true/true, Launch 테마 `windowSplashScreenBackground=@color/theroute_window_bg`, `drawable/splash` 리소스 없음, APK `assets/public/index.html` 이 새 app-shell(문구·aria-live·oklch·reduced-motion 확인) |
| 13 | gradle 부정 시험 N1 서명 env 4개 제거 | rc 1, 설정 단계 "release 서명 환경변수 없음: THEROUTE_KEYSTORE, THEROUTE_KEYSTORE_PASSWORD, THEROUTE_KEY_ALIAS", BUILD FAILED in 5s (`nice -n 10 flock`, `--no-daemon --max-workers=2`, 로그 `logs/neg1-noenv.log`) |
| 14 | gradle 부정 시험 N2 `THEROUTE_KEYSTORE=~/.android/debug.keystore`·alias androiddebugkey·더미 비밀번호 | rc 1, "release 를 디버그 키로 서명하려 했다", BUILD FAILED in 5s (`logs/neg2-debugkey.log`). 부정 시험 뒤 산출 APK sha256 그대로 |
| 15 | 소스 해시·문법·XML | 재계산 = 기록(`d04ba56e…5b9f`), `bash -n` 2개 통과, res XML 전부 well-formed·주석 `--` 0건 |
| 16 | 비밀 | `-f <(printf)` 방식으로 worktree mobile·web/public·.gitignore·작업 디렉터리 logs(부정 시험 로그 포함)·handoffs 검사 → 없음 |

**새 APK**: `/home/brownjeon/.node-local/theroute-mobile/out/theroute-1.0.0-1.apk` — 3,096,842 bytes, sha256 `ab9a74fa58190bd74a6f6ac956bdb2e8bab2bd3dd1114e7a6cc274bf16a93a3c` (versionCode 1 유지, splash 11장 제거로 약 89KB 감소).

### 못 한 것
- 실기기(시스템 다크 모드에서 라이트 유지, 시작 화면 색, 아이콘 마스크·테마 아이콘, app-shell 실제 표시·재시도). app-shell 은 브라우저 렌더 확인도 안 했다(APK 안 파일 내용만 확인).
- NFS 정본 경로에서 실제 실행(병합 전이라 불가). M-3 은 필터 단위 시험으로만 확인.
- versionCode 는 지시대로 1 유지 — 아직 설치된 기기가 없으므로 문제 없음. 첫 설치 뒤의 네이티브 변경부터 올린다.

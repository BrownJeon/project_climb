# TheRoute Android APK 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TheRoute 운영 웹(`climb.미라클펭귄.com`)을 Capacitor 7 WebView로 감싼 안드로이드 APK를 만들어, 폰에 사이드로드해 앱으로 쓴다.

**Architecture:** 앱은 껍데기다 — WebView가 `server.url`로 운영 도메인을 직접 로드하므로 화면·기능 수정은 웹 배포만으로 반영된다. 웹 번들은 앱과 브라우저에 **같은 것**이 나가므로 웹 코드는 `@capacitor/*`를 import하지 않고 `window.Capacitor` 전역만 본다. Google이 WebView OAuth를 차단하므로 로그인은 Custom Tab → 60초·1회용 코드 → 커스텀 스킴 딥링크로 우회한다.

**Tech Stack:** Capacitor 7 · Android targetSdk 35 · JDK 21 · Gradle(assembleDebug) · Node 20 내장 `node --test` · Express 4 · React 18 + Vite 5

**Spec:** [`docs/superpowers/specs/2026-09-18-android-apk-design.md`](../specs/2026-09-18-android-apk-design.md)

## Global Constraints

모든 태스크의 요구사항에 아래가 암묵적으로 포함된다.

- **NFS는 noexec**: `project/` 아래에서 npm·Capacitor CLI·gradle을 실행할 수 없다. 소스 편집은 항상 NFS(`/home/brownjeon/NFS/homes/brownjeon/project/TheRoute`), 실행은 ext4 미러 `~/.node-local/theroute-mobile`에서만. 반대 방향(미러→NFS) 동기화는 스크립트가 하지 않는다 — 미러에서 생긴 파일은 손으로 되돌린다.
- **`node --test`는 NFS에서 정상 동작**(node v20.20.2로 확인). 테스트는 NFS에서 바로 돌린다. 추가 테스트 프레임워크를 설치하지 않는다.
- **gradle 출력을 파이프로 자르지 않는다** — `| head`·`| tail`은 SIGPIPE로 빌드를 죽인다. 로그 파일로 보내고 종료 코드로 판단한다.
- **Android XML 주석에 하이픈 두 개를 쓰지 않는다** — `mergeDebugResources`가 실패한다.
- **웹 코드는 `@capacitor/*`를 import하지 않는다** — `window.Capacitor` 전역만 본다.
- **공용 패키지 `project/shared/auth-oauth`를 수정하지 않는다** (5개 프로젝트 공용).
- **`backend/src/index.js`의 SPA 폴백 정규식 `/^\/(?!api|uploads|health).*$/`를 수정하지 않는다.**
- **코드·토큰 원문을 로그에 남기지 않는다.**
- API 응답 형식은 `{ success: boolean, data: any, message: string }` (프로젝트 규약).
- 확정 식별자: `appId=com.miraclepenguin.theroute` · `appName=더 루트` · 딥링크 `theroute://auth/callback` · 쿠키 `route_app_login` · sessionStorage 키 `theroute_app_login_handled` · JWT localStorage 키 `theroute_token` · 운영 URL `https://climb.xn--lh0b87pnudm10a4vd.com`
- 브랜드 색: bg `#fafafa` · primary `#ff5a3c` · text `#1a1a1a` · muted `#6b7280`
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`를 붙인다.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `mobile/capacitor.config.ts` | 앱 정체성·원격 URL·edge-to-edge 설정. 네이티브 동작의 단일 진실 |
| `mobile/app-shell/index.html` | 운영 웹 로드 실패 시에만 뜨는 안내. 플러그인 접근 없음 |
| `mobile/scripts/sync-local.sh` | NFS → ext4 미러 단방향 동기화 |
| `mobile/scripts/build-apk.sh` | 동기화 → cap sync → gradle assembleDebug |
| `mobile/android/app/src/main/AndroidManifest.xml` | 권한·딥링크·launchMode |
| `mobile/android/app/src/main/java/.../MainActivity.java` | API 35+ 키보드 인셋 보정 |
| `mobile/android/app/src/main/res/values/{styles,theroute_colors}.xml` | 시스템 바 뒤 창 배경·바 아이콘 밝기 |
| `mobile/scripts/gen-app-icons.mjs` | 아이콘 도안의 단일 진실. 산출물은 손으로 고치지 않는다 |
| `web/src/native/bridge.js` | `window.Capacitor` 접근의 **유일한** 경로. 없으면 no-op |
| `web/src/native/appLogin.js` | 딥링크 → 로그인. React 비의존(단위 테스트 대상) |
| `web/src/native/backStack.js` | 뒤로가기 스택. React 비의존(단위 테스트 대상) |
| `web/src/native/useBackHandler.js` | 모달이 열린 동안 스택에 닫기 함수를 올리는 훅 |
| `web/src/native/NativeAppHost.jsx` | 앱에서만 켜지는 전역 연결부. 웹에서는 아무것도 하지 않음 |
| `backend/src/services/appAuthCodes.js` | 60초·1회용 코드 저장소 + 쿠키 헬퍼 |
| `backend/src/routes/appOAuthCallback.js` | 앱 로그인 복귀 가로채기. 쿠키 없으면 `next()` |

---

### Task 1: Capacitor 셸 골격과 Android 프로젝트 생성

기존 React Native Expo 앱을 제거하고 Capacitor 셸 골격을 세운 뒤, 미러에서 `npx cap add android`로 Android 프로젝트를 만들어 NFS로 되돌린다.

**Files:**
- Delete: `mobile/App.js`, `mobile/package.json`, `mobile/package-lock.json`, `mobile/src/**`, `mobile/assets/**`
- Create: `mobile/package.json`, `mobile/capacitor.config.ts`, `mobile/app-shell/index.html`, `mobile/scripts/sync-local.sh`, `mobile/scripts/build-apk.sh`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: 미러 `~/.node-local/theroute-mobile/`, NFS `mobile/android/` 프로젝트, 빌드 진입점 `bash mobile/scripts/build-apk.sh`

- [ ] **Step 1: 기존 RN Expo 앱 제거**

사용자 결정(2026-09-18)에 따라 삭제한다. git 이력에는 남는다. 추적 파일은 19개다.

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git rm -r --quiet mobile
git status --short
```

기대: `mobile/` 아래 19개 파일이 `D`로 표시된다. `mobile/node_modules`는 추적되지 않아 디렉터리가 남을 수 있다 — 남아 있으면 지운다.

- [ ] **Step 2: `mobile/package.json` 작성**

플러그인은 3개만 쓴다. BJJ의 `file-transfer`·`filesystem`은 TheRoute에 다운로드 흐름이 없어 제외하고, `status-bar`는 BJJ에서도 실제 호출되지 않아 제외한다.

```json
{
  "name": "theroute-mobile",
  "version": "1.0.0",
  "private": true,
  "description": "더 루트 Android 앱 껍데기 (Capacitor 7, 운영 웹을 원격 URL 로 로드)",
  "scripts": {
    "sync": "bash scripts/sync-local.sh",
    "build:apk": "bash scripts/build-apk.sh"
  },
  "dependencies": {
    "@capacitor/app": "^7.1.2",
    "@capacitor/browser": "^7.0.5",
    "@capacitor/core": "^7.6.9"
  },
  "devDependencies": {
    "@capacitor/android": "^7.6.9",
    "@capacitor/cli": "^7.6.9",
    "typescript": "^5.9.3"
  }
}
```

- [ ] **Step 3: `mobile/capacitor.config.ts` 작성**

```ts
/**
 * Capacitor 설정 — 더 루트 Android 앱 (T009).
 *
 * 앱은 껍데기고 내용물은 서버에 있다. `server.url` 이 운영 도메인을 가리키므로 WebView 가 항상
 * 최신 웹을 로드한다 — 화면·기능 수정은 웹 배포만으로 반영되고 APK 재설치가 필요 없다.
 * APK 를 다시 만들어야 하는 것은 아이콘·권한·플러그인·이 설정 파일을 바꿀 때뿐이다.
 *
 * `webDir`(`app-shell/`)는 Capacitor 가 요구하는 자리표시이고, 그 안의 `index.html` 을
 * `server.errorPath` 로 지정해 운영 웹을 불러오지 못했을 때만 안내로 쓴다.
 *
 * 퓨니코드를 쓰는 이유: 한글 도메인을 그대로 적으면 플랫폼마다 IDN 정규화가 달라 WebView 가 못 열거나,
 * Capacitor 가 "앱 내부 주소"로 판정하는 호스트 비교가 어긋나 같은 도메인 링크가 외부 브라우저로
 * 튕긴다(BJJ·TheMeal 에서 같은 이유로 퓨니코드 사용).
 *
 * `androidScheme: 'https'` + `cleartext: false`: 운영 서버가 정식 인증서를 쓴다. 스킴을 https 로 맞춰
 * Secure 쿠키·보안 컨텍스트 전용 API 가 브라우저와 똑같이 동작하게 한다.
 *
 * 서명: Play 스토어에 올리지 않고 디버그 서명 APK(`~/.android/debug.keystore`)를 사이드로드한다.
 */
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.miraclepenguin.theroute',
  appName: '더 루트',
  webDir: 'app-shell',
  server: {
    url: 'https://climb.xn--lh0b87pnudm10a4vd.com',
    androidScheme: 'https',
    cleartext: false,
    errorPath: 'index.html',
  },
  android: {
    // Android 15(targetSdk 35)는 edge-to-edge 를 강제해 WebView 가 상태바·내비게이션바 밑까지 그려지는데,
    // 이 WebView 는 CSS env(safe-area-inset-*) 를 0 으로 준다 → 하단 탭(BottomNav)이 시스템 내비게이션
    // 버튼과 겹친다. 'auto' 는 API 35+ 에서 WebView 에 시스템 바·컷아웃 크기만큼 네이티브 margin 을 줘
    // 웹이 바를 아예 피하게 한다. 바 뒤 배경은 styles.xml 의 창 배경색이 채운다.
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
```

- [ ] **Step 4: `mobile/app-shell/index.html` 작성**

색은 `web/src/styles/base.css`와 같은 값이다.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>더 루트</title>
    <style>
      html, body { margin: 0; height: 100%; background: #fafafa; color: #6b7280;
        font: 14px/1.6 -apple-system, BlinkMacSystemFont, 'Pretendard', system-ui, sans-serif; }
      main { height: 100%; display: grid; place-items: center; text-align: center; padding: 24px; box-sizing: border-box; }
      h1 { font-size: 18px; margin: 0 0 8px; color: #1a1a1a; font-weight: 600; }
      p { margin: 0; word-break: keep-all; }
      .sub { margin-top: 6px; font-size: 12px; }
      .connecting { display: none; }
      body.retrying .connecting { display: block; }
      body.retrying .fail { display: none; }
      button { margin-top: 18px; min-height: 44px; padding: 10px 20px; border: 0; border-radius: 10px;
        background: #ff5a3c; color: #fff; font: inherit; font-weight: 600; }
    </style>
  </head>
  <body>
    <main>
      <div>
        <h1>더 루트</h1>
        <div class="fail">
          <p>서버에 연결할 수 없습니다.</p>
          <p class="sub">네트워크 연결을 확인한 뒤 다시 시도해 주세요.</p>
          <button type="button" id="retry">다시 시도</button>
        </div>
        <p class="connecting">서버에 연결 중…</p>
      </div>
    </main>
    <script>
      /*
        이 파일은 거의 보이지 않는다. 앱은 capacitor.config.ts 의 server.url 로 운영 웹을 직접 로드하고,
        이 파일은 server.errorPath 로 지정돼 운영 웹을 불러오지 못했을 때만 뜬다.
        Android 에서 이 오류 페이지는 Capacitor 플러그인에 접근할 수 없다 — 순수 HTML 로만 동작해야 한다.
      */
      (function () {
        var APP_URL = 'https://climb.xn--lh0b87pnudm10a4vd.com/';
        function retry() {
          document.body.classList.add('retrying');
          location.replace(APP_URL);
        }
        document.getElementById('retry').addEventListener('click', retry);
        window.addEventListener('online', retry);
      })();
    </script>
  </body>
</html>
```

- [ ] **Step 5: `mobile/scripts/sync-local.sh` 작성**

```bash
#!/usr/bin/env bash
# NFS(소스 진실) → ext4 미러(~/.node-local/theroute-mobile) 동기화 — T009.
#
# 왜 필요한가: NFS(project/)는 noexec 이라 npm·Capacitor CLI·gradle 을 NFS 위에서 돌릴 수 없다.
# mobile/ 의 소스(설정·app-shell·android 프로젝트)를 미러로 보낸 뒤 미러에서 빌드한다.
# 편집은 항상 NFS 쪽에서 하고, 미러는 실행 전용이다.
#
# 반대 방향(미러 → NFS)은 이 스크립트가 하지 않는다. `npx cap add android`·`npm install` 처럼
# 미러에서 파일이 생기는 작업 뒤에는 필요한 파일만 손으로 NFS 로 되돌린다.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ROOT="${THEROUTE_MOBILE_LOCAL:-$HOME/.node-local/theroute-mobile}"

mkdir -p "$LOCAL_ROOT"

rsync -a --delete "$PROJECT_ROOT/app-shell/" "$LOCAL_ROOT/app-shell/"
rsync -a --delete "$PROJECT_ROOT/scripts/" "$LOCAL_ROOT/scripts/"

# 안드로이드 프로젝트. NFS 가 소스이고 빌드는 미러에서만 돈다.
#   · build/ · .gradle/ 은 산출물 — 보내지 않는다(매번 수백 MB).
#   · local.properties 는 기계별 값(sdk.dir) — 덮어쓰면 안 된다.
#   · --delete 를 쓰되 위 셋은 --filter 'P'(protect)로 지킨다.
if [ -d "$PROJECT_ROOT/android" ]; then
  rsync -a --delete \
    --exclude 'build/' --exclude '.gradle/' --exclude 'local.properties' --exclude '.idea/' \
    --filter 'P build/' --filter 'P .gradle/' --filter 'P local.properties' --filter 'P .idea/' \
    "$PROJECT_ROOT/android/" "$LOCAL_ROOT/android/"
fi

for f in package.json package-lock.json capacitor.config.ts tsconfig.json; do
  if [ -f "$PROJECT_ROOT/$f" ]; then
    cp "$PROJECT_ROOT/$f" "$LOCAL_ROOT/$f"
  fi
done

exit 0
```

- [ ] **Step 6: `mobile/scripts/build-apk.sh` 작성**

```bash
#!/usr/bin/env bash
# 디버그 APK 빌드 — T009. NFS 에서 호출해도 되고(스크립트 파일은 bash 로 읽힌다), 실제 실행은 미러에서 한다.
#
#   bash /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/scripts/build-apk.sh
#
# 순서: NFS → 미러 동기화 → (node_modules 없으면 npm ci) → `npx cap sync android` → gradle assembleDebug
#
# 🔴 gradle 출력은 로그 파일로만 보낸다. 파이프로 자르면 SIGPIPE 로 빌드가 중간에 죽는다.
#    결과는 종료 코드와 로그 끝부분으로 판단한다.
# 🔴 JDK 21 을 명시한다 — @capacitor/android 7 이 Java 21(VERSION_21)을 요구한다.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ROOT="${THEROUTE_MOBILE_LOCAL:-$HOME/.node-local/theroute-mobile}"
export JAVA_HOME="${JAVA_HOME_21:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.node-local/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

LOG_DIR="${THEROUTE_APK_LOG_DIR:-$LOCAL_ROOT/logs}"
mkdir -p "$LOG_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
CAP_LOG="$LOG_DIR/cap-sync-$STAMP.log"
GRADLE_LOG="$LOG_DIR/gradle-$STAMP.log"

bash "$PROJECT_ROOT/scripts/sync-local.sh"

cd "$LOCAL_ROOT"
if [ ! -d node_modules/@capacitor/cli ]; then
  echo "[build-apk] node_modules 없음 → npm ci"
  npm ci --no-audit --no-fund > "$LOG_DIR/npm-ci-$STAMP.log" 2>&1
fi

# local.properties(sdk.dir)는 기계별 값이라 NFS 에 두지 않는다 — 미러에 없으면 만든다.
if [ ! -f android/local.properties ]; then
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi

echo "[build-apk] npx cap sync android → $CAP_LOG"
set +e
npx cap sync android > "$CAP_LOG" 2>&1
CAP_RC=$?
set -e
if [ "$CAP_RC" -ne 0 ]; then
  echo "[build-apk] cap sync 실패 rc=$CAP_RC — 로그: $CAP_LOG"
  exit "$CAP_RC"
fi

echo "[build-apk] gradlew assembleDebug → $GRADLE_LOG (JAVA_HOME=$JAVA_HOME)"
cd "$LOCAL_ROOT/android"
set +e
./gradlew assembleDebug --no-daemon > "$GRADLE_LOG" 2>&1
GRADLE_RC=$?
set -e
echo "[build-apk] gradle rc=$GRADLE_RC"
if [ "$GRADLE_RC" -ne 0 ]; then
  echo "[build-apk] 빌드 실패 — 로그: $GRADLE_LOG"
  exit "$GRADLE_RC"
fi

APK="$LOCAL_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK" ]; then
  echo "[build-apk] 빌드는 성공했는데 APK 가 없다: $APK"
  exit 1
fi
echo "[build-apk] APK: $APK"
echo "[build-apk] size: $(stat -c %s "$APK") bytes"
echo "[build-apk] md5:  $(md5sum "$APK" | cut -d' ' -f1)"
```

- [ ] **Step 7: `.gitignore`에 Android 산출물·서명 키 추가**

`.gitignore` 끝에 덧붙인다. 기존 `build/`·`*.jks` 줄은 그대로 둔다.

```gitignore

# Android 앱 (T009) — 소스(mobile/android)는 커밋, 빌드 산출물·기계별 설정·서명 키는 제외
mobile/android/.gradle/
mobile/android/build/
mobile/android/app/build/
mobile/android/local.properties
mobile/android/app/src/main/assets/public/
mobile/android/app/src/main/assets/capacitor.config.json
mobile/android/app/src/main/assets/capacitor.plugins.json
mobile/android/capacitor-cordova-android-plugins/
*.keystore
```

`assets/public`·`capacitor.config.json`·`capacitor.plugins.json`·`capacitor-cordova-android-plugins/`는 `npx cap sync`가 매번 다시 만드는 산출물이다.

- [ ] **Step 8: 미러에서 의존성 설치와 Android 프로젝트 생성**

```bash
bash /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/scripts/sync-local.sh
cd ~/.node-local/theroute-mobile
npm install --no-audit --no-fund
npx cap add android
```

기대: `~/.node-local/theroute-mobile/android/`가 생기고 `npx cap add android`가 성공으로 끝난다. `package-lock.json`도 미러에 생긴다.

- [ ] **Step 9: 미러에서 생긴 결과물을 NFS로 되돌리기**

`sync-local.sh`는 단방향이라 이 되돌림만 손으로 한다.

```bash
M=~/.node-local/theroute-mobile
N=/home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile
cp "$M/package-lock.json" "$N/package-lock.json"
rsync -a --exclude 'build/' --exclude '.gradle/' --exclude 'local.properties' --exclude '.idea/' \
      --exclude 'app/src/main/assets/public/' --exclude 'capacitor-cordova-android-plugins/' \
      "$M/android/" "$N/android/"
ls "$N/android/app/src/main/java/com/miraclepenguin/theroute/"
```

기대: 마지막 `ls`가 `MainActivity.java`를 보여 준다(패키지 경로가 `appId`에서 나온다).

- [ ] **Step 10: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add -A mobile .gitignore
git commit -m "feat(mobile): Capacitor 7 Android 셸 골격 (RN Expo 제거)

파손 상태로 방치된 React Native Expo 앱을 삭제하고, 운영 웹을 원격 URL 로
로드하는 Capacitor 7 셸로 교체한다. 플러그인은 app·browser·core 3개만 쓴다
(다운로드 흐름이 없어 file-transfer/filesystem 제외, status-bar 미사용).

NFS noexec 때문에 빌드는 ext4 미러에서만 돈다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 네이티브 커스터마이즈와 첫 APK 빌드

Manifest·테마·MainActivity를 TheRoute에 맞게 고치고, 실제로 설치되는 APK를 처음으로 뽑는다.

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/src/main/res/values/styles.xml`
- Create: `mobile/android/app/src/main/res/values/theroute_colors.xml`
- Modify: `mobile/android/app/src/main/java/com/miraclepenguin/theroute/MainActivity.java`

**Interfaces:**
- Consumes: Task 1의 `mobile/android/` 프로젝트와 `build-apk.sh`
- Produces: 설치 가능한 `app-debug.apk`. 딥링크 수신처 `theroute://auth` (Task 6의 서버 302 대상), 권한 `ACCESS_FINE_LOCATION`·`ACCESS_COARSE_LOCATION`·`CAMERA`

- [ ] **Step 1: `AndroidManifest.xml` 교체**

Capacitor 템플릿이 만든 `<provider>` FileProvider 블록은 그대로 둔다.

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- allowBackup=false: WebView localStorage 의 로그인 JWT(theroute_token)가 Android 자동 백업으로
         기기 밖에 복사되지 않게 한다. -->
    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">

        <!-- launchMode="singleTask": 로그인 딥링크(theroute://auth/callback)가 도착하면 이미 떠 있는
             이 화면으로 돌아온다(새 화면이 하나 더 쌓이지 않는다). 같은 태스크 위에 떠 있던
             Custom Tab(로그인 창)도 이때 함께 정리된다. -->
        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:name=".MainActivity"
            android:windowSoftInputMode="adjustResize"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

            <!-- OAuth 로그인 복귀 딥링크. Google 은 WebView 안 로그인을 막으므로 앱은 Custom Tab 으로
                 로그인을 열고, 서버가 로그인 끝에 theroute://auth/callback?code=(60초 1회용 코드) 로
                 302 한다. 이 intent-filter 가 없으면 로그인을 마쳐도 브라우저에 "주소를 열 수 없습니다"가
                 뜨고 앱은 로그인 화면에 그대로 남는다.
                 딥링크에는 JWT 가 아니라 1회용 코드만 싣는다(웹이 POST /api/auth/app-exchange 로 교환). -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="theroute" android:host="auth" />
            </intent-filter>

        </activity>

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>
    </application>

    <uses-permission android:name="android.permission.INTERNET" />

    <!-- 위치: GymListPage 의 내 주변 암장 검색(navigator.geolocation). WebView 가 권한을 요청하려면
         앱 권한이 먼저 선언돼 있어야 한다. -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

    <!-- 카메라: 문제 사진·프로필 사진 업로드의 input type=file 촬영 경로. -->
    <uses-permission android:name="android.permission.CAMERA" />
</manifest>
```

저장소 권한은 선언하지 않는다 — 다운로드/기기 저장 흐름이 없다.

- [ ] **Step 2: `res/values/theroute_colors.xml` 생성**

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- 앱 라이트 배경(web/src/styles/base.css 의 bg 토큰). 시스템 바 뒤 창 배경으로 쓴다
         (styles.xml AppTheme.NoActionBar). XML 주석에는 하이픈 두 개를 쓸 수 없다. -->
    <color name="theroute_window_bg">#FAFAFA</color>
</resources>
```

- [ ] **Step 3: `res/values/styles.xml`의 `AppTheme.NoActionBar` 교체**

BJJ는 다크 테마라 바 아이콘이 밝았다. TheRoute는 **라이트 배경이므로 바 아이콘을 어둡게** 한다.

```xml
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <!-- capacitor.config 의 adjustMarginsForEdgeToEdge 로 WebView 가 시스템 바를 피하면,
             바 뒤로 보이는 것은 이 창 배경이다. 앱 라이트 배경(base.css bg #fafafa)과 같게 하고,
             밝은 배경 위이므로 바 아이콘은 어둡게 한다. -->
        <item name="android:windowBackground">@color/theroute_window_bg</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
    </style>
```

- [ ] **Step 4: `MainActivity.java` 교체**

```java
package com.miraclepenguin.theroute;

import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * 키보드(IME)가 열리면 WebView 를 키보드 위까지로 줄인다.
 *
 * Android 15(targetSdk 35)는 edge-to-edge 가 강제돼 windowSoftInputMode=adjustResize 가 더 이상
 * 창을 줄이지 않는다. capacitor.config 의 android.adjustMarginsForEdgeToEdge: 'auto' 는 WebView
 * margin 을 시스템 바·컷아웃만큼만 준다 — 키보드는 계산하지 않는다.
 * 그래서 Capacitor 가 onCreate 중에 건 인셋 리스너를 같은 계산 + 키보드로 교체한다:
 * 하단 margin = max(내비게이션 바, 키보드). 키보드가 닫히면 ime = 0 이라 내비게이션 바만큼으로 돌아간다.
 * WebView 가 실제로 줄어들어야 웹의 고정 하단 탭·스크롤 영역이 키보드 위에서 다시 계산된다.
 *
 * API 34 이하는 edge-to-edge 강제가 아니라 매니페스트 adjustResize 가 창을 줄이므로 손대지 않는다
 * (거기에 키보드 margin 까지 주면 이중으로 줄어든다).
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView == null) return;

        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams mlp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            mlp.leftMargin = bars.left;
            mlp.topMargin = bars.top;
            mlp.rightMargin = bars.right;
            mlp.bottomMargin = Math.max(bars.bottom, ime.bottom);
            v.setLayoutParams(mlp);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
```

- [ ] **Step 5: `strings.xml` 확인**

```bash
cat /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/android/app/src/main/res/values/strings.xml
```

기대: `app_name`·`title_activity_main`이 `더 루트`, `package_name`·`custom_url_scheme`이 `com.miraclepenguin.theroute`. `npx cap add android`가 `capacitor.config.ts`에서 채운 값이다. 다르면 손으로 맞춘다.

- [ ] **Step 6: WebView geolocation 권한 처리 여부 확인**

Capacitor 7의 기본 WebChromeClient가 `onGeolocationPermissionsShowPrompt`를 구현하는지 본다. 구현하지 않으면 위치 요청이 조용히 거부된다.

```bash
grep -rn "onGeolocationPermissionsShowPrompt" ~/.node-local/theroute-mobile/node_modules/@capacitor/android/capacitor/src/main/java/ || echo "미구현 — MainActivity 보강 필요"
```

- 출력이 있으면: 그대로 둔다.
- `미구현 — MainActivity 보강 필요`가 나오면 `MainActivity.onCreate`의 `ViewCompat.requestApplyInsets(webView);` 바로 앞에 아래를 넣는다.

```java
        webView.setWebChromeClient(new com.getcapacitor.BridgeWebChromeClient(getBridge()) {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, android.webkit.GeolocationPermissions.Callback callback) {
                // 앱이 로드하는 출처는 capacitor.config 의 server.url 하나뿐이다(내 서버).
                // 앱 단위 위치 권한은 Android 가 별도로 묻는다 — 여기서는 WebView 쪽 허용만 준다.
                callback.invoke(origin, true, false);
            }
        });
```

- [ ] **Step 7: 첫 APK 빌드**

```bash
bash /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/scripts/build-apk.sh
```

기대: `[build-apk] gradle rc=0`과 APK 경로·크기·md5가 출력된다. 실패하면 출력에 적힌 gradle 로그 파일의 끝부분을 읽는다(파이프로 자르지 말 것).

- [ ] **Step 8: 정적 검사**

```bash
BT=~/.node-local/android-sdk/build-tools/35.0.0
APK=~/.node-local/theroute-mobile/android/app/build/outputs/apk/debug/app-debug.apk
$BT/aapt2 dump badging "$APK" > /tmp/theroute-badging.txt 2>&1
grep -E "^package|application-label|uses-permission" /tmp/theroute-badging.txt
$BT/apksigner verify --print-certs "$APK"
unzip -p "$APK" assets/capacitor.config.json
$BT/aapt2 dump xmltree --file AndroidManifest.xml "$APK" > /tmp/theroute-manifest.txt 2>&1
grep -E "launchMode|scheme|allowBackup" /tmp/theroute-manifest.txt
```

기대:
- `package: name='com.miraclepenguin.theroute'`
- `application-label:'더 루트'`
- `uses-permission`: `INTERNET`·`ACCESS_FINE_LOCATION`·`ACCESS_COARSE_LOCATION`·`CAMERA` 4종, 저장소 권한 없음
- `apksigner`: `Verifies` + `Signer #1 certificate DN: CN=Android Debug, OU=Android, O=Android, L=Mountain View, ST=California, C=US`
- `capacitor.config.json`에 `"url":"https://climb.xn--lh0b87pnudm10a4vd.com"`, `"androidScheme":"https"`, `"adjustMarginsForEdgeToEdge":"auto"`
- manifest xmltree에 `launchMode(...)=0x2`, `scheme(...)="theroute"`, `allowBackup(...)=false`

- [ ] **Step 9: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add mobile/android
git commit -m "feat(mobile): Android 네이티브 설정 (딥링크·권한·라이트 테마·키보드 인셋)

- theroute://auth 딥링크 intent-filter, launchMode=singleTask, allowBackup=false
- 위치(암장 검색)·카메라(사진 업로드) 권한. 저장소 권한은 다운로드 흐름이 없어 제외
- 창 배경 #FAFAFA + 시스템 바 아이콘 어둡게 (웹이 라이트 테마라 BJJ 와 반대)
- MainActivity: API 35+ 에서 하단 margin = max(내비게이션 바, 키보드)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 앱 아이콘 생성기와 적용

도안을 코드 상수로 두는 생성기를 만들고, Android 적응형 3레이어 + 밀도별 PNG + 웹 파비콘을 한 번에 뽑는다.

> **왜 `mobile/scripts/`인가** (스펙 §11): `sharp`는 네이티브 모듈이라 ext4 미러에 설치해야 하는데,
> `sync-local.sh`가 이미 `mobile/scripts/`를 미러로 보내므로 미러에서 실행하면 `import sharp`가
> 형제 `node_modules`에서 **경로 조작 없이** 해결된다. `web/scripts/`에 두면 NFS 경로에서 미러의
> `node_modules`를 가리키는 절대경로 import가 필요하다.
> (BJJ는 생성기를 `web/scripts/`에 두고 TheMeal의 ext4 설치본을 빌려 쓰는데, 런북이
> "TheMeal 정리 시 같이 깨진다"고 적어 둔 바로 그 취약점이다.)

**Files:**
- Create: `mobile/scripts/gen-app-icons.mjs`
- Modify: `mobile/package.json` (devDependencies에 `sharp` 추가)
- Generate(커밋 대상): `mobile/android/app/src/main/res/drawable/ic_theroute_{foreground,monochrome}.xml`, `res/values/ic_launcher_background.xml`, `res/mipmap-anydpi-v26/ic_launcher{,_round}.xml`, `res/mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher{,_round}.png`, `web/public/{favicon.svg,favicon-32.png,apple-touch-icon.png}`
- Modify: `web/index.html` (파비콘 링크)

**Interfaces:**
- Consumes: Task 2의 `mobile/android/app/src/main/res/`
- Produces: 런처 아이콘 리소스 `@mipmap/ic_launcher`·`@mipmap/ic_launcher_round` (AndroidManifest가 이미 참조 중)

- [ ] **Step 1: `mobile/package.json`에 `sharp` 추가**

`devDependencies`에 한 줄 넣는다.

```json
  "devDependencies": {
    "@capacitor/android": "^7.6.9",
    "@capacitor/cli": "^7.6.9",
    "sharp": "^0.34.4",
    "typescript": "^5.9.3"
  }
```

- [ ] **Step 2: `mobile/scripts/gen-app-icons.mjs` 작성**

```js
#!/usr/bin/env node
/**
 * 더 루트 앱 아이콘 생성기 — T009.
 *
 * 🔴 도안은 이 파일 상단 상수(BRAND·HOLDS·ROUTE)가 **단일 진실**이다.
 *    산출된 PNG·XML 을 손으로 고치지 말 것 — 다음 실행에서 덮어써진다.
 *
 * 왜 mobile/scripts 에 있나: sharp 는 네이티브 모듈이라 ext4 미러에만 설치된다.
 * sync-local.sh 가 mobile/scripts/ 를 미러로 보내므로, 미러에서 실행하면 형제 node_modules 에서
 * sharp 가 경로 조작 없이 해결된다. NFS 는 noexec 이라 여기서는 실행할 수 없다.
 *
 * 실행:
 *   bash mobile/scripts/sync-local.sh
 *   cd ~/.node-local/theroute-mobile
 *   node scripts/gen-app-icons.mjs --android <res경로> --web <web/public 경로>
 * 두 옵션은 독립이다 — 하나만 줘도 된다.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';

// ── 도안 (108x108 적응형 좌표계) ─────────────────────────────────────────────
// 적응형 아이콘은 108x108 중 안쪽 72x72(중심 54,54 기준 ±36)만 항상 보인다.
// 바깥 18 은 런처가 모양(원·스퀘어클·물방울)에 따라 잘라 낸다 — 도안을 안전 영역 안에 둔다.
const BRAND = '#FF5A3C';      // web/src/styles/base.css 의 --primary
const ON_BRAND = '#FFFFFF';
/** 루트 라인: 왼쪽 아래에서 오른쪽 위로 오르는 등반 선. */
const ROUTE = 'M38,74 L50,57 L65,65 L72,39';
/** 홀드: 라인의 꼭짓점. 시작과 끝(손이 닿는 곳)을 크게. */
const HOLDS = [
  { x: 38, y: 74, r: 7 },
  { x: 50, y: 57, r: 5 },
  { x: 65, y: 65, r: 5 },
  { x: 72, y: 39, r: 7 },
];
const STROKE = 4;

/** 원을 path 로 — vector drawable 에는 <circle> 이 없다. */
function circlePath({ x, y, r }) {
  return `M${x - r},${y} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0`;
}

// ── Android vector drawable ─────────────────────────────────────────────────
function vectorDrawable() {
  const holds = HOLDS.map((h) => `    <path android:pathData="${circlePath(h)}" android:fillColor="${ON_BRAND}" />`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- 생성물: mobile/scripts/gen-app-icons.mjs. 손으로 고치지 말 것. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:pathData="${ROUTE}"
        android:strokeColor="${ON_BRAND}"
        android:strokeWidth="${STROKE}"
        android:strokeLineCap="round"
        android:strokeLineJoin="round" />
${holds}
</vector>
`;
}

function adaptiveIcon() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- 생성물: mobile/scripts/gen-app-icons.mjs. 손으로 고치지 말 것. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_theroute_foreground" />
    <monochrome android:drawable="@drawable/ic_theroute_monochrome" />
</adaptive-icon>
`;
}

function backgroundColorRes() {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- 생성물: mobile/scripts/gen-app-icons.mjs. 손으로 고치지 말 것. -->
<resources>
    <color name="ic_launcher_background">${BRAND}</color>
</resources>
`;
}

// ── 래스터용 SVG ────────────────────────────────────────────────────────────
function artSvg(shape) {
  const bg = shape === 'round'
    ? `<circle cx="54" cy="54" r="54" fill="${BRAND}" />`
    : `<rect width="108" height="108" rx="20" fill="${BRAND}" />`;
  const holds = HOLDS.map((h) => `<circle cx="${h.x}" cy="${h.y}" r="${h.r}" fill="${ON_BRAND}" />`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108">`
    + bg
    + `<path d="${ROUTE}" fill="none" stroke="${ON_BRAND}" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round" />`
    + holds
    + `</svg>`;
}

async function png(shape, size, outPath) {
  await sharp(Buffer.from(artSvg(shape))).resize(size, size).png().toFile(outPath);
}

// ── 실행 ────────────────────────────────────────────────────────────────────
/** 적응형 아이콘을 못 쓰는 API 25 이하용 레거시 런처 아이콘 밀도. */
const DENSITIES = [
  ['mipmap-mdpi', 48],
  ['mipmap-hdpi', 72],
  ['mipmap-xhdpi', 96],
  ['mipmap-xxhdpi', 144],
  ['mipmap-xxxhdpi', 192],
];

function argOf(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

async function writeAndroid(res) {
  await mkdir(join(res, 'drawable'), { recursive: true });
  await mkdir(join(res, 'values'), { recursive: true });
  await mkdir(join(res, 'mipmap-anydpi-v26'), { recursive: true });

  // 🔴 전경 이름을 ic_theroute_* 로 분리한다 — Capacitor 템플릿의
  //    drawable-v24/ic_launcher_foreground.xml 이 ic_launcher_foreground 라는 같은 이름을 덮는다.
  await writeFile(join(res, 'drawable', 'ic_theroute_foreground.xml'), vectorDrawable());
  await writeFile(join(res, 'drawable', 'ic_theroute_monochrome.xml'), vectorDrawable());
  await writeFile(join(res, 'values', 'ic_launcher_background.xml'), backgroundColorRes());
  await writeFile(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptiveIcon());
  await writeFile(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptiveIcon());

  for (const [dir, size] of DENSITIES) {
    await mkdir(join(res, dir), { recursive: true });
    await png('square', size, join(res, dir, 'ic_launcher.png'));
    await png('round', size, join(res, dir, 'ic_launcher_round.png'));
  }
  console.log(`[icons] android → ${res}`);
}

async function writeWeb(pub) {
  await mkdir(pub, { recursive: true });
  await writeFile(join(pub, 'favicon.svg'), artSvg('square'));
  await png('square', 32, join(pub, 'favicon-32.png'));
  await png('square', 180, join(pub, 'apple-touch-icon.png'));
  console.log(`[icons] web → ${pub}`);
}

const androidRes = argOf('--android');
const webPublic = argOf('--web');
if (!androidRes && !webPublic) {
  console.error('사용법: node scripts/gen-app-icons.mjs [--android <res경로>] [--web <public경로>]');
  process.exit(1);
}
if (androidRes) await writeAndroid(androidRes);
if (webPublic) await writeWeb(webPublic);
```

- [ ] **Step 3: 미러에 sharp 설치하고 생성기 실행**

```bash
bash /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/scripts/sync-local.sh
cd ~/.node-local/theroute-mobile
npm install --no-audit --no-fund
node scripts/gen-app-icons.mjs \
  --android /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/android/app/src/main/res \
  --web     /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web/public
```

기대: `[icons] android → …`와 `[icons] web → …` 두 줄. 생성기는 NFS 경로에 직접 쓰므로 역동기화가 필요 없다.

- [ ] **Step 4: 미러의 package-lock.json을 NFS로 되돌리기**

```bash
cp ~/.node-local/theroute-mobile/package-lock.json \
   /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/package-lock.json
```

- [ ] **Step 5: `web/index.html`에 파비콘 링크 추가**

`<title>TheRoute</title>` 바로 아래에 두 줄을 넣는다.

```html
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

- [ ] **Step 6: 아이콘을 넣어 재빌드하고 검사**

```bash
bash /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/scripts/build-apk.sh
BT=~/.node-local/android-sdk/build-tools/35.0.0
APK=~/.node-local/theroute-mobile/android/app/build/outputs/apk/debug/app-debug.apk
$BT/aapt2 dump xmltree --file res/mipmap-anydpi-v26/ic_launcher.xml "$APK"
```

기대: `gradle rc=0`. xmltree 출력에 `background`·`foreground`·`monochrome` **3개 요소**가 모두 보인다.

- [ ] **Step 7: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add mobile/scripts/gen-app-icons.mjs mobile/package.json mobile/package-lock.json \
        mobile/android/app/src/main/res web/public web/index.html
git commit -m "feat(icons): 앱 아이콘 생성기와 적응형 3레이어 아이콘

도안(클라이밍 홀드 4점 + 루트 라인, 브랜드 #FF5A3C)을 생성기 상수로 두고
Android 적응형 3레이어 + 밀도별 레거시 PNG + 웹 파비콘을 한 번에 만든다.
전경 이름을 ic_theroute_* 로 분리해 Capacitor 템플릿의 ic_launcher_foreground
와 충돌하지 않게 했다.

생성기는 mobile/scripts 에 둔다 — sync-local.sh 가 미러로 보내므로 네이티브
모듈 sharp 가 경로 조작 없이 해결된다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 앱 로그인 코드 저장소 (백엔드, TDD)

60초·1회용 코드 저장소와 표시 쿠키 헬퍼. 순수 모듈이라 먼저 테스트로 못 박는다.

**Files:**
- Create: `backend/src/services/appAuthCodes.js`
- Test: `backend/test/appAuthCodes.test.js`
- Modify: `backend/package.json` (test 스크립트)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `APP_AUTH_CODE_RE: RegExp` — `/^[0-9a-f]{64}$/`
  - `APP_AUTH_PROVIDERS: readonly string[]` — `['google','github']`
  - `APP_LOGIN_COOKIE: string` — `'route_app_login'`
  - `appAuthCodes: { issue(token: string): string, consume(code: unknown): {status:'ok',token:string} | {status:'malformed'|'unknown'|'expired'}, size(): number, ttlMs: number }`
  - `createAppAuthCodeStore(opts?: {ttlMs?: number, now?: () => number, maxEntries?: number})` — 위와 같은 모양
  - `buildAppDeepLink(params: Record<string,string>): string`
  - `readCookie(req, name: string): string | null`
  - `setAppLoginCookie(res, value: string): void`
  - `clearAppLoginCookie(res): void`

- [ ] **Step 1: `backend/package.json`에 test 스크립트 추가**

`scripts`에 한 줄 넣는다. 외부 테스트 프레임워크를 설치하지 않는다 — Node 20 내장 러너를 쓴다.

```json
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "lint": "eslint src/",
    "test": "node --test test/"
  },
```

- [ ] **Step 2: 실패하는 테스트 작성**

`backend/test/appAuthCodes.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const {
  APP_AUTH_CODE_RE,
  APP_AUTH_PROVIDERS,
  APP_LOGIN_COOKIE,
  buildAppDeepLink,
  createAppAuthCodeStore,
  readCookie,
} = require('../src/services/appAuthCodes');

test('발급한 코드는 소문자 hex 64자다', () => {
  const store = createAppAuthCodeStore();
  const code = store.issue('jwt.token.value');
  assert.match(code, APP_AUTH_CODE_RE);
});

test('한 번 교환하면 토큰이 나오고, 두 번째는 unknown 이다', () => {
  const store = createAppAuthCodeStore();
  const code = store.issue('jwt.token.value');
  assert.deepStrictEqual(store.consume(code), { status: 'ok', token: 'jwt.token.value' });
  assert.strictEqual(store.consume(code).status, 'unknown');
});

test('TTL 이 지나면 expired 이고, 그 코드도 즉시 지워진다', () => {
  let now = 1_000_000;
  const store = createAppAuthCodeStore({ ttlMs: 60_000, now: () => now });
  const code = store.issue('jwt.token.value');
  now += 60_001;
  assert.strictEqual(store.consume(code).status, 'expired');
  assert.strictEqual(store.size(), 0);
});

test('형식이 틀린 입력은 malformed 다 (저장소를 건드리지 않는다)', () => {
  const store = createAppAuthCodeStore();
  store.issue('jwt.token.value');
  for (const bad of [undefined, null, 42, '', 'ZZZ', 'a'.repeat(63), 'A'.repeat(64)]) {
    assert.strictEqual(store.consume(bad).status, 'malformed');
  }
  assert.strictEqual(store.size(), 1);
});

test('상한을 넘으면 가장 오래된 코드부터 버린다', () => {
  const store = createAppAuthCodeStore({ maxEntries: 2 });
  const first = store.issue('t1');
  store.issue('t2');
  store.issue('t3');
  assert.strictEqual(store.size(), 2);
  assert.strictEqual(store.consume(first).status, 'unknown');
});

test('딥링크는 theroute 스킴이고 빈 값은 싣지 않는다', () => {
  assert.strictEqual(buildAppDeepLink({ code: 'abc' }), 'theroute://auth/callback?code=abc');
  assert.strictEqual(buildAppDeepLink({ error: 'x', msg: '' }), 'theroute://auth/callback?error=x');
});

test('쿠키는 헤더에서 이름으로만 읽는다', () => {
  const req = { headers: { cookie: `other=1; ${APP_LOGIN_COOKIE}=fallback; trailing=2` } };
  assert.strictEqual(readCookie(req, APP_LOGIN_COOKIE), 'fallback');
  assert.strictEqual(readCookie({ headers: {} }, APP_LOGIN_COOKIE), null);
});

test('provider 화이트리스트는 google 과 github 뿐이다', () => {
  assert.deepStrictEqual([...APP_AUTH_PROVIDERS], ['google', 'github']);
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend
node --test test/
```

기대: FAIL — `Cannot find module '../src/services/appAuthCodes'`

- [ ] **Step 4: `backend/src/services/appAuthCodes.js` 구현**

```js
/**
 * 앱(Android APK) 로그인용 60초 1회용 코드 저장소 — T009.
 *
 * 왜 코드인가: Google 은 WebView 안 OAuth 를 막는다. 그래서 앱은 Custom Tab(외부 브라우저)으로
 * 로그인하고, 서버가 로그인 끝에 앱 스킴 theroute://auth/callback 으로 돌려보낸다. 그런데 Custom Tab 과
 * 앱 WebView 는 저장소(localStorage·쿠키)를 공유하지 않으므로 토큰을 어떻게든 앱에 넘겨야 한다.
 * 딥링크 URL 에 JWT(30일 유효)를 그대로 실으면 기록·가로채기 한 번에 계정이 넘어간다 —
 * 그래서 딥링크에는 60초·1회용·추측 불가(256bit) 코드만 싣고, 앱 WebView 가
 * POST /api/auth/app-exchange 로 코드를 JWT 로 바꾼다.
 *
 * 메모리 Map 인 이유: pm2 단일 프로세스(theroute-api)이고 코드 수명이 60초라, 재시작으로 잃는 것은
 * "진행 중이던 로그인 1건"뿐이다(사용자는 다시 누르면 된다). DB 테이블을 만들 이유가 없다.
 *
 * 🔴 코드·토큰 원문을 로그에 남기지 않는다(호출부 포함).
 */
const crypto = require('crypto');

/** 서버가 만드는 코드 모양 — 소문자 hex 64자(32바이트). 이 밖의 입력은 형식 오류(400). */
const APP_AUTH_CODE_RE = /^[0-9a-f]{64}$/;
/** Custom Tab 에만 심는 "이 로그인은 앱에서 시작됐다" 표시 쿠키. */
const APP_LOGIN_COOKIE = 'route_app_login';
const APP_LOGIN_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;
/** 앱 intent-filter(mobile/android/app/src/main/AndroidManifest.xml)와 같은 값. */
const APP_DEEP_LINK_BASE = 'theroute://auth/callback';
const APP_AUTH_PROVIDERS = Object.freeze(['google', 'github']);

/**
 * @param {object} [opts]
 * @param {number} [opts.ttlMs=60000]        코드 수명
 * @param {() => number} [opts.now=Date.now] 시계 — 테스트에서 시간을 주입한다
 * @param {number} [opts.maxEntries=500]     상한(발급 폭주 시 메모리 보호) — 넘으면 오래된 것부터 버린다
 */
function createAppAuthCodeStore({ ttlMs = 60 * 1000, now = Date.now, maxEntries = 500 } = {}) {
  /** code → { token, expiresAt }. Map 은 삽입 순서를 지키므로 첫 항목이 가장 오래된 것이다. */
  const codes = new Map();

  function sweep() {
    const t = now();
    for (const [code, entry] of codes) {
      if (entry.expiresAt <= t) codes.delete(code);
    }
  }

  /** 토큰을 맡기고 1회용 코드를 돌려준다. 토큰 검증(서명·만료)은 호출부 책임이다. */
  function issue(token) {
    if (typeof token !== 'string' || token === '') throw new Error('token required');
    sweep();
    while (codes.size >= maxEntries) {
      codes.delete(codes.keys().next().value);
    }
    const code = crypto.randomBytes(32).toString('hex');
    codes.set(code, { token, expiresAt: now() + ttlMs });
    return code;
  }

  /**
   * 코드를 꺼낸다. 맞든 틀리든 만료됐든 그 자리에서 지운다(1회용).
   * @returns {{status:'ok', token:string} | {status:'malformed'|'unknown'|'expired'}}
   */
  function consume(code) {
    if (typeof code !== 'string' || !APP_AUTH_CODE_RE.test(code)) return { status: 'malformed' };
    const entry = codes.get(code);
    codes.delete(code);
    if (!entry) return { status: 'unknown' };
    if (entry.expiresAt <= now()) return { status: 'expired' };
    return { status: 'ok', token: entry.token };
  }

  return { issue, consume, size: () => codes.size, ttlMs };
}

/** theroute://auth/callback?code=… / ?error=…&msg=… */
function buildAppDeepLink(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string' && v !== '') qs.set(k, v);
  }
  return `${APP_DEEP_LINK_BASE}?${qs.toString()}`;
}

/** cookie-parser 없이 한 개 값만 읽는다(이 앱에 쿠키는 이것 하나뿐이다). */
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (typeof header !== 'string' || header === '') return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      try {
        return decodeURIComponent(part.slice(idx + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

// SameSite=Lax 여야 OAuth 제공자에서 돌아오는 최상위 GET 네비게이션에 쿠키가 실린다.
const APP_LOGIN_COOKIE_OPTIONS = Object.freeze({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });

function setAppLoginCookie(res, value) {
  res.cookie(APP_LOGIN_COOKIE, value, { ...APP_LOGIN_COOKIE_OPTIONS, maxAge: APP_LOGIN_COOKIE_MAX_AGE_MS });
}

function clearAppLoginCookie(res) {
  res.clearCookie(APP_LOGIN_COOKIE, { ...APP_LOGIN_COOKIE_OPTIONS });
}

/** 프로세스 공용 저장소 — 라우트(교환)와 콜백 핸들러(발급)가 같은 인스턴스를 쓴다. */
const appAuthCodes = createAppAuthCodeStore();

module.exports = {
  APP_AUTH_CODE_RE,
  APP_AUTH_PROVIDERS,
  APP_DEEP_LINK_BASE,
  APP_LOGIN_COOKIE,
  APP_LOGIN_COOKIE_MAX_AGE_MS,
  appAuthCodes,
  buildAppDeepLink,
  clearAppLoginCookie,
  createAppAuthCodeStore,
  readCookie,
  setAppLoginCookie,
};
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend
node --test test/
```

기대: `# pass 8`, `# fail 0`

- [ ] **Step 6: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add backend/src/services/appAuthCodes.js backend/test/appAuthCodes.test.js backend/package.json
git commit -m "feat(auth): 앱 로그인용 60초 1회용 코드 저장소

Custom Tab 과 앱 WebView 는 저장소를 공유하지 않아 토큰을 넘길 통로가 필요한데,
딥링크에 JWT 를 그대로 실으면 기록·가로채기 한 번에 계정이 넘어간다. 그래서
256bit·60초·1회용 코드만 싣고 앱이 app-exchange 로 교환하게 한다.

pm2 단일 프로세스 + 60초 수명이라 메모리 Map 으로 충분하다.
테스트는 Node 20 내장 러너(node --test)를 쓴다 — 새 의존성 없음.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: app-start / app-exchange 라우트 (백엔드, TDD)

앱이 Custom Tab으로 여는 시작점과, 딥링크로 받은 코드를 JWT로 바꾸는 교환 엔드포인트.

> **왜 파일을 분리하나** (스펙 §7): BJJ는 두 라우트를 `routes/auth.js`에 인라인으로 두지만, 인라인
> 핸들러는 supertest 없이 단위 테스트할 수 없다. TheRoute에는 HTTP 테스트 라이브러리가 없고 추가하지
> 않기로 했으므로, 핸들러를 `routes/appAuth.js`로 분리해 export하고 `auth.js`는 마운트만 한다 —
> 가짜 req/res로 직접 부를 수 있다. 마운트 위치 요구사항은 그대로다.

**Files:**
- Create: `backend/src/routes/appAuth.js`
- Test: `backend/test/appAuth.test.js`
- Modify: `backend/src/routes/auth.js`

**Interfaces:**
- Consumes: Task 4의 `appAuthCodes`·`APP_AUTH_PROVIDERS`·`setAppLoginCookie`
- Produces:
  - `appStartHandler(req, res): void` — `GET /api/auth/app-start?provider=google|github[&fallback=1]`
  - `appExchangeHandler(req, res): void` — `POST /api/auth/app-exchange { code } → { success, data: { token }, message }`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/appAuth.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { appAuthCodes, APP_LOGIN_COOKIE } = require('../src/services/appAuthCodes');
const { appStartHandler, appExchangeHandler } = require('../src/routes/appAuth');

/** express Response 중 이 핸들러들이 쓰는 부분만 흉내 낸다. */
function fakeRes() {
  return {
    cookies: {}, cleared: [], headers: {}, statusCode: 200, body: null, redirected: null,
    cookie(name, value, opts) { this.cookies[name] = { value, opts }; return this; },
    clearCookie(name) { this.cleared.push(name); return this; },
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    redirect(code, url) { this.statusCode = code; this.redirected = url; return this; },
  };
}

test('app-start 는 표시 쿠키를 심고 기존 OAuth 시작점으로 302 한다', () => {
  const res = fakeRes();
  appStartHandler({ query: { provider: 'google' } }, res);
  assert.strictEqual(res.statusCode, 302);
  assert.strictEqual(res.redirected, '/api/auth/google');
  assert.strictEqual(res.cookies[APP_LOGIN_COOKIE].value, '1');
  assert.strictEqual(res.cookies[APP_LOGIN_COOKIE].opts.httpOnly, true);
  assert.strictEqual(res.cookies[APP_LOGIN_COOKIE].opts.secure, true);
  assert.strictEqual(res.cookies[APP_LOGIN_COOKIE].opts.sameSite, 'lax');
});

test('app-start 에 fallback=1 이면 쿠키 값이 fallback 이다', () => {
  const res = fakeRes();
  appStartHandler({ query: { provider: 'github', fallback: '1' } }, res);
  assert.strictEqual(res.cookies[APP_LOGIN_COOKIE].value, 'fallback');
});

test('app-start 는 화이트리스트 밖 provider 를 400 으로 막는다', () => {
  for (const provider of ['kakao', '', undefined, '../admin']) {
    const res = fakeRes();
    appStartHandler({ query: { provider } }, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.redirected, null);
    assert.deepStrictEqual(res.cookies, {});
  }
});

test('app-exchange 는 유효한 코드를 토큰으로 바꾼다', () => {
  const code = appAuthCodes.issue('jwt.for.exchange');
  const res = fakeRes();
  appExchangeHandler({ body: { code } }, res);
  assert.strictEqual(res.statusCode, 200);
  assert.deepStrictEqual(res.body, { success: true, data: { token: 'jwt.for.exchange' }, message: '' });
});

test('app-exchange 는 같은 코드를 두 번 받아 주지 않는다', () => {
  const code = appAuthCodes.issue('jwt.for.exchange');
  appExchangeHandler({ body: { code } }, fakeRes());
  const res = fakeRes();
  appExchangeHandler({ body: { code } }, res);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body.success, false);
});

test('app-exchange 는 형식이 틀린 코드를 400 으로 막는다', () => {
  const res = fakeRes();
  appExchangeHandler({ body: { code: 'not-a-code' } }, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.success, false);
});

test('app-exchange 는 body 가 없어도 죽지 않는다', () => {
  const res = fakeRes();
  appExchangeHandler({}, res);
  assert.strictEqual(res.statusCode, 400);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend
node --test test/
```

기대: FAIL — `Cannot find module '../src/routes/appAuth'`

- [ ] **Step 3: `backend/src/routes/appAuth.js` 구현**

```js
/**
 * 앱(Android APK) 로그인 라우트 핸들러 — T009.
 *
 * routes/auth.js 가 이 둘을 마운트한다. 🔴 마운트는 공용 OAuth 라우터(`router.use('/', oauthRouter)`)
 * 보다 **앞**이어야 한다 — 뒤에 두면 GET /app-start 가 공용 라우터의 GET /:provider 에 먼저 잡혀
 * "Unknown OAuth provider" 404 가 된다.
 *
 * 흐름 전체 설명: routes/appOAuthCallback.js 머리말.
 * 🔴 코드·토큰 원문을 로그에 남기지 않는다.
 */
const {
  APP_AUTH_PROVIDERS,
  appAuthCodes,
  setAppLoginCookie,
} = require('../services/appAuthCodes');

/** 프로젝트 규약: { success, data, message } */
function fail(res, status, message) {
  return res.status(status).json({ success: false, data: null, message });
}
function ok(res, data) {
  return res.status(200).json({ success: true, data, message: '' });
}

/**
 * GET /api/auth/app-start?provider=google|github[&fallback=1]
 *
 * 앱이 Custom Tab 으로 여는 주소. "이 로그인은 앱에서 시작됐다"는 표시 쿠키를 Custom Tab 에 심고
 * 기존 OAuth 시작점으로 넘긴다. 쿠키는 HttpOnly(JS 에서 못 읽음)·Secure·SameSite=Lax(제공자에서
 * 돌아오는 최상위 GET 네비게이션에는 실린다)·10분.
 */
function appStartHandler(req, res) {
  const provider = req.query && typeof req.query.provider === 'string' ? req.query.provider : '';
  if (!APP_AUTH_PROVIDERS.includes(provider)) {
    return fail(res, 400, '지원하지 않는 로그인 방식입니다');
  }
  setAppLoginCookie(res, req.query.fallback === '1' ? 'fallback' : '1');
  res.set('Cache-Control', 'no-store');
  return res.redirect(302, `/api/auth/${provider}`);
}

/**
 * POST /api/auth/app-exchange  { code }  →  { token }
 *
 * 딥링크로 받은 60초 1회용 코드를 JWT 로 바꾼다. 코드는 맞든 틀리든 한 번 보면 지운다.
 */
function appExchangeHandler(req, res) {
  const code = req.body && req.body.code;
  const result = appAuthCodes.consume(code);
  if (result.status === 'malformed') {
    return fail(res, 400, '로그인 코드 형식이 올바르지 않습니다');
  }
  if (result.status !== 'ok') {
    console.warn(`[app-auth] 코드 교환 실패 (${result.status})`);
    return fail(res, 401, '로그인 코드가 만료되었거나 이미 사용되었습니다. 다시 로그인해 주세요');
  }
  res.set('Cache-Control', 'no-store');
  return ok(res, { token: result.token });
}

module.exports = { appStartHandler, appExchangeHandler };
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend
node --test test/
```

기대: `# fail 0` (Task 4의 8건 + 이번 7건 = `# pass 15`)

- [ ] **Step 5: `backend/src/routes/auth.js`에 마운트**

`const router = Router();` 아래 이메일/비밀번호 블록 다음, `const OAUTH_ENABLED = {` **앞**에 아래를 넣는다. 파일 상단 import 묶음에도 한 줄 추가한다.

상단 import (4번째 줄 `createOAuthRouter` 아래):

```js
const { appStartHandler, appExchangeHandler } = require('./appAuth');
```

`router.post('/refresh',  refreshToken);` 다음 줄에:

```js

// ─── 앱(Android APK) 로그인 — T009 ────────────────────────────────────────────
// 🔴 공용 OAuth 라우터(router.use('/', oauthRouter))보다 **앞**에 둔다. 뒤에 두면
//    GET /app-start 가 공용 라우터의 GET /:provider 에 먼저 잡혀 "Unknown OAuth provider" 404 가 된다.
// 🔴 공용 패키지(@workspace/auth-oauth, 여러 프로젝트 공용)는 수정하지 않는다 — TheRoute 전용 라우트로만 붙인다.
// 흐름 전체 설명: routes/appOAuthCallback.js 머리말.
router.get('/app-start', appStartHandler);
router.post('/app-exchange', appExchangeHandler);
```

- [ ] **Step 6: 마운트 순서를 눈으로 확인**

```bash
grep -n "app-start\|app-exchange\|router.use('/', oauthRouter)" \
  /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend/src/routes/auth.js
```

기대: `app-start`·`app-exchange`의 줄 번호가 `router.use('/', oauthRouter)`보다 **작다**.

- [ ] **Step 7: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add backend/src/routes/appAuth.js backend/test/appAuth.test.js backend/src/routes/auth.js
git commit -m "feat(auth): 앱 로그인 시작·교환 라우트 (app-start, app-exchange)

app-start 는 표시 쿠키를 심고 기존 OAuth 시작점으로 302 하고, app-exchange 는
딥링크로 받은 1회용 코드를 JWT 로 바꾼다. 공용 OAuth 라우터보다 앞에 마운트해야
GET /app-start 가 /:provider 에 잡히지 않는다.

핸들러를 routes/appAuth.js 로 분리해 export 했다 — supertest 없이 가짜 req/res 로
단위 테스트하기 위해서다(HTTP 테스트 라이브러리를 새로 넣지 않는다).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 앱 로그인 복귀 가로채기 (백엔드, TDD)

OAuth가 끝나고 웹으로 돌아온 요청을, 앱에서 시작한 로그인일 때만 가로채 딥링크로 302한다.

**Files:**
- Create: `backend/src/routes/appOAuthCallback.js`
- Test: `backend/test/appOAuthCallback.test.js`
- Modify: `backend/src/index.js`

**Interfaces:**
- Consumes: Task 4의 `appAuthCodes`·`APP_LOGIN_COOKIE`·`buildAppDeepLink`·`clearAppLoginCookie`·`readCookie`
- Produces: `createAppOAuthCallbackHandler(deps?: {jwtSecret?: string, store?: {issue(token: string): string}}) => (req, res, next) => void`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/test/appOAuthCallback.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { APP_LOGIN_COOKIE } = require('../src/services/appAuthCodes');
const { createAppOAuthCallbackHandler } = require('../src/routes/appOAuthCallback');

const SECRET = 'test-secret';
const handler = createAppOAuthCallbackHandler({ jwtSecret: SECRET });

function fakeReq({ path, query = {}, cookie = null, method = 'GET' }) {
  return { method, path, query, headers: cookie ? { cookie } : {} };
}

function fakeRes() {
  return {
    cleared: [], headers: {}, statusCode: 200, body: null, redirected: null, contentType: null,
    clearCookie(name) { this.cleared.push(name); return this; },
    set(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    type(t) { this.contentType = t; return this; },
    send(b) { this.body = b; return this; },
    redirect(code, url) { this.statusCode = code; this.redirected = url; return this; },
  };
}

function run(reqOpts) {
  const req = fakeReq(reqOpts);
  const res = fakeRes();
  let nexted = false;
  handler(req, res, () => { nexted = true; });
  return { res, nexted };
}

const APP_COOKIE = `${APP_LOGIN_COOKIE}=1`;

test('표시 쿠키가 없으면 next() — 웹 로그인 흐름은 그대로다', () => {
  const token = jwt.sign({ id: 1 }, SECRET);
  const { res, nexted } = run({ path: '/oauth/callback', query: { token } });
  assert.strictEqual(nexted, true);
  assert.strictEqual(res.redirected, null);
  assert.deepStrictEqual(res.cleared, []);
});

test('쿠키 + 유효 JWT 면 1회용 코드를 실은 딥링크로 302 하고 쿠키를 지운다', () => {
  const token = jwt.sign({ id: 1 }, SECRET);
  const { res, nexted } = run({ path: '/oauth/callback', query: { token }, cookie: APP_COOKIE });
  assert.strictEqual(nexted, false);
  assert.strictEqual(res.statusCode, 302);
  assert.match(res.redirected, /^theroute:\/\/auth\/callback\?code=[0-9a-f]{64}$/);
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
  assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  assert.ok(!res.redirected.includes(token), '딥링크에 JWT 를 실으면 안 된다');
});

test('쿠키가 있어도 JWT 가 무효면 error 딥링크다', () => {
  const token = jwt.sign({ id: 1 }, 'other-secret');
  const { res } = run({ path: '/oauth/callback', query: { token }, cookie: APP_COOKIE });
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=invalid_token');
  assert.deepStrictEqual(res.cleared, [APP_LOGIN_COOKIE]);
});

test('토큰이 아예 없으면 no_token 딥링크다', () => {
  const { res } = run({ path: '/oauth/callback', query: {}, cookie: APP_COOKIE });
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=no_token');
});

test('공용 라우터가 실패로 보내는 /login?error= 도 가로채 앱으로 돌려보낸다', () => {
  const { res, nexted } = run({
    path: '/login',
    query: { error: 'access_denied', msg: 'user cancelled' },
    cookie: APP_COOKIE,
  });
  assert.strictEqual(nexted, false);
  assert.strictEqual(res.redirected, 'theroute://auth/callback?error=access_denied&msg=user+cancelled');
});

test('error 없는 /login 은 그냥 웹 로그인 화면이다 — next()', () => {
  const { nexted } = run({ path: '/login', query: {}, cookie: APP_COOKIE });
  assert.strictEqual(nexted, true);
});

test('GET 이 아니면 next()', () => {
  const { nexted } = run({ method: 'POST', path: '/oauth/callback', query: {}, cookie: APP_COOKIE });
  assert.strictEqual(nexted, true);
});

test('fallback 쿠키면 302 대신 앱으로 돌아가기 버튼 HTML 을 준다', () => {
  const token = jwt.sign({ id: 1 }, SECRET);
  const { res } = run({
    path: '/oauth/callback', query: { token }, cookie: `${APP_LOGIN_COOKIE}=fallback`,
  });
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.contentType, 'html');
  assert.strictEqual(res.redirected, null);
  assert.match(res.body, /theroute:\/\/auth\/callback\?code=[0-9a-f]{64}/);
  assert.match(res.body, /앱으로 돌아가기/);
});

test('오류 메시지는 HTML 로 이스케이프된다', () => {
  const { res } = run({
    path: '/login',
    query: { error: 'bad', msg: '<script>alert(1)</script>', fallback: '1' },
    cookie: APP_COOKIE,
  });
  assert.ok(!res.body.includes('<script>alert(1)</script>'));
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend
node --test test/
```

기대: FAIL — `Cannot find module '../src/routes/appOAuthCallback'`

- [ ] **Step 3: `backend/src/routes/appOAuthCallback.js` 구현**

```js
/**
 * 앱 로그인 복귀 핸들러 — GET /oauth/callback · GET /login?error= (T009).
 *
 * backend/src/index.js 에서 **dist 정적 서빙 뒤 · SPA 폴백 앞**에 붙는다.
 * 🔴 SPA 폴백 정규식은 건드리지 않는다 — 이 핸들러가 처리하지 않는 요청은 전부 next() 로
 *    흘려 보내 **웹 로그인 흐름은 한 글자도 바뀌지 않는다.**
 *
 * 흐름
 * 1. 앱이 Custom Tab 으로 /api/auth/app-start?provider=google 을 연다 → 표시 쿠키를 심고
 *    공유 OAuth 라우터(/api/auth/google)로 302.
 * 2. 공유 라우터(@workspace/auth-oauth, 무수정)가 성공 시 /oauth/callback?token=<JWT> 로,
 *    실패 시 /login?error=…&msg=… 로 302 한다.
 *    🔴 실패는 /oauth/callback 이 아니라 **/login** 으로 온다 — 그래서 /login 도 여기서 받는다.
 *    받지 않으면 사용자가 제공자에서 "취소"했을 때 Custom Tab 안에 웹 로그인 화면이 떠 있고
 *    앱으로는 영영 돌아가지 않는다.
 * 3. 쿠키가 있으면(= 앱에서 시작한 로그인) 여기서 가로챈다:
 *    · 유효 JWT → 60초 1회용 코드 발급 → 쿠키 삭제 → 302 theroute://auth/callback?code=…
 *    · 무효 JWT / 토큰 없음 / error → 쿠키 삭제 → 302 theroute://auth/callback?error=…
 *    쿠키가 없으면 next() — 일반 브라우저의 웹 로그인은 기존 OAuthCallbackPage 가 그대로 처리한다.
 * 4. 폴백: Custom Tab 이 스킴 302 를 막는 기기를 대비해, 쿠키 값이 fallback(app-start 에 fallback=1)
 *    이거나 이 요청에 ?fallback=1 이 있으면 302 대신 "앱으로 돌아가기" 버튼 HTML 을 준다.
 *    웹 배포만으로 앱의 app-start 주소에 &fallback=1 을 붙여 전환할 수 있다(APK 재빌드 불필요).
 *
 * 🔴 딥링크에는 JWT 를 싣지 않는다. 🔴 코드·토큰 원문을 로그에 남기지 않는다.
 */
const jwt = require('jsonwebtoken');
const {
  APP_LOGIN_COOKIE,
  appAuthCodes,
  buildAppDeepLink,
  clearAppLoginCookie,
  readCookie,
} = require('../services/appAuthCodes');

// routes/auth.js 와 **같은 표현**을 쓴다. 폴백 일원화는 별도 과제(agent-vault board Todo)이며
// 여기서 다른 값을 쓰면 서명/검증이 어긋나 앱 로그인만 조용히 깨진다.
const JWT_SECRET = process.env.JWT_SECRET || 'theroute-dev-secret';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function firstString(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/** 302 가 막히는 기기용 — 사용자가 직접 누르는 스킴 링크(사용자 제스처라 Custom Tab 이 허용한다). */
function renderFallbackPage(deepLink, isError) {
  const href = escapeHtml(deepLink);
  const msg = isError ? '로그인을 완료하지 못했습니다.' : '로그인이 완료되었습니다.';
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>더 루트 — 앱으로 돌아가기</title>
<style>
html,body{margin:0;height:100%;background:#fafafa;color:#1a1a1a;font:15px/1.6 -apple-system,BlinkMacSystemFont,'Pretendard',sans-serif}
main{height:100%;display:grid;place-items:center;text-align:center;padding:24px;box-sizing:border-box}
p{margin:0 0 18px;color:#6b7280}
a{display:inline-block;min-height:44px;line-height:44px;padding:0 24px;border-radius:10px;background:#ff5a3c;color:#fff;font-weight:600;text-decoration:none}
</style></head>
<body><main><div><p>${msg}</p><a href="${href}">앱으로 돌아가기</a></div></main></body></html>`;
}

/**
 * @param {object} [deps] 테스트 주입용
 * @param {string} [deps.jwtSecret]
 * @param {{issue:(token:string)=>string}} [deps.store]
 */
function createAppOAuthCallbackHandler({ jwtSecret = JWT_SECRET, store = appAuthCodes } = {}) {
  return function appOAuthCallback(req, res, next) {
    if (req.method !== 'GET') return next();

    const isCallback = req.path === '/oauth/callback';
    const errorParam = firstString(req.query.error);
    const isLoginError = req.path === '/login' && errorParam !== '';
    if (!isCallback && !isLoginError) return next();

    const mark = readCookie(req, APP_LOGIN_COOKIE);
    if (mark !== '1' && mark !== 'fallback') return next(); // 웹 로그인 — 기존 흐름 그대로

    // 여기부터는 "앱에서 시작한 로그인의 끝". 성공이든 실패든 표시 쿠키는 한 번 쓰고 버린다
    // (남겨 두면 10분 안에 같은 폰 브라우저에서 한 웹 로그인까지 앱으로 끌려간다).
    clearAppLoginCookie(res);
    res.set('Cache-Control', 'no-store');
    res.set('Referrer-Policy', 'no-referrer');

    let deepLink;
    let isError = false;
    const token = isCallback ? firstString(req.query.token) : '';
    if (token !== '') {
      try {
        jwt.verify(token, jwtSecret);
        deepLink = buildAppDeepLink({ code: store.issue(token) });
        console.log('[app-auth] 앱 로그인 코드 발급 (60초·1회용)');
      } catch {
        isError = true;
        deepLink = buildAppDeepLink({ error: 'invalid_token' });
        console.warn('[app-auth] 앱 로그인 콜백 — 토큰 검증 실패');
      }
    } else {
      isError = true;
      deepLink = buildAppDeepLink({
        error: (errorParam || 'no_token').slice(0, 64),
        msg: firstString(req.query.msg).slice(0, 100),
      });
      console.warn(`[app-auth] 앱 로그인 실패 복귀 (${isCallback ? 'callback' : 'login'})`);
    }

    const wantFallback = mark === 'fallback' || firstString(req.query.fallback) === '1';
    if (wantFallback) {
      res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
      return res.status(200).type('html').send(renderFallbackPage(deepLink, isError));
    }
    return res.redirect(302, deepLink);
  };
}

module.exports = { createAppOAuthCallbackHandler, renderFallbackPage };
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend
node --test test/
```

기대: `# fail 0` (누적 `# pass 24`)

- [ ] **Step 5: `backend/src/index.js`에 마운트**

현재 코드(48-57행)는 아래와 같다.

```js
// SPA 정적 서빙 (Phase 11 — web/dist 존재 시 자동 활성)
const distDir = path.join(__dirname, '../../web/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false }));
  app.get(/^\/(?!api|uploads|health).*$/, (_req, res) => {
```

`express.static` 줄과 SPA 폴백 `app.get(...)` 줄 **사이**에 아래 블록을 넣는다. SPA 폴백 정규식은 그대로 둔다.

```js
  // 앱(Android APK) 로그인 복귀 — T009. dist 정적 서빙 뒤 · SPA 폴백 앞.
  // route_app_login 쿠키(= Custom Tab 에서 시작한 앱 로그인)가 있을 때만 /oauth/callback·/login?error= 를
  // 가로채 theroute://auth/callback?code=… 로 302 하고, 쿠키가 없으면 next() — 웹 로그인 흐름은 그대로다.
  // 🔴 아래 SPA 폴백 정규식은 그대로 둔다.
  app.get(['/oauth/callback', '/login'], require('./routes/appOAuthCallback').createAppOAuthCallbackHandler());
```

- [ ] **Step 6: 웹 로그인 회귀 확인 (표시 쿠키 없이는 아무것도 바뀌지 않는다)**

백엔드를 재시작하고, 쿠키 없이 콜백 경로를 부르면 SPA `index.html`이 그대로 나와야 한다.

```bash
pm2 restart theroute-api --update-env
curl -sS -o /dev/null -w "no-cookie: %{http_code} %{content_type}\n" \
     "https://climb.xn--lh0b87pnudm10a4vd.com/oauth/callback?token=dummy"
pm2 logs theroute-api --lines 20 --nostream
```

기대: `no-cookie: 200 text/html…` (302도 딥링크도 아니다). pm2 로그에 `[app-auth]` 줄이 **없어야** 한다.

- [ ] **Step 7: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add backend/src/routes/appOAuthCallback.js backend/test/appOAuthCallback.test.js backend/src/index.js
git commit -m "feat(auth): 앱 로그인 복귀 가로채기 (딥링크 302 + 폴백 페이지)

표시 쿠키가 있을 때만 /oauth/callback·/login?error= 를 가로채 1회용 코드를 실은
theroute:// 딥링크로 302 한다. 쿠키가 없으면 next() 라 웹 로그인은 그대로다.
공용 라우터가 실패를 /login 으로 보내므로 그 경로도 받는다 — 받지 않으면 제공자에서
취소했을 때 앱으로 영영 돌아가지 못한다.

302 스킴 이동이 막히는 기기용 폴백 HTML 을 포함한다(웹 배포만으로 전환 가능).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: 네이티브 브리지 (웹, TDD)

웹 코드가 네이티브를 만지는 유일한 경로. 앱이 아니면 모든 함수가 조용히 아무것도 하지 않는다.

**Files:**
- Create: `web/src/native/bridge.js`
- Test: `web/test/bridge.test.js`
- Modify: `web/package.json` (test 스크립트)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `APP_ORIGIN: string` — `'https://climb.xn--lh0b87pnudm10a4vd.com'`
  - `AUTH_DEEP_LINK_SCHEME: string` — `'theroute:'`
  - `isNativeApp(): boolean`
  - `openExternal(url: string): Promise<boolean>`
  - `closeExternal(): Promise<void>`
  - `authCodeFromDeepLink(rawUrl: unknown): string | null`
  - `authErrorFromDeepLink(rawUrl: unknown): {error: string, msg: string} | null`
  - `onAuthDeepLink(handler: (url: string, meta: {source: 'open'|'launch'}) => void): () => void`
  - `onBackButton(handler: (data: {canGoBack?: boolean}) => void): () => void`
  - `exitApp(): Promise<boolean>`

> 🔴 **ESM import 확장자**: `web/package.json`은 `"type": "module"`이다. Vite는 확장자 없는 상대 import를
> 해석하지만 **Node는 하지 않는다.** `node --test`로 이 모듈들을 읽으려면 `web/src/native/` 안의 상대
> import에 **반드시 `.js`를 붙인다**(`from './bridge.js'`). 나머지 기존 코드 스타일은 건드리지 않는다.

- [ ] **Step 1: `web/package.json`에 test 스크립트 추가**

```json
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test test/"
  },
```

- [ ] **Step 2: 실패하는 테스트 작성**

`web/test/bridge.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import {
  APP_ORIGIN,
  AUTH_DEEP_LINK_SCHEME,
  authCodeFromDeepLink,
  authErrorFromDeepLink,
  isNativeApp,
  exitApp,
  openExternal,
} from '../src/native/bridge.js';

const CODE = 'a'.repeat(64);

test('상수는 네이티브 설정과 같은 값이다', () => {
  assert.strictEqual(APP_ORIGIN, 'https://climb.xn--lh0b87pnudm10a4vd.com');
  assert.strictEqual(AUTH_DEEP_LINK_SCHEME, 'theroute:');
});

test('window 가 없으면(웹 SSR·Node) 앱이 아니고 모든 호출이 조용히 끝난다', async () => {
  assert.strictEqual(isNativeApp(), false);
  assert.strictEqual(await openExternal('https://example.com'), false);
  assert.strictEqual(await exitApp(), false);
});

test('딥링크에서 코드를 꺼낸다 — host 와 path 를 따로 본다', () => {
  assert.strictEqual(authCodeFromDeepLink(`theroute://auth/callback?code=${CODE}`), CODE);
  assert.strictEqual(authCodeFromDeepLink(`theroute://auth/callback/?code=${CODE}`), CODE);
});

test('코드 형식(소문자 hex 64자)이 아니면 null 이다', () => {
  for (const bad of ['', 'ZZZ', 'A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)]) {
    assert.strictEqual(authCodeFromDeepLink(`theroute://auth/callback?code=${bad}`), null);
  }
});

test('다른 스킴·다른 host·다른 path 는 무시한다', () => {
  assert.strictEqual(authCodeFromDeepLink(`bjjapp://auth/callback?code=${CODE}`), null);
  assert.strictEqual(authCodeFromDeepLink(`theroute://other/callback?code=${CODE}`), null);
  assert.strictEqual(authCodeFromDeepLink(`theroute://auth/other?code=${CODE}`), null);
  assert.strictEqual(authCodeFromDeepLink('https://climb.example.com/callback?code=' + CODE), null);
});

test('문자열이 아니거나 파싱 불가면 null 이다', () => {
  for (const bad of [undefined, null, 42, '', 'not a url']) {
    assert.strictEqual(authCodeFromDeepLink(bad), null);
    assert.strictEqual(authErrorFromDeepLink(bad), null);
  }
});

test('오류 딥링크에서 error 와 msg 를 꺼낸다', () => {
  assert.deepStrictEqual(
    authErrorFromDeepLink('theroute://auth/callback?error=access_denied&msg=cancelled'),
    { error: 'access_denied', msg: 'cancelled' },
  );
  assert.deepStrictEqual(
    authErrorFromDeepLink('theroute://auth/callback?error=no_token'),
    { error: 'no_token', msg: '' },
  );
  assert.strictEqual(authErrorFromDeepLink(`theroute://auth/callback?code=${CODE}`), null);
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
node --test test/
```

기대: FAIL — `Cannot find module .../src/native/bridge.js`

- [ ] **Step 4: `web/src/native/bridge.js` 구현**

```js
/**
 * Capacitor 런타임 브리지 — 웹 코드가 네이티브(Android 앱) 기능을 만지는 **유일한 경로** (T009).
 *
 * `@capacitor/*` 를 import 하지 않는다: 앱은 운영 웹(server.url)을 그대로 로드한다 —
 * **같은 번들이 폰 앱과 PC·모바일 브라우저에 함께 나간다.** 네이티브 패키지를 import 하면 웹 사용자도
 * 그 코드를 받고, 플러그인이 빠진 환경에서는 모듈 최상위에서 터진다. 그래서 여기서는
 * **앱 WebView 에 Capacitor 가 주입하는 window.Capacitor 전역만** 본다.
 *
 * 규칙: 브리지·플러그인이 없으면 조용히 아무 일도 안 한다. 모든 함수가 웹에서는 no-op / false / null 을
 * 돌려주고, 호출부는 그 값으로 웹 동작으로 갈라진다.
 */

/** 앱이 로드하는 운영 주소. 퓨니코드 — mobile/capacitor.config.ts 의 server.url 과 같은 값. */
export const APP_ORIGIN = 'https://climb.xn--lh0b87pnudm10a4vd.com';
/** 앱 intent-filter(theroute://auth)·서버 appAuthCodes.js 의 딥링크와 같은 값. */
export const AUTH_DEEP_LINK_SCHEME = 'theroute:';

const AUTH_CODE_RE = /^[0-9a-f]{64}$/;

export function getBridge() {
  if (typeof window === 'undefined') return null;
  return window.Capacitor || null;
}

export function isNativeApp() {
  const b = getBridge();
  return !!b && typeof b.isNativePlatform === 'function' && b.isNativePlatform() === true;
}

/** 앱일 때만 플러그인 프록시를 꺼낸다. 없으면 null. */
function getPlugin(name) {
  if (!isNativeApp()) return null;
  const plugins = getBridge().Plugins;
  return (plugins && plugins[name]) || null;
}

function fn(plugin, method) {
  return plugin && typeof plugin[method] === 'function' ? plugin[method].bind(plugin) : null;
}

/** Custom Tab(외부 브라우저)으로 연다. 플러그인이 없거나 실패하면 false — 호출부가 일반 이동으로 폴백한다. */
export async function openExternal(url) {
  const open = fn(getPlugin('Browser'), 'open');
  if (!open) return false;
  try {
    await open({ url });
    return true;
  } catch {
    return false;
  }
}

/** 로그인이 끝나면 떠 있는 Custom Tab 을 닫는다. 부가 동작이라 실패해도 무시한다. */
export async function closeExternal() {
  const close = fn(getPlugin('Browser'), 'close');
  if (!close) return;
  try {
    await close();
  } catch {
    // 이미 닫혔거나(singleTask 복귀가 먼저 정리) 열린 적이 없다 — 사용자가 할 일이 없다.
  }
}

/**
 * theroute://auth/callback?… 인지 판정하고 URL 객체를 돌려준다.
 *
 * 🔴 함정: 커스텀 스킴은 WHATWG URL 의 "특수 스킴"이 아니라서 new URL('theroute://auth/callback') 의
 *    auth 는 **host** 로, pathname 은 **/callback** 으로 파싱된다.
 *    pathname.includes('auth/callback') 으로 찾으면 영원히 못 찾는다(TheMeal 실기기에서 로그인이
 *    통째로 죽었던 원인) — 그래서 host 와 path 를 따로 본다.
 */
function parseAuthCallback(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl === '') return null;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== AUTH_DEEP_LINK_SCHEME) return null;
  if (url.host !== 'auth') return null;
  if (url.pathname !== '/callback' && url.pathname !== '/callback/') return null;
  return url;
}

/** 딥링크에서 로그인 코드(소문자 hex 64자)를 꺼낸다. 로그인 딥링크가 아니거나 형식이 틀리면 null. */
export function authCodeFromDeepLink(rawUrl) {
  const url = parseAuthCallback(rawUrl);
  if (!url) return null;
  const code = url.searchParams.get('code');
  return code !== null && AUTH_CODE_RE.test(code) ? code : null;
}

/** 딥링크에 실린 오류(?error=…&msg=…, 예: 제공자에서 취소). 없으면 null. */
export function authErrorFromDeepLink(rawUrl) {
  const url = parseAuthCallback(rawUrl);
  if (!url) return null;
  const error = url.searchParams.get('error');
  if (error === null || error === '') return null;
  return { error, msg: url.searchParams.get('msg') || '' };
}

/**
 * 로그인 딥링크 구독 + **콜드 스타트 보정**.
 *
 * ⚠️ 앱이 꺼져 있다가 딥링크로 깨어나면 웹이 뜨기 전에 appUrlOpen 이 지나간다. Capacitor App 플러그인은
 *    그 이벤트를 보관했다가 첫 리스너에 주기도 하고, getLaunchUrl() 도 같은 주소를 준다.
 *    즉 **같은 주소가 두 번 올 수 있고**, getLaunchUrl() 은 WebView 가 새로고침돼도 계속 같은 옛 주소를
 *    준다. 코드는 1회용이므로 **중복 처리는 호출부(native/appLogin.js)가 막는다.**
 *
 * @param {(url: string, meta: {source: 'open'|'launch'}) => void} handler
 * @returns {() => void} 구독 해제. 브리지가 없으면 아무것도 안 하는 함수.
 */
export function onAuthDeepLink(handler) {
  const app = getPlugin('App');
  if (!app) return () => {};

  let disposed = false;
  let removeListener = null;

  const addListener = fn(app, 'addListener');
  if (addListener) {
    try {
      const result = addListener('appUrlOpen', (data) => {
        if (!disposed && data && typeof data.url === 'string') handler(data.url, { source: 'open' });
      });
      Promise.resolve(result).then((h) => {
        const remove = h && typeof h.remove === 'function' ? () => h.remove() : null;
        if (disposed) { if (remove) remove(); } else removeListener = remove;
      }).catch(() => {});
    } catch {
      // 리스너 등록 실패 — 콜드 스타트 보정만 남는다.
    }
  }

  const getLaunchUrl = fn(app, 'getLaunchUrl');
  if (getLaunchUrl) {
    Promise.resolve()
      .then(() => getLaunchUrl())
      .then((launch) => {
        if (!disposed && launch && typeof launch.url === 'string') handler(launch.url, { source: 'launch' });
      })
      .catch(() => {});
  }

  return () => {
    disposed = true;
    if (removeListener) {
      try { removeListener(); } catch { /* 무시 */ }
    }
  };
}

/**
 * 하드웨어 뒤로가기. 🔴 리스너를 하나라도 등록하면 Capacitor 의 기본 동작(WebView goBack)이 **꺼진다** —
 * 그래서 등록한 쪽(native/backStack.js handleNativeBack)이 모달 닫기·뒤로·종료를 전부 책임진다.
 * @param {(data: {canGoBack?: boolean}) => void} handler
 */
export function onBackButton(handler) {
  const addListener = fn(getPlugin('App'), 'addListener');
  if (!addListener) return () => {};
  let disposed = false;
  let removeListener = null;
  try {
    const result = addListener('backButton', (data) => { if (!disposed) handler(data || {}); });
    Promise.resolve(result).then((h) => {
      const remove = h && typeof h.remove === 'function' ? () => h.remove() : null;
      if (disposed) { if (remove) remove(); } else removeListener = remove;
    }).catch(() => {});
  } catch {
    return () => {};
  }
  return () => {
    disposed = true;
    if (removeListener) {
      try { removeListener(); } catch { /* 무시 */ }
    }
  };
}

/** 앱 종료(루트에서 뒤로가기). 웹에서는 아무 일도 없다. */
export async function exitApp() {
  const exit = fn(getPlugin('App'), 'exitApp');
  if (!exit) return false;
  try {
    await exit();
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
node --test test/
```

기대: `# pass 7`, `# fail 0`

- [ ] **Step 6: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add web/src/native/bridge.js web/test/bridge.test.js web/package.json
git commit -m "feat(native): Capacitor 브리지 (window.Capacitor 전역만 사용)

같은 웹 번들이 앱과 브라우저에 함께 나가므로 @capacitor/* 를 import 하지 않고
주입된 전역만 본다. 플러그인이 없으면 모든 함수가 no-op/false/null 이다.

커스텀 스킴은 WHATWG URL 특수 스킴이 아니라 theroute://auth/callback 이
host=auth, pathname=/callback 으로 파싱된다 — host 와 path 를 따로 검사한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: 딥링크 → 로그인 (웹, TDD)

딥링크를 로그인 상태로 바꾸는 순수 모듈. 의존성을 전부 주입받아 React 없이 테스트한다.

**Files:**
- Create: `web/src/native/appLogin.js`
- Test: `web/test/appLogin.test.js`

**Interfaces:**
- Consumes: Task 7의 `authCodeFromDeepLink`·`authErrorFromDeepLink`
- Produces:
  - `HANDLED_KEY: string` — `'theroute_app_login_handled'`
  - `describeAuthError(e?: {error?: string, msg?: string}): string`
  - `createAppLoginHandler(deps): (url: string, meta?: {source?: 'open'|'launch'}) => Promise<'ignored'|'duplicate'|'error-link'|'failed'|'silent'|'ok'>`
    - `deps.exchange: (code: string) => Promise<string>` — 코드를 JWT로 (실패 시 throw)
    - `deps.login: (token: string) => Promise<boolean>` — 토큰 저장 + 사용자 조회, 성공 여부
    - `deps.navigate: (path: string, opts?: object) => void`
    - `deps.notify: (msg: string) => void`
    - `deps.closeExternal?: () => Promise<void>`
    - `deps.hasToken?: () => boolean`
    - `deps.storage?: Storage | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/test/appLogin.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { createAppLoginHandler, describeAuthError, HANDLED_KEY } from '../src/native/appLogin.js';

const CODE = 'b'.repeat(64);
const LINK = `theroute://auth/callback?code=${CODE}`;

/** sessionStorage 를 흉내 낸다. */
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

function harness(overrides = {}) {
  const calls = { navigate: [], notify: [], closed: 0, exchanged: [] };
  const deps = {
    exchange: async (code) => { calls.exchanged.push(code); return 'jwt.token'; },
    login: async () => true,
    navigate: (p, o) => calls.navigate.push([p, o]),
    notify: (m) => calls.notify.push(m),
    closeExternal: async () => { calls.closed += 1; },
    hasToken: () => false,
    storage: memStorage(),
    ...overrides,
  };
  return { calls, deps, handle: createAppLoginHandler(deps) };
}

test('로그인 딥링크가 아니면 ignored', async () => {
  const { handle, calls } = harness();
  assert.strictEqual(await handle('https://climb.example.com/'), 'ignored');
  assert.strictEqual(calls.closed, 0);
});

test('정상 흐름: 코드 교환 → 로그인 → 홈으로', async () => {
  const { handle, calls } = harness();
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'ok');
  assert.deepStrictEqual(calls.exchanged, [CODE]);
  assert.strictEqual(calls.closed, 1);
  assert.deepStrictEqual(calls.navigate, [['/', { replace: true }]]);
});

test('같은 코드가 두 번 오면 두 번째는 duplicate (교환하지 않는다)', async () => {
  const { handle, calls } = harness();
  await handle(LINK, { source: 'open' });
  assert.strictEqual(await handle(LINK, { source: 'launch' }), 'duplicate');
  assert.deepStrictEqual(calls.exchanged, [CODE]);
});

test('새로고침 뒤에도 sessionStorage 로 중복을 막는다', async () => {
  const storage = memStorage();
  const first = harness({ storage });
  await first.handle(LINK, { source: 'open' });
  const second = harness({ storage });  // 새 페이지 = 새 메모리 Set
  assert.strictEqual(await second.handle(LINK, { source: 'launch' }), 'duplicate');
  assert.deepStrictEqual(second.calls.exchanged, []);
  assert.ok(JSON.parse(storage.getItem(HANDLED_KEY)).includes(`code:${CODE}`));
});

test('사용자가 방금 누른 로그인(open)의 교환 실패는 반드시 알린다', async () => {
  const { handle, calls } = harness({ exchange: async () => { throw new Error('코드가 만료되었습니다'); } });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.deepStrictEqual(calls.notify, ['코드가 만료되었습니다']);
  assert.deepStrictEqual(calls.navigate, [['/login', { replace: true }]]);
});

test('옛 launch 코드가 실패했는데 이미 로그인돼 있으면 조용히 넘긴다', async () => {
  const { handle, calls } = harness({
    exchange: async () => { throw new Error('만료'); },
    hasToken: () => true,
  });
  assert.strictEqual(await handle(LINK, { source: 'launch' }), 'silent');
  assert.deepStrictEqual(calls.notify, []);
  assert.deepStrictEqual(calls.navigate, []);
});

test('토큰은 받았지만 사용자 조회가 실패하면 알리고 로그인 화면으로', async () => {
  const { handle, calls } = harness({ login: async () => false });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'failed');
  assert.strictEqual(calls.notify.length, 1);
  assert.deepStrictEqual(calls.navigate, [['/login', { replace: true }]]);
});

test('오류 딥링크는 취소 문구로 안내한다', async () => {
  const { handle, calls } = harness();
  const link = 'theroute://auth/callback?error=access_denied&msg=user+cancelled';
  assert.strictEqual(await handle(link, { source: 'open' }), 'error-link');
  assert.deepStrictEqual(calls.notify, ['로그인을 취소했습니다']);
  assert.strictEqual(calls.closed, 1);
});

test('오류 문구 판정', () => {
  assert.strictEqual(describeAuthError({ error: 'access_denied' }), '로그인을 취소했습니다');
  assert.strictEqual(describeAuthError({ error: 'invalid_token' }), '로그인에 실패했습니다. 다시 시도해 주세요');
  assert.strictEqual(describeAuthError(), '로그인에 실패했습니다. 다시 시도해 주세요');
});

test('storage 가 막혀 있어도(한 페이지 안) 중복은 막힌다', async () => {
  const blocked = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() {},
  };
  const { handle, calls } = harness({ storage: blocked });
  await handle(LINK, { source: 'open' });
  assert.strictEqual(await handle(LINK, { source: 'open' }), 'duplicate');
  assert.deepStrictEqual(calls.exchanged, [CODE]);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
node --test test/
```

기대: FAIL — `Cannot find module .../src/native/appLogin.js`

- [ ] **Step 3: `web/src/native/appLogin.js` 구현**

```js
/**
 * 앱 로그인의 마지막 한 칸 — 딥링크(theroute://auth/callback?code=…)를 로그인 상태로 바꾼다 (T009).
 *
 * 흐름: 딥링크 수신 → Custom Tab 닫기 → POST /api/auth/app-exchange {code} → JWT →
 *       login(token)(토큰 저장 + /auth/me 조회) → 홈으로 replace.
 *
 * 중복 처리 방지(코드는 1회용 — 두 번째 교환은 반드시 401):
 * 같은 주소가 여러 번 온다. 콜드 스타트에서 appUrlOpen(보관 이벤트)과 getLaunchUrl() 이 같은 주소를 주고,
 * getLaunchUrl() 은 **WebView 새로고침(로그아웃·401 이동 포함) 뒤에도** 앱 시작 때의 옛 주소를 계속 준다.
 *  · 한 페이지 안: 메모리 Set 으로 거른다.
 *  · 새로고침 뒤: sessionStorage 에 최근 처리한 코드를 남겨 거른다(코드는 이미 소모돼 저장해도 무해).
 *  · 그래도 옛 launch 코드가 교환에 실패했는데 **이미 로그인돼 있으면** 조용히 넘긴다 —
 *    멀쩡히 쓰는 사람에게 "로그인 코드 만료" 알림을 띄우지 않는다. 사용자가 방금 누른 로그인(open)의
 *    실패는 항상 알린다(조용한 실패 금지).
 *
 * 이 파일은 React 를 import 하지 않는다 — 의존성은 전부 주입받는다(Node 단위 테스트가 실제 파일을 읽는다).
 */
import { authCodeFromDeepLink, authErrorFromDeepLink } from './bridge.js';

export const HANDLED_KEY = 'theroute_app_login_handled';
const HANDLED_MAX = 5;

function readHandled(storage) {
  try {
    const raw = storage && storage.getItem(HANDLED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeHandled(storage, key) {
  try {
    if (!storage) return;
    const next = readHandled(storage).filter((s) => s !== key);
    next.push(key);
    storage.setItem(HANDLED_KEY, JSON.stringify(next.slice(-HANDLED_MAX)));
  } catch {
    // 저장소가 막힌 WebView — 메모리 Set 만으로 한 페이지 안 중복은 막힌다.
  }
}

/** 제공자에서 취소 등 서버가 실어 보낸 오류를 사용자 문구로. */
export function describeAuthError({ error, msg } = {}) {
  const text = `${error || ''} ${msg || ''}`;
  if (/access_denied|cancel/i.test(text)) return '로그인을 취소했습니다';
  return '로그인에 실패했습니다. 다시 시도해 주세요';
}

/**
 * @param {object} deps  (자세한 타입은 계획서 Task 8 Interfaces 참조)
 * @returns {(url: string, meta?: {source?: 'open'|'launch'}) => Promise<string>}
 */
export function createAppLoginHandler(deps) {
  const {
    exchange, login, navigate, notify,
    closeExternal = async () => {},
    hasToken = () => false,
    storage = null,
  } = deps;
  const seen = new Set();

  async function safeClose() {
    try { await closeExternal(); } catch { /* 부가 동작 */ }
  }

  return async function handleAuthDeepLink(url, meta = {}) {
    const source = meta.source === 'launch' ? 'launch' : 'open';
    const code = authCodeFromDeepLink(url);
    const err = code ? null : authErrorFromDeepLink(url);
    if (!code && !err) return 'ignored'; // 로그인과 무관한 딥링크

    const key = code ? `code:${code}` : `error:${url}`;
    if (seen.has(key) || readHandled(storage).includes(key)) return 'duplicate';
    seen.add(key);
    writeHandled(storage, key);

    await safeClose();

    if (err) {
      notify(describeAuthError(err));
      if (!hasToken()) navigate('/login', { replace: true });
      return 'error-link';
    }

    let token;
    try {
      token = await exchange(code);
    } catch (e) {
      if (source === 'launch' && hasToken()) return 'silent';
      notify((e && e.message) || '로그인에 실패했습니다. 다시 시도해 주세요');
      if (!hasToken()) navigate('/login', { replace: true });
      return 'failed';
    }

    let ok = false;
    try {
      ok = (await login(token)) !== false;
    } catch {
      ok = false;
    }
    if (!ok) {
      notify('로그인 정보를 불러오지 못했습니다. 다시 시도해 주세요');
      navigate('/login', { replace: true });
      return 'failed';
    }
    navigate('/', { replace: true });
    return 'ok';
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
node --test test/
```

기대: `# fail 0` (Task 7의 7건 + 이번 10건 = `# pass 17`)

- [ ] **Step 5: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add web/src/native/appLogin.js web/test/appLogin.test.js
git commit -m "feat(native): 딥링크를 로그인 상태로 바꾸는 순수 모듈

코드는 1회용인데 콜드 스타트에서 appUrlOpen 과 getLaunchUrl 이 같은 주소를 주고,
getLaunchUrl 은 새로고침 뒤에도 옛 주소를 계속 준다. 메모리 Set + sessionStorage
2단으로 막고, 옛 launch 실패는 이미 로그인돼 있으면 조용히 넘긴다.
사용자가 방금 누른 로그인의 실패는 항상 알린다(조용한 실패 금지).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: 하드웨어 뒤로가기 (웹, TDD)

뒤로가기 스택과 훅을 만들고 12개 모달에 연결한다.

**Files:**
- Create: `web/src/native/backStack.js`, `web/src/native/useBackHandler.js`
- Test: `web/test/backStack.test.js`
- Modify: `web/src/components/modals/` 아래 12개 모달

**Interfaces:**
- Consumes: 없음
- Produces:
  - `pushBackHandler(handler: () => void): () => void`
  - `backStackSize(): number`
  - `runTopBackHandler(): boolean`
  - `handleNativeBack(data: {canGoBack?: boolean}, env: {goBack: () => void, exitApp: () => void, historyLength?: number}): 'handler'|'back'|'exit'`
  - `__resetBackStackForTest(): void`
  - 기본 export `useBackHandler(active: boolean, onBack?: () => void): void`

- [ ] **Step 1: 실패하는 테스트 작성**

`web/test/backStack.test.js`:

```js
import { test, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  __resetBackStackForTest,
  backStackSize,
  handleNativeBack,
  pushBackHandler,
  runTopBackHandler,
} from '../src/native/backStack.js';

beforeEach(() => __resetBackStackForTest());

function env(overrides = {}) {
  const calls = { back: 0, exit: 0 };
  return {
    calls,
    env: { goBack: () => { calls.back += 1; }, exitApp: () => { calls.exit += 1; }, ...overrides },
  };
}

test('스택이 비었으면 runTopBackHandler 는 false', () => {
  assert.strictEqual(runTopBackHandler(), false);
});

test('겹친 모달에서 맨 위 하나만 닫는다', () => {
  const closed = [];
  pushBackHandler(() => closed.push('아래'));
  pushBackHandler(() => closed.push('위'));
  const { env: e } = env();
  assert.strictEqual(handleNativeBack({ canGoBack: true }, e), 'handler');
  assert.deepStrictEqual(closed, ['위']);
});

test('핸들러는 실행해도 스택에서 빠지지 않는다 (닫힘은 컴포넌트가 스스로 뺀다)', () => {
  pushBackHandler(() => {});
  runTopBackHandler();
  assert.strictEqual(backStackSize(), 1);
});

test('돌려받은 함수로 빼고, 여러 번 불러도 안전하다', () => {
  const remove = pushBackHandler(() => {});
  remove();
  remove();
  assert.strictEqual(backStackSize(), 0);
});

test('함수가 아니면 스택에 올리지 않는다', () => {
  pushBackHandler(null);
  pushBackHandler('닫기');
  assert.strictEqual(backStackSize(), 0);
});

test('모달이 없고 canGoBack 이면 뒤로 간다', () => {
  const { calls, env: e } = env();
  assert.strictEqual(handleNativeBack({ canGoBack: true }, e), 'back');
  assert.deepStrictEqual(calls, { back: 1, exit: 0 });
});

test('모달이 없고 canGoBack 이 false 면 앱을 끈다', () => {
  const { calls, env: e } = env();
  assert.strictEqual(handleNativeBack({ canGoBack: false }, e), 'exit');
  assert.deepStrictEqual(calls, { back: 0, exit: 1 });
});

test('canGoBack 이 없으면 historyLength 로 대신한다', () => {
  const a = env({ historyLength: 3 });
  assert.strictEqual(handleNativeBack({}, a.env), 'back');
  const b = env({ historyLength: 1 });
  assert.strictEqual(handleNativeBack({}, b.env), 'exit');
});

test('핸들러가 던져도 뒤로가기가 죽지 않는다', () => {
  pushBackHandler(() => { throw new Error('닫기 실패'); });
  const { env: e } = env();
  assert.strictEqual(handleNativeBack({ canGoBack: true }, e), 'handler');
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
node --test test/
```

기대: FAIL — `Cannot find module .../src/native/backStack.js`

- [ ] **Step 3: `web/src/native/backStack.js` 구현**

```js
/**
 * 안드로이드 하드웨어 뒤로가기 처리 — T009.
 *
 * 순서: ① 열린 모달이 있으면 **맨 위 하나만** 닫는다 → ② 뒤로 갈 기록이 있으면 history.back()
 *       → ③ 없으면 앱 종료.
 *
 * 왜 "전역 스택"인가: 모달은 부모가 조건부로 렌더하는 컴포넌트라 "열려 있음 = 마운트됨"이다.
 * 열려 있는 동안 닫는 방법을 스택에 올려 두면(useBackHandler) 뒤로가기는 맨 위 것만 부르면 된다.
 * 겹친 모달(상세 위 편집기)에서 **위의 것만** 닫힌다 — Escape 키 이벤트를 흉내 내면 열린 모달이
 * 한꺼번에 다 닫힌다.
 * 핸들러는 실행해도 스택에서 빼지 않는다: 닫힘은 컴포넌트가 언마운트되며 스스로 빠진다.
 * (닫기를 거절하는 화면이면 다음 뒤로가기도 같은 핸들러로 간다.)
 *
 * 왜 history.length 가 아니라 canGoBack 인가: history.length 는 뒤로 가도 줄지 않는다 —
 * 첫 화면으로 돌아와도 1 보다 커서 **앱이 영원히 안 꺼진다.** Capacitor App 플러그인이
 * backButton 이벤트에 WebView 의 canGoBack() 을 실어 주므로 그것을 쓰고, 값이 없을 때만
 * history.length 로 대신한다.
 *
 * 이 파일은 React 를 import 하지 않는다(단위 테스트가 Node 에서 실제 파일을 읽는다).
 */

const stack = [];

/** 닫기 함수를 스택 맨 위에 올린다. 돌려받은 함수로 뺀다(여러 번 불러도 안전). */
export function pushBackHandler(handler) {
  if (typeof handler !== 'function') return () => {};
  const entry = { handler };
  stack.push(entry);
  return () => {
    const i = stack.lastIndexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function backStackSize() {
  return stack.length;
}

/** 맨 위 핸들러를 부른다. 불렀으면 true. */
export function runTopBackHandler() {
  const top = stack[stack.length - 1];
  if (!top) return false;
  try {
    top.handler();
  } catch (e) {
    console.error('[native-back] 닫기 핸들러 오류', e);
  }
  return true;
}

/**
 * @param {{canGoBack?: boolean}} data  App backButton 이벤트 데이터
 * @param {{goBack: () => void, exitApp: () => void, historyLength?: number}} env
 * @returns {'handler'|'back'|'exit'}
 */
export function handleNativeBack(data, env) {
  if (runTopBackHandler()) return 'handler';
  const canGoBack = data && typeof data.canGoBack === 'boolean'
    ? data.canGoBack
    : (Number(env && env.historyLength) || 0) > 1;
  if (canGoBack) {
    env.goBack();
    return 'back';
  }
  env.exitApp();
  return 'exit';
}

/** 테스트 전용 — 스택 비우기. */
export function __resetBackStackForTest() {
  stack.length = 0;
}
```

- [ ] **Step 4: `web/src/native/useBackHandler.js` 구현**

```js
import { useEffect, useRef } from 'react';
import { pushBackHandler } from './backStack.js';

/**
 * 열려 있는 동안 안드로이드 뒤로가기로 닫히게 한다 (T009, 설명은 ./backStack.js).
 *
 * 🔴 핸들러는 ref 로 최신값만 부르고, 스택 등록은 active 가 바뀔 때만 한다. onClose 가 매 렌더
 *    새 함수(인라인 화살표)여도 재등록하지 않으므로 **겹친 모달의 위·아래 순서가 뒤바뀌지 않는다.**
 * 웹 브라우저에서는 스택에 올라가기만 하고 아무도 부르지 않는다(동작 변화 없음).
 *
 * @param {boolean} active   열려 있는가
 * @param {() => void} [onBack] 닫는 함수 — 없으면 등록하지 않는다
 */
export default function useBackHandler(active, onBack) {
  const ref = useRef(onBack);
  ref.current = onBack;
  const enabled = !!active && typeof onBack === 'function';
  useEffect(() => {
    if (!enabled) return undefined;
    return pushBackHandler(() => { if (typeof ref.current === 'function') ref.current(); });
  }, [enabled]);
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
node --test test/
```

기대: `# fail 0` (누적 `# pass 26`)

- [ ] **Step 6: 12개 모달에 훅 연결**

모달은 모두 부모가 조건부로 렌더한다(열림 prop 없이 마운트 자체가 "열림"). 따라서 `active`는 항상 `true`다.
각 파일에 **import 한 줄**과 컴포넌트 본문 첫 줄에 **호출 한 줄**을 넣는다.

import (기존 import 묶음 끝에):

```js
import useBackHandler from '../../native/useBackHandler';
```

호출 (컴포넌트 함수 본문 맨 앞, 다른 훅보다 먼저):

```js
  useBackHandler(true, onClose);
```

대상 파일과 각 파일의 `onClose` prop 이름(모두 `onClose`로 동일하다):

| 파일 | 시그니처 |
|---|---|
| `GoalAddModal.jsx` | `({ goal, onClose, onSaved, onDeleted })` |
| `GymAddModal.jsx` | `({ gym, onClose, onSaved })` |
| `PassAddModal.jsx` | `({ onClose, onSaved })` |
| `PassEditModal.jsx` | `({ pass, onClose, onSaved })` |
| `ProblemAddModal.jsx` | `({ gymId, onClose, onSaved })` |
| `ProblemPhotoModal.jsx` | `({ logId, cpId, photo, onSaved, onDeleted, onClose })` |
| `ProfileEditModal.jsx` | `({ user, onClose, onSaved })` |
| `RecordEditModal.jsx` | `({ kind, logId, initial, onSubmit, onClose, onChanged })` |
| `RouteEditModal.jsx` | `({ route, onClose, onSaved })` |
| `SessionAddModal.jsx` | `({ mode = 'full', initialPrefill = {}, onClose, onSaved })` |
| `VideoLinkPicker.jsx` | `({ defaultColor, defaultLevel, onPick, onClose })` |
| `VideoUploadModal.jsx` | `({ onClose, onSaved })` |

⚠️ `SessionAddModal.jsx`는 이 작업 시작 시점에 **커밋되지 않은 변경이 있다**(이전 세션 작업). 그 변경을 되돌리지 말고 그대로 둔 채 훅만 추가한다.

- [ ] **Step 7: 12개 파일에 모두 들어갔는지 확인하고 빌드**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
grep -l "useBackHandler" src/components/modals/*.jsx | wc -l
npm run build
```

기대: `12`. `vite build`가 에러 없이 끝난다(기존 청크 크기 경고는 이번 변경과 무관하게 원래 있던 것).

- [ ] **Step 8: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add web/src/native/backStack.js web/src/native/useBackHandler.js \
        web/test/backStack.test.js web/src/components/modals
git commit -m "feat(native): 하드웨어 뒤로가기 (모달 닫기 → 뒤로 → 종료)

리스너를 하나라도 등록하면 Capacitor 의 기본 goBack 이 꺼지므로 등록한 쪽이
전부 책임진다. 겹친 모달에서는 맨 위 하나만 닫는다 — Escape 흉내를 내면
열린 모달이 한꺼번에 다 닫힌다.

종료 판정은 history.length 가 아니라 backButton 이벤트의 canGoBack 을 쓴다.
history.length 는 뒤로 가도 줄지 않아 앱이 영원히 안 꺼진다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: 전역 연결부와 앱 로그인 배선 (웹)

앞의 순수 모듈들을 앱 런타임에 연결하고, OAuth 버튼이 앱에서 Custom Tab으로 가게 한다.

**Files:**
- Create: `web/src/native/NativeAppHost.jsx`
- Modify: `web/src/api/auth.js`, `web/src/main.jsx`, `web/src/components/OAuthButtons.jsx`

**Interfaces:**
- Consumes: Task 7의 `bridge.js`, Task 8의 `createAppLoginHandler`, Task 9의 `handleNativeBack`, Task 5의 `POST /api/auth/app-exchange`
- Produces: `appExchange(code: string): Promise<string>` (`web/src/api/auth.js`), 기본 export `NativeAppHost` 컴포넌트

- [ ] **Step 1: `web/src/api/auth.js`에 `appExchange` 추가**

파일 끝에 덧붙인다. `client`의 응답 인터셉터가 이미 `res.data`(= `{ success, data, message }`)를 돌려주므로 한 겹 더 벗긴다.

```js

/**
 * 앱(Android) 로그인 딥링크로 받은 60초 1회용 코드를 JWT 로 바꾼다 (T009).
 * 실패하면 reject 된다 — 호출부(native/appLogin.js)가 사용자에게 알린다.
 */
export async function appExchange(code) {
  const r = await client.post('/auth/app-exchange', { code });
  const token = r && r.data && r.data.token;
  if (!token) throw new Error('로그인 정보를 받지 못했습니다. 다시 시도해 주세요');
  return token;
}
```

- [ ] **Step 2: `web/src/native/NativeAppHost.jsx` 작성**

```jsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { appExchange, getMe } from '../api/auth';
import { closeExternal, exitApp, isNativeApp, onAuthDeepLink, onBackButton } from './bridge.js';
import { createAppLoginHandler } from './appLogin.js';
import { handleNativeBack } from './backStack.js';

const TOKEN_KEY = 'theroute_token';

function getSession() {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

function hasToken() {
  try {
    return !!localStorage.getItem(TOKEN_KEY);
  } catch {
    return false;
  }
}

/**
 * 안드로이드 앱(Capacitor WebView)에서만 켜지는 전역 연결부 — T009.
 * 웹 브라우저에서는 **아무것도 등록하지 않고** 아무것도 그리지 않는다(isNativeApp() false).
 *
 *  1. 로그인 딥링크 → 코드 교환 → 로그인 → 홈 (native/appLogin.js)
 *  2. 하드웨어 뒤로가기 → 맨 위 모달 닫기 → 뒤로 → 종료 (native/backStack.js)
 *  3. 키보드가 열려 WebView 가 줄면 입력 중인 칸을 화면 가운데로
 *
 * BrowserRouter · AuthProvider **안쪽**에 마운트해야 한다(navigate·authLogin 을 쓴다).
 */
export default function NativeAppHost() {
  const navigate = useNavigate();
  const { authLogin } = useAuth();
  // 딥링크·뒤로가기 구독은 마운트 1회만 한다(중복 교환 방지 Set 이 앱 수명 동안 유지돼야 한다).
  // 그래서 navigate·authLogin 은 ref 로 **호출 시점의 최신값**을 부른다.
  const live = useRef({ navigate, authLogin });
  live.current = { navigate, authLogin };

  // 1. 로그인 딥링크
  useEffect(() => {
    if (!isNativeApp()) return undefined;

    // TheRoute 에는 범용 토스트가 없다(VideoUploadToast 는 영상 업로드 전용).
    // LoginPage 가 ?error= 를 초기 상태로 읽어 이미 렌더하므로(LoginPage.jsx), 메시지를 버퍼에
    // 담았다가 /login 이동에 실어 보낸다 — OAuthCallbackPage 와 같은 기존 패턴이다.
    let pendingError = '';

    const handle = createAppLoginHandler({
      exchange: appExchange,
      // AuthContext.authLogin 은 사용자 정보를 스스로 가져오지 않는다 —
      // OAuthCallbackPage 와 같은 순서로 토큰을 먼저 저장하고(axios 인터셉터가 요청 시점에 읽는다)
      // /auth/me 로 사용자를 가져온 뒤 확정한다.
      login: async (token) => {
        localStorage.setItem(TOKEN_KEY, token);
        try {
          const r = await getMe();
          live.current.authLogin(token, r.data);
          return true;
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          return false;
        }
      },
      navigate: (path, opts) => {
        const to = pendingError && path === '/login'
          ? `/login?error=${encodeURIComponent(pendingError)}`
          : path;
        pendingError = '';
        live.current.navigate(to, opts);
      },
      notify: (msg) => { pendingError = msg; },
      closeExternal,
      hasToken,
      storage: getSession(),
    });

    return onAuthDeepLink((url, meta) => {
      handle(url, meta)
        .then(() => {
          // 이미 로그인된 상태라 /login 으로 보내지 않은 경우 — 메시지를 실을 화면 이동이 없다.
          // 이 경로는 "로그인된 채로 옛 오류 딥링크가 다시 온" 때뿐이라 사용자가 막힌 상태가 아니다.
          if (pendingError) {
            console.warn('[native-login]', pendingError);
            pendingError = '';
          }
        })
        .catch((e) => console.error('[native-login]', e && e.message));
    });
  }, []);

  // 2. 뒤로가기
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    return onBackButton((data) => {
      handleNativeBack(data, {
        goBack: () => window.history.back(),
        exitApp: () => { exitApp(); },
        historyLength: window.history.length,
      });
    });
  }, []);

  // 3. 키보드가 열려 WebView 가 줄면(MainActivity 가 키보드만큼 margin 을 준다) 입력 중인 칸을
  //    **화면 가운데**로. 브라우저 기본 스크롤은 칸이 겨우 보이는 데서 멈춰, 그 아래 목록이
  //    키보드 경계에 잘린다. input·textarea·select·contenteditable 공통.
  useEffect(() => {
    if (!isNativeApp()) return undefined;
    const isEditable = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
    let fullHeight = window.innerHeight;   // 키보드 없는 높이(회전·첫 로드 때 갱신)
    let lastHeight = window.innerHeight;
    let raf = 0;
    const centerActive = () => {
      const el = document.activeElement;
      if (!isEditable(el) || typeof el.scrollIntoView !== 'function') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
    };
    const keyboardOpen = () => window.innerHeight < fullHeight * 0.85;
    const onResize = () => {
      const h = window.innerHeight;
      if (h > fullHeight) fullHeight = h;
      if (h < lastHeight && keyboardOpen()) centerActive();
      lastHeight = h;
    };
    const onFocusIn = (e) => {
      if (!isEditable(e.target) || !keyboardOpen()) return;
      setTimeout(centerActive, 50);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);

  return null;
}
```

- [ ] **Step 3: `web/src/main.jsx`에 마운트**

import 묶음의 `import { AuthProvider } from './contexts/AuthContext';` 아래에 한 줄:

```js
import NativeAppHost from './native/NativeAppHost';
```

그리고 `<AuthProvider>` 여는 태그 바로 다음 줄, `<Routes>` **앞**에:

```jsx
        <NativeAppHost />
```

- [ ] **Step 4: `web/src/components/OAuthButtons.jsx` 수정**

파일 맨 위에 import 한 줄을 넣는다.

```js
import { APP_ORIGIN, isNativeApp, openExternal } from '../native/bridge.js';
```

`onClick` 핸들러를 아래로 바꾼다.

```jsx
          onClick={async () => {
            // Google 은 WebView 안 OAuth 를 막는다(disallowed_useragent). 앱에서는 Custom Tab 으로
            // app-start 를 열고, 서버가 로그인 끝에 theroute:// 딥링크로 앱에 돌려보낸다.
            // Custom Tab 을 못 열면(플러그인 없음·실패) 아래 웹 동작으로 폴백한다.
            if (isNativeApp()) {
              const startUrl = `${APP_ORIGIN}/api/auth/app-start?provider=${btn.key}`;
              if (await openExternal(startUrl)) return;
            }
            window.location.href = `/api/auth/${btn.key}`;
          }}
```

- [ ] **Step 5: 빌드하고 배포 확인**

`backend/src/index.js`가 `web/dist`를 그대로 정적 서빙하므로 **빌드가 곧 배포**다. 별도 배포 단계가 없다.
`web/dist`는 `.gitignore`의 `dist/`에 걸려 **커밋 대상이 아니다** — 이 기계에서 빌드한 결과가 곧 운영 파일이다.

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web
npm run build
node --test test/
curl -sS -o /dev/null -w "prod: %{http_code}\n" https://climb.xn--lh0b87pnudm10a4vd.com/
```

기대: `vite build` 성공(에러 0), `# fail 0`, `prod: 200`.

- [ ] **Step 6: 웹 브라우저 회귀 확인**

앱이 아닌 환경에서 아무것도 바뀌지 않아야 한다.

```bash
curl -sS "https://climb.xn--lh0b87pnudm10a4vd.com/login" | grep -c "root"
curl -sS -o /dev/null -w "app-start 차단: %{http_code}\n" \
     "https://climb.xn--lh0b87pnudm10a4vd.com/api/auth/app-start?provider=kakao"
curl -sS -o /dev/null -w "app-start 정상: %{redirect_url}\n" \
     "https://climb.xn--lh0b87pnudm10a4vd.com/api/auth/app-start?provider=google"
```

기대: 첫 줄 `1`(로그인 페이지가 그대로 나옴), `app-start 차단: 400`,
`app-start 정상:` 이 `…/api/auth/google`로 끝난다.

- [ ] **Step 7: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add web/src/native/NativeAppHost.jsx web/src/api/auth.js web/src/main.jsx \
        web/src/components/OAuthButtons.jsx
git commit -m "feat(native): 앱 전역 연결부와 OAuth Custom Tab 배선

NativeAppHost 가 앱에서만 켜져 딥링크 로그인·뒤로가기·키보드 스크롤을 맡는다.
웹 브라우저에서는 아무 리스너도 등록하지 않는다.

AuthContext.authLogin 은 사용자 정보를 스스로 가져오지 않으므로 OAuthCallbackPage
와 같은 순서(토큰 저장 → getMe → authLogin)를 쓴다. 실패 안내는 범용 토스트 대신
LoginPage 의 ?error= 렌더를 그대로 재사용한다.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: 최종 APK 빌드·검증·전달

모든 조각이 붙은 상태로 APK를 다시 뽑고, 정적 검사를 전부 돌린 뒤 사용자에게 전달한다.

**Files:**
- Modify: `agent-vault/10-Flow/tasks/T009-android-apk.md`, `agent-vault/10-Flow/board.md`, `agent-vault/00-Context/ACTIVE.md`, `agent-vault/20-Log/<오늘>.md`
- Create: `agent-vault/30-Knowledge/runbooks/android-apk-build.md`

**Interfaces:**
- Consumes: Task 1–10 전부
- Produces: 사용자에게 전달되는 `app-debug.apk`, 재현 가능한 런북

- [ ] **Step 1: 전체 테스트 재실행**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/backend && node --test test/
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/web && node --test test/
```

기대: 백엔드 `# pass 24 / # fail 0`, 웹 `# pass 26 / # fail 0`.

- [ ] **Step 2: 최종 APK 빌드**

```bash
bash /home/brownjeon/NFS/homes/brownjeon/project/TheRoute/mobile/scripts/build-apk.sh
```

기대: `gradle rc=0` + APK 경로·크기·md5.

- [ ] **Step 3: 정적 검사 5종 전부**

```bash
BT=~/.node-local/android-sdk/build-tools/35.0.0
APK=~/.node-local/theroute-mobile/android/app/build/outputs/apk/debug/app-debug.apk
$BT/aapt2 dump badging "$APK" > /tmp/theroute-badging.txt 2>&1
grep -E "^package|application-label|uses-permission|application-icon" /tmp/theroute-badging.txt
$BT/aapt2 dump xmltree --file AndroidManifest.xml "$APK" > /tmp/theroute-manifest.txt 2>&1
grep -E "launchMode|scheme|host|allowBackup|windowSoftInputMode" /tmp/theroute-manifest.txt
$BT/aapt2 dump xmltree --file res/mipmap-anydpi-v26/ic_launcher.xml "$APK"
$BT/apksigner verify --print-certs "$APK"
unzip -p "$APK" assets/capacitor.config.json
```

기대(하나라도 어긋나면 고치고 재빌드):

| 검사 | 기대값 |
|---|---|
| package | `com.miraclepenguin.theroute` |
| label | `더 루트` |
| 권한 | `INTERNET`·`ACCESS_FINE_LOCATION`·`ACCESS_COARSE_LOCATION`·`CAMERA` 4종, 저장소 권한 없음 |
| launchMode | `0x2` (singleTask) |
| 딥링크 | scheme `theroute`, host `auth` |
| allowBackup | `false` |
| windowSoftInputMode | `0x10` (adjustResize) |
| 적응형 아이콘 | `background`·`foreground`·`monochrome` 3요소 |
| 서명 | `Verifies` · `CN=Android Debug` |
| capacitor.config.json | `url` 퓨니코드 https, `androidScheme` https, `adjustMarginsForEdgeToEdge` auto |

- [ ] **Step 4: APK를 사용자에게 전달**

scratchpad로 복사한 뒤 `SendUserFile`로 보낸다.

```bash
cp ~/.node-local/theroute-mobile/android/app/build/outputs/apk/debug/app-debug.apk \
   /tmp/claude-1000/theroute-app-debug.apk
ls -la /tmp/claude-1000/theroute-app-debug.apk
```

전달 시 함께 알릴 것:
- **이 APK는 디버그 서명 사이드로드다.** 설치하려면 폰에서 "출처를 알 수 없는 앱" 설치를 허용해야 한다.
- **앞으로 화면·기능 수정은 웹 배포만으로 반영된다** — 앱을 완전히 껐다 켜면 최신 웹이 뜬다. APK 재설치는 아이콘·권한·플러그인·네이티브 설정을 바꿀 때만 필요하다.
- 같은 디버그 키로 빌드하는 한 덮어쓰기 설치가 된다. **키를 잃으면 앱을 지웠다 깔아야 하고 로그인이 초기화된다.**

- [ ] **Step 5: 실기기 체크리스트를 사용자에게 요청**

headless로는 시스템 바·키보드·OAuth 왕복이 재현되지 않는다. 아래 7항목은 **실기기가 유일한 판정 수단**이다.

1. 하단 탭이 시스템 내비게이션 버튼과 겹치지 않는가
2. 입력칸을 탭했을 때 키보드가 그 칸을 가리지 않는가
3. Google 로그인이 외부 브라우저 창으로 열리고, 로그인 후 앱으로 돌아와 홈 화면이 뜨는가
4. GitHub 로그인도 같은가
5. 암장 목록에서 위치 권한을 물어보고, 허용하면 내 주변 검색이 되는가
6. 문제 사진 업로드에서 카메라·갤러리 선택이 뜨는가
7. 뒤로가기: 모달이 열려 있으면 모달만 닫히고 → 이전 화면으로 → 첫 화면에서 한 번 더 누르면 앱이 꺼지는가

3번이 실패하고 브라우저에 "주소를 열 수 없습니다"가 뜨면 → 기기가 302 스킴 이동을 막는 경우다.
`OAuthButtons.jsx`의 `startUrl`에 `&fallback=1`을 붙이고 `npm run build`만 하면 된다(**APK 재설치 불필요**).

- [ ] **Step 6: 런북 작성**

`agent-vault/30-Knowledge/runbooks/android-apk-build.md`에 아래를 담는다. BJJ 런북과 같은 구성이되 TheRoute 값으로 쓴다.

- frontmatter: `name: android-apk-build`, `aliases: ["APK 빌드", "안드로이드 앱 빌드", "Capacitor 빌드 절차"]`, `tags: [type/runbook, domain/mobile, domain/infra]`, `related_tasks: ["[[T009-android-apk]]"]`
- §1 구조: 방식·앱 ID·경로별 책임 표(계획서 "파일 구조" 표를 옮긴다)
- §2 빌드: `build-apk.sh` 한 줄 + 로그 위치 + 파이프 금지 경고
- §3 검사: Step 3의 명령과 기대값 표
- §4 업데이트 규칙: 재설치가 필요한가 표(스펙 §12)
- §5 아이콘 재생성: `gen-app-icons.mjs` 실행법
- §6 서명 키 백업 경고
- §7 앱 로그인 흐름 4단계 + `fallback=1` 전환법 + 커스텀 스킴 URL 파싱 함정
- §8 교훈·함정: edge-to-edge·IME·XML 주석 하이픈·`canGoBack`·ESM import 확장자
- §9 남은 리스크: 커스텀 스킴 PKCE 미결속(보류), 10분 쿠키 잔존

- [ ] **Step 7: agent-vault 갱신**

- `T009-android-apk.md`: `status: done`, 각 역할 섹션 기록, 하단에 사용자용 한국어 "최종 요약"
- `board.md`: Doing의 T009를 Done으로 옮기고 날짜 기입
- `ACTIVE.md`: 안드로이드 APK 라인을 완료로, 실기기 확인 대기 항목 명시
- `20-Log/<오늘>.md`: 역할별 타임라인 한 줄씩

- [ ] **Step 8: 커밋**

```bash
cd /home/brownjeon/NFS/homes/brownjeon/project/TheRoute
git add agent-vault
git commit -m "docs(agent-vault): T009 안드로이드 APK 완료 기록과 빌드 런북

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## 실행 후 확인 (Definition of Done)

1. `mobile/scripts/build-apk.sh`가 성공하고 APK가 나온다
2. Task 11 Step 3의 정적 검사 10항목이 모두 기대값과 일치한다
3. 백엔드 24건 · 웹 26건 단위 테스트가 전부 통과한다
4. 표시 쿠키 없는 웹 로그인이 변하지 않았음이 확인된다(Task 6 Step 6, Task 10 Step 6)
5. APK가 사용자에게 전달되고, 실기기 체크리스트 7항목 결과가 회신된다

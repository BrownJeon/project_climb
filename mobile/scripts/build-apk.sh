#!/usr/bin/env bash
# 더 루트(TheRoute) 안드로이드 release APK 빌드·검사 — T009 (2026-10-30 개정 §2).
#
#   bash <저장소>/mobile/scripts/build-apk.sh
#
# NFS 정본에서 불러도, ext4 worktree 에서 불러도 된다 — 소스 위치(PROJECT_ROOT = mobile/)는 이 스크립트 위치에서 계산하고,
# 실제 npm·cap·gradle 실행은 작업 디렉터리(기본 ~/.node-local/theroute-mobile, THEROUTE_APK_WORK 로 변경)에서만 한다.
#
# 순서: (무거운 작업 잠금) → 서명 설정 점검 → 소스 → 작업 디렉터리 동기화 → gradlew 실행 비트 → 네이티브 소스가 바뀌었으면
#       옛 빌드 산출물 정리 → (lock 이 바뀌었거나 node_modules 없으면 npm ci) → npx cap sync android →
#       gradlew :app:assembleRelease → 검사(패키지·버전·권한·딥링크·debuggable·아이콘 3레이어·서명 지문·설정·비밀) → 출력
#
# ── 지키는 것 ────────────────────────────────────────────────────────────────
# - 이 서버는 운영 호스트다(2026-10-28 병렬 시험 부하로 서버 정지). 스크립트 전체가 `nice -n 10 flock /tmp/theroute-heavy.lock`
#   아래에서 돈다 — 스크립트가 스스로 잠금을 잡고 자신을 다시 실행한다(대기 상한 THEROUTE_HEAVY_LOCK_WAIT 초, 기본 1800,
#   넘기면 rc 75 로 실패). 🔴 바깥에서 같은 잠금으로 또 감싸지 말 것 — 감싸야 하면 THEROUTE_HEAVY_LOCK_HELD=1 을 함께 준다
#   (HELD=1 인데 실제로 아무도 잠금을 잡고 있지 않으면 무시하고 직접 잡는다). gradle 은 --no-daemon --max-workers=2.
# - `--check-lock`: 잠금을 잡은 뒤 아무것도 빌드하지 않고 rc 0 으로 끝난다(잠금 동작 시험용).
# - npm·cap·gradle 출력은 **로그 파일로만**(파이프로 자르면 SIGPIPE 로 빌드가 죽는다). 판정은 종료 코드.
# - JDK 21(@capacitor/android 7 요구) · ANDROID_HOME=~/.node-local/android-sdk · build-tools 35.0.0.
# - 서명은 TheRoute 전용 키스토어만. 값은 ~/.android/theroute-signing.env(권한 600, 저장소 밖)를 **gradle 하위 셸에서만**
#   읽어 환경변수로 넘긴다 — 이 스크립트는 그 값을 출력·로그에 남기지 않는다(set -x 금지). 디버그 키 폴백 없음
#   (android/app/build.gradle 이 값이 없거나 디버그 키를 가리키면 빌드를 실패시킨다).
# - 서명 인증서 SHA-256 이 기대 지문(scripts/expected-cert-sha256.txt, 공개값 한 줄)과 다르면 실패한다
#   (키가 바뀐 APK 는 기존 설치본 위에 덮어써지지 않는다).
# - gradlew 실행 비트: 저장소는 2026-09-19(ffe77f3) 실행 비트를 일괄 제거했고 NFS 는 noexec·core.fileMode=false 라
#   신선한 clone 의 첫 빌드가 rc 126 으로 실패한다 → 작업 디렉터리에 동기화한 뒤 이 스크립트가 chmod +x 한다.
# - 옛 빌드 캐시: 네이티브 소스 해시가 직전 **성공** 빌드와 다르면 작업 디렉터리의 android/app/build·android/build 를
#   지운다(AAPT "resource not found" 방지). .gradle(의존성 캐시)은 남긴다. 해시는 검사까지 통과했을 때만 기록한다.
set -euo pipefail
set +x

CHECK_LOCK=0
for arg in "$@"; do
  case "$arg" in
    --check-lock) CHECK_LOCK=1 ;;
    *) echo "[build-apk] 실패: 알 수 없는 인자: $arg" >&2; exit 2 ;;
  esac
done

SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)/$(basename "${BASH_SOURCE[0]}")"
HEAVY_LOCK=/tmp/theroute-heavy.lock
LOCK_WAIT="${THEROUTE_HEAVY_LOCK_WAIT:-1800}"
[[ "$LOCK_WAIT" =~ ^[0-9]{1,5}$ ]] || { echo "[build-apk] 실패: THEROUTE_HEAVY_LOCK_WAIT 는 초 단위 정수여야 한다: '$LOCK_WAIT'" >&2; exit 2; }
LOCK_TIMEOUT_RC=75
# HELD=1 이 왔는데 지금 아무도 잠금을 잡고 있지 않으면(즉시 잡히면) 보호받지 못하는 상태다 — 무시하고 직접 잡는다.
# 바깥이 실제로 잡고 있으면 이 시험 잠금은 즉시 실패하므로 그대로 진행한다(교착 없음).
if [ "${THEROUTE_HEAVY_LOCK_HELD:-}" = "1" ] && flock -n "$HEAVY_LOCK" true 2>/dev/null; then
  echo "[build-apk] THEROUTE_HEAVY_LOCK_HELD=1 인데 잠금을 잡은 프로세스가 없다 — 직접 잡는다"
  unset THEROUTE_HEAVY_LOCK_HELD
fi
if [ "${THEROUTE_HEAVY_LOCK_HELD:-}" != "1" ]; then
  echo "[build-apk] 무거운 작업 잠금($HEAVY_LOCK)을 잡고 nice 10 으로 다시 실행한다 — 다른 빌드가 돌고 있으면 최대 ${LOCK_WAIT}초 기다린다"
  set +e
  env THEROUTE_HEAVY_LOCK_HELD=1 nice -n 10 flock -w "$LOCK_WAIT" -E "$LOCK_TIMEOUT_RC" "$HEAVY_LOCK" bash "$SCRIPT_PATH" "$@"
  RC=$?
  set -e
  if [ "$RC" -eq "$LOCK_TIMEOUT_RC" ]; then
    echo "[build-apk] 실패: ${LOCK_WAIT}초 안에 잠금($HEAVY_LOCK)을 얻지 못했다 — 다른 빌드가 끝난 뒤 다시 실행. 바깥에서 같은 잠금으로 감쌌다면 THEROUTE_HEAVY_LOCK_HELD=1 을 줄 것" >&2
  fi
  exit "$RC"
fi
if [ "$CHECK_LOCK" -eq 1 ]; then
  echo "[build-apk] --check-lock: 잠금 구간 진입(pid $$) — 빌드하지 않고 끝낸다"
  exit 0
fi

PROJECT_ROOT="$(cd "$(dirname "$SCRIPT_PATH")/.." && pwd -P)"
export THEROUTE_APK_WORK="${THEROUTE_APK_WORK:-$HOME/.node-local/theroute-mobile}"
export JAVA_HOME="${JAVA_HOME_21:-/usr/lib/jvm/java-21-openjdk-amd64}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/.node-local/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$PATH"
BUILD_TOOLS="$ANDROID_HOME/build-tools/35.0.0"
SIGNING_ENV="${THEROUTE_SIGNING_ENV:-$HOME/.android/theroute-signing.env}"
EXPECTED_CERT_FILE="$PROJECT_ROOT/scripts/expected-cert-sha256.txt"

EXPECTED_APP_ID="com.miraclepenguin.theroute"
EXPECTED_LABEL="더 루트"
EXPECTED_SERVER_URL="https://climb.xn--lh0b87pnudm10a4vd.com"
EXPECTED_CERT_CN="CN=TheRoute"

log() { echo "[build-apk] $*"; }
fail() { log "실패: $*"; exit 1; }

[ -x "$JAVA_HOME/bin/java" ] || fail "JDK 21 이 없다: $JAVA_HOME"
[ -x "$BUILD_TOOLS/aapt2" ] && [ -x "$BUILD_TOOLS/apksigner" ] || fail "build-tools 35.0.0 이 없다: $BUILD_TOOLS"

# ── 0. 서명 설정 점검(내용은 출력하지 않는다) ──────────────────────────────────
[ -f "$SIGNING_ENV" ] || fail "서명 설정 파일이 없다: $SIGNING_ENV (디버그 키로 대신 서명하지 않는다)"
SIGNING_MODE="$(stat -c %a "$SIGNING_ENV")"
case "$SIGNING_MODE" in
  600|400) ;;
  *) fail "서명 설정 파일 권한이 $SIGNING_MODE 이다 — chmod 600 $SIGNING_ENV 뒤 다시 실행" ;;
esac
# 이 파일은 source(코드 실행)되므로 소유자도 본다 — 현재 사용자 것이 아니면 거부.
SIGNING_OWNER="$(stat -c %U "$SIGNING_ENV")"
[ "$SIGNING_OWNER" = "$(id -un)" ] || fail "서명 설정 파일 소유자가 $SIGNING_OWNER 이다(현재 사용자 $(id -un) 이어야 한다)"
for key in THEROUTE_KEYSTORE THEROUTE_KEYSTORE_PASSWORD THEROUTE_KEY_ALIAS; do
  grep -q "^\(export \)\?${key}=." "$SIGNING_ENV" || fail "서명 설정 파일에 ${key} 가 없다"
done
[ -f "$EXPECTED_CERT_FILE" ] || fail "기대 인증서 지문 파일이 없다: $EXPECTED_CERT_FILE"
EXPECTED_CERT="$(tr -d ' \r\n:' < "$EXPECTED_CERT_FILE" | tr 'A-F' 'a-f')"
[[ "$EXPECTED_CERT" =~ ^[0-9a-f]{64}$ ]] || fail "기대 인증서 지문 형식 이상($EXPECTED_CERT_FILE)"

# ── 1. 소스 → 작업 디렉터리 동기화 ────────────────────────────────────────────
# sync-local.sh 가 작업 디렉터리 값을 검증한다(빈 값·/·$HOME·소스 자신·소스의 조상·소스 안쪽 거부).
bash "$PROJECT_ROOT/scripts/sync-local.sh"
WORK="$(cd "$THEROUTE_APK_WORK" && pwd -P)"
LOG_DIR="$WORK/logs"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR" "$WORK/out"
[ -f "$WORK/android/gradlew" ] || fail "작업 디렉터리에 android/gradlew 가 없다 — 소스에 mobile/android 가 있는지 확인"

# gradlew 실행 비트(위 머리말 참고). 저장소 쪽이 아니라 작업 사본에만 준다.
chmod +x "$WORK/android/gradlew"

# ── 2. 옛 빌드 산출물 정리(네이티브 소스 해시) ───────────────────────────────────
# 해시 대상: 소스 android/(산출물·기계별 값·cap sync 생성물 제외)·capacitor.config.ts·app-shell·package.json·package-lock.json
# (플러그인 버전이 바뀌어도 네이티브 산출물이 달라진다). NFS 정본의 Synology 메타데이터(@eaDir·*@SynoEAStream)는 빼서
# 같은 소스면 NFS 에서든 worktree 에서든 해시가 같게 한다.
native_src_hash() {
  (
    cd "$PROJECT_ROOT"
    find android -type f \
      -not -path 'android/build/*' -not -path 'android/app/build/*' -not -path 'android/.gradle/*' \
      -not -path 'android/.idea/*' -not -path 'android/capacitor-cordova-android-plugins/*' \
      -not -path 'android/app/src/main/assets/*' -not -path 'android/app/src/main/res/xml/config.xml' \
      -not -name 'local.properties' -not -name '*.keystore' -not -name '*.jks' -not -name '*signing.env' \
      -not -path '*/@eaDir/*' -not -name '*@SynoEAStream' -print0 \
      | LC_ALL=C sort -z | xargs -0 -r sha256sum
    sha256sum capacitor.config.ts package.json
    if [ -f package-lock.json ]; then sha256sum package-lock.json; fi
    find app-shell -type f -not -path '*/@eaDir/*' -not -name '*@SynoEAStream' -print0 \
      | LC_ALL=C sort -z | xargs -0 -r sha256sum
  ) | sha256sum | cut -d' ' -f1
}
SRC_HASH="$(native_src_hash)"
[[ "$SRC_HASH" =~ ^[0-9a-f]{64}$ ]] || fail "네이티브 소스 해시 계산 실패"
SRC_HASH_FILE="$WORK/.native-src-hash"
if [ "$(cat "$SRC_HASH_FILE" 2>/dev/null || true)" != "$SRC_HASH" ]; then
  log "네이티브 소스가 직전 성공 빌드와 다르다 — 작업 디렉터리의 옛 빌드 산출물(android/app/build·android/build)을 지운다"
  case "$WORK" in
    ""|"/"|"$HOME"|"$HOME/"|"$PROJECT_ROOT") fail "작업 디렉터리 값이 이상하다: '$WORK'" ;;
  esac
  # 변수 경로로 rm 하지 않는다: 검증한 디렉터리로 들어가 그 안의 고정 상대경로만 지운다.
  cd "$WORK/android"
  [ "$(pwd -P)" = "$WORK/android" ] && [ -f settings.gradle ] && [ -f gradlew ] \
    || fail "정리 대상 디렉터리 확인 실패: $(pwd -P)"
  rm -rf -- ./app/build ./build
  cd "$WORK"
fi

# ── 3. 의존성 ────────────────────────────────────────────────────────────────
cd "$WORK"
[ -f package-lock.json ] || fail "package-lock.json 이 없다 — npm ci 를 할 수 없다(소스 mobile/package-lock.json 확인)"
LOCK_HASH="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ ! -d node_modules/@capacitor/cli ] || [ ! -d node_modules/@capacitor/android ] \
   || [ "$(cat .pkg-lock-hash 2>/dev/null || true)" != "$LOCK_HASH" ]; then
  log "npm ci → $LOG_DIR/npm-ci-$STAMP.log"
  set +e
  npm ci --no-audit --no-fund > "$LOG_DIR/npm-ci-$STAMP.log" 2>&1
  RC=$?
  set -e
  [ "$RC" -eq 0 ] || fail "npm ci rc=$RC — 로그: $LOG_DIR/npm-ci-$STAMP.log"
  echo "$LOCK_HASH" > .pkg-lock-hash
fi

# ── 4. cap sync ─────────────────────────────────────────────────────────────
# local.properties(sdk.dir)는 기계별 값이라 저장소에 두지 않는다 — 작업 디렉터리에 없으면 만든다.
if [ ! -f android/local.properties ]; then
  echo "sdk.dir=$ANDROID_HOME" > android/local.properties
fi
log "npx cap sync android → $LOG_DIR/cap-sync-$STAMP.log"
set +e
npx cap sync android > "$LOG_DIR/cap-sync-$STAMP.log" 2>&1
RC=$?
set -e
[ "$RC" -eq 0 ] || fail "cap sync rc=$RC — 로그: $LOG_DIR/cap-sync-$STAMP.log"

# ── 5. gradle ────────────────────────────────────────────────────────────────
# 서명 값은 이 하위 셸 안에서만 환경변수로 존재한다(부모 셸·cap·npm 에는 없다). 출력은 로그 파일로만.
cd "$WORK/android"
GRADLE_LOG="$LOG_DIR/gradle-$STAMP.log"
log "gradlew :app:assembleRelease --no-daemon --max-workers=2 → $GRADLE_LOG (JAVA_HOME=$JAVA_HOME)"
set +e
(
  set +x
  set -a
  # shellcheck disable=SC1090
  . "$SIGNING_ENV"
  set +a
  exec ./gradlew :app:assembleRelease --no-daemon --max-workers=2
) > "$GRADLE_LOG" 2>&1
RC=$?
set -e
log "gradle rc=$RC"
[ "$RC" -eq 0 ] || fail "gradle 빌드 실패 — 로그 끝부분을 읽을 것: $GRADLE_LOG"

# ── 6. 검사 ──────────────────────────────────────────────────────────────────
APK="$WORK/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK" ] || fail "빌드는 성공했는데 APK 가 없다: $APK"
# 출력을 변수로 먼저 받는다(파이프 + pipefail + grep -q 의 SIGPIPE 위험 제거).
BADGING="$("$BUILD_TOOLS/aapt2" dump badging "$APK")"
MANIFEST_TREE="$("$BUILD_TOOLS/aapt2" dump xmltree --file AndroidManifest.xml "$APK")"
[ -n "$MANIFEST_TREE" ] || fail "aapt2 xmltree 출력이 비었다"

# 6-1 debuggable 이중 검사 — badging 의 application-debuggable 줄 / manifest 의 android:debuggable 참 값.
if grep -q 'application-debuggable' <<<"$BADGING"; then fail "debuggable APK(badging) — 배포 금지"; fi
if grep -q -E 'android:debuggable(\([^)]*\))?=(true|\(type 0x12\)0x0*[1-9a-fA-F])' <<<"$MANIFEST_TREE"; then
  fail "debuggable APK(manifest) — 배포 금지"
fi

# 6-2 패키지·이름·버전
PKG_NAME="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"$BADGING")"
[ "$PKG_NAME" = "$EXPECTED_APP_ID" ] || fail "패키지 이름이 '$PKG_NAME' 이다(기대 $EXPECTED_APP_ID)"
grep -q -F "application-label:'$EXPECTED_LABEL'" <<<"$BADGING" || fail "앱 이름(application-label)이 '$EXPECTED_LABEL' 이 아니다"
VERSION_CODE="$(sed -n "s/^package: .*versionCode='\([0-9]*\)'.*/\1/p" <<<"$BADGING")"
VERSION_NAME="$(sed -n "s/^package: .*versionName='\([^']*\)'.*/\1/p" <<<"$BADGING")"
[[ "$VERSION_CODE" =~ ^[1-9][0-9]{0,8}$ ]] || fail "versionCode 형식 이상: '$VERSION_CODE'"
[[ "$VERSION_NAME" =~ ^[0-9]{1,4}[.][0-9]{1,4}[.][0-9]{1,4}$ ]] || fail "versionName 형식 이상: '$VERSION_NAME'"

# 6-3 권한: 정확히 INTERNET·위치 2종·CAMERA (+ androidx core 가 스스로 선언하는 앱 전용 signature 권한). 저장소 권한 없음.
PERMS="$(sed -n "s/^uses-permission: name='\([^']*\)'.*/\1/p" <<<"$BADGING" | sort -u)"
UNEXPECTED_PERMS="$(grep -v -x \
  -e 'android.permission.INTERNET' \
  -e 'android.permission.ACCESS_FINE_LOCATION' \
  -e 'android.permission.ACCESS_COARSE_LOCATION' \
  -e 'android.permission.CAMERA' \
  -e "${EXPECTED_APP_ID}.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" <<<"$PERMS" || true)"
[ -z "$UNEXPECTED_PERMS" ] || fail "허용하지 않은 권한: $(tr '\n' ' ' <<<"$UNEXPECTED_PERMS")"
for p in INTERNET ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION CAMERA; do
  grep -q -x "android.permission.$p" <<<"$PERMS" || fail "필수 권한이 없다: $p"
done

# 6-4 Manifest: singleTask · allowBackup=false · 딥링크 <data> 는 정확히 하나(theroute://auth)
# launchMode 는 MainActivity 의 것만 본다(Capacitor Browser 의 BrowserControllerActivity 도 launchMode=2 라 전체 grep 은 거짓 통과한다).
# aapt2 xmltree 는 요소 바로 아래에 그 요소의 속성(A:)을 먼저 찍고 자식 요소(E:)를 찍는다.
MAIN_LAUNCH_MODE="$(awk '
  /^ *E: / { if (inact && name ~ /\.MainActivity"/) { print lm; done = 1; exit } inact = ($2 == "activity"); name = ""; lm = ""; next }
  inact && /:name\(0x01010003\)=/ { name = $0 }
  inact && /:launchMode\(0x0101001d\)=/ { sub(/.*=/, ""); lm = $0 }
  END { if (!done && inact && name ~ /\.MainActivity"/) print lm }
' <<<"$MANIFEST_TREE")"
case "$MAIN_LAUNCH_MODE" in
  2|"(type 0x10)0x2") ;;
  *) fail "MainActivity launchMode 가 singleTask(2)가 아니다: '$MAIN_LAUNCH_MODE'" ;;
esac
grep -q -E 'allowBackup(\([^)]*\))?=(false|\(type 0x12\)0x0)$' <<<"$MANIFEST_TREE" || fail "allowBackup=false 가 아니다"
DATA_COUNT="$(grep -c -E '^\s*E: data ' <<<"$MANIFEST_TREE" || true)"
[ "$DATA_COUNT" = "1" ] || fail "intent-filter <data> 가 $DATA_COUNT 개다(기대 1: theroute://auth)"
grep -q -E ':scheme\([^)]*\)="theroute"' <<<"$MANIFEST_TREE" || fail "딥링크 scheme theroute 가 없다"
grep -q -E ':host\([^)]*\)="auth"' <<<"$MANIFEST_TREE" || fail "딥링크 host auth 가 없다"

# 6-5 아이콘: 적응형 ic_launcher 에 background·foreground·monochrome 3레이어.
# release 빌드는 리소스 경로를 짧게 바꿀 수 있어(res/xx.xml) 파일 경로를 리소스 표에서 찾는다.
RES_TABLE="$("$BUILD_TOOLS/aapt2" dump resources "$APK")"
ICON_FILE="$(awk '
  /^ *resource 0x[0-9a-f]+ mipmap\/ic_launcher$/ { on=1; next }
  /^ *resource / { on=0 }
  on && /anydpi-v26/ { for (i=1;i<=NF;i++) if ($i ~ /^res\//) { print $i; exit } }
' <<<"$RES_TABLE")"
[ -n "$ICON_FILE" ] || fail "리소스 표에서 mipmap/ic_launcher(anydpi-v26) 파일을 찾지 못했다"
ICON_TREE="$("$BUILD_TOOLS/aapt2" dump xmltree --file "$ICON_FILE" "$APK")"
for layer in background foreground monochrome; do
  grep -q -E "^\s*E: $layer " <<<"$ICON_TREE" || fail "적응형 아이콘에 $layer 레이어가 없다($ICON_FILE)"
done

# 6-6 capacitor.config.json(APK 안의 것)
CAP_JSON="$(unzip -p "$APK" assets/capacitor.config.json)"
node -e '
const [json, appId, url] = process.argv.slice(1)
const c = JSON.parse(json), s = c.server || {}, a = c.android || {}
const bad = []
if (c.appId !== appId) bad.push("appId")
if (s.url !== url) bad.push("server.url")
if (s.androidScheme !== "https") bad.push("server.androidScheme")
if (s.cleartext !== false) bad.push("server.cleartext")
if (s.errorPath !== "index.html") bad.push("server.errorPath")
if (s.allowNavigation !== undefined) bad.push("server.allowNavigation(있으면 안 됨)")
if (a.adjustMarginsForEdgeToEdge !== "auto") bad.push("android.adjustMarginsForEdgeToEdge")
if (bad.length) { console.error("[build-apk] capacitor.config.json 어긋난 항목: " + bad.join(", ")); process.exit(1) }
' "$CAP_JSON" "$EXPECTED_APP_ID" "$EXPECTED_SERVER_URL" || fail "APK 안 capacitor.config.json 이 기대와 다르다"

# 6-7 서명: apksigner 검증 · 서명자 1명 · 인증서 지문 = 기대값 · DN 에 CN=TheRoute
set +e
CERTS="$("$BUILD_TOOLS/apksigner" verify --print-certs "$APK" 2>&1)"
RC=$?
set -e
[ "$RC" -eq 0 ] || fail "apksigner verify rc=$RC"
SIGNER_COUNT="$(grep -c '^Signer #[0-9]* certificate SHA-256 digest:' <<<"$CERTS" || true)"
[ "$SIGNER_COUNT" = "1" ] || fail "서명자가 $SIGNER_COUNT 명이다(1 이어야 한다)"
CERT_SHA="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' <<<"$CERTS" | tr -d ':' | tr 'A-F' 'a-f')"
[[ "$CERT_SHA" =~ ^[0-9a-f]{64}$ ]] || fail "인증서 지문을 읽지 못했다"
[ "$CERT_SHA" = "$EXPECTED_CERT" ] || fail "서명 인증서 지문 불일치: $CERT_SHA (기대 $EXPECTED_CERT) — 다른 키로 서명됐다. 배포 금지"
CERT_DN="$(sed -n 's/^Signer #1 certificate DN: //p' <<<"$CERTS")"
grep -q -F "$EXPECTED_CERT_CN" <<<"$CERT_DN" || fail "서명 인증서 DN 이 기대와 다르다: $CERT_DN"
if grep -q -F 'CN=Android Debug' <<<"$CERT_DN"; then fail "디버그 키로 서명됐다"; fi

# 6-8 비밀: APK 안에 키스토어·서명 설정·.env 파일이 없고, 서명 비밀번호 문자열도 없다.
ENTRIES="$(unzip -Z1 "$APK")"
if grep -i -E '(^|/)\.env|\.keystore$|\.jks$|signing\.env|\.p12$|\.pem$' <<<"$ENTRIES"; then
  fail "APK 안에 비밀 파일로 보이는 항목이 있다(위 목록)"
fi
grep -q -x 'assets/public/index.html' <<<"$ENTRIES" || fail "APK 에 연결 실패 화면(assets/public/index.html)이 없다"
# 임시 디렉터리에 풀지 않고(정리용 rm -rf 가 필요 없게) 모든 항목의 압축 해제 내용을 흘려 보며 찾는다.
# 🔴 비밀번호를 grep 의 명령행 인자로 주지 않는다(ps·/proc/PID/cmdline 에 보인다) — 내장 printf 로 만든 프로세스 치환을
#    패턴 파일(-f)로 넘기므로 argv 에는 /dev/fd/N 만 남는다.
# grep 이 일찍 끝나면 unzip 이 SIGPIPE 를 받으므로 pipefail 을 끄고 두 종료 코드를 따로 본다:
#   grep 0(찾음) → 1 / grep 1(없음)이면서 unzip 0 → 0 / 그 밖(unzip 실패·grep 오류) → 3
set +e
(
  set +x
  set +o pipefail
  set -a
  # shellcheck disable=SC1090
  . "$SIGNING_ENV"
  set +a
  [ -n "${THEROUTE_KEYSTORE_PASSWORD:-}" ] || exit 2
  unzip -p "$APK" | grep -a -q -F -f <(printf '%s\n' "$THEROUTE_KEYSTORE_PASSWORD")
  PS=("${PIPESTATUS[@]}")
  [ "${PS[1]}" -eq 0 ] && exit 1
  [ "${PS[1]}" -eq 1 ] && [ "${PS[0]}" -eq 0 ] && exit 0
  exit 3
) > /dev/null 2>&1
RC=$?
set -e
[ "$RC" -eq 0 ] || fail "APK 안에 서명 비밀번호와 같은 문자열이 있거나 검사하지 못했다(rc=$RC)"

# ── 7. 출력 ──────────────────────────────────────────────────────────────────
APK_SHA="$(sha256sum "$APK" | cut -d' ' -f1)"
APK_MD5="$(md5sum "$APK" | cut -d' ' -f1)"
APK_BYTES="$(stat -c %s "$APK")"
OUT="$WORK/out/theroute-${VERSION_NAME}-${VERSION_CODE}.apk"
cp "$APK" "$OUT"

log "APK        : $APK"
log "copy       : $OUT"
log "package    : $PKG_NAME  label: $EXPECTED_LABEL  versionCode: $VERSION_CODE  versionName: $VERSION_NAME"
log "permissions: $(tr '\n' ' ' <<<"$PERMS")"
log "manifest   : singleTask · allowBackup=false · deeplink theroute://auth (data 1개)"
log "icon       : $ICON_FILE — background·foreground·monochrome"
log "signer     : $CERT_DN / SHA-256 $CERT_SHA (기대 지문과 일치)"
log "debuggable : no"
log "secrets    : 없음(파일 이름·서명 비밀번호 검사 통과)"
log "size       : $APK_BYTES bytes"
log "sha256     : $APK_SHA"
log "md5        : $APK_MD5"
# 검사까지 통과한 빌드의 소스 해시만 기록한다(다음 빌드가 옛 산출물을 재사용해도 되는지 판단).
echo "$SRC_HASH" > "$SRC_HASH_FILE"

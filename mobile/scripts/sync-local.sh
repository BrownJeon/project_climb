#!/usr/bin/env bash
# 소스(mobile/) → APK 작업 디렉터리 단방향 동기화 — T009.
#
#   bash <저장소>/mobile/scripts/sync-local.sh
#
# 왜 필요한가: NFS 정본(project/)은 noexec 이라 npm·Capacitor CLI·gradle 을 그 위에서 돌릴 수 없다.
# mobile/ 의 소스(설정·app-shell·scripts·android 프로젝트)를 ext4 작업 디렉터리로 보낸 뒤 거기서 빌드한다.
# 편집은 항상 소스 쪽(NFS 정본 또는 ext4 worktree)에서 하고, 작업 디렉터리는 실행 전용이다.
#
# - 소스 위치(PROJECT_ROOT)는 이 스크립트 위치에서 계산한다 — NFS 정본에서도, worktree 에서도 같은 스크립트가 돈다.
# - 작업 디렉터리 기본값 ~/.node-local/theroute-mobile, 환경변수 THEROUTE_APK_WORK 로 바꾼다.
# - 반대 방향(작업 디렉터리 → 소스)은 하지 않는다. `npx cap add android`·`npm install` 처럼 작업 디렉터리에서
#   파일이 생기는 작업 뒤에는 필요한 파일만 손으로 소스로 되돌린다.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
WORK="${THEROUTE_APK_WORK:-$HOME/.node-local/theroute-mobile}"

# rsync --delete 대상이므로 작업 디렉터리 값을 먼저 검증한다.
# 빈 값·상대경로·/·$HOME·소스 자신·소스의 조상(저장소 루트 등)·소스 안쪽은 거부한다.
case "$WORK" in
  ""|/|"$HOME"|"$HOME/") echo "[sync-local] 작업 디렉터리 값이 이상하다: '$WORK'" >&2; exit 2 ;;
  /*) ;;
  *) echo "[sync-local] 작업 디렉터리는 절대경로여야 한다: '$WORK'" >&2; exit 2 ;;
esac
mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd -P)"
case "$PROJECT_ROOT/" in
  "$WORK"/*) echo "[sync-local] 작업 디렉터리($WORK)가 소스($PROJECT_ROOT)와 같거나 그 조상이다 — 거부" >&2; exit 2 ;;
esac
case "$WORK/" in
  "$PROJECT_ROOT"/*) echo "[sync-local] 작업 디렉터리($WORK)가 소스($PROJECT_ROOT) 안에 있다 — 거부" >&2; exit 2 ;;
esac

# NFS 정본(Synology)은 디렉터리마다 @eaDir·*@SynoEAStream 메타데이터를 만든다 — 소스가 아니므로 보내지 않는다.
# `--exclude` 대신 송신 쪽에서만 숨기는 `-s` 필터를 쓴다: --exclude 는 수신 쪽 삭제 보호도 겸해서, 예전에 한 번
# 넘어간 메타데이터가 작업 디렉터리(res/ 등)에 영영 남는다. `-s` 는 숨기기만 하므로 --delete 가 그것을 지운다.
SYNO=(--filter='-s @eaDir/' --filter='-s *@SynoEAStream')

rsync -a --delete "${SYNO[@]}" "$PROJECT_ROOT/app-shell/" "$WORK/app-shell/"
rsync -a --delete "${SYNO[@]}" "$PROJECT_ROOT/scripts/" "$WORK/scripts/"

# 안드로이드 프로젝트. 소스가 진실이고 빌드는 작업 디렉터리에서만 돈다.
#   · build/ · .gradle/ 은 산출물 — 보내지 않는다(매번 수백 MB).
#   · local.properties 는 기계별 값(sdk.dir) — 덮어쓰면 안 된다.
#   · assets/·capacitor-cordova-android-plugins/·res/xml/config.xml 은 `npx cap sync` 생성물이다.
#   · 키스토어·서명 설정은 저장소에 없어야 하지만, 실수로 생겨도 작업 디렉터리로 옮기지 않는다.
#   --exclude 는 수신 쪽 삭제 보호도 겸한다(--delete-excluded 를 쓰지 않으므로).
if [ -d "$PROJECT_ROOT/android" ]; then
  rsync -a --delete "${SYNO[@]}" \
    --exclude 'build/' --exclude '.gradle/' --exclude 'local.properties' --exclude '.idea/' \
    --exclude 'capacitor-cordova-android-plugins/' \
    --exclude 'app/src/main/assets/' \
    --exclude 'app/src/main/res/xml/config.xml' \
    --exclude '*.keystore' --exclude '*.jks' --exclude '*signing.env' \
    "$PROJECT_ROOT/android/" "$WORK/android/"
fi

for f in package.json package-lock.json capacitor.config.ts tsconfig.json; do
  if [ -f "$PROJECT_ROOT/$f" ]; then
    cp "$PROJECT_ROOT/$f" "$WORK/$f"
  fi
done

exit 0

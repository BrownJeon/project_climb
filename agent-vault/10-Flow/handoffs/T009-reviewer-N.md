---
task: "[[T009-android-apk]]"
stream: N
role: reviewer
verdict: PASS
round1: CONDITIONAL_PASS
round: 2
status: DONE
updated: 2026-10-30
tags:
  - type/handoff
  - domain/mobile
---

# T009 스트림 N — Reviewer 감사 (네이티브 셸·전용 서명 키·빌드 스크립트·아이콘 생성기)

대상: `/home/brownjeon/.node-local/theroute-app` (브랜치 `mobile-app-t009`, 미커밋). 의도 문서 = [개정 2026-10-30](../../../docs/superpowers/plans/2026-10-30-android-apk-addendum.md) §2·§5-1, 스펙 §5·§6·§10~§13, 개발자 기록 [[T009-stream-N]].
읽기·정적 검사만 했다. 코드 수정·git 조작·gradle/npm/vite 실행·비밀 읽기 없음(비밀번호 값은 한 번도 읽거나 출력하지 않았고, 변수 이름과 키스토어 경로만 확인).

## 판정: CONDITIONAL_PASS

CRITICAL 0 · HIGH 0 · MEDIUM 3 · LOW 8. QA 로 넘겨도 된다. 단 M-1(서명 비밀번호가 `ps` 인자에 잠깐 노출)은 한 줄 수정이라 QA 전 수정을 권한다.

## 의도 검증 (개정 §2·§5-1·§6)

| 요구 | 결과 | 근거 |
|---|---|---|
| 전용 키(없을 때만 생성), 600, 저장소 밖 | 충족 | `~/.android/theroute-release.keystore`·`theroute-signing.env` 모두 `-rw-------`(stat 600) |
| RSA 2048+·alias·DN | 충족 | apksigner: `CN=TheRoute, O=miraclepenguin`, RSA 4096. alias 는 env 변수 이름·존재만 확인했고 값은 읽지 않았다(파일 173바이트의 길이 계산상 alias 8자·비밀번호 48자로 개발자 기록 `theroute`·48자와 모순 없음, 값 자체는 미확인) |
| 유효기간 10000일+ | 부분 확인 | README 에 2056-10-22. keytool -list 는 비밀번호가 필요해 실행하지 않음 |
| 백업 700/600, 비밀 없음 | 충족 | `backup/android-signing/theroute/` 700, 파일 3개 600, README 는 경로·공개 지문만(전문 읽음). 키스토어·env 는 원본과 크기 동일(4284·173)이나 바이트 비교는 비밀 읽기라 하지 않음 |
| 지문 기대값 파일에 공개값만 | 충족 | `expected-cert-sha256.txt` 한 줄 = `BA:B3:…:38:CE` = 실제 APK 서명 지문 |
| release 서명·디버그 키 폴백 불가 | 정적 판독으로 충족 | build.gradle:48-57(서명 설정은 env 만), :71-90 taskGraph 검사. 부정 시험은 gradle 금지라 미실행(아래 QA 항목) |
| gradlew chmod +x 가 빌드 전 | 충족 | build-apk.sh:84(chmod) < :158(gradlew 실행) |
| 옛 빌드 캐시 정리(해시) | 충족 | build-apk.sh:89-117, 해시 재계산값 = 기록값(`f5355d40…18ef`) |
| `.gitignore` 목록 | 충족 | 개정 §2-1 의 7항목 전부 + cap sync 생성물. 신규 파일 84개 중 비밀·산출물 없음(`backend/node_modules` 심볼릭 링크만 — 커밋 제외 대상) |
| 버전·경로 | 충족 | build.gradle:8-9, `THEROUTE_APK_WORK`, PROJECT_ROOT 는 스크립트 위치에서 계산 |
| 서버 부하 규칙 | 충족(M-2 참고) | nice·flock·`--no-daemon --max-workers=2`·로그 파일 출력 |
| §5-1 임시값 표시 | 충족 | 창 배경·아이콘 주황·도안은 상수/리소스로 분리(L-5 참고) |

개발자가 "계획과 다르게 한" 항목은 10개다(Leader 설명은 7개). 10개 모두 의도에 맞거나 더 안전하다. 잠금 자기 재실행(3번)만 M-2 의 운영 위험이 따른다. 4번(아이콘 검사 경로)은 스펙 §13 이 틀렸음을 내가 직접 재현했다.

## 발견 이슈

| ID | 심각도 | 파일:줄 | 증상 → 원인 → 제안 |
|---|---|---|---|
| M-1 | MEDIUM | `mobile/scripts/build-apk.sh:282` | 서명 비밀번호가 `grep` 명령행 인자로 들어가 `ps`·`/proc/PID/cmdline` 에 잠깐 노출된다. 원인: `unzip -p "$APK" \| grep -a -q -F -- "$THEROUTE_KEYSTORE_PASSWORD"`. 더미 값으로 재현(`ps` 에 `-F -- DUMMY_SECRET_VALUE_123` 이 보임). 노출 시간은 APK 3MB 스캔 동안(수십 ms). 키스토어 파일이 600 이라 비밀번호만으로는 악용 불가라 MEDIUM. 개정 §2-1 은 "ps 인자에 남기지 않는다" 가 중점 감사 항목. 제안: `grep -a -q -F -f <(printf '%s\n' "$THEROUTE_KEYSTORE_PASSWORD")` (printf 는 내장이라 argv 에 값이 없고 `-f /dev/fd/N` 만 남는다). 양성·음성 대조 시험(rc=1/0)으로 `PIPESTATUS[1]` 판정 로직 자체는 올바름을 확인. 같은 패턴이 참고 구현 `StockInvest/scripts/build-apk.sh:354` 에도 있다 |
| M-2 | MEDIUM | `build-apk.sh:33-36` ↔ 개정 §2-4(45행) | 개정이 지시한 형식 `nice -n 10 flock /tmp/theroute-heavy.lock <명령>` 으로 이 스크립트를 감싸면 영구 교착한다. 원인: 스크립트가 같은 잠금 파일에 다시 `flock` 을 거는데 바깥 flock 과 open file description 이 달라 서로 막힌다. 제한 시간이 없고 메시지는 "기다린다" 뿐이다. 스크립트 머리말(15-16행)에는 `THEROUTE_HEAVY_LOCK_HELD=1` 을 함께 주라고 있으나 개정 문서·QA 지시에는 없다. 해(害)는 시간 낭비뿐. 제안: ① 최소 — QA·Leader 브리프에 "build-apk.sh 는 바깥에서 flock 으로 감싸지 말 것(스스로 잡는다). 감쌀 때는 `THEROUTE_HEAVY_LOCK_HELD=1`" 한 줄 ② 선택 — 잠금 대기에 `flock -w <초>` 와 대기 안내, HELD=1 인데 실제로 잠금이 안 잡혀 있으면(`flock -n "$HEAVY_LOCK" true` 가 성공하면) 무시하고 새로 잡기 |
| M-3 | MEDIUM | `mobile/scripts/sync-local.sh:35,36,45-51` · `build-apk.sh:92-100` | NFS 정본에서 돌리면 Synology `@eaDir`·`*@SynoEAStream` 이 복사·해시에 섞인다. 원인: rsync 4회·해시 `find` 어디에도 제외가 없다. 같은 NFS 트리에 이미 `web/src/components/@eaDir`·`web/src/pages/@eaDir` 가 있고, TheAdmin 의 `sync-local.sh:31,39` 는 `--exclude '@eaDir'` 를 쓴다. 개정 §2-3 은 "NFS 정본에서도 worktree 에서도 같은 스크립트가 돈다" 고 약속한다. 지금 ext4 worktree 에서는 무해하나, main 병합 뒤 NFS 경로 실행에서 `res/*/@eaDir` 가 AAPT2 에 들어가거나 해시가 흔들려 매번 전체 재빌드될 수 있다(AAPT2 가 이를 어떻게 처리하는지는 [추측], 미확인). 제안: 4개 rsync 에 `--exclude '@eaDir' --exclude '*@SynoEAStream'`, 해시 find 에 `-not -path '*/@eaDir/*' -not -name '*@SynoEAStream'` |
| L-1 | LOW | `sync-local.sh:21-33` | 대상 경로 검증이 "비어 있음·`/`·`$HOME`·소스 자신·조상·안쪽" 만 막는다. 무관한 기존 디렉터리는 통과한다. 시험(실제 검증 구간을 잘라 실행): `/`·`$HOME`·`/home/brownjeon/.`·`NFS/..`·조상·자신·안쪽·상대경로·소스/홈/조상을 가리키는 심볼릭 링크 → 전부 거부. 그러나 `…/project/StockInvest`·`/tmp` 는 ACCEPT 라서, 사용자가 `THEROUTE_APK_WORK` 를 잘못 지정하면 `$WORK/{scripts,android,app-shell}` 이 `--delete` 로 교체된다(StockInvest 에는 `scripts/`·`android/` 가 둘 다 있다). 기본값 사용 시 위험 없음. 제안: 작업 디렉터리에 표식 파일(예 `.theroute-apk-work`)을 두고 "비어 있거나 표식이 있을 때만" 허용 |
| L-2 | LOW | `build-apk.sh:62-66,156,279` | env 파일은 권한(600/400)만 보고 소유자는 보지 않는데, 이 파일은 `source`(코드 실행)된다. `~/.android` 가 775 이지만 그룹 `brownjeon` 의 구성원이 본인뿐이라 지금은 악용 경로 없음. 제안: `stat -c '%a %U'` 로 소유자 = 현재 사용자 확인 |
| L-3 | LOW | `build-apk.sh:274-287` | `unzip -p` 자체의 실패를 안 본다(`PIPESTATUS[0]` 미확인): unzip 이 실패해도 grep 이 빈 입력을 받아 rc=1 → "비밀 없음" 통과. 앞서 `unzip -Z1`·`unzip -p assets/…` 가 성공해 실제 발생 가능성은 낮다. 제안: `[ "${PIPESTATUS[0]}" -eq 0 ]` 추가 |
| L-4 | LOW | `res/values/styles.xml:12` | `AppTheme.NoActionBar` 의 parent 가 `Theme.AppCompat.DayNight.NoActionBar` 인데 앱은 라이트 전용이다(웹은 `[data-theme=dark]` 만 있고 `prefers-color-scheme` 없음, `uiMode` 는 configChanges 에 있음). 시스템 다크 모드에서는 theme 이 `isLightTheme=false` 가 되어 Android 10~12 WebView 가 FORCE_DARK_AUTO 로 웹을 어둡게 칠할 수 있다 [추측, 실기기 미확인]. Capacitor 에 force-dark 설정 코드 없음(grep 확인). 제안: QA 가 시스템 다크 모드로 확인하고, 문제가 보이면 parent 를 `Theme.AppCompat.Light.NoActionBar` 로(API 33+ 는 영향 거의 없음) |
| L-5 | LOW | `styles.xml:16-18`·`theroute_colors.xml:3`·`gen-app-icons.mjs:27`·`app-shell/index.html:8-18` | §5-1 이 "어디서도 import 안 되는 죽은 파일"이라고 정정한 `base.css` 를 근거로 주석이 달려 있고(값은 임시), 같은 색이 여러 곳에 중복돼 D2·D3 결정 때 한 번에 안 바뀐다. 바꿀 곳: ① 생성기 상수 `BRAND`·`ON_BRAND`·`HOLDS`·`STROKE` → `--android`·`--web` 재생성(단일 진실, 생성물과 상수 일치 확인함) ② `theroute_colors.xml` 의 `theroute_window_bg` ③ `app-shell/index.html` 인라인 색 4개(`#fafafa`·`#ff5a3c`·`#1a1a1a`·`#6b7280`) ④ 위 주석 3곳. 제안: 결정 후 한 번에 처리, 지금은 조치 불필요 |
| L-6 | LOW | `gen-app-icons.mjs:89`·`web/public/apple-touch-icon.png` | 파비콘·apple-touch-icon 이 둥근 사각(rx=20)이라 iOS 홈 화면에서 투명 모서리가 검게 보인다. 안드로이드 앱 범위 밖이고 웹 파비콘만 해당. 제안: apple-touch 용은 모서리를 둥글게 하지 않은 꽉 찬 사각으로 |
| L-7 | LOW | `res/drawable*/splash.png`(11개)·`drawable-v24/ic_launcher_foreground.xml`·`mipmap-*/ic_launcher_foreground.png`·`drawable/ic_launcher_background.xml`(청록 벡터)·`layout/activity_main.xml`·`src/test`·`src/androidTest` 예제 | Capacitor 템플릿 잔여물이 APK 에 그대로 실린다. splash.png 는 파란 Capacitor 로고다(내가 직접 열어 봄). 컴파일된 테마를 보면 `AppTheme.NoActionBarLaunch` 는 `android:background` 만 splash.png 로 지정하고 창 배경은 core-splashscreen 의 `compat_splash_screen_no_icon_background` 라서 화면에 보일 가능성은 낮다 [가능성 높음, 실기기 미확인]. 예제 테스트는 패키지 `com.getcapacitor.myapp` 이라 실행하면 실패하는 죽은 코드. 제안: 보이는 곳이 없음을 QA 가 시작 화면으로 확인, 정리는 선택 |
| L-8 | LOW | 문서·잔여 | ① 저장소 `CLAUDE.md:91-93` 에 삭제된 RN Expo 실행 안내가 남아 있다(Leader 몫). ② `mobile/package.json` 의 `version` 과 build.gradle 의 `routeVersionName` 이 이중 관리라 어긋날 수 있다. ③ `package.json` 의 `build:apk`·`sync` 스크립트는 작업 디렉터리(WORK)에서 실행하면 sync-local 이 "소스와 같음" 으로 거부한다(소스에서만 의미). ④ Gradle wrapper 에 `distributionSha256Sum` 없음(템플릿 기본). ⑤ 키 생성·교체 절차를 남긴 런북이 없다(백업 README 만 있음) |

## 항목별 근거 (중점 감사 11개)

1. **서명 비밀**: 비밀번호 출력·로그·저장소 파일·문서 어디에도 없다 — 48자 토큰 스캔(파일명만 출력)을 worktree(`.git`·node_modules 제외)·vault·docs·`.claude`·백업 README·작업 디렉터리 `logs/`·android 빌드 중간산출물에 돌려 `package-lock.json` 2개(무관한 무결성 해시)만 걸렸다. gradle 로그 2개에서 "password" 등장 0회. 빌드 중간산출물의 서명 관련 파일은 `signing-config-versions.json`(버전만)뿐. env 는 하위 셸 2곳에서만 source(`build-apk.sh:152-159, 274-287`), `set -x` 없음(`set +x` 만 29·153·275행), 권한 600/400 검사(62-66행), 서명 후 서명자 1명·SHA-256 = 기대값·DN·`CN=Android Debug` 거부(250-263행). 키 파일 권한은 위 의도 검증 표. 예외는 M-1(argv)과 L-2.
2. **파일 삭제 안전**: `rm -rf` 는 `build-apk.sh:115` 한 곳이고 `cd "$WORK/android"` → `pwd -P` 일치·`settings.gradle`·`gradlew` 확인 → 고정 상대경로(`./app/build ./build`)라 변수가 비어도 상위를 지울 수 없다(`A && B && C \|\| fail` 우선순위도 올바름). sync-local.sh 시험 결과는 L-1. rsync exclude 는 `build/`·`.gradle/`·`local.properties`·`.idea/`·`*.keystore`·`*.jks`·`*signing.env`·cap sync 생성물을 보호한다(`--delete-excluded` 안 씀). 소스/작업 사본 diff(scripts·android)는 동일.
3. **동시성·재실행**: HELD 변수가 없으면 `exec env …=1 nice flock bash` 로 재실행해 정상 경로에서는 교착이 없다. 바깥에서 감싸면 교착(M-2). 잔존 gradle·kotlin 프로세스 없음, 잠금 파일(0바이트)은 아무도 열고 있지 않음. 해시·chmod 순서는 위 표.
4. **Manifest**: 권한 = INTERNET·FINE·COARSE·CAMERA + androidx 의 signature 권한뿐(저장소 권한 없음), `allowBackup=false`, MainActivity 만 `exported=true`(+ `ProfileInstallReceiver` 는 DUMP 권한 보호), FileProvider·BrowserControllerActivity·InitializationProvider `exported=false`, `usesCleartextTraffic`·`debuggable`·`networkSecurityConfig` 없음, 딥링크 `<data>` 정확히 1개(`theroute`/`auth`), `launchMode=2`, `windowSoftInputMode=0x10`(adjustResize). XML 주석의 `--` 는 Python 으로 생성물 포함 전 XML 을 검사해 0건, 전부 well-formed. 참고: CAMERA·위치 권한이 `uses-feature` camera/location 을 필수로 암시한다(사이드로드 폰에는 무관, 해당 하드웨어 없는 기기만 설치 불가).
5. **MainActivity**: 정확. `SDK_INT < 35` 이면 return 하고, Capacitor 의 `CapacitorWebView.edgeToEdgeHandler` 도 35+·auto·opt-out 없음 에서만 리스너를 건다(`CapacitorWebView.java:58-86`) → API 34 이하에서 이중 축소 없음. Bridge 생성(`Bridge.java:1623`)이 `super.onCreate` 의 `load()` 안이라 `onCreate` 에서 교체하는 시점이 맞다. 같은 뷰의 리스너는 하나뿐이라 Capacitor 것이 교체되고, 람다는 외부 변수를 잡지 않아 해제·누수 문제 없음. `max(bars.bottom, ime.bottom)` 는 IME 인셋이 내비게이션 바를 포함하므로 올바르다. geolocation: `BridgeWebChromeClient.java:246` 이 `onGeolocationPermissionsShowPrompt` 를 구현(권한 런처 → `callback.invoke`, S+ 에서 COARSE 만 허용돼도 허용), `Bridge.java:280` 이 `webView.setWebChromeClient(new BridgeWebChromeClient(this))` — 개발자가 적은 두 줄 번호가 미러 소스와 일치. `onShowFileChooser`(같은 클래스, geolocation 바로 아래)가 파일 선택·카메라를 처리하므로 교체하지 않은 판단도 맞다. 실제 키보드 동작·프레임별 인셋 갱신 부하는 실기기 영역.
6. **config/셸**: `capacitor.config.ts` — 퓨니코드 `climb.xn--lh0b87pnudm10a4vd.com` 이 `domainToASCII('climb.미라클펭귄.com')` 결과와 같다, `androidScheme https`·`cleartext false`·`errorPath index.html`·`allowNavigation` 없음. 외부 이동: `Bridge.launchIntent`(`Bridge.java:393-430`)가 앱 host 와 허용 마스크 밖 URL 을 `ACTION_VIEW` 로 시스템에 넘기고 `true` 를 돌려주므로 앱 안에서 열리지 않는다. `webContentsDebuggingEnabled` 는 기본값이 `isDebug`(`CapConfig.java:288`)라 release 에서 꺼지고 `allowMixedContent` 기본 false. `app-shell/index.html` 은 인라인 CSS·JS 뿐, 플러그인·외부 요청 없음(`location.replace` 로 운영 URL 재시도만).
7. **styles/colors**: `windowLightStatusBar`·`windowLightNavigationBar` 둘 다 true 로 컴파일됨(`0x010104e0`·`0x0101056c`=true), 창 배경은 `@color/theroute_window_bg`(`#fffafafa`) 단일 리소스. 다만 L-4(DayNight)·L-5(중복·주석).
8. **아이콘 생성기**: 결정적 — 작업 사본에서 두 번 실행해 scratchpad 로 쓴 결과가 바이트 동일, 커밋될 산출물(Android res 12개 + 파비콘 3개)과 현재 생성기 출력이 전부 동일. 도안은 파일 상단 상수(`BRAND`·`ON_BRAND`·`HOLDS`·`ROUTE`·`STROKE`), `ROUTE` 는 `HOLDS` 에서 계산. 3레이어(background·foreground·monochrome) 산출, 전경 이름 `ic_theroute_*` 로 분리돼 템플릿 `ic_launcher_foreground` 와 충돌 없음(컴파일된 리소스 id `0x7f070062`·`0x7f070063` 이 각각 foreground·monochrome 으로 연결). 홀드 3점은 원형 마스크 안전영역 안(중심 거리+반지름이 각각 약 31·7·30 < 36). 손으로 고칠 필요 없는 구조.
9. **.gitignore**: 위 의도 검증 표. `git check-ignore` 로 키스토어·`signing.env`·`build/`·`.gradle/`·`local.properties`·`app/release/`·cap sync 생성물·`node_modules`·`logs` 가 제외되고 gradlew·wrapper jar·`AndroidManifest.xml`·`styles.xml`·`file_paths.xml`·`package-lock.json`·`expected-cert-sha256.txt` 는 제외되지 않음을 확인. 참고: `core.fileMode=false` 라 `git add` 하면 gradlew·스크립트가 100644 로 들어간다 — build-apk.sh 가 작업 사본에서 chmod 하므로 무해.
10. **APK 직접 검증**: 아래 "직접 실행한 검사" 표.
11. **의도 대조**: 위 표.

## 직접 실행한 검사

| 검사 | 결과 |
|---|---|
| `aapt2 dump badging` | `com.miraclepenguin.theroute` versionCode 1 / versionName 1.0.0, label `더 루트`, minSdk 23 / targetSdk 35, 권한 INTERNET·FINE·COARSE·CAMERA·DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION, `application-debuggable` 없음, 아이콘 `res/BW.xml` |
| manifest xmltree | `allowBackup=false`, MainActivity `launchMode=2`·`windowSoftInputMode=0x10`·`exported=true`, `scheme="theroute"`·`host="auth"`(data 1개), BrowserControllerActivity 도 `launchMode=2`(개발자 지적 확인) |
| `apksigner verify --print-certs` | Verifies, v1·v2 true(v3 false), 서명자 1명, `CN=TheRoute, O=miraclepenguin`, SHA-256 `bab3ef3f…c1f538ce` = 기대값, RSA 4096. META-INF 3개 "not protected" 경고는 AGP 메타데이터라 무해 |
| `assets/capacitor.config.json` | appId·server.url(퓨니코드)·https·cleartext false·errorPath·adjustMarginsForEdgeToEdge auto, allowNavigation 없음. `capacitor.plugins.json` = app·browser 만 |
| APK 안 비밀 파일 | env·keystore·jks·p12·pem·ts·map 없음 |
| 스펙 §13 아이콘 명령 | `aapt2 dump xmltree --file res/mipmap-anydpi-v26/ic_launcher.xml <release apk>` → `error: failed to find file.` (개발자 주장 확인). 리소스 경로가 난독화돼 `res/BW.xml` |
| 네이티브 소스 해시 | 재계산 = 기록, APK 이후 수정된 소스 없음(빌드물 = 현재 소스) |
| 키·env·백업 권한 | 위 표(600·700) |
| sync-local 검증 | 위 L-1 (시험 18+6건) |
| 비밀 스캔 | 위 항목 1 |
| 비밀번호 검사 파이프 대조 시험 | 양성 rc=1, 음성 rc=0 (더미 값) |
| XML 주석 `--`·well-formed | 0건·이상 없음 |

## QA 에 넘길 high_risk_areas

1. **아이콘 3레이어 검사의 올바른 방법**(스펙 §13 명령은 release 에서 실패):
   ```
   BT=/home/brownjeon/.node-local/android-sdk/build-tools/35.0.0; APK=<release apk>
   $BT/aapt2 dump resources "$APK" > res.txt
   P=$(awk '/^ *resource 0x[0-9a-f]+ mipmap\/ic_launcher$/ {on=1;next} /^ *resource /{on=0} on && /anydpi-v26/ {for(i=1;i<=NF;i++) if($i ~ /^res\//){print $i; exit}}' res.txt)
   $BT/aapt2 dump xmltree --file "$P" "$APK"     # E: background · E: foreground · E: monochrome 세 요소
   ```
   교차 확인: xmltree 의 `@0x7f07xxxx` 가 `res.txt` 에서 `drawable/ic_theroute_foreground`·`drawable/ic_theroute_monochrome` 으로 풀리는지, 배경은 `color/ic_launcher_background`(`#ffff5a3c`). id·경로는 빌드마다 달라질 수 있으니 값이 아니라 이름으로 확인. build-apk.sh 6-5 단계가 이미 같은 일을 하므로 출력의 `icon : res/… — background·foreground·monochrome` 줄도 증거가 된다.
2. **gradle 부정 시험 1회**(내가 gradle 금지라 못 함): 서명 env 없이 `:app:assembleRelease` 가 "release 서명 환경변수 없음" `GradleException` 으로 설정 단계에서 실패하는지, `THEROUTE_KEYSTORE` 를 `~/.android/debug.keystore` 로 주면 "디버그 키로 서명하려 했다" 로 실패하는지. 부하 규칙 준수(`nice -n 10 flock /tmp/theroute-heavy.lock`, `--no-daemon --max-workers=2`, 로그 파일, `build-apk.sh` 는 바깥에서 감싸지 않음 — M-2).
3. **실기기 7항목**(스펙 §13): 특히 ① 키보드 — API 35 기기와 34 이하 기기 각각에서 이중 축소·가림 여부, 키보드 애니메이션 중 끊김 ② 위치 프롬프트(`BridgeWebChromeClient`) ③ 로그인 딥링크 복귀(singleTask·Custom Tab 정리, 콜드 스타트·앱이 죽은 뒤 복귀 모두) ④ 하단 탭과 내비게이션 바 겹침.
5. **시스템 다크 모드 ON** 으로 앱을 열어 화면 색이 라이트 그대로인지(L-4).
6. **콜드 스타트 첫 화면**: Android 12+ 시스템 스플래시 아이콘이 앱 아이콘(주황)인지, 파란 Capacitor 로고가 보이지 않는지(L-7).
7. **덮어쓰기 설치**: 같은 키로 `routeVersionCode` 를 올려 다시 빌드한 APK 가 앱 삭제 없이 설치되는지(키 연속성 증명, 배포 단계에서).
8. **NFS 병합 뒤 첫 실행**: NFS 경로에서 `build-apk.sh` 를 돌릴 때 `@eaDir` 영향(M-3 수정 여부 포함).
9. 수정 사항이 생기면 QA 가 직접 재실행하지 말고 **Reviewer 부터 재순환**.

## 후속 과제

- M-1·M-2·M-3 수정(스트림 N, 개발자) — M-1 은 한 줄. 수정 후 이 감사의 해당 항목만 재검증하면 된다.
- 개정 문서 §2-4 에 "build-apk.sh 는 스스로 잠금을 잡는다" 한 줄 보강(Leader).
- 사용자 데모 결정 D1~D4 뒤: L-5 의 수정 지점 일괄 처리, 아이콘 재생성, versionCode 증가(네이티브 변경 → 재설치 필요 알림 선행).
- `CLAUDE.md` 의 RN Expo 실행 안내 정리, 키 생성·교체 런북(`docs/mobile-*`) 작성.
- 커밋 시: `backend/node_modules` 심볼릭 링크 제외, 필요하면 `git update-index --chmod=+x` 로 gradlew·스크립트 모드 지정(선택).

## 검토하지 못한 것

- gradle 부정 시험(위 2번), 실기기 동작 일체, 키스토어 내부(유효기간·alias 를 `keytool -list` 로 보는 것은 비밀번호가 필요해 안 함), 백업 키스토어의 바이트 동일성(크기·권한·수정시각만), 키 생성 시 비밀번호 전달 방식(`-storepass:env` — 일회성이라 지금 관찰 불가, 개발자 진술에 의존).
- AAPT2 가 `res/` 아래 `@eaDir` 를 실제로 어떻게 처리하는지(M-3 은 위험 보고).
- 스트림 B(백엔드)·W(웹 순수 모듈) 코드는 이 감사 범위 밖(`reviewer-b`·`reviewer-w` 담당).

---

# 2라운드 (2026-10-30 밤) — 후속 패치와 새 APK 재감사

대상: 개발자 기록 [[T009-stream-N]] "후속 패치" 절, 새 APK `theroute-1.0.0-1.apk`(sha256 `ab9a74fa…93a3c`, 현재 파일과 기록값 일치), 사용자 승인 데모 v1(D1 B·D2 B·D3 B·D4 그대로). 이번에도 읽기·정적 검사만 했다. rsync·아이콘 생성·잠금 시험은 scratchpad 의 새 디렉터리와 scratchpad 잠금 파일에서만 돌렸고 프로젝트·작업 디렉터리·NFS·운영 잠금(`/tmp/theroute-heavy.lock`)은 건드리지 않았다(아이콘 생성기만 가벼운 작업이라 운영 잠금을 짧게 잡았다). 비밀번호 값은 읽거나 출력하지 않았다.

## 판정: PASS

Critical 0 · High 0 · Medium 0 · LOW 5(전부 비차단 권고). 1라운드 지적 M-1·M-2·M-3·L-2·L-3·L-4·L-7(+L-5·L-6)은 모두 해소됐고, 데모 v1 반영은 승인본과 일치하며, 1라운드에서 PASS 였던 항목은 깨지지 않았다.

## 1라운드 지적 재검증

| ID | 결과 | 근거 |
|---|---|---|
| M-1 | 해소 | `build-apk.sh:320` `unzip -p "$APK" \| grep -a -q -F -f <(printf '%s\n' "$THEROUTE_KEYSTORE_PASSWORD")`. 스크립트 311~327행을 그대로 잘라 더미 값으로 실행: 포함 zip rc=1, 없음 zip rc=0, 깨진 zip rc=3. 호출부 `:328` 은 rc≠0 이면 전부 실패(`[ "$RC" -eq 0 ] \|\| fail`)라 반대 해석해 통과시키는 경로가 없다. grep 을 2초 살려 두고 `ps` 확인: argv 는 `grep -a -q -F -f /dev/fd/63`, 더미 값이 든 프로세스 0개 |
| M-2 | 해소(LOW 2건 잔여) | 아래 "잠금 시험" 표 |
| M-3 | 해소 | 아래 "rsync 필터 재현" |
| L-2 | 해소 | `:97-98` `stat -c %U` = `id -un` 아니면 실패 |
| L-3 | 해소 | `:321-324` `PIPESTATUS` 를 배열로 받아 grep 0 → 1, grep 1 이고 unzip 0 → 0, 그 밖 → 3 (깨진 zip 시험 rc=3) |
| L-4 | 해소 | 컴파일된 `AppTheme.NoActionBar` parent = `Theme.AppCompat.Light.NoActionBar`(리소스 id `0x7f0e0112`; DayNight 는 `0x7f0e0106` 으로 별개), 바 아이콘 어둡게 true/true 유지 |
| L-7 | 해소(잔여물 LOW) | APK 리소스 표에 `drawable/splash` 없음. `AppTheme.NoActionBarLaunch` = `android:background`·`windowSplashScreenBackground` 둘 다 `@color/theroute_window_bg`. 소스와 작업 사본 모두 `splash.png`·`src/test`·`src/androidTest` 없음. `drawable/splash`·`myapp`·`ExampleUnitTest` 참조 grep 0건 |
| L-5 | 해소 | 창 배경색 정의는 `theroute_colors.xml:6`(`#FFFFFF`) 한 곳, `styles.xml:21,29,30` 은 `@color` 참조뿐. 아이콘 주황은 생성기 `BRAND` 한 곳(→ `values/ic_launcher_background.xml` 생성물). 근거 주석이 죽은 `base.css` 에서 `tokens.css` 로 바뀜 |
| L-6 | 해소 | `apple-touch-icon.png` 180×180 모서리 픽셀 `[238,100,56,255]`(불투명), `favicon-32.png` 모서리는 투명(둥근 사각 유지) |

### 잠금 시험 (build-apk.sh 사본 + scratchpad 잠금 파일, 실제 잠금과 무간섭)

| 시험 | 결과 |
|---|---|
| T1 그냥 `--check-lock` | rc 0, 빌드 없음, 0.0초 |
| T2 바깥 `flock` + `HELD=1` | rc 0, 교착 없음 |
| T3 다른 보유자 + `WAIT=2` | 2.0초 뒤 안내 메시지, rc 75 |
| T4 `HELD=1` 인데 보유자 없음 | "직접 잡는다" 안내 후 rc 0 (거짓 `HELD=1` 은 무시된다) |
| T5 바깥 `flock`, HELD 없음, `WAIT=3`(옛 교착 상황) | 3.0초 뒤 rc 75 — 교착이 제한 시간으로 끝남 |
| T6 알 수 없는 인자·`WAIT=abc` | rc 2 · rc 2 |

안전성 판독: 정상 재실행 경로에서 자식의 `flock -n` 은 부모 flock 의 open file description 과 충돌해 항상 실패하므로 `HELD=1` 이 유지되고 거짓 양성이 없다. 거짓 `HELD=1`(보유자 없음)은 `flock -n` 이 성공해 무시된다. 시험 잠금을 잡았다 바로 놓은 뒤 `flock -w` 로 다시 기다리므로 그 사이 경쟁이 생겨도 안전하다. 자식에게만 `env THEROUTE_HEAVY_LOCK_HELD=1` 을 주고(`:55`), 부모 환경은 그대로이며, 서명 env 는 이 구간 뒤(`:191`, `:317`)에 하위 셸에서만 source 된다.

### rsync 필터 재현 (실제 `sync-local.sh` 38~57행을 scratchpad 디렉터리로 실행)

개발자 주장(`--exclude` 는 수신 쪽 파일을 `--delete` 에서 보호하지만 `-s` 는 보내기만 막고 옛 것을 지운다)은 rsync 의미와 맞고 시험으로 확인했다. 같은 시작 상태(수신 쪽에 옛 `@eaDir`·`*@SynoEAStream` 과 보호 대상이 이미 있음)에서:

| 항목 | 현재 `-s` 필터 | 비교용 `--exclude` |
|---|---|---|
| 수신 쪽 옛 `app-shell/@eaDir/old`·`res/.../@eaDir/old`·`*@SynoEAStream` | 삭제됨 | 남음(res/ 아래 영영 남아 AAPT2 에 들어갈 수 있음) |
| 송신 쪽 `@eaDir`·`*@SynoEAStream`(app-shell·scripts·res) | 안 넘어감 | 안 넘어감 |
| 수신 쪽 `app/build/`·`build/`·`.gradle/`·`assets/`·`*.keystore`·`*signing.env` | 유지 | 유지 |
| `local.properties` | 수신 값(`dst-local`) 유지 | 유지 |
| 송신 쪽 `build/`·`assets/`·`*.keystore`·`*signing.env` | 안 넘어감 | 안 넘어감 |

`-s` 선택은 지시보다 낫다. 해시 `find` 2곳(`build-apk.sh:130,134`)도 실제 함수(122~137행)로 확인했다: 메타데이터가 있는 소스와 없는 소스의 해시가 같고(`a3848c53…1520`), 제외를 뺀 옛 로직에서는 달라진다.

## 데모 v1 반영 대조

- **아이콘(D1 B·D3 B)**: `gen-app-icons.mjs:28-38` `BRAND '#EE6438'`·`ON_BRAND '#FFFFFF'`·`ROUTE 'M46,78 L62,56 L48,32'`·`HOLDS (46,78,6.5)·(62,56,5.5)·(48,32,7.5)`·`STROKE 5` 가 데모 `ICONS.B`(`T009-android-apk-v1.html:464`)와 글자 그대로 같다. 홀드의 안전 원(반지름 33) 안 최대값 31.80. 생성기를 scratchpad 로 두 번 실행해 결과가 바이트 동일, 커밋될 산출물 Android 15개·웹 3개와 모두 동일. 컴파일된 `ic_launcher_background` = `#ffee6438`, 적응형 아이콘 3레이어(background·foreground·monochrome)가 `ic_theroute_*` 로 풀림. 웹 `theme-color`(`#ff5a3c`)는 개발자가 승인 범위 밖이라 그대로 둠(L-9 참고).
- **창 배경(D2 B)**: 컴파일된 `color/theroute_window_bg` = `#ffffffff`.
- **app-shell**: 구조·문구·크기·색을 가이드 §2-3 과 데모 CSS(`.shell`·`.cta`·`.connecting`·`.spinner`)에 대조해 일치(앱 이름 13px 600 `#6b6b68` 아래 14px, 제목 18px 700 `#131313`, 설명 14px, 버튼 min-height 52·min-width 200·패딩 0 28·모서리 10·19px 700·`#ee6438` 다음 줄 `oklch(67% 0.18 38)`·누름 `brightness(.94)`·포커스 `3px #9d2800` offset 2, 재시도 상태 문구 3줄·스피너 18px·`aria-live` "다시 연결하는 중입니다", `prefers-reduced-motion` 에서 스피너 정지). 외부 요청·플러그인 없음(링크·스크립트 소스·fetch 없음), 운영 주소 퓨니코드 `https://climb.xn--lh0b87pnudm10a4vd.com/`. APK 안 `assets/public/index.html` 이 소스 `app-shell/index.html` 과 바이트 동일. 재시도 폭주 없음: 타이머·누적 리스너가 없고 이동이 또 실패하면 Capacitor 가 페이지를 새로 띄워 상태가 초기화된다. 이동은 `online` 이벤트·버튼 때만 일어난다.

## APK 직접 검증 (새 APK)

| 검사 | 결과 |
|---|---|
| sha256 | `ab9a74fa…a93a3c` = 기록값, 부정 시험(23:06) 전후 APK 불변(APK 수정시각 23:05:44, 소스에 그보다 나중에 수정된 파일 없음) |
| badging | `com.miraclepenguin.theroute` 1/1.0.0, minSdk 23/target 35, 권한 INTERNET·FINE·COARSE·CAMERA·DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION, `application-debuggable` 0줄 |
| manifest | `allowBackup=false`, MainActivity `launchMode=2`·`windowSoftInputMode=0x10`, `theroute`/`auth` `<data>` 1개, `exported=true` 는 MainActivity·ProfileInstallReceiver 2개 |
| apksigner | Verifies, 서명자 1명, `CN=TheRoute, O=miraclepenguin`, SHA-256 `bab3ef3f…c1f538ce` = 기대값 |
| `capacitor.config.json` | 퓨니코드 URL·https·cleartext false·errorPath·adjustMargins auto, `allowNavigation` 없음, 플러그인 app·browser 뿐 |
| 아이콘 | 리소스 표로 `res/BW.xml` 를 찾아 xmltree: background `@0x7f05003c`(`#ffee6438`)·foreground `@0x7f070062`·monochrome `@0x7f070063` = `ic_theroute_*` |
| 테마·splash | `AppTheme.NoActionBar` parent Light, 창 배경 `theroute_window_bg`, 바 아이콘 true/true. `AppTheme.NoActionBarLaunch` 위 L-7 대로. `drawable/splash` 없음 |

## 부정 시험 증거 (개발자 로그)

`logs/neg1-noenv.log`·`neg2-debugkey.log` 를 읽었다(48자 토큰 검사 0건, 비밀 없음). neg1: `build.gradle` line 81 "release 서명 환경변수 없음: THEROUTE_KEYSTORE, THEROUTE_KEYSTORE_PASSWORD, THEROUTE_KEY_ALIAS", 설정 단계 BUILD FAILED in 5s. neg2: line 88 "release 를 디버그 키로 서명하려 했다 — TheRoute 전용 키스토어만 쓴다", BUILD FAILED in 5s. 현재 `build.gradle` 81·88행이 정확히 그 두 `throw` 줄이다. 둘 다 서명 가드 문구에서 실패했고 APK 는 시험 전후 같다. 1라운드에서 못 한 항목(QA 2번)이 이것으로 닫혔다.

## 회귀 확인

키 파일 600·백업 700/600·파일 크기 불변, 소스 해시 기록 = 재계산(`d04ba56e…5b9f`), 소스↔작업 사본 동일(scripts·app-shell·android), `gradlew chmod +x`(`:116`) < gradle(`:193`) < 캐시 정리 순서 유지, 비밀 48자 토큰 스캔 0건(mobile·web/public·.gitignore·handoffs·작업 디렉터리 logs·빌드 중간산출물·백업 README), XML 13개 well-formed·주석 `--` 0건, `bash -n` 통과·`set -x` 없음, `git ls-files -o` 71개에 비밀·산출물 없음, `backend/node_modules` 링크는 `.gitignore:8` 로 걸러짐, `.gitignore` 에 제거된 줄 없음(주석 한 줄 교체만), `web/index.html` 변경은 파비콘 링크 2줄뿐.

## 잔여 이슈 (전부 LOW, 비차단)

| ID | 파일:줄 | 증상 → 원인 → 제안 |
|---|---|---|
| N-1 | `build-apk.sh:55-61` | 부모 bash 만 `kill -TERM <PID>` 하면 자식(flock+빌드)이 고아로 남아 빌드를 계속하고 잠금을 쥔다 — 시험으로 확인(부모 TERM 후 잠금 유지, 시험용 sleep 이 끝나야 풀림). 원인: 1라운드 M-2 수정이 `exec` 를 자식 실행으로 바꿈. 개정 §2-4 가 "프로세스 종료는 PID 로" 라고 해 빌드를 중단하려는 사람이 부모만 죽일 수 있다. 제안: 부모에 `trap 'kill -TERM "$CHILD"' TERM INT` 를 두고 자식을 백그라운드 + `wait` 로 돌리거나, 최소한 QA 브리프에 "중단하려면 부모가 아니라 gradle(자식) 프로세스 그룹을 종료" 한 줄 |
| N-2 | `build-apk.sh:48` | 다른 프로세스가 실제로 잠금을 쥔 상태에서 가짜 `HELD=1` 을 주면 잠금 없이 통과한다(시험 T7: 보유자 있음 + `HELD=1` → 즉시 rc 0). `flock -n` 으로는 보유자가 누구인지 구별할 수 없다. 거짓 `HELD=1` 은 사람이 일부러 줘야 하므로 위험은 낮다. 조치 불필요, 인지만 |
| N-3 | `app-shell/index.html:75-80` | `online` 이벤트가 연달아 오면 `location.replace` 가 중복 호출돼 진행 중 이동이 매번 재시작된다. 타이머·리스너 누수는 없다. 제안(선택): `retry()` 에 진행 중 표시를 두어 두 번째 호출을 무시 |
| N-4 | 템플릿 잔여물 | 남은 미사용 리소스: `drawable-v24/ic_launcher_foreground.xml`(`ic_launcher_foreground` 3건)·`mipmap-*/ic_launcher_foreground.png`·청록 `drawable/ic_launcher_background.xml`·`layout/activity_main.xml`. 화면에 쓰이지 않는다(파란 Capacitor 로고 `splash.png` 는 이번에 제거됨). 정리는 선택 |
| N-5(= L-9) | `web/index.html` `theme-color` | `#ff5a3c`(기존)가 새 아이콘 주황 `#EE6438` 과 어긋난다. 데모 D3 범위 밖이라 개발자가 그대로 뒀다. 브라우저 주소창 색일 뿐이므로 Leader 판단 |

1라운드 LOW 중 L-1(작업 디렉터리 표식 파일)·L-8(문서류)은 지시대로 하지 않았다. 둘 다 비차단으로 유지한다.

## QA 에 넘길 high_risk_areas (달라진 것)

- **닫힌 항목**: gradle 부정 시험은 개발자가 수행했고 증거 로그를 내가 확인했다(QA 재실행은 선택). 시스템 다크 모드는 테마가 Light 로 바뀌어 위험이 줄었다(실기기 확인은 유지).
- **빌드 실행 규칙**: `build-apk.sh` 는 바깥에서 `flock` 으로 감싸지 말고 직접 호출한다(스스로 잠금을 잡는다, 대기 상한 `THEROUTE_HEAVY_LOCK_WAIT` 기본 1800초, 초과 시 rc 75). 감쌀 때만 `THEROUTE_HEAVY_LOCK_HELD=1`. `--check-lock` 은 빌드 없이 잠금 구간 진입만 확인한다. 중단은 부모만 죽이지 말 것(N-1).
- **아이콘 검사(올바른 방법)**: 1라운드의 `aapt2 dump resources` 로 `mipmap/ic_launcher (anydpi-v26)` 경로를 찾아 xmltree 를 보는 방식 그대로. 기대 배경색 `#ffee6438`.
- **실기기에서 새로 볼 것**: ① 런처 아이콘이 원형·둥근 사각·물방울 마스크에서 홀드 3점이 잘리지 않는지, 테마 아이콘(monochrome)이 단색으로 보이는지 ② 시작 화면: Android 12+ 은 흰 배경에 시스템 시작 화면 아이콘이 앱 아이콘인지(기본 Android 아이콘이면 `windowSplashScreenAnimatedIcon` 지정 필요 — 컴파일 결과상 값은 `@android:drawable/sym_def_app_icon` 기본이다), 12 미만은 흰 화면 ③ 시스템 바 뒤 흰 창 배경이 상단바·하단 탭과 이어지는지(D2 B) ④ app-shell: 비행기 모드로 앱을 열어 "서버에 연결할 수 없습니다"가 뜨는지, 네트워크를 켜면 `online` 이벤트로 "다시 연결하는 중…"을 거쳐 앱이 열리는지, "다시 시도" 버튼 동작, TalkBack 이 "다시 연결하는 중입니다"를 읽는지, 360px 폭에서 버튼이 안 잘리는지, 모션 줄이기 설정에서 스피너 정지 ⑤ 기존 항목: 키보드(API 35 / 34 이하)·위치·로그인 딥링크 복귀·하단 탭 겹침.
- **APK 식별**: versionCode 가 1 로 그대로라 설치된 기기가 있어도 같은 키·같은 versionCode 라 덮어쓰기는 되지만 새 빌드와 옛 빌드가 versionCode 로 구분되지 않는다. 전달한 파일은 sha256(`ab9a74fa…a93a3c`)으로 확인한다.
- 수정이 생기면 QA 가 직접 재실행하지 말고 Reviewer 부터 재순환.

## 검토하지 못한 것 (2라운드)

실기기 동작 일체, NFS 정본 경로에서의 실제 실행(병합 전이라 불가 — 필터와 해시는 scratchpad 재현으로만 확인), 브라우저에서의 app-shell 렌더(코드·APK 내용 대조만), Android 12+ 시스템 시작 화면 아이콘 해석, 키스토어 내부(비밀번호 필요)·백업 키스토어 바이트 동일성.

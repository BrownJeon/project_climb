# 클라이밍기록 (TheRoute) — 배포 작업절차서

> **이 프로젝트 배포의 정본.** 배포를 실행하기 전에 이 문서를 먼저 읽는다.
> 작성 2026-09-19 · 근거: VoiceVault 파일럿 실배포(`VoiceVault/docs/task-038-deploy-order.md`)와
> 워크스페이스 정본 [`dev-deploy-workflow.md`](../../docs/dev-deploy-workflow.md).
>
> | 문서 | 다루는 것 |
> |---|---|
> | [`../../docs/dev-deploy-workflow.md`](../../docs/dev-deploy-workflow.md) | 배포 **메커니즘** (스크립트·매니페스트·blue/green) |
> | [`../../docs/deployer-integration-procedure.md`](../../docs/deployer-integration-procedure.md) | 에이전트 **연계 정책**·게이트 |
> | **이 문서** | **이 프로젝트에서 실제로 무엇을 어떤 순서로 하는가** |
> | [`../deploy.yml`](../deploy.yml) | 이 프로젝트의 배포 매니페스트 |

---

## 0. 한 줄 요약

**맥에서 소스를 고치고 → 커밋·푸시하고 → `scripts/deploy.sh TheRoute --yes` 한 번.**
그 뒤는 우분투가 알아서 한다 — 새 릴리스 디렉토리에 빌드하고, 헬스체크가 통과해야만
`current` 심볼릭 링크를 옮긴다. 빌드가 깨져도 운영은 이전 릴리스로 계속 서 있다.

```
맥: NAS 소스 편집 → backend: npm run dev / web: npm run dev → 브라우저 검증 → git push
                                          │
                                scripts/deploy.sh TheRoute --yes  (SSH 한 번)
                                          ▼
우분투: 릴리스 전개 → 빌드 → 헬스체크 ─┬─ 통과 → current 전환 → 완료
                                       └─ 실패 → 자동 롤백 (운영 그대로)
```

> **현재 상태 (2026-09-19)**: 🔴 아직 blue/green 으로 컷오버되지 않았다. 운영 pm2 가 **NFS 편집 트리에서 직접** 돌고 있고,
> 배포는 2026-09-19 부터 webhook(`deploy-climb.sh`)이 push 시 자동으로 수행한다.
> 즉 **지금은 `scripts/deploy.sh` 경로가 아니라 webhook 경로가 현역**이다 — §1 을 반드시 먼저 읽는다.

---

## 1. 🔴 선결 조건 — 해소 전에는 배포하지 않는다

| # | 항목 | 상태 | 조치 주체 |
|---|---|---|---|
| 1 | 🔴 운영이 NFS 편집 트리에서 직접 구동 중 | 미해소 | 사용자 (컷오버, §9) |
| 2 | 🔴 현재 배포는 **webhook `deploy-climb.sh`** 가 담당 → blue/green 과 이중 배포 위험 | 미해소 | 사용자 (§9) |
| 3 | 🔴 `ecosystem.config.js` 의 `cwd`·로그 경로가 NFS 절대경로로 하드코딩됨 | 미해소 | developer |
| 4 | 🔴 `@workspace/auth-oauth` 의 `file:` 상대경로가 릴리스 깊이에서 깨짐 | 미해소 | developer + 사용자 승인 |
| 5 | ⚠️ 루트에 `package.json` 이 없다 — `backend/`·`web/` 두 곳을 각각 다뤄야 한다 | `deploy.yml` 에 반영 완료 | — |
| 6 | 🔴 `web/dist` 가 `.gitignore` 대상 — 릴리스에서 반드시 빌드해야 한다 | `deploy.yml` 에 반영 완료 | — |
| 7 | `shared/backend/.env`·`shared/uploads` 서버 배치 | 미해소 | 사용자 (§9) |

### 2번 — 지금 배포되는 경로는 무엇인가

2026-09-19 부터 `webhook-deploy/deploy-climb.sh` 가 push 시 `web/` 빌드까지 자동 수행한다.
즉 **현역 배포 경로는 push 다.** blue/green(`scripts/deploy.sh TheRoute`)으로 컷오버할 때
이 훅을 그대로 두면 push 한 번에 두 경로가 동시에 배포된다.

컷오버 시 둘 중 하나를 택한다 — 사용자 판단 사항이다.
- **(A)** 훅 스크립트를 `release.sh` 경유로 교체 ([`../../docs/webhook-deploy-guide.md`](../../docs/webhook-deploy-guide.md))
- **(B)** 훅을 비활성화하고 `scripts/deploy.sh` 로만 배포

### 3번 — `ecosystem.config.js` 가 NFS 를 가리킨다

```js
cwd: '/home/brownjeon/NFS/homes/brownjeon/project/TheRoute',
error_file: '/home/brownjeon/NFS/.../TheRoute/logs/api-error.log',
```

blue/green 은 릴리스마다 디렉토리가 바뀌므로 이 값을 고정해 두면 **배포해도 옛 코드가 계속 돈다.**
`cwd: __dirname` + 로그를 `/home/brownjeon/apps/theroute/shared/logs` 로 바꾼다.

> ⚠️ 과거 `ecosystem.config.js` 가 루트와 `backend/` 두 곳에 있고 앱 이름이 `theroute-api` 로
> 같았다. 어느 쪽으로 `pm2 start` 했는지에 따라 동작이 갈리므로 **하나로 통합**했는지 확인한다.

### 4번 상세 — `npm ci` 가 깨지는 이유

`backend/package.json` 이 공용 OAuth 패키지를 **저장소 상대경로**로 참조한다.

```json
"@workspace/auth-oauth": "file:../../shared/auth-oauth"
```

릴리스 디렉토리에서는

```
/home/brownjeon/apps/theroute/releases/<타임스탬프>/backend/../../shared/auth-oauth
  = /home/brownjeon/apps/theroute/releases/shared/auth-oauth     ← 존재하지 않는다
```

로 풀려 `npm ci` 가 ENOENT 로 깨진다.

| | 방법 | 평가 |
|---|---|---|
| A | `$BASE/releases/shared` 심볼릭 링크 | 동작하지만 취약하다 — `releases/` 는 prune 대상이다 |
| B | **(권장)** `backend/.npmrc` 에 `install-links=true` + `file:` 을 NFS 절대경로로 | TheMeal·VoiceVault 방식 |

### 6번 — 프론트 빌드를 건너뛰면 화면만 빈다

`web/dist` 는 저장소에 없다. 릴리스에서 빌드하지 않으면 `/health` 는 200 인데
**화면만 비는** 상태가 된다. 같은 형태의 실사고가 bjj-trainning 에서 2026-09-18 에 있었다.
`deploy.yml` 의 `build.command` 에 `cd web && npm run build` 가 들어 있는지 매번 확인한다.

> **이 절에 미해소 항목이 하나라도 있으면 deployer 는 기동하지 않는다.**
> 배포하지 않고 "무엇이 남았는지"를 그대로 보고하는 것이 올바른 행동이다.

---

## 2. 배포 전 확인

```bash
cd /Volumes/homes/brownjeon/project/TheRoute

# ① 배포되는 것은 작업본이 아니라 origin 의 ref 다. 푸시 안 된 커밋이 있으면 그게 빠진다.
git status -sb | head -1          # "[ahead N]" 이 보이면 N 개가 아직 origin 에 없다
git log --oneline origin/main..HEAD

# ② 브랜치 확인 — deploy.yml 의 source.ref 와 같아야 한다
git branch --show-current         # 기대: main

# ③ 커밋되지 않은 변경
git status --short | head
```

- `ahead` 가 0 이 아니면 **푸시하거나**, 올리지 않을 커밋이면 사용자에게 확인받는다.
  `deploy.sh` 가 경고하지만 `--yes` 로 넘기면 그 경고도 지나간다.
- QA(`verdict=PASS`, 결함 0건) 보고가 없으면 기동하지 않는다.

### 업로드 데이터 주의

`uploads/` 는 `.gitignore` 대상이고 **사용자 업로드 이미지·영상**이 들어 있다.
`deploy.yml` 의 `shared` 에 넣어 릴리스 간 유지하도록 했다.
컷오버 시 기존 데이터는 **복사**한다(이동 아님) — 옮겨버리면 롤백할 게 없어진다.

---

## 3. 배포 실행

```bash
# ① 계획만 확인 — SSH 하지 않는다. 대상 호스트·경로·ref 를 눈으로 본다
scripts/deploy.sh TheRoute --dry-run

# ② 배포
scripts/deploy.sh TheRoute --yes
```



> ⚠️ **`--with-migrate` 를 스스로 붙이지 않는다.** 개발과 운영이 같은 NAS MariaDB
> (`192.168.219.154:3306`)를 본다. blue/green 롤백은 **코드만** 되돌리므로 마이그레이션은
> 되돌아가지 않는다. 필요하다고 판단되면 그 사실만 보고하고 사용자 승인을 기다린다.

---

## 4. 결과 판정

스크립트는 마지막에 `RELEASE_RESULT <json>` 한 줄을 출력한다.
**출력 문구가 아니라 이 JSON 의 `status` 로 판정한다.**

| `status` | 운영 상태 | 다음 조치 |
|---|---|---|
| `ok` | 새 릴리스 | §5 배포 후 확인으로 |
| `build_failed` | **영향 없음** (current 불변) | 빌드 로그 발췌 → developer. 수정 후 Reviewer 부터 재순환 |
| `health_failed` | **이전 릴리스로 자동 롤백됨** | pm2 로그 발췌 → developer. 수정 후 Reviewer 부터 재순환 |
| `rolled_back` | 이전 릴리스 (수동 롤백) | 사용자 지시로만 발생 |
| `rollback_unhealthy` | 🔴 **비정상** | 즉시 에스컬레이션. **추가 배포 시도 금지** |

```bash
scripts/deploy.sh TheRoute --status
scripts/deploy.sh TheRoute --logs 100
```

---

## 5. 배포 후 확인 — 여기가 핵심

`status: ok` 는 "프로세스가 떴다" 는 뜻이지 "기능이 동작한다" 는 뜻이 아니다.
아래를 **실제로 열어서** 확인한다. 확인하지 않은 항목은 "미확인"이라고 그대로 적는다.

### 화면

- [ ] `https://climb.미라클펭귄.com` 메인 화면이 렌더링되는가
      — **빈 화면이면 `web/dist` 빌드 누락이다**
- [ ] 이번 변경이 프론트를 건드렸다면 **그 화면에서 변경이 실제로 보이는가**
- [ ] 업로드된 이미지·영상이 그대로 보이는가 (`shared/uploads` 연결 확인)
- [ ] 로그인(이메일 / Google / GitHub)이 동작하는가 — `@workspace/auth-oauth` 경로가 배포로 깨지기 쉽다

### API·프로세스

```bash
scripts/deploy.sh TheRoute --status
scripts/deploy.sh TheRoute --logs 100
```

- [ ] `GET /health` 가 200 인가 (`/api/health` 가 아니다)
- [ ] pm2 재시작 횟수가 늘어나지 않는가
- [ ] 로그에 기동 직후 예외·스택트레이스가 없는가

---

## 6. 실패했을 때

### 롤백

```bash
scripts/deploy.sh TheRoute --rollback      # 직전 릴리스로
scripts/deploy.sh TheRoute --rollback 2    # 두 단계 전으로
```

`current` 심볼릭 링크를 되돌리고 pm2 를 reload 할 뿐이라 수 초면 끝난다.
**수동 롤백은 사용자 지시가 있을 때만** 한다 — 자동 롤백은 스크립트가 이미 한다.

> 🔴 **DB 마이그레이션은 되돌아가지 않는다.** 마이그레이션을 동반한 배포를 롤백하면
> 스키마와 코드가 어긋난 상태가 된다.
>
> ⚠️ **컷오버 직후 첫 롤백 주의.** 컷오버 이전에 만들어진 릴리스는 옛 `ecosystem.config.js`
> (미러·NFS 를 가리키는 cwd)를 담고 있다. 그리로 롤백하면 재등록이 옛 경로로 떨어져 실패한다.
> 새 ecosystem 으로 만든 릴리스가 2개 이상 쌓인 뒤에 롤백을 연습한다.

### 흔할 만한 실패와 원인

| 증상 | 원인 | 조치 |
|---|---|---|
| `SSH 접속 불가` | **포트가 22 가 아니다** (이 환경은 **993**) | `deploy.yml` 의 `target.port` 확인 |
| `shared 파일이 없다: .../shared/.env` | 첫 배포 전 `.env` 미배치 | `scp` 로 올린다 (§9) |
| `ref 를 찾을 수 없다` | 커밋이 origin 에 push 되지 않음 / 브랜치명 오기 | push 후 재시도. 이 프로젝트 기본 ref 는 `main` |
| 배포는 됐는데 **옛 코드가 돈다** | `ecosystem.config.js` 의 `cwd` 가 릴리스를 가리키지 않음 | `cwd: __dirname` 으로 고친 뒤 `pm2 delete` → 재배포 |
| `npm ci` ENOENT (`file:` 의존성) | lock 의 상대경로가 릴리스 깊이에서 어긋남 | §1 의 해당 선결 과제 참고 |
| 빌드는 맥에서 되는데 우분투에서 깨진다 | 네이티브 모듈·파일명 대소문자·경로 가정 | **코드가 환경을 가정한 것이다.** Reviewer 재순환 대상 |
| `배포가 이미 진행 중이다` | flock 점유 | 진행 중인 배포를 기다린다. 비정상 종료였다면 `$BASE/.deploy.lock` 확인 |

---

## 7. 하지 말 것

- ❌ 우분투에 직접 ssh 해서 `pm2` / `git pull` / `npm run build` 조작 — 배포 경로는 하나다
- ❌ `--with-migrate` 자체 판단 사용
- ❌ 사용자 승인 없는 수동 `--rollback`
- ❌ QA PASS 없이 배포
- ❌ 운영 릴리스 디렉토리 직접 편집 — 다음 배포에 사라진다. 편집 대상은 NAS 소스뿐이다
- ❌ 실패를 "환경 문제"로 단정하고 같은 명령 재시도
- ❌ 업로드 데이터를 **이동**하지 않는다 — 복사만 한다. 옮기면 롤백이 불가능해진다

---

## 8. 보고 형식

**실측치만 적고, 확인하지 않은 항목은 "미확인"이라고 그대로 적는다.**

```
[배포 — 클라이밍기록 (TheRoute)]
- git log -1 / origin 대비 ahead:
- --dry-run 결과: (대상 호스트·경로·ref)
- RELEASE_RESULT: (JSON 원문 그대로)
- --status 결과: (current 릴리스·pm2·헬스)

[배포 후 확인]
- 메인 화면 렌더링: 예/아니오
- (프론트 변경 시) 화면에서 변경 확인: 예/아니오/해당없음
- 업로드 이미지 표시: 예/아니오
- 로그인 동작: 예/아니오
- /health 응답:
- pm2 재시작 횟수 변화:

[이상 징후]
- 로그의 ERROR·스택트레이스:
- 그 밖에 예상과 달랐던 것:
```

> ⚠️ VoiceVault 파일럿에서 QA 에이전트 3인이 테스트를 실행하지 않은 채 "PASS·결함 0건"을
> 보고했고 전부 사실이 아니었다. 배포는 운영을 바꾸는 행동이라 같은 일이 벌어지면 피해가
> 즉시 사용자에게 간다. **돌리지 않은 것을 돌렸다고 적지 않는다.**

---

## 9. 최초 컷오버 절차 (1회성)

운영 중인 서비스를 blue/green 구조로 옮기는 단계다. **되돌릴 수 있는 순서로 진행한다.**
`pm2 delete` 는 순간적인 서비스 중단을 동반하고 deployer 의 권한 경계 밖이므로 **사용자가 수행**한다.

```bash
# (1) 운영 루트와 shared 준비
ssh home_ubuntu 'mkdir -p /home/brownjeon/apps/theroute/shared'

# (2) .env 배치 — 없으면 첫 배포가 실패한다 (의도된 동작)
scp TheRoute/backend/.env brownjeon@125.177.194.26:/home/brownjeon/apps/theroute/shared/backend/.env   # 포트 993 필요 시 -P 993

# (3) 계획 확인 (SSH 하지 않는다)
scripts/deploy.sh TheRoute --dry-run

# (4) 첫 릴리스 전개 + 빌드 + 헬스체크
#     이 시점에는 pm2 가 아직 옛 경로로 돌고 있다 — 운영은 영향받지 않는다
scripts/deploy.sh TheRoute

# (5) 헬스체크 통과를 확인한 뒤에만 pm2 재등록  ← 여기서 짧은 중단이 발생한다
ssh home_ubuntu 'pm2 delete theroute-api; cd /home/brownjeon/apps/theroute/current && pm2 startOrReload ecosystem.config.js --only theroute-api --update-env && pm2 save'

# (6) 확인
scripts/deploy.sh TheRoute --status
ssh home_ubuntu "pm2 jlist | python3 -c \"import sys,json;[print(a['name'],a['pm2_env']['pm_cwd']) for a in json.load(sys.stdin)]\""
#   기대: pm_cwd 가 /home/brownjeon/apps/theroute/releases/... 다
```

**실패 시 복귀** — pm2 를 옛 경로로 되돌린다. `apps/` 구조는 남겨둬도 운영에 영향이 없다.

```bash
ssh home_ubuntu 'pm2 delete theroute-api; cd <옛 경로> && pm2 start ecosystem.config.js --only theroute-api && pm2 save'
```

### 컷오버 완료 판정 — 전부 참일 때만 완료다

- [ ] `scripts/deploy.sh TheRoute --yes` 가 `RELEASE_RESULT {"status":"ok",...}` 로 끝난다
- [ ] `pm2 jlist` 의 `pm_cwd` 가 `/home/brownjeon/apps/theroute/releases/...` 다 (theroute-api 전부)
- [ ] 운영 실화면이 정상이다 (§5)
- [ ] `--rollback` 으로 이전 릴리스 복귀가 되고, **다시 배포해 원복**했다
      (릴리스가 2개 이상 쌓인 뒤에 한다)
- [ ] `deploy.yml`·`deployer.md`·이 문서가 커밋되고 **푸시**됐다
- [ ] 업로드 데이터를 `shared/uploads` 로 **복사**했다 (이동 아님)
- [ ] `ecosystem.config.js` 가 루트/`backend/` 중 하나로 통합돼 있다
- [ ] webhook(`deploy-climb.sh`) 충돌을 (A) 또는 (B) 로 정리했다

> **롤백을 실제로 한 번 돌려보는 것**이 가장 중요하다. 롤백은 사고 났을 때 처음 쓰게 되는데,
> 그때 처음 돌려보면 늦는다.

---

## 10. 부록 — 경로·값 표

| 용도 | 값 |
|---|---|
| 편집 대상(유일한 SSOT) | `/Volumes/homes/brownjeon/project/TheRoute` (맥) / `/home/brownjeon/NFS/homes/brownjeon/project/TheRoute` (리눅스) |
| 맥 개발 실행 | `~/.node-local/theroute-web-work/` (프론트 빌드 확인용) |
| 운영 경로 | `/home/brownjeon/apps/theroute/current` |
| 릴리스 보관 | `/home/brownjeon/apps/theroute/releases/` (최근 5개) |
| 릴리스 간 유지 | `/home/brownjeon/apps/theroute/shared/` |
| pm2 앱 | `theroute-api` (단일 — API + SPA 동시 서빙) |
| 포트 | 3100 |
| 헬스 | `GET /health` (`backend/src/index.js:30`) — `/api/health` 가 **아니다** |
| 운영 도메인 | https://climb.미라클펭귄.com |
| 저장소 / ref | Gitea `project_climb` ← **디렉토리명과 다르다** / `main` |
| 우분투 호스트 | `home-dev-x600` `125.177.194.26` · **sshd 993 포트** |
| DB | `192.168.219.154:3306` — **개발과 운영이 공유** |
| 매니페스트 | [`../deploy.yml`](../deploy.yml) |
| 실행 주체 | [`../.claude/agents/deployer.md`](../.claude/agents/deployer.md) |

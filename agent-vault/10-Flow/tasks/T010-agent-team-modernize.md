---
task_id: T010
title: 서브에이전트 구성 최신화 (공통 템플릿 기준 재편)
slug: agent-team-modernize
project: TheRoute
status: done
roles_involved: leader
created: 2026-09-18
updated: 2026-09-18
aliases: ["에이전트 팀 재편", "leader 신설", "deployer 도입"]
tags:
  - type/task
  - domain/infra
  - domain/qa
---

# T010 · 서브에이전트 구성 최신화 (공통 템플릿 기준 재편)

## 배경 / 요청

사용자 지시 (2026-09-18):
> "현재 공통 템플릿에 정의되어 있는 에이전트 구성을 기반으로 현재 클라이밍일상 서브에이전트의 구성을 최신화시켜줘."

공통 템플릿(`project/.claude/agents/_template-*.md`, 2026-09-18 갱신)의 README가 이 작업을
**체크항목 ②**로 명시해 두고 있었다 — "TheRoute 에 leader 가 없음 … 조율 공백 상태".

## 조치 전 상태

- 에이전트 4종(designer·developer·reviewer·qa), 파일 날짜 2026-07-12 ~ 08-02
- **leader 없음** → 조율·Agent Vault 이력 큐레이션 주체 부재
- **deployer 없음** — 워크스페이스 CLAUDE.md는 이미 배정해 둬 문서·실제가 어긋난 상태
- 기존 4종이 **폐기 대상 React Native 앱**(`mobile/src/screens/*`, `isGuest`)을 전제
- 실제 코드에 없는 색상 `#2D6A4F`를 팔레트로 지정 (실제는 `--primary: #ff5a3c`)
- reviewer 체크리스트가 `res.data.data` 언랩을 **요구** — 웹 코드베이스에 적용하면 버그를 만든다
  (2026-09-18 `SessionAddModal` 섹터 목록 장애가 정확히 그 형태였다)

## 조치 내용

| 파일 | 조치 |
|---|---|
| `.claude/agents/leader.md` | **신규**(Opus) — 사양·조율·인프라·문서 + Agent Vault 이력 큐레이션 |
| `.claude/agents/deployer.md` | **신규**(Haiku) — QA PASS 후 `scripts/deploy.sh TheRoute` 실행 |
| `.claude/agents/designer.md` | 재작성(Opus) — 웹 기준 화면 설계, CSS 토큰 표, 언랩 규칙 |
| `.claude/agents/developer.md` | 재작성(Opus) — web/backend 구현 규칙 8항목 |
| `.claude/agents/reviewer.md` | 재작성(Sonnet) — 감사 6영역, `PASS/CONDITIONAL_PASS/FAIL` |
| `.claude/agents/qa.md` | 재작성(Haiku) — 실행 검증 체크리스트, 배포 게이트 |
| `deploy.yml` | **신규** — 배포 매니페스트 + 선결 과제 4건 주석 |
| `CLAUDE.md` | 팀 소집 문구를 6인 구성·새 워크플로우로 갱신 |

**공통 문서 정합**(워크스페이스는 git 저장소가 아니라 파일 편집만):
- `project/CLAUDE.md` TheRoute 행에 `leader(Opus)` 추가
- `project/.claude/agents/README.md` 참고표 갱신 + 체크항목 ② 완료 처리

## deploy.yml 선결 과제 4건 (미해소 — 배포 불가 상태)

1. 운영 루트 `/home/brownjeon/apps/theroute` 없음 (현재 `voicevault`만 존재) — 사용자 생성 필요
2. `ecosystem.config.js`의 `cwd`가 NFS 작업 디렉터리로 하드코딩 → blue/green 릴리스에서 옛 코드가 계속 돈다.
   전환 시 운영 중단 동반 — 사용자 판단 필요
3. 루트에 `package.json` 없음 → build를 `backend/`·`web/` 두 단계로 구성
4. `web/dist`가 gitignore 대상 → 릴리스마다 빌드 필수. 건너뛰면 `/health`는 200인데 화면만 빈다

> 지금까지 TheRoute의 "배포"는 `cd web && npm run build` 한 줄이었다(backend가 NFS의 `web/dist`를 직접 서빙).
> deployer는 선결 과제가 남은 동안 **배포를 시작하지 않고 Leader에게 보고**하도록 명시했다.

## 발견한 문서 오류

- `docs/dev-deploy-workflow.md` §3 예시가 TheRoute를 쓰면서 저장소를 `project_TheRoute.git`으로 적어 뒀다.
  **실제 remote는 `project_climb.git`**이다.
  → **2026-09-19 해소**: 사용자 지시로 워크스페이스 문서를 직접 고쳤다. URL 교정에 더해,
  조사 과정에서 같은 함정이 더 있음을 확인해 **저장소 이름 표**를 §3에 추가했다.

  | 프로젝트 | 실제 저장소 |
  |---|---|
  | TheRoute | `project_climb` ← 디렉터리명과 다름 |
  | bjj-trainning | `project_bjj-history` ← 디렉터리명과 다름 |
  | VoiceVault · StockInvest · TradingInvest · home-m4-api | `project_<디렉터리명>` |
  | TheCareerMng · TheThinker | GitHub — Gitea 아님 |
  | TheMeal · OdinueAnalysis · OdinueDispatch | **remote 없음** (deploy.yml 의 repo 주소가 아직 존재하지 않는 저장소) |

  워크스페이스는 git 저장소가 아니라 파일 편집만 했다.

## 역할별 기록

### leader

- 2026-09-18: 공통 템플릿 README·TheMeal 참조 구현·TheRoute 현행 코드를 대조해 6종 재편. 모델 배정은 템플릿 정책 그대로(leader/designer/developer=Opus, reviewer=Sonnet, qa/deployer=Haiku).

## 최종 요약

TheRoute 서브에이전트를 공통 템플릿 기준으로 6인 체제(leader·designer·developer·reviewer·qa·deployer)로 재편했습니다.

가장 큰 변화는 **leader 신설**입니다. 그동안 조율과 작업이력 큐레이션을 맡는 주체가 없어, 여러 역할이 서로 다른 방향으로 일할 위험이 있었습니다.

기존 4종은 단순 구조 갱신이 아니라 **내용이 틀려 있어서** 다시 썼습니다 — 곧 삭제할 React Native 앱을 작업 대상으로 적고 있었고, 실제 코드에 없는 색상을 팔레트로 지정하고 있었으며, 무엇보다 reviewer 체크리스트가 요구하던 API 언랩 규칙(`res.data.data`)이 지금 웹 구조에서는 **버그를 만드는 규칙**이었습니다. 실제로 같은 날 그 형태의 장애를 하나 고쳤습니다.

deployer는 파일과 `deploy.yml`을 함께 만들었지만 **아직 배포할 수 없는 상태**입니다. 운영 루트가 없고 pm2 설정이 작업 디렉터리에 묶여 있어서, 그 둘은 사용자 결정이 필요합니다. 선결 과제 4건을 매니페스트 주석에 남겨 뒀고, deployer는 그것이 풀릴 때까지 배포를 시작하지 않습니다.

## 관련 이력

- [[T009-android-apk]] · 안드로이드 APK — `mobile/` RN 폐기 결정의 근거
- [[board]] · 칸반

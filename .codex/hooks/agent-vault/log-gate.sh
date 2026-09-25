#!/usr/bin/env bash
# Agent Vault: Codex SubagentStop/Stop 시점의 가벼운 게이트.
# 오늘 하루 동안 이 프로젝트의 agent-vault에 아무 기록도 없으면 완료 처리를 막고 기록을 요구한다.
# 오늘 날짜의 로그가 하나라도 있으면(즉 하루 중 첫 완료 건을 통과시키면) 그 뒤로는 통과시킨다.
set -euo pipefail

project_dir="${CODEX_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
vault="$project_dir/agent-vault"

[ -d "$vault" ] || exit 0

today="$(date +%F)"
log="$vault/20-Log/${today}.md"

if [ ! -f "$log" ]; then
  echo "오늘(${today}) agent-vault/20-Log/${today}.md 에 아직 기록이 없습니다. 완료 처리 전에 '- [HH:MM][역할] task-<id> 완료 → [[task-<id>-<slug>]] 참고' 한 줄을 append하세요(경로가 아니라 위키링크로). (규약: docs/agent-vault-protocol.md)" >&2
  exit 2
fi

exit 0

#!/usr/bin/env bash
# Agent Vault: Codex SessionStart/SubagentStart 진입 시 프로젝트 이력 개요를 additionalContext로 주입한다.
# 훅은 "지금 이 에이전트가 어떤 task를 맡았는지"는 알 수 없다 — 그건 Leader가 SendMessage로
# task 파일 경로를 함께 전달해야 알 수 있는 정보다. 이 스크립트는 큰 그림(ACTIVE/board/최근 로그)만 띄운다.
set -euo pipefail

input="$(cat || true)"
project_dir="${CODEX_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
vault="$project_dir/agent-vault"

event="SessionStart"
if command -v jq >/dev/null 2>&1 && [ -n "$input" ]; then
  parsed_event="$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null || true)"
  [ -n "$parsed_event" ] && event="$parsed_event"
fi

[ -d "$vault" ] || exit 0

ctx="## Agent Vault — 작업이력 컨텍스트 (agent-vault/)"

if [ -f "$vault/00-Context/ACTIVE.md" ]; then
  ctx="$ctx"$'\n\n### 현재 상태 (00-Context/ACTIVE.md)\n'"$(sed -n '1,40p' "$vault/00-Context/ACTIVE.md")"
fi

if [ -f "$vault/10-Flow/board.md" ]; then
  ctx="$ctx"$'\n\n### 칸반 보드 (10-Flow/board.md)\n'"$(sed -n '1,40p' "$vault/10-Flow/board.md")"
fi

latest_log="$(ls -1 "$vault"/20-Log/*.md 2>/dev/null | sort | tail -1 || true)"
if [ -n "$latest_log" ]; then
  ctx="$ctx"$'\n\n### 최근 활동 색인 ('"$(basename "$latest_log")"$')\n'"$(tail -20 "$latest_log")"
fi

ctx="$ctx"$'\n\nAgent Vault 프로토콜: leader/architect는 새 작업 지시 시 관련 과거 `10-Flow/tasks/*.md`를 찾아(태그 `domain/*`로 좁혀서) 요약하고, tags·aliases를 채운 새 task 이력서를 작성한다. 다른 task 참조는 항상 `[[파일명]]` 위키링크로 연결한다. 그 외 역할은 배정받은 task 이력서 파일 하나만 참고하고 자신의 섹션에만 기록한다. 자세한 내용: docs/agent-vault-protocol.md'

if command -v jq >/dev/null 2>&1; then
  jq -n --arg event "$event" --arg ctx "$ctx" '{hookSpecificOutput: {hookEventName: $event, additionalContext: $ctx}}'
else
  # jq 없을 때의 최소 폴백 — 개행/따옴표만 이스케이프
  escaped="$(printf '%s' "$ctx" | sed ':a;N;$!ba;s/\\/\\\\/g;s/"/\\"/g;s/\n/\\n/g')"
  printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$event" "$escaped"
fi

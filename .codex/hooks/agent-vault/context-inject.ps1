$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$event = if ($payload.hook_event_name) { $payload.hook_event_name } else { 'SessionStart' }
$dir = Get-Item -LiteralPath $payload.cwd
$project = $null
while ($dir) {
    if ((Test-Path (Join-Path $dir.FullName 'agent-vault')) -and (Test-Path (Join-Path $dir.FullName '.codex/hooks/agent-vault'))) { $project = $dir.FullName; break }
    $dir = $dir.Parent
}
if (-not $project) { exit 0 }
$vault = Join-Path $project 'agent-vault'
$ctx = "## Agent Vault — 작업이력 컨텍스트 (agent-vault/)"
$active = Join-Path $vault '00-Context/ACTIVE.md'
if (Test-Path $active) { $ctx += "`n`n### 현재 상태 (00-Context/ACTIVE.md)`n" + ((Get-Content $active -Encoding UTF8 | Select-Object -First 40) -join "`n") }
$board = Join-Path $vault '10-Flow/board.md'
if (Test-Path $board) { $ctx += "`n`n### 칸반 보드 (10-Flow/board.md)`n" + ((Get-Content $board -Encoding UTF8 | Select-Object -First 40) -join "`n") }
$logs = Get-ChildItem (Join-Path $vault '20-Log') -Filter '*.md' -File -ErrorAction SilentlyContinue | Sort-Object Name
if ($logs) { $latest = $logs[-1]; $ctx += "`n`n### 최근 활동 색인 ($($latest.Name))`n" + ((Get-Content $latest.FullName -Encoding UTF8 | Select-Object -Last 20) -join "`n") }
$ctx += "`n`nAgent Vault 프로토콜: leader/architect는 새 작업 지시 시 관련 과거 task를 찾아 새 task 이력서를 작성한다. 다른 역할은 배정받은 task 하나만 참고하고 자신의 역할 섹션에만 기록한다. 자세한 내용: docs/agent-vault-protocol.md"
@{ hookSpecificOutput = @{ hookEventName = $event; additionalContext = $ctx } } | ConvertTo-Json -Depth 8 -Compress
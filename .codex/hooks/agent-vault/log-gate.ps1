$ErrorActionPreference = 'Stop'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$dir = Get-Item -LiteralPath $payload.cwd
$project = $null
while ($dir) {
    if ((Test-Path (Join-Path $dir.FullName 'agent-vault')) -and (Test-Path (Join-Path $dir.FullName '.codex/hooks/agent-vault'))) { $project = $dir.FullName; break }
    $dir = $dir.Parent
}
if (-not $project) { exit 0 }
$today = Get-Date -Format 'yyyy-MM-dd'
$log = Join-Path $project "agent-vault/20-Log/$today.md"
if (-not (Test-Path $log)) {
    [Console]::Error.WriteLine("오늘($today) agent-vault/20-Log/$today.md 에 아직 기록이 없습니다. 완료 전에 '- [HH:MM][역할] task-<id> 완료 → [[task-<id>-<slug>]]' 한 줄을 기록하세요. (규약: docs/agent-vault-protocol.md)")
    exit 2
}
exit 0
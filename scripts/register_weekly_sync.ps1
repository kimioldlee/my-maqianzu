param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path,
  [string]$TaskName = "MyMaqianzu-WeeklyZhihuSync",
  [string]$Day = "SUN",
  [string]$StartTime = "03:30"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path $ProjectRoot).Path
$script = Join-Path $root "scripts\sync_zhihu_weekly.ps1"
if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing script: $script" }

# This creates a task for the current Windows user. It must run while that
# user's interactive browser profile is available; it does not store secrets.
$action = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
# /IT keeps the task in the interactive user's session, which is required by
# the visible Playwright browser and avoids granting a batch-logon privilege.
schtasks.exe /Create /TN $TaskName /SC WEEKLY /D $Day /ST $StartTime /IT /TR $action /F | Out-Host
if ($LASTEXITCODE -ne 0) { throw "Could not register scheduled task." }
Write-Output "Registered $TaskName for $Day at $StartTime. Test it with: schtasks /Run /TN `"$TaskName`""

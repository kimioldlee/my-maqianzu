param(
  [string]$Target = "$env:USERPROFILE\Desktop\my-maqianzu-main"
)

$ErrorActionPreference = "Stop"
$source = (Resolve-Path (Join-Path $PSScriptRoot ".")).Path
$destination = (Resolve-Path $Target).Path

if ($destination.TrimEnd('\') -eq $source.TrimEnd('\')) {
  throw "Target must be the formal project, not the publish package itself."
}

$required = @(
  "SKILL.md",
  "LOCAL_RETRIEVAL.md",
  "scripts\search_bedtime_transcripts.mjs"
)

foreach ($relative in $required) {
  $from = Join-Path $source $relative
  $to = Join-Path $destination $relative
  if (-not (Test-Path -LiteralPath $from -PathType Leaf)) {
    throw "Missing source file: $from"
  }
  $parent = Split-Path -Parent $to
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
  Copy-Item -LiteralPath $from -Destination $to -Force
  Write-Output "Copied $relative"
}

Write-Output "Done. Original transcript files were not modified."

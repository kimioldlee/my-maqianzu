param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot

node .\scripts\sync_bedtime_transcripts.mjs .
node .\scripts\index_bedtime_transcripts.mjs .\work\BedtimeNews-Transcripts .\bedtime-transcript-index.json
node .\scripts\generate_corpus_digest.mjs .\bedtime-transcript-index.json .\references\research\17-full-corpus-digest.md

$index = Get-Content .\bedtime-transcript-index.json -Raw | ConvertFrom-Json
if ([int]$index.coverage.indexedDocuments -lt 700) {
  throw "Transcript index is unexpectedly small: $($index.coverage.indexedDocuments) documents."
}
Write-Output "Transcript refresh complete: $($index.coverage.indexedDocuments) documents, highest episode $($index.coverage.highestEpisodeNumber)."

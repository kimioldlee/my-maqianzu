param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$dataRoot = (Resolve-Path ".\work\ZhihuOfficial-Answers").Path
$staging = Join-Path ([System.IO.Path]::GetTempPath()) "my-maqianzu-zhihu-$PID"

try {
  Copy-Item -LiteralPath $dataRoot -Destination $staging -Recurse -Force
  $env:ZHIHU_DATA_ROOT = $staging

  python .\scripts\zhihu\zhihu_fetch_all.py
  if ($LASTEXITCODE -ne 0) { throw "知乎抓取失败。常见原因是登录态过期、验证码或知乎接口限流；正式语料尚未替换。" }
  python .\scripts\zhihu\zhihu_to_md.py
  if ($LASTEXITCODE -ne 0) { throw "知乎 Markdown 转换失败；正式语料尚未替换。" }
  node .\scripts\index_zhihu_official_answers.mjs $staging $staging\zhihu-official-answer-index.json
  if ($LASTEXITCODE -ne 0) { throw "知乎索引重建失败；正式语料尚未替换。" }

  $index = Get-Content (Join-Path $staging "zhihu-official-answer-index.json") -Raw | ConvertFrom-Json
  $answerCount = (Get-ChildItem (Join-Path $staging "answers") -Filter *.md -File).Count
  if ([int]$index.coverage.indexedAnswers -ne $answerCount) {
    throw "知乎索引与 Markdown 数量不一致：index=$($index.coverage.indexedAnswers), files=$answerCount"
  }

  Remove-Item -LiteralPath $dataRoot -Recurse -Force
  Move-Item -LiteralPath $staging -Destination $dataRoot
  $staging = $null
} finally {
  Remove-Item Env:ZHIHU_DATA_ROOT -ErrorAction SilentlyContinue
  if ($staging -and (Test-Path -LiteralPath $staging)) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}

git add work/ZhihuOfficial-Answers
if (git diff --cached --quiet) {
  Write-Output "知乎语料没有变化。"
  exit 0
}

git commit -m "Weekly refresh Zhihu official answer corpus"
if (-not $NoPush) { git push origin main }
Write-Output "知乎刷新完成：$($index.coverage.indexedAnswers) 篇；最新日期 $($index.coverage.dateRange.latest)。"

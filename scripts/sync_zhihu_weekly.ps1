param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\")).Path,
  [switch]$NoPush
)

$ErrorActionPreference = "Stop"
Set-Location $ProjectRoot
$dataRoot = (Resolve-Path ".\work\ZhihuOfficial-Answers").Path
$dataParent = Split-Path -Parent $dataRoot
$token = "$PID-$([guid]::NewGuid().ToString('N'))"
$staging = Join-Path $dataParent ".ZhihuOfficial-Answers-staging-$token"
$backup = Join-Path $dataParent ".ZhihuOfficial-Answers-backup-$token"
$previousDataRoot = $env:ZHIHU_DATA_ROOT

$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { throw "无法读取当前 Git 分支。" }
if ($branch -ne "main") { throw "知乎周同步只允许在 main 分支运行；当前分支：$branch" }

$targetStatus = git status --porcelain -- work/ZhihuOfficial-Answers
if ($LASTEXITCODE -ne 0) { throw "无法检查知乎语料工作区状态。" }
if ($targetStatus) { throw "work/ZhihuOfficial-Answers 存在未提交修改，拒绝覆盖。" }

git diff --cached --quiet
if ($LASTEXITCODE -eq 1) { throw "暂存区已有其他修改，拒绝把它们混入自动同步提交。" }
if ($LASTEXITCODE -ne 0) { throw "无法检查 Git 暂存区状态。" }

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

  [System.IO.Directory]::Move($dataRoot, $backup)
  try {
    [System.IO.Directory]::Move($staging, $dataRoot)
    $staging = $null
  } catch {
    try {
      if (Test-Path -LiteralPath $dataRoot) {
        Remove-Item -LiteralPath $dataRoot -Recurse -Force
      }
      [System.IO.Directory]::Move($backup, $dataRoot)
      $backup = $null
    } catch {
      throw "知乎语料替换失败，自动恢复也失败。旧语料备份保留在：$backup"
    }
    throw
  }
  try {
    Remove-Item -LiteralPath $backup -Recurse -Force
    $backup = $null
  } catch {
    throw "新语料已就位，但旧语料备份清理失败，已停止提交。备份位置：$backup"
  }
} finally {
  if ($null -eq $previousDataRoot) {
    Remove-Item Env:ZHIHU_DATA_ROOT -ErrorAction SilentlyContinue
  } else {
    $env:ZHIHU_DATA_ROOT = $previousDataRoot
  }
  if ($staging -and (Test-Path -LiteralPath $staging)) {
    Remove-Item -LiteralPath $staging -Recurse -Force
  }
}

git add work/ZhihuOfficial-Answers
if ($LASTEXITCODE -ne 0) { throw "Git 暂存知乎语料失败。" }
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Output "知乎语料没有变化。"
  exit 0
}
if ($LASTEXITCODE -ne 1) { throw "无法检查知乎语料差异。" }

git commit -m "Weekly refresh Zhihu official answer corpus"
if ($LASTEXITCODE -ne 0) { throw "Git 提交知乎语料失败。" }
if (-not $NoPush) {
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw "Git 推送 main 失败；本地提交仍保留。" }
}
Write-Output "知乎刷新完成：$($index.coverage.indexedAnswers) 篇；最新日期 $($index.coverage.dateRange.latest)。"

# 本地低上下文检索

本项目保留完整文字稿，但默认只把与问题相关的短片段交给 Agent。这样降低的是模型输入量，不是删除或压缩原始证据。

## 默认调用

在项目根目录执行：

```powershell
node scripts/search_bedtime_transcripts.mjs . "关键词1,关键词2" 8 --context-lines 24 --max-chars 24000
```

也可以传入 `work\BedtimeNews-Transcripts` 或其 `contents\ShuiQianXiaoXi` 目录。逗号分隔的关键词采用同一文件内同时命中逻辑。

默认会对少量高频概念做保守别名扩展。例如查询“房产税”也会召回“房地产税”，查询“地方债”也会召回“地方政府债务、城投债”等。JSON 结果中的 `matchedVariants` 会显示实际命中的词。冷门专名没有内置别名时仍按原词检索；需要严格字面匹配时加 `--no-expand`。

## 检索顺序

1. 先用事件词和机制词分别检索，例如事件名称、主体、土地财政、地方债、人口流动等。
2. 先阅读结果中的命中片段和行号，再回读最相关的一至数篇原文。
3. 只有片段不足、事实订正重要、来源发生冲突，或需要核对全文结构时，才对单篇候选使用 `--full`。
4. 进入最终答案的节目观点必须保留相对路径、行号、标题和简短引文。索引或摘要只能定位，不能冒充正文依据。

## 参数

- `--context-lines N`：命中行前后各取 N 行，默认 24。
- `--max-chars N`：所有结果的字符上限，默认 24000。
- `--max-files N`：候选文件上限。
- `--no-expand`：关闭内置别名扩展，严格按输入词匹配。
- `--json`：输出机器可读 JSON，供 Agent 或其他脚本消费。
- `--full`：返回候选文件全文，只应对已经选定的单篇文稿使用。
- `--all-channels`：检索 `contents/` 下全部频道；默认只检索 `ShuiQianXiaoXi`。

示例：

```powershell
node scripts/search_bedtime_transcripts.mjs . "土地财政,房产税" 5 --context-lines 12 --max-chars 12000 --json
node scripts/search_bedtime_transcripts.mjs . "地方债" 1 --full --max-chars 60000
node scripts/search_bedtime_transcripts.mjs . "地方债,房地产税" 8 --json
```

检索器只限制返回证据的大小，不改变 `work/BedtimeNews-Transcripts/` 中的原文。

## 每周刷新

节目文字稿由 GitHub Actions 每周日自动从公开的 `BedtimeNews-Transcripts` 仓库拉取，只更新 `ShuiQianXiaoXi` 频道，然后重建 `bedtime-transcript-index.json` 和 `references/research/17-full-corpus-digest.md`。索引数量异常或同步失败时不会提交。也可以在 GitHub Actions 页面手动运行 `Weekly transcript sync`。

知乎回答不能安全地放进 GitHub Actions 抓取，因为它依赖本机登录态、可能触发验证码和设备验证。Windows 上可在已登录知乎的当前用户会话中注册每周任务：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register_weekly_sync.ps1 -ProjectRoot (Get-Location)
schtasks /Run /TN "MyMaqianzu-WeeklyZhihuSync"
```

该任务在临时目录中抓取新增及更新数据，重建 Markdown 和索引，校验数量后才替换正式语料、提交并推送。Cookie、浏览器 profile 和登录状态不会进入 Git。知乎登录态失效时任务会失败并保留原语料，需要重新登录后手动运行一次。

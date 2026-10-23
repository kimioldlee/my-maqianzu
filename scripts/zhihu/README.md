# 知乎语料刷新脚本

这些脚本只用于刷新 `马前卒official` 账号的公开回答。它们需要用户本人用浏览器登录知乎；不会、也不应提交 `zhihu-session/`、`zhihu_state.json`、Cookie 或浏览器 profile。

## 依赖

- Python 3.10+。
- `playwright`：`python -m pip install playwright`，然后运行 `python -m playwright install chromium`。
- 可访问知乎的本地浏览器环境。

## 刷新流程

在仓库根目录执行 PowerShell：

```powershell
$env:ZHIHU_DATA_ROOT = (Resolve-Path "work/ZhihuOfficial-Answers")
python scripts/zhihu/zhihu_login.py
python scripts/zhihu/zhihu_fetch_all.py
python scripts/zhihu/zhihu_to_md.py
node scripts/index_zhihu_official_answers.mjs work/ZhihuOfficial-Answers work/ZhihuOfficial-Answers/zhihu-official-answer-index.json
```

抓取器按照回答 ID 去重，可从已有 `zhihu-answers-raw.jsonl` 继续；转写器会用该原始文件删除并重建 `answers/`，再重建 `INDEX.md`。刷新前先备份现有语料，且只在你有权访问并保存这些资料、并确认适用平台规则的情况下执行。

## 发布前检查

```powershell
node scripts/search_zhihu_official_answers.mjs work/ZhihuOfficial-Answers "生育,化工" 10
```

确保 `answers/` 的文件数与 `zhihu-official-answer-index.json` 中的 `coverage.indexedAnswers` 一致，再提交。任何回答仍必须在技能输出中标为“官方账号补充”，不能自动归为任冲昊个人原话或节目结论。

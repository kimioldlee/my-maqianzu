# 马前卒视角分析技能

这是一个面向 Claude Code 和兼容 Agent 的新闻分析技能。它先检索本地《睡前消息》文字稿与 `马前卒official` 回答，再区分节目明确观点、账号回应、框架推演和助手判断，最终生成可验证的单人口播稿。

本项目不是身份模仿工具。它不会声称自己是马前卒或任冲昊，也不会把框架推演写成其本人真实观点。

## 主要能力

- 从本地全文语料中低 Token 检索同一事件和相似机制。
- 核验当前事件的时间线、主体、政策、数字和统计口径。
- 从利益、财政、产业链、制度激励和二阶效应分析问题。
- 生成 3000 至 5000 个非空白字符的完整单人口播稿。
- 执行固定的 Sepia 审校流程和确定性终稿验证。
- 为每个新闻任务建立独立 `task-id`，支持中断恢复和同任务续跑。

运行规范以 [`SKILL.md`](SKILL.md) 为入口。详细工作流按需分布在：

- [`references/workflow.md`](references/workflow.md)
- [`references/quality-gates.md`](references/quality-gates.md)
- [`references/recovery.md`](references/recovery.md)
- [`references/resource-policy.md`](references/resource-policy.md)

## Claude Code 安装

不要把 `SKILL.md` 复制进 `CLAUDE.md`。本技能依赖同目录下的脚本、索引、参考文件和本地语料，必须按完整技能目录安装。

### 个人技能

适合在所有项目中使用。推荐直接克隆到 Claude Code 的个人技能目录：

```bash
mkdir -p ~/.claude/skills
git clone https://github.com/kimioldlee/my-maqianzu.git \
  ~/.claude/skills/madugong-perspective
```

已克隆过时，用 Git 更新：

```bash
git -C ~/.claude/skills/madugong-perspective pull --ff-only
```

也可以在仓库目录运行：

```bash
bash scripts/install.sh --personal
```

### 项目技能

适合只在某个项目中使用，并可随项目版本控制：

```bash
mkdir -p /path/to/project/.claude/skills
git clone https://github.com/kimioldlee/my-maqianzu.git \
  /path/to/project/.claude/skills/madugong-perspective
```

或从已下载的仓库安装：

```bash
bash scripts/install.sh --project /path/to/project
```

### Claude 桌面版账号上传

先生成精简运行包：

```bash
bash scripts/package_skill.sh
```

脚本会生成 `dist/madugong-perspective.zip`。在 Claude 的技能设置中上传该 ZIP；更新时重新生成并重新上传。账号上传版本由 Claude 托管并在支持技能同步的产品中使用，不通过本地 `git pull` 更新。

如果最初是从 GitHub 下载 ZIP 并解压到桌面，该目录没有 `.git` 历史，不能直接 `git pull`。长期维护建议改用上面的 `git clone`；只使用账号上传时，则每次下载新版、重新打包并上传。

Claude Code 官方技能文档：<https://code.claude.com/docs/en/skills>

## 路径模型

技能运行时严格区分：

- `SKILL_ROOT=${CLAUDE_SKILL_DIR}`：只读技能资源，包括脚本、索引、参考资料和语料。
- `PROJECT_ROOT`：当前新闻项目的可写根目录，任务结果写入 `outputs/<task-id>/`。

因此可以从任意项目目录调用技能，不需要先 `cd` 到技能仓库。账号上传技能也不会尝试把任务结果写进内部技能目录。

## 调用方式

在 Claude Code 中可输入 `/madugong-perspective`，也可以直接点名技能。推荐提示词：

```text
请使用 madugong-perspective 技能完成一个全新的新闻任务。

本次项目根目录：
/你的/项目/绝对路径

新闻材料：
【粘贴文字或链接，或上传图片/文件】

请以技能目录中的 SKILL.md 为规范入口，自动完成预检、检索、事实核验、分析、成稿、Sepia 审校和终稿验证，不等待我逐步确认。

为本任务创建唯一 task-id，并把全部文件写入项目根目录下的 outputs/<task-id>/。不得覆盖、删除或移动其他任务目录、outputs 根目录旧文件或非本任务文件。同一任务续跑时沿用原 task-id。

在对话中完整交付单人口播正文一次；阶段记录、完整审计和验证 JSON 只保存到任务目录，不重复回显。若上下文中断，保留已有文件并生成恢复提示，恢复时不重跑已有效完成的阶段。
```

只需要分析、不需要完整稿件时，应明确写“只要分析”；只需要检索时写“只要检索结果”。这两种情况会跳过完整成稿硬门。

## 输出契约

每个完整稿件任务有六个必需产物：

```text
outputs/<task-id>/
├── final_draft.md
├── final_audit.json
├── sepia_review_1.md
├── sepia_refactor.md
├── sepia_review_2.md
└── final_validation.json
```

必要的内部诊断只能放在本任务的 `.internal/` 子目录。不会自动创建 `v2`、`enhanced`、`9plus` 或重复正文。

`final_audit.json` 使用六项有证据的质量门，而不是 11 项主观打分：

- 事实与归因
- 因果与边界
- 多方约束
- 可执行方案
- 口播与去模板
- 反驳与风险

每项通过记录必须引用正文原句或明确位置。最终稿还要通过机械检查、方案六要素检查和三个 Sepia 阶段文件检查。

## 本地检索

技能会使用 `${CLAUDE_SKILL_DIR}` 定位资源。手动测试时可运行：

```bash
node scripts/search_bedtime_transcripts.mjs . \
  "事件词,机制词" 8 \
  --context-lines 12 --max-chars 12000 --json
```

知乎补充检索：

```bash
node scripts/search_zhihu_official_answers.mjs . \
  "事件词,机制词" 8 \
  --context-lines 12 --max-chars 12000 --json
```

索引负责定位，不能代替正文证据。零命中不等于语料失败；只有资源不可读、检索器报错、根目录错误或命中原文无法回读时才标记 `corpus_failed`。

完整检索说明见 [`LOCAL_RETRIEVAL.md`](LOCAL_RETRIEVAL.md)。索引覆盖数量由索引文件自身的 `coverage` 字段提供，README 不手工维护容易过期的精确计数。

## 维护与测试

运行全部测试：

```bash
node --test tests/*.test.mjs
```

主要测试包括：

- `validate_final_draft.test.mjs`：终稿机械检查与六项质量门。
- `task_output_dir.test.mjs`：任务目录隔离与旧文件保护。
- `external_cwd.test.mjs`：从技能仓库外运行检索器和验证器。
- `corpus_status_regression.test.mjs`：零命中与技术失败分类。
- `skill_contract_rules.test.mjs`：入口、参考路由和安装契约。
- `context_budget_rules.test.mjs`：上下文预算与恢复规则。

语料同步和索引重建属于维护流程，不会在每次新闻任务中自动运行。知乎登录态、Cookie、浏览器 profile 和 session 文件不得提交到 Git。

## 仓库结构

```text
my-maqianzu/
├── SKILL.md
├── README.md
├── SOUL.md
├── LOCAL_RETRIEVAL.md
├── bedtime-transcript-index.json
├── references/
│   ├── workflow.md
│   ├── quality-gates.md
│   ├── recovery.md
│   ├── resource-policy.md
│   └── research/
├── scripts/
│   ├── search_bedtime_transcripts.mjs
│   ├── search_zhihu_official_answers.mjs
│   ├── validate_final_draft.mjs
│   ├── install.sh
│   └── package_skill.sh
├── tests/
└── work/
    ├── BedtimeNews-Transcripts/
    └── ZhihuOfficial-Answers/
```

## 权利与边界

MIT License 只适用于本仓库自行编写的代码与说明文件。节目文字稿和知乎回答的著作权仍归原权利人；这些内容用于检索、学习、核验与短引，不构成对原文的重新授权。

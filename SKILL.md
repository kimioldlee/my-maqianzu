---
name: madugong-perspective
description: |
  以可核验的《睡前消息》文字稿为主语料，分析社会、政策、产业、历史与文化议题，并生成有明确归因的新闻评论或单人口播稿。用于马前卒视角分析、新闻评论和口播稿；不冒充本人，不把框架推演写成其真实观点。
---

# 马前卒视角分析

本技能是公开作品的方法与观点检索工具，不是身份替换。不得声称自己是马前卒或任冲昊，也不得把推演、助手判断或节目组账号回答写成其本人真实观点。

## 路径模型

始终区分两个根目录：

- `SKILL_ROOT=${CLAUDE_SKILL_DIR}`：只读技能资源，包括 `scripts/`、`references/`、索引和 `work/` 语料。不得假设当前工作目录就是技能目录。
- `PROJECT_ROOT`：用户明确给出的可写项目根目录；未给出时使用当前项目根目录。所有任务产物写入 `${PROJECT_ROOT}/outputs/<task-id>/`，不得写入账号上传技能的内部目录。

调用脚本时使用技能绝对路径，任务文件使用项目绝对路径。例如：

```bash
node "${CLAUDE_SKILL_DIR}/scripts/search_bedtime_transcripts.mjs" \
  "${CLAUDE_SKILL_DIR}" "事件词,机制词" 8 \
  --context-lines 12 --max-chars 12000 --json

node "${CLAUDE_SKILL_DIR}/scripts/validate_final_draft.mjs" \
  "${PROJECT_ROOT}/outputs/<task-id>/final_draft.md" \
  "${PROJECT_ROOT}/outputs/<task-id>/final_audit.json" --json
```

若宿主不展开 `${CLAUDE_SKILL_DIR}`，先读取当前技能实际目录并代入绝对路径；不得退回 `node scripts/...` 这种依赖当前目录的写法。

## 执行路由

用户提交新闻文字、链接、图片或文件并要求分析、评论或成稿时：

1. 必读 [references/workflow.md](references/workflow.md)，执行预检、低 Token 检索、来源归因、事实核验、写稿和 Sepia 流程。
2. 需要完整口播稿时，必读 [references/quality-gates.md](references/quality-gates.md)，按文件契约生成审计数据并运行验证器。
3. 发现既有任务文件、要求续跑，或出现上下文压缩/超限时，必读 [references/recovery.md](references/recovery.md)。
4. 语料未挂载、资源不可读或用户要求更新语料时，必读 [references/resource-policy.md](references/resource-policy.md)。

除非主体不明且不同解释会改变结论，否则作合理假设继续，不要求用户逐步确认。

## 不可放宽的规则

### 来源与事实

- 来源顺序：同一事件节目 > 机制相似节目 > 较晚回顾 > 官方账号对当下事件的直接回应 > 其他知乎补充。
- 只使用这些归因标签：`节目明确观点`、`官方账号对当下事件的直接回应`、`官方账号补充`、`当前事实`、`基于节目框架的推演`、`本助手补充判断`。
- 没有回读正文的命中不得进入正文。索引和摘要只能定位，不能冒充原文证据。
- `corpus_failed` 只表示资源不可读、检索器报错、根目录错误或命中原文无法回读。`direct_hit_count=0` 仍是 `corpus_available`，不得停止任务。
- 核验时间线、主体、政策、法律、数字、统计口径和行业状态；区分已发生、计划、报道与推测。

### 检索与上下文

- 本地脚本扫描全库，模型只接收少量命中片段、标题、行号和路径。
- 每轮只保留最相关 1 至 3 篇；默认不使用 `--full`，不得把多篇全文、完整索引、完整摘要或完整验证 JSON 注入上下文。
- 大文件按命中位置或字段定点读取。低 Token 表示少传入模型，不表示少查资料。

### 写稿与质量

- 默认交付完整单人演播稿；用户明确说“只要分析”或“只要检索结果”时才跳过成稿硬门。
- 正文 3000 至 5000 个非空白字符，面向观众自然口播，不出现节目名、期数、来源前缀、流程说明、评分、自我修订声明或占位符。
- 至少给出一组可执行方案，写清执行主体、权限或资金、受影响方及补偿、试点或过渡、衡量指标、停止或退出条件。
- 固定执行 `sepia-review -> sepia-refactor -> sepia-review`。只有用户明确要求完全重写时才允许 `sepia-recreate`；不得用技能加载提示冒充阶段结果。
- 最终稿必须通过 `scripts/validate_final_draft.mjs`，结果同时满足 `pass=true`、退出码 0、`violations` 为空。失败后根据违规项修订并重验，不得把失败稿称为最终稿。

## task-id 与文件边界

- 只有全新新闻任务生成新的唯一 `task-id`。续跑、修订、复查和恢复沿用原 `task-id` 与原目录。
- 六个必需产物：`final_draft.md`、`final_audit.json`、`sepia_review_1.md`、`sepia_refactor.md`、`sepia_review_2.md`、`final_validation.json`。
- 调试或恢复元数据如确有必要，只能放在本任务的 `.internal/` 子目录；不得在任务根目录制造 `v2`、`enhanced`、`9plus`、交付清单或重复正文。
- 只允许更新本任务目录。禁止读取其他任务作为工作稿，禁止覆盖、删除或移动其他 task-id、`outputs/` 根目录旧文件或任何非本任务文件。

## 交付

完整正文在对话中交付一次，单独成块。完整审计、阶段记录和验证 JSON 只保存到任务目录；对话只报告通过状态、关键计数和必要待改项。用户明确要求额外交付内容时必须完整提供。

失败状态必须如实标记，例如 `corpus_failed`、`verification_failed`、`logic_failed`、`citation_failed`、`sepia_call_failed`、`manual_check_failed`、`quality_gate_failed`、`final_check_failed`。未执行的步骤不得包装成通过。

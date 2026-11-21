# 质量门与终稿验证

完整口播稿必须执行本文件。所有文件写入 `${PROJECT_ROOT}/outputs/<task-id>/`。

## 必需产物

任务根目录必须包含：

- `final_draft.md`：只放完整正文，不放评分、验证记录、链接摘要或占位符。
- `final_audit.json`：方案六要素证据、六项质量门、事实与来源核验摘要。
- `sepia_review_1.md`
- `sepia_refactor.md`
- `sepia_review_2.md`
- `final_validation.json`：验证器原始输出。

可选内部诊断只能放在 `.internal/` 子目录。用户明确要求的额外交付物可另建文件，但须说明用途。

## 正文硬门

- 3000 至 5000 个非空白字符。
- 破折号字符为 0。
- 节目名称、期数、来源前缀、来源标签和链接为 0。
- “同上”“见前文”等占位符为 0。
- 不混入评分表、验证记录、修改指令或生产流程。
- 模板句、重复句和近重复段落经机械扫描与人工复核处理。
- 方案六要素齐全，每项在审计文件中引用正文原句。
- 三个 Sepia 阶段文件均有可审计内容，不得只有加载提示或等待文字。

## 六项证据型质量门

`final_audit.json` 使用 `qualityGates` 对象，每项包含 `pass`、`evidence`，失败时再写 `reason`。验证器只接受以下六项：

1. `事实与归因`：关键事实有来源、时点和口径；节目、账号、推演与助手判断区分清楚。
2. `因果与边界`：关键因果链能还原中间机制，并处理替代解释、反例或不确定边界。
3. `多方约束`：至少比较主要利益相关方、执行者和受损方的真实约束。
4. `可执行方案`：六要素均在正文有原句证据，方案不是口号。
5. `口播与去模板`：语言适合单人口播，无流程元话语、机械模板和无意义重复。
6. `反驳与风险`：可指认主要反对意见，并回应成本、执行风险和二阶效应。

通过项的 `evidence` 必须是正文原句，或明确的“第 N 段/第 N 句”定位。失败项必须给出具体原因。六项必须全部通过；这是一组有证据的质量门，不是客观分数或外部认证。

建议结构：

```json
{
  "solutionElements": {
    "执行主体": { "evidence": "正文原句" },
    "权限或资金来源": { "evidence": "正文原句" },
    "受影响方及补偿": { "evidence": "正文原句" },
    "试点或过渡安排": { "evidence": "正文原句" },
    "衡量指标": { "evidence": "正文原句" },
    "停止或退出条件": { "evidence": "正文原句" }
  },
  "qualityGates": {
    "事实与归因": { "pass": true, "evidence": "正文原句" },
    "因果与边界": { "pass": true, "evidence": "正文原句" },
    "多方约束": { "pass": true, "evidence": "正文原句" },
    "可执行方案": { "pass": true, "evidence": "正文原句" },
    "口播与去模板": { "pass": true, "evidence": "正文原句" },
    "反驳与风险": { "pass": true, "evidence": "正文原句" }
  },
  "remainingIssues": "无"
}
```

## 验证命令

```bash
node "${CLAUDE_SKILL_DIR}/scripts/validate_final_draft.mjs" \
  "${PROJECT_ROOT}/outputs/<task-id>/final_draft.md" \
  "${PROJECT_ROOT}/outputs/<task-id>/final_audit.json" --json
```

验证器从传入稿件的同目录读取三个 Sepia 文件，并默认把结果写为 `final_validation.json`。Agent 只读取 `pass`、`exitCode`、`violations` 和必要计数，不把完整 JSON 回注上下文。

只有 `pass=true`、退出码 0、`violations` 为空时才称为最终稿。失败时依据违规项修改正文、审计或阶段记录，并重新执行必要的复查和验证。

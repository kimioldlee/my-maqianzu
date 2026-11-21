#!/usr/bin/env node

/** Read-only checks for context-budget and recovery behavior. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8").replace(/[`*]/g, "");
const skill = read("SKILL.md");
const workflow = read("references/workflow.md");
const recovery = read("references/recovery.md");
const quality = read("references/quality-gates.md");
const has = (text, ...needles) => needles.every((needle) => text.includes(needle));

const checks = [
  ["默认检索保持有界", has(skill + workflow, "最相关 1 至 3 篇", "12000", "不得把多篇全文")],
  ["大型文件采用定点读取", has(skill + workflow, "定点读取", "完整索引", "完整验证 JSON")],
  ["Sepia 通过文件路径传递", has(recovery, "文件路径传递", "不反复粘贴完整正文")],
  ["初稿立即落盘并在同一文件修订", has(recovery, "初稿立即写入 final_draft.md", "覆盖本任务自己的 final_draft.md")],
  ["第二次复查只看修订稿", has(recovery, "第二次复查只读取修订后的正文")],
  ["未经用户要求禁止完全重写", has(skill, "只有用户明确要求完全重写时才允许 sepia-recreate")],
  ["验证器完整 JSON 不回注上下文", has(quality, "不把完整 JSON 回注上下文")],
  ["上下文中断保留文件并续跑", has(recovery, "Autocompact is thrashing", "context limit", "保留本任务目录", "不从头重跑")],
  ["恢复提示包含关键定位信息", has(recovery, "项目根目录", "原 task-id", "完整任务目录", "下一缺失阶段", "验证器摘要")],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

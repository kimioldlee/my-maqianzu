#!/usr/bin/env node

/** Static behavior checks for the skill entrypoint and routed references. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(REPO, rel));
const plain = (text) => text.replace(/[`*]/g, "");

const skill = plain(read("SKILL.md"));
const readme = plain(read("README.md"));
const workflow = plain(read("references/workflow.md"));
const quality = plain(read("references/quality-gates.md"));
const recovery = plain(read("references/recovery.md"));
const resources = plain(read("references/resource-policy.md"));
const validator = read("scripts/validate_final_draft.mjs");
const gitignore = read(".gitignore");

const checks = [];
const add = (name, ok) => checks.push({ name, ok: Boolean(ok) });
const has = (text, ...needles) => needles.every((needle) => text.includes(needle));

add(
  "SKILL.md 有合法入口元数据",
  /^---\n[\s\S]*?name:\s*madugong-perspective\n[\s\S]*?description:[\s\S]*?\n---\n/u.test(read("SKILL.md"))
);

const routedReferences = [
  "references/workflow.md",
  "references/quality-gates.md",
  "references/recovery.md",
  "references/resource-policy.md",
];
add("四份运行参考文件存在", routedReferences.every(exists));
add("SKILL.md 明确路由到四份参考文件", routedReferences.every((rel) => skill.includes(rel)));

add(
  "技能资源根与项目写入根严格分离",
  has(skill, "SKILL_ROOT=${CLAUDE_SKILL_DIR}", "PROJECT_ROOT", "${PROJECT_ROOT}/outputs/<task-id>/") &&
    has(skill, "不得假设当前工作目录就是技能目录", "不得写入账号上传技能的内部目录")
);
add(
  "运行命令使用 CLAUDE_SKILL_DIR 绝对定位",
  has(skill, "${CLAUDE_SKILL_DIR}/scripts/search_bedtime_transcripts.mjs", "${CLAUDE_SKILL_DIR}/scripts/validate_final_draft.mjs")
);
add(
  "零命中与技术失败语义保留",
  has(skill + workflow, "direct_hit_count=0", "corpus_available", "corpus_failed", "技术失败")
);
add(
  "来源归因与回读正文边界保留",
  has(skill, "节目明确观点", "官方账号对当下事件的直接回应", "基于节目框架的推演", "本助手补充判断") &&
    has(skill, "没有回读正文", "不能冒充原文证据")
);

const gates = ["事实与归因", "因果与边界", "多方约束", "可执行方案", "口播与去模板", "反驳与风险"];
add("质量参考定义六项证据型质量门", has(quality, "qualityGates", ...gates));
add("验证器实现同一组六项质量门", gates.every((gate) => validator.includes(`"${gate}"`)));
add("旧 11×10 评分契约已移除", !quality.includes("11项评分") && !validator.includes("10 boolean checkpoints"));

const requiredOutputs = [
  "final_draft.md", "final_audit.json", "sepia_review_1.md",
  "sepia_refactor.md", "sepia_review_2.md", "final_validation.json",
];
add("六个必需产物仍有固定文件名", requiredOutputs.every((name) => skill.includes(name) && quality.includes(name)));
add("可选诊断被限制在本任务 .internal/", has(skill, ".internal/", "本任务") && quality.includes(".internal/"));
add("其他任务与 outputs 根目录受保护", has(skill + recovery, "其他 task-id", "outputs/ 根目录", "禁止覆盖", "移动"));

add(
  "Sepia 顺序、失败判定和重写边界保留",
  has(skill + workflow, "sepia-review -> sepia-refactor -> sepia-review", "sepia_call_failed", "sepia-recreate", "用户明确要求完全重写")
);
add(
  "中断恢复沿用 task-id 并从缺失阶段继续",
  has(recovery, "Autocompact is thrashing", "context limit", "原 task-id", "继续缺失", "不从头重跑")
);
add(
  "资源未挂载时降低归因强度而非假装读过原文",
  has(resources, "只挂载 SKILL.md 不代表语料为空", "只有实际打开正文", "降低归因强度")
);

add(
  "README 面向 Claude Code 技能安装而非 CLAUDE.md 注入",
  has(readme, "Claude Code", "个人技能", "项目技能", "账号上传") &&
    !/cp\s+.*SKILL\.md\s+.*CLAUDE\.md/u.test(readme)
);
add("README 说明从任意项目目录调用", has(readme, "CLAUDE_SKILL_DIR", "PROJECT_ROOT", "任意"));
add("README 列出外部工作目录集成测试", readme.includes("external_cwd.test.mjs"));

add("outputs/ 仍被忽略", gitignore.split(/\r?\n/u).some((line) => line.trim() === "outputs/"));
add("登录态与 session 仍被忽略", has(gitignore, "**/zhihu-session/", "**/zhihu_state.json"));

const skillChars = read("SKILL.md").replace(/\r\n/g, "\n").length;
add(`SKILL.md 保持精简（${skillChars} 字符）`, skillChars <= 10000);

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}`);
  if (!check.ok) failed += 1;
}
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

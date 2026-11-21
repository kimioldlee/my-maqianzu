#!/usr/bin/env node

/** Integration test: runtime scripts work outside the skill repository. */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(HERE, "..");
const RETRIEVER = path.join(SKILL_ROOT, "scripts", "search_bedtime_transcripts.mjs");
const VALIDATOR = path.join(SKILL_ROOT, "scripts", "validate_final_draft.mjs");
const QUALITY_GATES = ["事实与归因", "因果与边界", "多方约束", "可执行方案", "口播与去模板", "反驳与风险"];
const SOLUTION_KEYS = ["执行主体", "权限或资金来源", "受影响方及补偿", "试点或过渡安排", "衡量指标", "停止或退出条件"];
const SENTENCES = [
  "由市发展和改革委员会牵头成立联合工作组负责执行。",
  "所需经费从市级财政专项资金中列支并依法授权。",
  "对受影响的沿街商户按实际损失给予一次性补偿。",
  "先在两个城区开展六个月试点再逐步扩大范围。",
  "以月度投诉量和办结率作为主要衡量指标。",
  "若连续三个月指标未改善则停止试点并退出。",
];
const FILLERS = [
  "公开数据应标明统计口径和采集时点，便于外部复核与内部对照。",
  "不同群体承担的成本并不相同，执行前要逐项确认影响与补偿安排。",
  "政策效果需要同时观察短期变化和长期趋势，不能凭单月波动下结论。",
  "主要反对意见集中在财政负担和基层执行能力，试点必须保留调整空间。",
  "跨部门协作要明确交接节点、责任单位和整改期限，避免材料长期滞留。",
  "记录归档应与现场核查同步进行，保证事后能够还原当时的决策依据。",
];

const nonWhitespace = (text) => [...text].filter((char) => !/\s/u.test(char)).length;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "maqianzu-external-cwd-"));
const projectRoot = path.join(root, "consumer-project");
const taskDir = path.join(projectRoot, "outputs", "20261121-external");
const untouchedDir = path.join(projectRoot, "outputs", "20260101-untouched");
fs.mkdirSync(taskDir, { recursive: true });
fs.mkdirSync(untouchedDir, { recursive: true });
fs.writeFileSync(path.join(untouchedDir, "final_draft.md"), "旧任务不得改动。\n", "utf8");
const untouchedBefore = fs.readFileSync(path.join(untouchedDir, "final_draft.md"), "utf8");

const parts = [...SENTENCES];
let index = 0;
while (nonWhitespace(parts.join("\n\n")) < 3600) {
  parts.push(`第${index + 1}项记录表明，${FILLERS[index % FILLERS.length]}`);
  index += 1;
}
const body = `${parts.join("\n\n")}\n`;
fs.writeFileSync(path.join(taskDir, "final_draft.md"), body, "utf8");

const solutionElements = {};
const qualityGates = {};
SOLUTION_KEYS.forEach((key, i) => { solutionElements[key] = { evidence: SENTENCES[i] }; });
QUALITY_GATES.forEach((key, i) => { qualityGates[key] = { pass: true, evidence: SENTENCES[i] }; });
fs.writeFileSync(
  path.join(taskDir, "final_audit.json"),
  `${JSON.stringify({ solutionElements, qualityGates, remainingIssues: "无" }, null, 2)}\n`,
  "utf8"
);

const stages = {
  "sepia_review_1.md": "诊断：第2段需要核对口径。\n问题位置：第2段。\n修复计划：补充统计时点。",
  "sepia_refactor.md": "修改项：已补充统计时点。\n修改后的完整正文见 final_draft.md。",
  "sepia_review_2.md": "复查对象：修订后的 final_draft.md。\n已修复项：统计时点。\n剩余问题：无。\n位置：第2段。\n是否通过：通过。",
};
for (const [name, content] of Object.entries(stages)) fs.writeFileSync(path.join(taskDir, name), `${content}\n`, "utf8");

const retrieverRun = spawnSync(
  process.execPath,
  [RETRIEVER, SKILL_ROOT, "量子泡馍悖论XYZ2026", "2", "--json"],
  { cwd: projectRoot, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
);
let retrieverJson = null;
try { retrieverJson = JSON.parse(retrieverRun.stdout); } catch { retrieverJson = null; }

const draft = path.join(taskDir, "final_draft.md");
const audit = path.join(taskDir, "final_audit.json");
const validatorRun = spawnSync(process.execPath, [VALIDATOR, draft, audit, "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
});
let validation = null;
try { validation = JSON.parse(validatorRun.stdout); } catch { validation = null; }

const checks = [
  ["从技能目录外运行检索器", retrieverRun.status === 0 && retrieverJson?.totalScanned > 0],
  ["从技能目录外验证项目任务", validatorRun.status === 0 && validation?.pass === true],
  ["验证结果写入项目任务目录", fs.existsSync(path.join(taskDir, "final_validation.json"))],
  ["未改动其他 task-id", fs.readFileSync(path.join(untouchedDir, "final_draft.md"), "utf8") === untouchedBefore],
  ["技能仓库未收到任务产物", !fs.existsSync(path.join(SKILL_ROOT, "outputs", "20261121-external"))],
];

fs.rmSync(root, { recursive: true, force: true });
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

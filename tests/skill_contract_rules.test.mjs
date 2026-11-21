#!/usr/bin/env node

/**
 * Read-only static contract checks for the deduplicated SKILL.md / README.md.
 *
 * Run: node tests/skill_contract_rules.test.mjs
 *
 * Never writes files, never loads the corpus/index, never invokes skills,
 * never touches cookies, sessions, login state or outputs/. It asserts that
 * consolidating the rules did NOT drop any hard gate or required semantics.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
const plain = (text) => text.replace(/[`*]/g, "");

const skill = plain(read("SKILL.md"));
const readme = plain(read("README.md"));
const regressionTest = read("tests/corpus_status_regression.test.mjs");
const gitignore = read(".gitignore");

const has = (text, ...needles) => needles.every((n) => text.includes(n));
const absent = (text, ...needles) => needles.every((n) => !text.includes(n));

const checks = [];
const add = (name, ok) => checks.push({ name, ok: Boolean(ok) });

// 1. One authoritative location table, with short references elsewhere.
add(
  "权威规则位置表存在且声明唯一权威位置",
  has(skill, "## 权威规则位置", "唯一权威位置", "本文件是本项目唯一规范入口", "按某节执行")
);
add(
  "各章节用引用而非重复展开",
  has(skill, "此处不重复", "本节不重复") &&
    has(skill, "按「终稿确定性验证与交付硬门」", "按「输出原则」")
);

// 2. Every preserved hard gate / semantic still present.
const preserved = [
  ["来源层级与归因", "来源层级与归因", "按序检索和使用证据", "节目明确观点"],
  ["低 Token 本地全文检索", "低 Token 本地全文检索", "索引负责定位", "最相关 1 至 3 篇"],
  ["零命中不等于 corpus_failed", "corpus_available", "零命中绝不单独触发", "direct_hit_count=0"],
  ["corpus_failed 仅限技术失败", "corpus_failed", "只用于技术性失败", "搜索根目录错误"],
  ["事实核验、因果、多视角", "事实、因果和多视角", "核验时间线", "二阶效应"],
  ["方案六要素", "方案六要素是硬门", "衡量指标", "停止/退出条件"],
  ["正文 3000 至 5000 字", "3000 至 5000 个中文字符", "3000 至 5000 字"],
  ["固定 Sepia 三阶段", "sepia-review -> sepia-refactor -> sepia-review", "只有用户明确要求完全重写时才允许改用 sepia-recreate"],
  ["sepia_call_failed 判定", "sepia_call_failed", "不得用模型自评冒充真实阶段结果"],
  ["11 项可审计评分", "### 11项评分", "10 个检查点", "0 至 10 的整数", "综合平均分可为小数"],
  ["终稿验证器", "validate_final_draft.mjs outputs/<task-id>/final_draft.md outputs/<task-id>/final_audit.json --json", "pass=true"],
  ["中断恢复与断点续跑", "Autocompact is thrashing", "context limit", "断点续跑", "继续缺失阶段"],
  ["来源诚实与资源降级", "资源降级与更新边界", "只有实际打开正文才可称为原文依据"],
];
for (const [name, ...needles] of preserved) {
  add(`硬门语义未丢失：${name}`, has(skill, ...needles));
}

// 3. Regression probes moved out of per-task flow into a skill-update test.
add(
  "回归测试不再写成每篇任务必做",
  absent(skill, "用只读方式复核两类情形", "状态判定复核（上线自检）") &&
    has(skill, "不是每篇任务的步骤", "技能更新测试", "tests/corpus_status_regression.test.mjs")
);
add(
  "回归测试文件确实覆盖冷门词零命中与错误根目录",
  has(regressionTest, "量子泡馍悖论XYZ2026", "Cannot find transcript directory", "corpus_available", "corpus_failed")
);

// 4. Full audit data still saved to files; conversation only a short summary.
add(
  "完整审计数据仍落盘到任务目录",
  has(skill, "outputs/<task-id>/final_audit.json", "outputs/<task-id>/final_validation.json", "完整数据一律落盘", "一律保存到本次任务目录")
);
add(
  "对话交付只报必要摘要，不重复正文/完整 JSON/多篇全文",
  has(skill, "对话交付只报必要摘要", "不重复输出正文、完整 JSON 或多篇全文") &&
    has(skill, "不得把完整 JSON 重新注入上下文", "对话中不得重复展示完整正文")
);
add(
  "口播稿正文仍完整交付一次且不混入来源/流程信息",
  has(skill, "交付完整正文一次", "正文单独成块", "不把来源名、期数和流程信息混进稿件")
);

// 5. Companion publishing content is conditional, without dropping explicit requests.
add(
  "标题/标签/简介只在需要发布配套内容或明确要求时生成",
  has(skill, "只有用户需要发布配套内容或明确要求时", "才额外生成 1 个推荐标题", "7 个 B 站标签")
);
add(
  "用户明确要求的内容不得因摘要而漏掉",
  has(skill, "用户明确要求的内容必须完整提供", "不得因摘要而漏掉") &&
    has(readme, "用户明确要求的内容不得因摘要而漏掉")
);

// 6. Platform compatibility: no TEXT ONLY / tool bans introduced.
add(
  "未引入 TEXT ONLY / 禁止工具等平台限制",
  absent(skill, "TEXT ONLY", "禁止工具", "禁用工具", "禁止使用工具", "不得调用工具", "tool-free") &&
    absent(readme, "TEXT ONLY", "禁止工具", "禁用工具", "禁止使用工具", "tool-free")
);
add(
  "保留平台挂载降级与 macOS/PowerShell 兼容说明",
  has(skill, "平台只挂载本文件不代表语料为空", "Windows PowerShell 不得成为 macOS 必要步骤")
);

// 7. README quick-use prompt references SKILL.md instead of restating the spec.
add(
  "README 推荐调用句精简并引用项目 SKILL.md",
  has(readme, "这是新闻材料。请按项目 SKILL.md 执行 madugong-perspective 完整流程") &&
    has(readme, "唯一权威定义", "### 快速使用", "不要求逐步输入命令")
);
add(
  "README 不再重复整套规范长提示句",
  absent(
    readme,
    "自动依次执行 sepia-review、sepia-refactor、sepia-review，并交付可审计评分表",
    "使用本地低 Token 全文检索，优先检索《睡前消息》主语料"
  ) && readme.includes("这里不重复")
);
add(
  "README 仍说明上下文预算、中断恢复与断点续跑",
  has(readme, "上下文预算与中断恢复", "sepia-recreate", "Autocompact is thrashing", "context limit", "断点续跑", "final_validation.json")
);
add(
  "README 检索示例与实际默认值一致（12 / 12000）",
  readme.includes("--context-lines 12 --max-chars 12000 --json") &&
    absent(readme, "--context-lines 24 --max-chars 24000")
);

// 8. outputs/ stays ignored; no login/session state committed.
add("outputs/ 仍被 .gitignore 忽略", gitignore.split(/\r?\n/).some((line) => line.trim() === "outputs/"));
add(
  "登录态与 session 排除规则仍在",
  has(gitignore, "**/zhihu-session/", "**/zhihu_state.json")
);

// 8b. Single-task output whitelist: exactly 6 files by default, no duplicate
// versions, no auto-generated manifests / reports / platform wrappers, with an
// explicit-user-request exception. Read-only assertions on SKILL.md text only;
// the validator is intentionally NOT asked to scan or reject existing outputs/.
// Filenames are fixed; SKILL.md states all of them live at
// outputs/<task-id>/<文件名>, so both the prefix and the six names are asserted.
const defaultOutputs = [
  "final_draft.md",
  "final_audit.json",
  "sepia_review_1.md",
  "sepia_refactor.md",
  "sepia_review_2.md",
  "final_validation.json",
];
add(
  "终稿交付规则列出单篇任务默认的 6 个流程产物及其任务目录前缀",
  has(skill, "单篇任务默认只生成这 6 个流程产物", "outputs/<task-id>/<文件名>", ...defaultOutputs) &&
    has(skill, "不自动增加文件")
);
add(
  "修订覆盖同一 final_draft.md，禁止自动生成 v2 / enhanced / 9plus 重复版本",
  has(skill, "修订一律覆盖同一任务的 final_draft.md", "不自动另存", "v2", "enhanced", "9plus")
);
add(
  "禁止自动生成交付清单、深度报告、平台包装文件",
  has(skill, "不自动生成交付清单、深度报告或平台包装文件")
);
add(
  "用户明确要求额外交付物时才可新建并须说明用途",
  has(skill, "只有用户明确要求额外交付物时才可新建", "并须说明用途")
);
add(
  "只约束新任务自动生成，禁止触碰其他任务/根目录/非本任务文件",
  has(skill, "本条只约束新任务的自动生成行为", "禁止覆盖、删除或移动其他 task-id 目录", "任何非本任务文件")
);
add(
  "验证器未被改造成扫描或拒绝 outputs/ 已有文件",
  !/readdir|walk\(/u.test(fs.readFileSync(path.join(REPO, "scripts", "validate_final_draft.mjs"), "utf8"))
);

// 8c. DOCUMENT / STATIC CONTRACT ONLY. The validator never generates or
// selects task-id: that choice is Agent session behaviour and CANNOT be
// exercised end-to-end by file-level tests. The assertions below verify the
// wording in SKILL.md / README.md, not runtime behaviour. The file-level
// subset (path parameters, exact 6-file sets, protection of pre-existing files
// when the same task directory is reused) is covered by
// tests/task_output_dir.test.mjs; see the SCOPE LIMIT note there.
add(
  "路径约定解析到任务专属目录且不新增第七个文件",
  has(skill, "路径约定与 task-id 生命周期", "outputs/<task-id>/<文件名>", "直接由任务目录名保存", "不另建记录文件", "不新增第七个文件")
);
add(
  "（静态契约）只有明确开始一个全新新闻任务才生成新的唯一 task-id",
  has(skill, "只有明确开始一个全新新闻任务时才生成新的唯一 task-id", "不得使用其他任务的 task-id")
);
add(
  "（静态契约）同一任务续跑/修订/复查/重跑/恢复沿用原 task-id",
  has(skill, "同一任务的续跑、修订、复查、验证器重跑和中断恢复一律沿用原 task-id", "不得新建任务目录")
);
add(
  "（静态契约）第 6 条引用路径约定，限定仅全新任务新建目录、同任务沿用",
  has(skill, "task-id 生成/复用与覆盖边界按", "仅全新任务新建目录", "同一任务沿用原目录")
);
add(
  "（静态契约）中断恢复与续跑规则明确沿用原目录",
  has(skill, "中断恢复、同一任务的续跑与修订、复查、验证器重跑", "一律沿用原 task-id 和原任务目录", "不得新建任务目录")
);
add(
  "恢复提示要求记录项目根目录、task-id、任务目录、已完成与下一缺失阶段",
  has(skill, "至少含完整项目根目录、原 task-id（不得新建）、完整任务目录", "已完成阶段、下一缺失阶段") &&
    has(skill, "项目根目录：<完整项目根目录的绝对路径>", "task-id：<原 task-id，不得新建>", "完整任务目录：<项目根目录>/outputs/<task-id>/", "已完成阶段：<阶段列表>；下一缺失阶段：")
);
add(
  "恢复提示描述与模板一致要求原 task-id 不新建",
  has(skill, "原 task-id（不得新建）", "不得新建任务目录")
);
add(
  "第 6 条限定只有全新新闻任务才新建目录、目录内 6 个文件名固定",
  has(skill, "仅全新任务新建目录", "同一任务沿用原目录", "单篇任务默认只生成这 6 个流程产物", "均为 outputs/<task-id>/<文件名>")
);
add(
  "允许更新本任务 6 个文件、禁止触碰其他 task-id/根目录/非本任务文件",
  has(skill, "允许按流程更新同一 task-id 下这 6 个文件", "禁止覆盖、删除或移动其他 task-id 目录", "任何非本任务文件") &&
    has(skill, "含覆盖本任务自己的 final_draft.md", "只更新本任务 6 个文件")
);
add(
  "验证器命令改为任务专属路径参数（无需改脚本）",
  has(skill, "validate_final_draft.mjs outputs/<task-id>/final_draft.md outputs/<task-id>/final_audit.json --json", "天然支持任务专属目录，无需修改脚本")
);
add(
  "README 保留任务目录与验证器操作入口，规则只在 SKILL.md 定义一次",
  has(readme, "<task-id>/", "outputs/<task-id>/<文件名>", "outputs/<task-id>/final_draft.md", "outputs/<task-id>/final_audit.json --json", "这里不重复", "唯一权威定义")
);
add(
  "README 明确只有用户要求额外交付物时才可新建并说明用途",
  has(readme, "只有用户明确要求额外交付物时", "说明用途") &&
    has(skill, "用户明确要求额外交付物时例外", "只有用户明确要求额外交付物时才可新建")
);
add(
  "README 目录树列出 5 个测试文件",
  has(readme, "corpus_status_regression.test.mjs", "skill_contract_rules.test.mjs", "task_output_dir.test.mjs", "validate_final_draft.test.mjs", "context_budget_rules.test.mjs")
);
add(
  "README 精简后不再重复 task-id/六文件/恢复规则长摘要",
  absent(
    readme,
    "只有明确开始一个全新新闻任务时才生成唯一 task-id 并新建任务目录",
    "禁止覆盖、删除或移动其他 task-id 目录",
    "完整项目根目录、原 task-id、完整任务目录"
  ) && has(readme, "操作入口，规则以 SKILL.md 为准")
);
add(
  "恢复提示五要素的完整模板仍由 SKILL.md 定义",
  has(skill, "项目根目录：<完整项目根目录的绝对路径>", "task-id：<原 task-id，不得新建>", "完整任务目录：<项目根目录>/outputs/<task-id>/", "已完成阶段：<阶段列表>；下一缺失阶段：")
);

// 9. Stable document size budget (docs are injected into every task's context).
// Normalize CRLF so the comparison is identical to the git blob baseline.
// The pre-optimisation baseline was SKILL.md 13224 / README.md 9752 (22976
// combined). We allow a fixed 2000-character headroom per document (3000
// combined), i.e. ~15% -- enough that small wording edits or a new clause do
// not flip the check, while a real regression back to a bloated spec still
// fails. These budgets are deliberately NOT set to the current values.
const BASELINE = { skill: 13224, readme: 9752, combined: 22976 };
const HEADROOM = { skill: 2000, readme: 2000, combined: 3000 };
const BUDGET = {
  skill: BASELINE.skill + HEADROOM.skill,
  readme: BASELINE.readme + HEADROOM.readme,
  combined: BASELINE.combined + HEADROOM.combined,
};
const lf = (rel) => read(rel).replace(/\r\n/g, "\n").length;
const skillChars = lf("SKILL.md");
const readmeChars = lf("README.md");
add(
  `SKILL.md 在稳定预算内（当前 ${skillChars}，预算 ${BUDGET.skill} = 基线 13224 + 2000 余量）`,
  skillChars <= BUDGET.skill
);
add(
  `README.md 在稳定预算内（当前 ${readmeChars}，预算 ${BUDGET.readme} = 基线 9752 + 2000 余量）`,
  readmeChars <= BUDGET.readme
);
add(
  `两份文档合计在稳定预算内（当前 ${skillChars + readmeChars}，预算 ${BUDGET.combined}）`,
  skillChars + readmeChars <= BUDGET.combined
);
add(
  "预算本身留有余量（各文档至少 1000 字符、合计至少 2000 字符）",
  HEADROOM.skill >= 1000 && HEADROOM.readme >= 1000 && HEADROOM.combined >= 2000 &&
    BUDGET.skill - skillChars >= 1000 && BUDGET.readme - readmeChars >= 1000
);

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}`);
  if (!check.ok) failed += 1;
}
console.log(`\n${checks.length} checks, ${failed} failed`);
console.log(`SKILL.md=${skillChars} chars, README.md=${readmeChars} chars`);
process.exit(failed === 0 ? 0 : 1);

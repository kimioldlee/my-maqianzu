#!/usr/bin/env node

/**
 * Focused tests for the low-context patch (SKILL.md / README.md rules plus
 * scripts/validate_final_draft.mjs terminal output and scoring evidence).
 *
 * Run: node tests/context_budget_patch.test.mjs
 *
 * 1-2 are DOCUMENT / STATIC CONTRACT checks: SKILL.md describes how the Agent
 * must classify a timed-out or failed retrieval. The validator and retriever
 * scripts do not implement a timeout themselves, so no end-to-end runtime
 * claim is made for those two items.
 * 3-6 are behavioural: they run the real validator in an OS temp workspace.
 * All writes happen in that temp workspace and are removed afterwards.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const VALIDATOR = path.join(REPO, "scripts", "validate_final_draft.mjs");

const skill = fs.readFileSync(path.join(REPO, "SKILL.md"), "utf8");
const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
const validatorSource = fs.readFileSync(VALIDATOR, "utf8");

const has = (text, ...needles) => needles.every((n) => text.includes(n));
const absent = (text, ...needles) => needles.every((n) => !text.includes(n));

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

// ---------------------------------------------------------------------------
// 1. Timeout must never be reported as a zero-hit result.
// ---------------------------------------------------------------------------
add(
  "（静态契约）检索器至少允许运行 90 秒，首次超时只重试一次较小参数",
  has(skill, "至少运行 90 秒", "首次超时时", "重试一次", "更小的 `limit` 或 `max-chars`")
);
add(
  "（静态契约）超时不等于零命中，不得进入零命中补充检索",
  has(skill, "超时不等于零命中", "不得记为 `direct_hit_count=0`") &&
    has(skill, "不得据此进入零命中补充检索流程")
);

// ---------------------------------------------------------------------------
// 2. corpus_available requires a clean exit, statistics and readable source.
// ---------------------------------------------------------------------------
add(
  "（静态契约）未正常退出/无统计/无法回读原文时不得报告 corpus_available",
  has(skill, "检索器未正常退出、未得到统计结果或命中原文无法回读时，不得报告 `corpus_available`") &&
    has(skill, "corpus_failed", "只用于技术性失败")
);
add(
  "（静态契约）故意零命中/无效目录只在技能更新回归测试中执行",
  has(skill, "只在技能、索引或检索器更新后的回归测试中执行", "不在每篇新闻任务中重复执行") &&
    absent(skill, "用只读方式复核两类情形", "状态判定复核（上线自检）") &&
    has(readme, "不是每篇新闻任务的步骤")
);

// Executable mirror of the SKILL.md classification rules. This is a rule
// semantics test, NOT an end-to-end test of the retriever (whose search logic
// is intentionally untouched): it proves a timeout/failure can never be
// collapsed into "zero hits" or "corpus_available".
function classifyRetrieval({ timedOut, cleanExit, statsPresent, canReadOriginal, total }) {
  if (timedOut || !cleanExit || !statsPresent || !canReadOriginal) {
    return { status: "corpus_failed", zeroHit: null, directHitCount: null };
  }
  return { status: "corpus_available", zeroHit: total === 0, directHitCount: total };
}
add(
  "（规则语义）超时/中断/无统计都不是零命中，也不报告 corpus_available",
  classifyRetrieval({ timedOut: true, cleanExit: false, statsPresent: false, canReadOriginal: false, total: 0 })
    .status === "corpus_failed" &&
  classifyRetrieval({ timedOut: true, cleanExit: true, statsPresent: true, canReadOriginal: true, total: 0 })
    .zeroHit === null &&
  classifyRetrieval({ timedOut: false, cleanExit: false, statsPresent: true, canReadOriginal: true, total: 0 })
    .status === "corpus_failed"
);
add(
  "（规则语义）corpus_available 需成功退出+统计+可回读；此时零命中才为 direct_hit_count=0",
  classifyRetrieval({ timedOut: false, cleanExit: true, statsPresent: true, canReadOriginal: true, total: 0 })
    .directHitCount === 0 &&
  classifyRetrieval({ timedOut: false, cleanExit: true, statsPresent: true, canReadOriginal: true, total: 3 })
    .status === "corpus_available" &&
  classifyRetrieval({ timedOut: false, cleanExit: true, statsPresent: true, canReadOriginal: false, total: 3 })
    .status === "corpus_failed"
);

// ---------------------------------------------------------------------------
// Context-control rules (SKILL.md) and normal usage (README.md).
// ---------------------------------------------------------------------------
add(
  "（静态契约）Sepia 工作流说明只加载一次、三阶段仍由同一 Agent 连续执行",
  has(skill, "`sepia-review` 的工作流说明在同一任务中只加载一次", "`sepia-refactor` 的工作流说明只加载一次") &&
    has(skill, "三阶段仍必须由同一 Agent 自动连续执行", "不得要求用户分别输入三次命令")
);
add(
  "（静态契约）阶段结果落盘、对话只留摘要、可复用预检但每份新新闻仍检索",
  has(skill, "三阶段的完整结果写入项目的 `outputs/` 目录", "会话中只保留阶段摘要、关键问题和文件路径") &&
    has(skill, "可复用已经成功的资源预检", "每份新新闻仍必须执行话题检索")
);
add(
  "（静态契约）README 明确正常使用方式，不再建议注入完整 SKILL.md",
  has(readme, "打开或挂载**完整项目目录**", "调用该技能", "项目根目录的 `SKILL.md` 是规范入口", "不需要在每个任务中重复粘贴完整") &&
    absent(readme, "将 `SKILL.md` 全部内容作为 System Prompt 注入", "将 SKILL.md 内容拼入 system message")
);
add(
  "（静态契约）README 检索示例为 12 / 12000，语料数量不写死",
  has(readme, "--context-lines 12 --max-chars 12000", "实际语料覆盖范围以 `bedtime-transcript-index.json` 和 `references/research/17-full-corpus-digest.md` 为准") &&
    absent(readme, "--context-lines 24 --max-chars 24000", "892篇", "2047 篇", "覆盖到第1124期")
);

// ---------------------------------------------------------------------------
// Behavioural fixtures for validator output modes and scoring evidence.
// ---------------------------------------------------------------------------
const DIMENSIONS = [
  "切入点准确性", "态度冷静度", "数据可信度", "逻辑严密度", "口播化程度",
  "节目腔调", "观点完整性", "AI痕迹消除", "预判反驳力度", "政治现实感", "幽默恰当性",
];
const SOLUTION_KEYS = [
  "执行主体", "权限或资金来源", "受影响方及补偿", "试点或过渡安排", "衡量指标", "停止或退出条件",
];
const SOLUTION_SENTENCES = [
  "由市发展和改革委员会牵头成立联合工作组负责执行",
  "所需经费从市级财政专项资金中列支并依法授权",
  "对受影响的沿街商户按实际损失给予一次性补偿",
  "先在两个城区开展六个月试点再逐步扩大范围",
  "以月度投诉量和办结率作为主要衡量指标",
  "若连续三个月指标未改善则停止试点并退出",
];
const QUOTES = [
  ...SOLUTION_SENTENCES,
  "按季度更新记录", "保留原始单据", "标明统计口径和采集时点", "写清交接节点", "留出申辩渠道",
];
const FILLERS = [
  "相关单位需要把基础台账核对清楚，并按季度更新记录，保证每个环节都有凭证可查。",
  "基层执行人员应当保留原始单据，方便后续抽查与复核，减少口径不一致的情况。",
  "财政安排要与项目进度匹配，先确定经费渠道，再明确拨付节奏和监督方式。",
  "对公众关切的事项，应当给出可查询的时间表和责任人，降低信息不对称带来的误判。",
  "评估工作需要同时观察短期变化和长期趋势，不能只凭单一月份的波动下结论。",
  "试点范围内的商户与居民可以提交意见，汇总后由工作组逐条回应并公开处理结果。",
  "跨部门协作要写清交接节点，避免材料在某个环节停留过久而影响整体进度。",
  "公开数据应当标明统计口径和采集时点，便于外部复核，也便于内部对照。",
  "方案落地前需要确认执行权限，确保每一步都有明确的承担主体和复核人员。",
  "对受影响群体要提前说明安排，留出申辩渠道，并把处理结果纳入后续评估。",
  "衡量成效时要选定少量稳定指标，持续跟踪，不因单月波动频繁改动口径。",
  "退出机制需要写明触发情形、通知方式和后续交接，避免项目停摆后无人负责。",
];
const STAGE_FILES = {
  "sepia_review_1.md": [
    "诊断：初稿第2段存在重复表述与残留前缀。",
    "问题原句：相关单位需要把基础台账核对清楚，并按季度更新记录。",
    "位置：第2段第3句。",
    "修复计划：删除残留前缀，合并重复句，保留事实主体。",
  ].join("\n"),
  "sepia_refactor.md": [
    "修改项：删除残留前缀；合并第2段重复表述；保留事实主体。",
    "修改后的完整正文见同目录 final_draft.md。",
    "修改记录：共3处，均已在 final_draft.md 中落实。",
  ].join("\n"),
  "sepia_review_2.md": [
    "复查对象：final_draft.md 修改后的同一份稿件。",
    "已修复项：残留前缀、重复表述、事实主体缺失，共3处。",
    "剩余问题：无。",
    "位置：第2段、第5段、第9段。",
    "是否通过：通过。",
  ].join("\n"),
};

const nonWhitespaceCount = (text) => [...text].filter((c) => !/\s/u.test(c)).length;

function buildBody(target = 3800) {
  const parts = [...SOLUTION_SENTENCES];
  let i = 0;
  while (nonWhitespaceCount(parts.join("\n\n")) < target) {
    parts.push(`第${i + 1}项记录显示，${FILLERS[i % FILLERS.length]}`);
    i += 1;
    if (i > 500) break;
  }
  return parts.join("\n\n");
}

function buildAudit(mutate = () => {}) {
  const scores = DIMENSIONS.map((name, di) => ({
    name,
    declaredScore: 10,
    checkpoints: Array.from({ length: 10 }, (_, ci) => ({
      result: true,
      location: `第 ${di + 1} 段`,
      quote: QUOTES[(di + ci) % QUOTES.length],
      reason: "检查点通过，证据引自终稿正文",
    })),
  }));
  const solutionElements = {};
  SOLUTION_KEYS.forEach((key, i) => { solutionElements[key] = { evidence: SOLUTION_SENTENCES[i] }; });
  const audit = {
    scores,
    solutionElements,
    averageScore: 10,
    remainingIssues: "无",
    reported: { bodyChars: 3500, nonWhitespaceChars: 3500, dashCount: 0 },
  };
  mutate(audit);
  return audit;
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), "context-budget-patch-"));

function makeFixture(name, mutate) {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "final_draft.md"), `${buildBody()}\n`, "utf8");
  fs.writeFileSync(path.join(dir, "final_audit.json"), `${JSON.stringify(buildAudit(mutate), null, 2)}\n`, "utf8");
  for (const [file, content] of Object.entries(STAGE_FILES)) {
    fs.writeFileSync(path.join(dir, file), `${content}\n`, "utf8");
  }
  return {
    dir,
    draft: path.join(dir, "final_draft.md"),
    audit: path.join(dir, "final_audit.json"),
    report: path.join(dir, "final_validation.json"),
  };
}

function run(fixture, extraArgs = []) {
  const result = spawnSync(process.execPath, [VALIDATOR, fixture.draft, fixture.audit, ...extraArgs], {
    cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
  });
  let json = null;
  try { json = JSON.parse(result.stdout); } catch { json = null; }
  return { status: result.status, stdout: result.stdout, json, stderr: result.stderr };
}

// 3. Default terminal output = compact summary, complete JSON still on disk.
const good = makeFixture("good");
const defaultRun = run(good);
const reportOnDisk = fs.existsSync(good.report);
const reportJson = reportOnDisk ? JSON.parse(fs.readFileSync(good.report, "utf8")) : null;
add(
  "验证器默认输出为精简摘要（不含完整 JSON），完整报告仍落盘",
  defaultRun.status === 0 &&
    defaultRun.json === null &&
    has(defaultRun.stdout, "pass: true", "正文字数:", "平均评分:", "违规数量:", "完整报告:") &&
    absent(defaultRun.stdout, '"violations"', '"schemaVersion"', '"scoreDetails"') &&
    reportOnDisk && reportJson?.pass === true && Array.isArray(reportJson.violations),
  `stdout 首行=${defaultRun.stdout.split("\n")[0]}；完整报告=${reportOnDisk}`
);
add(
  "摘要只列出最重要的若干条违规，不回填完整稿件/诊断",
  absent(defaultRun.stdout, "由市发展和改革委员会牵头成立联合工作组负责执行", "诊断：初稿第2段") &&
    (defaultRun.stdout.match(/\n/g) ?? []).length <= 12,
  `摘要行数=${(defaultRun.stdout.match(/\n/g) ?? []).length}`
);

// 4. --full-json prints the complete JSON.
const fullRun = run(makeFixture("full-json"), ["--full-json"]);
add(
  "显式 --full-json 在终端打印完整 JSON",
  fullRun.status === 0 && fullRun.json !== null &&
    fullRun.json.pass === true && Array.isArray(fullRun.json.violations) &&
    typeof fullRun.json.averageScore === "number" && !!fullRun.json.scoreDetails,
  `stdout 可解析=${fullRun.json !== null}`
);
const aliasRun = run(makeFixture("json-alias"), ["--json"]);
add(
  "向后兼容：--json 仍打印完整 JSON（显式开关）",
  aliasRun.status === 0 && aliasRun.json !== null && aliasRun.json.pass === true,
  `stdout 可解析=${aliasRun.json !== null}`
);

// 5. quote must be real text from the final draft.
const badQuote = makeFixture("bad-quote", (a) => {
  a.scores[0].checkpoints[0] = {
    result: true,
    location: "第 3 段",
    quote: "这句原文根本不在终稿正文中XYZ123",
    reason: "检查点通过",
  };
});
const badQuoteRun = run(badQuote, ["--full-json"]);
add(
  "评分证据 quote 不存在于正文时验证失败",
  badQuoteRun.status !== 0 && badQuoteRun.json?.pass === false &&
    badQuoteRun.json.violations.some((v) => v.includes("quote 未原样出现在 final_draft.md")),
  `exit=${badQuoteRun.status}`
);
const locationOnly = makeFixture("location-only", (a) => {
  a.scores[0].checkpoints[0] = {
    result: true,
    location: "第 3 段",
    quote: "第3段",
    reason: "检查点通过",
  };
});
const locationOnlyRun = run(locationOnly, ["--full-json"]);
add(
  "只有『第3段』之类位置说明、没有原文引用不得通过",
  locationOnlyRun.status !== 0 && locationOnlyRun.json?.pass === false &&
    locationOnlyRun.json.violations.some((v) => v.includes("只有位置说明、没有原文引用")),
  `exit=${locationOnlyRun.status}`
);
const missingFields = makeFixture("missing-fields", (a) => {
  a.scores[0].checkpoints[0] = { result: true, quote: SOLUTION_SENTENCES[0] };
});
const missingFieldsRun = run(missingFields, ["--full-json"]);
add(
  "结构化评分证据缺少 location/reason 时验证失败",
  missingFieldsRun.status !== 0 && missingFieldsRun.json?.pass === false &&
    missingFieldsRun.json.violations.some((v) => v.includes("评分证据缺少")),
  `exit=${missingFieldsRun.status}`
);
const goodRunFull = run(good, ["--full-json"]);
add(
  "含 location/quote/reason 且 quote 真实存在于正文时通过，硬门判定未放宽",
  goodRunFull.status === 0 && goodRunFull.json?.pass === true &&
    goodRunFull.json.scoreDetails[DIMENSIONS[0]][0].location &&
    goodRunFull.json.scoreDetails[DIMENSIONS[0]][0].quote &&
    goodRunFull.json.scoreDetails[DIMENSIONS[0]][0].reason,
  `exit=${goodRunFull.status}`
);

// 6. Existing hard-gate suite still passes.
const existing = spawnSync(process.execPath, [path.join(REPO, "tests", "validate_final_draft.test.mjs")], {
  cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
add(
  "原有终稿硬门测试继续通过（9/9）",
  existing.status === 0 && /总判定：全部通过/u.test(existing.stdout ?? "") &&
    (existing.stdout.match(/判定：OK/g) ?? []).length === 9,
  `exit=${existing.status} OK 数=${(existing.stdout.match(/判定：OK/g) ?? []).length}`
);

// No full JSON is dumped by default in the validator source itself either.
add(
  "（静态契约）验证器默认不向终端输出完整 JSON",
  has(validatorSource, "fullJson ? json : summaryLines", "--full-json", "Terminal output is a SHORT SUMMARY") &&
    absent(validatorSource, "process.stdout.write(json)")
);

fs.rmSync(root, { recursive: true, force: true });

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}`);
  if (check.detail) console.log(`      ${check.detail}`);
  if (!check.ok) failed += 1;
}
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

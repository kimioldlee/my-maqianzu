#!/usr/bin/env node

/**
 * Read-only path-parameter test for per-task output isolation.
 *
 * Run: node tests/task_output_dir.test.mjs
 *
 * It builds two valid fixtures under <tmp>/outputs/<task-id>/ and runs the
 * REAL validator against each. It proves the validator accepts task-scoped
 * draft/audit paths, resolves the three Sepia stage files from that same
 * directory, and writes final_validation.json there -- without touching the
 * other task or pre-existing files in the outputs/ root.
 *
 * SCOPE LIMIT (important): this is a FILE-LEVEL integration test. It verifies
 * path-parameter compatibility, exact per-task file sets, and protection of
 * pre-existing files when the same task directory is reused. It does NOT and
 * CANNOT verify the Agent's session-level behaviour of choosing / reusing a
 * task-id: the validator never generates or selects task-id; that choice is
 * made by the Agent and is specified as a DOCUMENT / STATIC CONTRACT in
 * SKILL.md and README.md. No end-to-end claim is made here.
 *
 * All writes happen in an OS temp workspace created by this test, which is
 * removed afterwards. Inside it we actually pre-create an outputs/ root with
 * an old root-level draft plus an older task directory, and assert those
 * pre-existing entries stay byte-identical (content + mtime) before/after;
 * the real repository's outputs/, corpus, index, digest, cookies, sessions
 * and login state are never created or modified.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const VALIDATOR = path.join(REPO, "scripts", "validate_final_draft.mjs");

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
const CHECKPOINT_EVIDENCE = [
  ...SOLUTION_SENTENCES,
  "按季度更新记录",
  "保留原始单据",
  "标明统计口径和采集时点",
  "写清交接节点",
  "留出申辩渠道",
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
  "记录归档应当与现场核查同步进行，保证事后能够还原当时的决策材料。",
  "预算编制要覆盖试点期与过渡期，分别列支，防止出现资金空档。",
  "培训材料应当使用统一术语，减少不同区县理解偏差造成的执行差异。",
  "巡检结果要形成可追溯清单，标明发现时间、责任单位和整改期限。",
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

function nonWhitespaceCount(text) {
  let count = 0;
  for (const char of text) if (!/\s/u.test(char)) count += 1;
  return count;
}

function buildBody(target, marker) {
  const parts = [marker, ...SOLUTION_SENTENCES];
  let i = 0;
  while (nonWhitespaceCount(parts.join("\n\n")) < target) {
    parts.push(`第${i + 1}项记录显示，${FILLERS[i % FILLERS.length]}`);
    i += 1;
    if (i > 500) break;
  }
  return parts.join("\n\n");
}

function buildAudit() {
  const scores = DIMENSIONS.map((name, di) => ({
    name,
    declaredScore: 10,
    checkpoints: Array.from({ length: 10 }, (_, ci) => ({
      result: true,
      evidence: CHECKPOINT_EVIDENCE[(di + ci) % CHECKPOINT_EVIDENCE.length],
    })),
  }));
  const solutionElements = {};
  SOLUTION_KEYS.forEach((key, i) => {
    solutionElements[key] = { evidence: SOLUTION_SENTENCES[i] };
  });
  return {
    scores,
    solutionElements,
    averageScore: 10,
    remainingIssues: "无",
    reported: { bodyChars: 3500, nonWhitespaceChars: 3500, dashCount: 0 },
  };
}

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

// Read-only snapshots: pre-existing outputs/ content must survive unchanged.
const snapshotTree = (dir) => {
  if (!fs.existsSync(dir)) return null;
  const entries = [];
  const walk = (current, rel) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const key = path.join(rel, entry.name);
      if (entry.isDirectory()) {
        entries.push(`dir:${key}`);
        walk(full, key);
      } else {
        entries.push(`file:${key}:${fs.readFileSync(full).toString("base64")}`);
      }
    }
  };
  walk(dir, "");
  return entries.sort();
};
const SIX_FILES = [
  "final_draft.md", "final_audit.json", "sepia_review_1.md",
  "sepia_refactor.md", "sepia_review_2.md", "final_validation.json",
];

const root = fs.mkdtempSync(path.join(os.tmpdir(), "task-output-dir-"));
const outputsRoot = path.join(root, "outputs");
const taskA = path.join(outputsRoot, "20261121-alpha");
const taskB = path.join(outputsRoot, "20261121-beta");
const oldTask = path.join(outputsRoot, "20260101-old-task");
const legacy = path.join(outputsRoot, "final_draft.md");
const legacyText = "这是上一轮任务留下的旧稿，不应被新任务覆盖。";

fs.mkdirSync(taskA, { recursive: true });
fs.mkdirSync(taskB, { recursive: true });
fs.mkdirSync(oldTask, { recursive: true });
fs.writeFileSync(legacy, legacyText, "utf8");
fs.writeFileSync(path.join(oldTask, "final_draft.md"), "更早任务的工作稿，不应被其他任务改动。", "utf8");
fs.writeFileSync(path.join(oldTask, "final_audit.json"), '{"task":"20260101-old-task"}\n', "utf8");

// Pre-existing files in a NON-task root and another task's directory. The
// snapshot is deliberately non-empty: this test must never pass merely because
// the repository happens to have no outputs/ directory (null === null).
const preexistingPaths = [
  legacy,
  path.join(oldTask, "final_draft.md"),
  path.join(oldTask, "final_audit.json"),
];
const snapshotPreexisting = () =>
  preexistingPaths.map(
    (p) => `${p}:${fs.statSync(p).mtimeMs}:${fs.readFileSync(p).toString("base64")}`
  );
const preexistingBefore = snapshotPreexisting();

const markerA = "本次任务编号为甲，记录归档与核对流程均以此为准。";
const markerB = "本次任务编号为乙，记录归档与核对流程均以此为准。";
for (const [dir, marker] of [[taskA, markerA], [taskB, markerB]]) {
  fs.writeFileSync(path.join(dir, "final_draft.md"), `${buildBody(3800, marker)}\n`, "utf8");
  fs.writeFileSync(path.join(dir, "final_audit.json"), `${JSON.stringify(buildAudit(), null, 2)}\n`, "utf8");
  for (const [name, content] of Object.entries(STAGE_FILES)) {
    fs.writeFileSync(path.join(dir, name), `${content}\n`, "utf8");
  }
}

const draftA = path.join(taskA, "final_draft.md");
const auditA = path.join(taskA, "final_audit.json");
const draftB = path.join(taskB, "final_draft.md");
const auditB = path.join(taskB, "final_audit.json");
const beforeA = fs.readFileSync(draftA, "utf8");
const beforeB = fs.readFileSync(draftB, "utf8");
const beforeLegacy = fs.statSync(legacy).mtimeMs;

// Absolute task-scoped paths.
const runA = spawnSync(process.execPath, [VALIDATOR, draftA, auditA, "--json"], {
  cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
// Relative task-scoped paths, relative to the temp root.
const runB = spawnSync(process.execPath, [
  VALIDATOR,
  path.join("outputs", "20261121-beta", "final_draft.md"),
  path.join("outputs", "20261121-beta", "final_audit.json"),
  "--json",
], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });

// Same-task re-run: reuse task A's own directory (the file-level analogue of
// "同一任务续跑 / 验证器重跑"), and verify no new task directory appears and
// that the other task plus the legacy root file stay untouched.
const taskDirsBefore = fs.readdirSync(outputsRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory()).map((e) => e.name).sort();
const snapshotBBeforeRerun = snapshotTree(taskB);
const runA2 = spawnSync(process.execPath, [VALIDATOR, draftA, auditA, "--json"], {
  cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
let payloadA2 = null;
try { payloadA2 = JSON.parse(runA2.stdout); } catch { payloadA2 = null; }

let payloadA = null;
let payloadB = null;
try { payloadA = JSON.parse(runA.stdout); } catch { payloadA = null; }
try { payloadB = JSON.parse(runB.stdout); } catch { payloadB = null; }

add(
  "A 绝对任务路径：验证器退出码 0 且 pass=true",
  runA.status === 0 && payloadA?.pass === true && payloadA?.exitCode === 0,
  `exit=${runA.status} pass=${payloadA?.pass}`
);
add(
  "B 相对任务路径：验证器退出码 0 且 pass=true",
  runB.status === 0 && payloadB?.pass === true && payloadB?.exitCode === 0,
  `exit=${runB.status} pass=${payloadB?.pass}`
);
add(
  "三阶段文件由稿件同目录读取（不是固定 outputs/ 根）",
  Object.values(payloadA?.stageFiles ?? {}).filter((s) => "pass" in s).every((s) => s.pass === true) &&
    payloadA?.stageFiles?.["sepia_review_1.md"]?.pass === true &&
    payloadA?.stageFiles?.["sepia_refactor.md"]?.pass === true &&
    payloadA?.stageFiles?.["sepia_review_2.md"]?.pass === true,
  `stageFiles=${Object.keys(payloadA?.stageFiles ?? {}).length}`
);
add(
  "A 的 final_validation.json 写入 A 任务目录",
  path.resolve(payloadA?.validationOutputPath ?? "") === path.join(taskA, "final_validation.json") &&
    fs.existsSync(path.join(taskA, "final_validation.json")),
  `path=${payloadA?.validationOutputPath ?? "无"}`
);
add(
  "B 的 final_validation.json 写入 B 任务目录",
  path.resolve(payloadB?.validationOutputPath ?? "") === path.join(taskB, "final_validation.json") &&
    fs.existsSync(path.join(taskB, "final_validation.json")),
  `path=${payloadB?.validationOutputPath ?? "无"}`
);
add(
  "A 的 draftPath 精确指向 A 任务目录",
  payloadA?.draftPath === draftA && payloadA?.auditPath === auditA,
  `draft=${payloadA?.draftPath}`
);
add(
  "B 的 draftPath 精确指向 B 的 task-id 路径（不只是与 A 不同）",
  path.resolve(root, payloadB?.draftPath ?? "__missing__") === draftB &&
    path.resolve(root, payloadB?.auditPath ?? "__missing__") === auditB &&
    (payloadB?.draftPath ?? "").includes(path.join("20261121-beta", "final_draft.md")),
  `draft=${payloadB?.draftPath}`
);
add(
  "B 任务运行未覆盖 A 任务的稿件",
  fs.readFileSync(draftA, "utf8") === beforeA,
  "A 正文逐字未变"
);
add(
  "A 与 A2 重复运行后 B 任务的稿件逐字未变",
  fs.readFileSync(draftB, "utf8") === beforeB,
  "其他 task-id 未被写入"
);
add(
  "outputs/ 根目录已有旧文件内容与状态未变（允许预存）",
  fs.existsSync(legacy) &&
    fs.readFileSync(legacy, "utf8") === legacyText &&
    fs.statSync(legacy).mtimeMs === beforeLegacy,
  "legacy final_draft.md 内容与 mtime 均未变"
);
add(
  "验证器未在 outputs/ 根目录生成 final_validation.json",
  !fs.existsSync(path.join(outputsRoot, "final_validation.json")),
  "根目录无新产物"
);
add(
  "临时目录预置的旧文件与旧任务目录内容/mtime 逐项未变（非空快照，不依赖 null===null）",
  Array.isArray(preexistingBefore) &&
    preexistingBefore.length === 3 &&
    preexistingBefore.every((entry) => typeof entry === "string" && entry.length > 0) &&
    JSON.stringify(preexistingBefore) === JSON.stringify(snapshotPreexisting()) &&
    Array.isArray(snapshotTree(oldTask)) &&
    snapshotTree(oldTask).length === 2,
  `预置 ${preexistingPaths.length} 个旧文件 + 1 个旧任务目录，逐项内容与 mtime 均未变`
);
add(
  "每个任务目录恰好只有 6 个规定产物（无第七个文件）",
  [taskA, taskB].every((dir) => {
    const actual = fs.readdirSync(dir).sort();
    return JSON.stringify(actual) === JSON.stringify([...SIX_FILES].sort());
  }),
  [taskA, taskB].map((d) => `${path.basename(d)}=${fs.readdirSync(d).length}`).join(" ")
);
add(
  "同一任务目录重复运行验证器：仍 pass、输出仍写原 task-id 目录",
  runA2.status === 0 && payloadA2?.pass === true && payloadA2?.exitCode === 0 &&
    path.resolve(payloadA2?.validationOutputPath ?? "") === path.join(taskA, "final_validation.json") &&
    payloadA2?.draftPath === draftA,
  `exit=${runA2.status} pass=${payloadA2?.pass} 目录=20261121-alpha`
);
add(
  "同一任务重复运行未新建任务目录、未改动其他任务目录（文件级续跑保护）",
  JSON.stringify(
    fs.readdirSync(outputsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory()).map((e) => e.name).sort()
  ) === JSON.stringify(taskDirsBefore) &&
    Array.isArray(snapshotBBeforeRerun) &&
    JSON.stringify(snapshotBBeforeRerun) === JSON.stringify(snapshotTree(taskB)) &&
    fs.readFileSync(draftB, "utf8") === beforeB &&
    fs.readdirSync(taskB).length === 6 &&
    fs.readdirSync(taskA).length === 6,
  `任务目录=${taskDirsBefore.join(",")}；B 目录逐项快照未变`
);
add(
  "同一任务重复运行后 outputs/ 根目录仍只有预置旧文件、旧任务目录与两个任务目录",
  fs.readdirSync(outputsRoot).sort().join(",") ===
    ["20260101-old-task", "20261121-alpha", "20261121-beta", "final_draft.md"].sort().join(","),
  fs.readdirSync(outputsRoot).sort().join(",")
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

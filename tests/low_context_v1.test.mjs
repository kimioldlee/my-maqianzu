#!/usr/bin/env node

/**
 * Focused tests for the "low-context execution v1" patch.
 *
 * Run: node tests/low_context_v1.test.mjs
 *
 * Behavioural checks run the real preflight script and the real validator in
 * OS temp workspaces; all writes are removed afterwards. Static checks assert
 * that the new low-context rules did not delete or loosen any existing gate.
 * These are file-level / contract checks, NOT a measured Token A/B test.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const PREFLIGHT = path.join(REPO, "scripts", "run_compact_preflight.mjs");
const VALIDATOR = path.join(REPO, "scripts", "validate_final_draft.mjs");

const skill = fs.readFileSync(path.join(REPO, "SKILL.md"), "utf8");
const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf8");
const template = fs.readFileSync(path.join(REPO, "references", "templates", "evidence-pack-template.md"), "utf8");

const has = (text, ...needles) => needles.every((n) => text.includes(n));
const absent = (text, ...needles) => needles.every((n) => !text.includes(n));

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

// 1. Default first-round retrieval budget.
add(
  "SKILL.md 首轮检索预算为 limit 3 / context-lines 6 / max-chars 4000",
  has(skill, "首轮默认 `limit 3 --context-lines 6 --max-chars 4000`") &&
    has(skill, '"事件词" 3 --context-lines 6 --max-chars 4000 --json') &&
    has(skill, "首轮预算为「低上下文执行规范」的默认值（limit 3 / 6 / 4000）")
);
add(
  "README 首轮检索示例同步为 3 / 6 / 4000，并指向 SKILL.md 规范",
  has(readme, '"事件词,机制词" 3 --context-lines 6 --max-chars 4000 --json', "首轮预算与轮次上限见") &&
    absent(readme, '"事件词,机制词" 8 --context-lines 12 --max-chars 12000')
);
add(
  "低上下文规范保留批量执行、预检复用、6 轮上限、重试一次与脚本化机械检查",
  has(skill, "合并成一次批量执行", "资源预检在同一会话内成功后可复用", "原则上不超过 6 轮", "最多重试一次",
    "全部由本地脚本", "checkpoint 只保存")
);

// 2. Existing hard gates must still be present, verbatim.
const gates = [
  "`corpus_failed`：只用于技术性失败",
  "零命中绝不单独触发",
  "direct_hit_count=0",
  "3000 至 5000 个中文字符",
  "解决方案是口播稿硬门",
  "方案六要素齐全且在 `final_audit.json` 中各有正文原句证据",
  "正文节目名和期数为 0",
  "正文破折号数必须为 0",
  "三阶段必须由同一 Agent 连续执行",
  "11 项可审计评分",
  "11 项均达到 9.0",
];
add(
  `低上下文规则没有删除或放宽 ${gates.length} 项原有硬门`,
  has(skill, ...gates),
  `校验 ${gates.length} 项硬门文本`
);
add(
  "低上下文规范明确不改变硬门、七步流程、来源层级与三阶段 Sepia",
  has(skill, "不改动任何硬门、七步流程、来源层级、零命中补充检索或三阶段 Sepia",
    "三阶段 Sepia 仍必须由同一 Agent 自动连续执行", "不得拆给不同 Agent")
);

// 3. Compact preflight: no full text, no directory listing, only 9 fields.
const preflightNoQuery = spawnSync(process.execPath, [PREFLIGHT], {
  cwd: REPO, encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 120_000,
});
let preflight = null;
try { preflight = JSON.parse(preflightNoQuery.stdout); } catch { preflight = null; }
const EXPECTED_FIELDS = [
  "status", "resourceErrors", "transcriptFileCount", "zhihuFileCount",
  "retrieverExitCode", "scanned", "totalHits", "returned", "readbackVerified",
];
add(
  "紧凑预检只输出约定的 9 个字段，且资源检查通过",
  preflightNoQuery.status === 0 && preflight !== null &&
    JSON.stringify(Object.keys(preflight).sort()) === JSON.stringify([...EXPECTED_FIELDS].sort()) &&
    preflight.status === "ok" && Array.isArray(preflight.resourceErrors) &&
    preflight.resourceErrors.length === 0 &&
    preflight.transcriptFileCount > 0 && preflight.zhihuFileCount > 0,
  `transcript=${preflight?.transcriptFileCount} zhihu=${preflight?.zhihuFileCount}`
);
add(
  "紧凑预检不输出完整原文或完整目录列表",
  preflight !== null &&
    preflightNoQuery.stdout.length < 400 &&
    absent(preflightNoQuery.stdout, "## ", "--- lines", ".md\"", "snippets", "results") &&
    !Array.isArray(preflight.resourceErrors.find((e) => typeof e !== "string")),
  `stdout 长度=${preflightNoQuery.stdout.length}`
);
const preflightQuery = spawnSync(process.execPath, [PREFLIGHT, "--query", "地方债"], {
  cwd: REPO, encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: 120_000,
});
let withQuery = null;
try { withQuery = JSON.parse(preflightQuery.stdout); } catch { withQuery = null; }
add(
  "可选测试查询仍只返回紧凑统计，且回读校验为真",
  preflightQuery.status === 0 && withQuery !== null &&
    withQuery.retrieverExitCode === 0 && withQuery.scanned > 0 &&
    typeof withQuery.totalHits === "number" && typeof withQuery.returned === "number" &&
    withQuery.readbackVerified === true && preflightQuery.stdout.length < 400,
  `scanned=${withQuery?.scanned} totalHits=${withQuery?.totalHits} returned=${withQuery?.returned}`
);

// 4. Evidence pack template fields.
add(
  "证据包模板包含来源路径、行号、短引文和归因标签",
  has(template, "文件路径", "行号", "短引文", "归因标签", "节目明确观点", "官方账号补充",
    "当前事实", "基于节目框架的推演", "本助手补充判断", "来源清单")
);
add(
  "证据包模板不鼓励复制整篇检索结果",
  has(template, "不要粘贴整篇检索结果", "不超过 80 字短引文") &&
    absent(template, "粘贴整篇文稿到此处", "复制完整 JSON 报告")
);
add(
  "模板字段只包含约定的 10 类信息，无 task-id/生命周期字段",
  has(template, "## 新闻事件与日期", "## 政策、法律和数据", "## 反方意见", "## 事实不确定项", "## 方案约束") &&
    absent(template, "task-id", "生命周期", "断点续跑规则")
);

// 5. Validator still defaults to a compact summary.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "low-context-v1-"));
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
const FILLERS = [
  "相关单位需要把基础台账核对清楚，并按季度更新记录，保证每个环节都有凭证可查。",
  "基层执行人员应当保留原始单据，方便后续抽查与复核，减少口径不一致的情况。",
  "财政安排要与项目进度匹配，先确定经费渠道，再明确拨付节奏和监督方式。",
  "对公众关切的事项，应当给出可查询的时间表和责任人，降低信息不对称带来的误判。",
  "评估工作需要同时观察短期变化和长期趋势，不能只凭单一月份的波动下结论。",
  "试点范围内的商户与居民可以提交意见，汇总后由工作组逐条回应并公开处理结果。",
  "跨部门协作要写清交接节点，避免材料在某个环节停留过久而影响整体进度。",
  "公开数据应当标明统计口径和采集时点，便于外部复核，也便于内部对照。",
];
const STAGES = {
  "sepia_review_1.md": "诊断：第2段存在重复表述。\n问题原句：按季度更新记录。\n位置：第2段第3句。\n修复计划：合并重复句。",
  "sepia_refactor.md": "修改项：合并第2段重复表述。\n修改后的完整正文见同目录 final_draft.md。\n修改记录：共1处。",
  "sepia_review_2.md": "已修复项：重复表述。\n剩余问题：无。\n位置：第2段。\n是否通过：通过。",
};
const nws = (text) => [...text].filter((c) => !/\s/u.test(c)).length;
const parts = [...SOLUTION_SENTENCES];
let i = 0;
while (nws(parts.join("\n\n")) < 3800) {
  parts.push(`第${i + 1}项记录显示，${FILLERS[i % FILLERS.length]}`);
  i += 1;
  if (i > 500) break;
}
const body = parts.join("\n\n");
const QUOTES = [
  ...SOLUTION_SENTENCES,
  "按季度更新记录", "保留原始单据", "标明统计口径和采集时点",
];
const audit = {
  scores: DIMENSIONS.map((name, di) => ({
    name,
    declaredScore: 10,
    checkpoints: Array.from({ length: 10 }, (_, ci) => ({
      result: true,
      location: `第 ${di + 1} 段`,
      quote: QUOTES[(di + ci) % QUOTES.length],
      reason: "检查点通过，证据引自终稿正文",
    })),
  })),
  solutionElements: Object.fromEntries(SOLUTION_KEYS.map((key, k) => [key, { evidence: SOLUTION_SENTENCES[k] }])),
  averageScore: 10,
  remainingIssues: "无",
};
const dir = path.join(root, "fixture");
fs.mkdirSync(dir, { recursive: true });
const draft = path.join(dir, "final_draft.md");
const auditPath = path.join(dir, "final_audit.json");
fs.writeFileSync(draft, `${body}\n`, "utf8");
fs.writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
for (const [name, content] of Object.entries(STAGES)) {
  fs.writeFileSync(path.join(dir, name), `${content}\n`, "utf8");
}
const validatorDefault = spawnSync(process.execPath, [VALIDATOR, draft, auditPath], {
  cwd: REPO, encoding: "utf8", maxBuffer: 4 * 1024 * 1024,
});
add(
  "最终验证器仍默认只输出摘要，完整报告落盘",
  validatorDefault.status === 0 &&
    has(validatorDefault.stdout, "pass: true", "正文字数:", "平均评分:", "违规数量:", "完整报告:") &&
    absent(validatorDefault.stdout, '"violations"', '"schemaVersion"') &&
    fs.existsSync(path.join(dir, "final_validation.json")),
  `stdout 首行=${validatorDefault.stdout.split("\n")[0]}`
);

// 6. Existing validator hard-gate suite still passes.
const existing = spawnSync(process.execPath, [path.join(REPO, "tests", "validate_final_draft.test.mjs")], {
  cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024,
});
add(
  "原有验证器硬门测试继续 9/9 通过",
  existing.status === 0 && /总判定：全部通过/u.test(existing.stdout ?? "") &&
    (existing.stdout.match(/判定：OK/g) ?? []).length === 9,
  `OK 数=${(existing.stdout.match(/判定：OK/g) ?? []).length}`
);

// README usage notes.
add(
  "README 低上下文使用说明覆盖 7 条要点",
  has(readme, "不要重复粘贴完整 `SKILL.md`", "不要在同一个会话连续处理多篇新闻", "每篇新闻使用一个**全新会话**",
    "保存到本次任务的 `outputs/` 目录", "会话中只显示阶段摘要", "优先用 checkpoint 新建会话",
    "累计缓存 Token", "真实 A/B 测试")
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

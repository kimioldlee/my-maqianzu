#!/usr/bin/env node

/**
 * Fixture-based tests for scripts/validate_final_draft.mjs.
 *
 * Run: node tests/validate_final_draft.test.mjs
 * Each case builds its own temp workspace, runs the real validator and
 * asserts the exit code plus key recomputed JSON fields.
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

function buildBody(targetNonWs, extras = [], exact = false) {
  const parts = [...SOLUTION_SENTENCES];
  let i = 0;
  while (nonWhitespaceCount(parts.join("\n\n")) < targetNonWs) {
    parts.push(`第${i + 1}项记录显示，${FILLERS[i % FILLERS.length]}`);
    i += 1;
    if (i > 500) break;
  }
  let body = [...parts, ...extras].join("\n\n");
  if (exact) {
    let chars = [...body];
    while (nonWhitespaceCount(chars.join("")) > targetNonWs && chars.length) {
      const last = chars.pop();
      if (last && /\s/u.test(last)) continue;
    }
    body = chars.join("");
  }
  return body;
}

function buildAudit(mutate = () => {}) {
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

function writeFixture(dir, { body, audit, stages }) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "final_draft.md"), `${body}\n`, "utf8");
  fs.writeFileSync(path.join(dir, "final_audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  const stageContents = { ...STAGE_FILES, ...(stages ?? {}) };
  for (const [name, content] of Object.entries(stageContents)) {
    fs.writeFileSync(path.join(dir, name), `${content}\n`, "utf8");
  }
}

function runValidator(dir) {
  const draft = path.join(dir, "final_draft.md");
  const audit = path.join(dir, "final_audit.json");
  const command = `node ${path.relative(REPO, VALIDATOR).replace(/\\/g, "/")} "${draft}" "${audit}" --json`;
  const result = spawnSync(process.execPath, [VALIDATOR, draft, audit, "--json"], {
    cwd: REPO,
    encoding: "utf8",
  });
  let payload = null;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    payload = { parseError: result.stdout, stderr: result.stderr };
  }
  return { command, status: result.status, payload, stderr: result.stderr };
}

const cases = [
  {
    name: "1. 正文实际1878字但审计声称3500字",
    fixture: () => ({ body: buildBody(1878, [], true), audit: buildAudit() }),
    expectPass: false,
    assert: (p) => p.nonWhitespaceChars < 3000 && p.violations.some((v) => v.includes("3000 至 5000")),
    key: (p) => `nonWhitespaceChars=${p.nonWhitespaceChars}, auditReported.bodyChars=${p.auditReported.bodyChars}`,
  },
  {
    name: "2. 正文含两个『——』共4个破折号字符",
    fixture: () => ({ body: buildBody(3800, ["——补充观察——"]), audit: buildAudit() }),
    expectPass: false,
    assert: (p) => p.dashCount === 4 && p.dashGroupCount === 2,
    key: (p) => `dashCount=${p.dashCount}, dashGroupCount=${p.dashGroupCount}`,
  },
  {
    name: "3. 正文含『同上第1部分，共3500字』",
    fixture: () => ({ body: buildBody(3800, ["同上第1部分，共3500字"]), audit: buildAudit() }),
    expectPass: false,
    assert: (p) => p.placeholderCount >= 1,
    key: (p) => `placeholderCount=${p.placeholderCount}`,
  },
  {
    name: "4. 衡量指标与退出条件只有『隐含存在』",
    fixture: () => ({
      body: buildBody(3800),
      audit: buildAudit((a) => {
        a.solutionElements["衡量指标"] = { evidence: "隐含存在" };
        a.solutionElements["停止或退出条件"] = { evidence: "隐含存在" };
      }),
    }),
    expectPass: false,
    assert: (p) => !p.solutionElements["衡量指标"].pass && !p.solutionElements["停止或退出条件"].pass,
    key: (p) => `衡量指标.pass=${p.solutionElements["衡量指标"].pass}, 停止或退出条件.pass=${p.solutionElements["停止或退出条件"].pass}`,
  },
  {
    name: "5. 10个检查点全true但申报分数写9.0",
    fixture: () => ({
      body: buildBody(3800),
      audit: buildAudit((a) => { a.scores[0].declaredScore = 9.0; }),
    }),
    expectPass: false,
    assert: (p) => p.scoreMismatches.some((m) => m.dimension === DIMENSIONS[0] && m.recomputed === 10 && m.declared === 9),
    key: (p) => `${DIMENSIONS[0]} 重算=${p.scoresRecomputed[DIMENSIONS[0]]}, 申报=${p.declaredScores[DIMENSIONS[0]]}`,
  },
  {
    name: "6. 正文含节目名与『第342期』",
    fixture: () => ({ body: buildBody(3800, ["《睡前消息》第342期的内容可供参考。"]), audit: buildAudit() }),
    expectPass: false,
    assert: (p) => p.programNameCount >= 1 && p.episodeReferenceCount >= 1,
    key: (p) => `programNameCount=${p.programNameCount}, episodeReferenceCount=${p.episodeReferenceCount}`,
  },
  {
    name: "7. Sepia阶段文件只有启动提示/等待结果",
    fixture: () => ({
      body: buildBody(3800),
      audit: buildAudit(),
      stages: {
        "sepia_review_1.md": "Launching skill\nLoaded a skill\nGot the result\nWaiting for execution result",
      },
    }),
    expectPass: false,
    assert: (p) => p.stageFiles["sepia_review_1.md"].pass === false,
    key: (p) => `sepia_review_1.md.pass=${p.stageFiles["sepia_review_1.md"].pass}`,
  },
  {
    name: "8. 满足全部硬门的正常夹具",
    fixture: () => ({ body: buildBody(3800), audit: buildAudit() }),
    expectPass: true,
    assert: (p) =>
      p.exitCode === 0 &&
      p.pass === true &&
      p.nonWhitespaceChars >= 3000 &&
      p.nonWhitespaceChars <= 5000 &&
      DIMENSIONS.every((d) => p.scoresRecomputed[d] >= 9) &&
      p.averageScore === 10,
    key: (p) => `nonWhitespaceChars=${p.nonWhitespaceChars}, averageScore=${p.averageScore}, violations=${p.violations.length}`,
  },
  {
    name: "9.（附加）申报分数9.3不是二元检查点可得的整数",
    fixture: () => ({
      body: buildBody(3800),
      audit: buildAudit((a) => { a.scores[0].declaredScore = 9.3; }),
    }),
    expectPass: false,
    assert: (p) => p.violations.some((v) => v.includes("不是 0 至 10 的整数")),
    key: (p) => `${DIMENSIONS[0]} 申报=${p.declaredScores[DIMENSIONS[0]]}`,
  },
];

let allOk = true;
const root = fs.mkdtempSync(path.join(os.tmpdir(), "final-draft-tests-"));
console.log(`测试夹具根目录：${root}\n`);
for (const testCase of cases) {
  const dir = path.join(root, testCase.name.replace(/[^\w\u4e00-\u9fa5]+/g, "_").slice(0, 40));
  const fixture = testCase.fixture();
  writeFixture(dir, fixture);
  const run = runValidator(dir);
  const payload = run.payload;
  const actualPass = payload?.pass === true;
  const assertionsOk =
    actualPass === testCase.expectPass &&
    run.status === (testCase.expectPass ? 0 : 1) &&
    testCase.assert(payload);
  if (!assertionsOk) allOk = false;
  console.log(`=== ${testCase.name} ===`);
  console.log(`命令：${run.command}`);
  console.log(`退出码：${run.status}（期望 ${testCase.expectPass ? 0 : "非0"}）  pass=${actualPass}（期望 ${testCase.expectPass}）`);
  console.log(`关键结果：${testCase.key(payload)}`);
  console.log(`violations：${(payload?.violations ?? [payload?.parseError]).slice(0, 3).join(" | ")}`);
  console.log(`判定：${assertionsOk ? "OK" : "FAIL"}\n`);
}

console.log(`总判定：${allOk ? "全部通过" : "存在失败用例"}`);
process.exitCode = allOk ? 0 : 1;

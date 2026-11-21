#!/usr/bin/env node

/**
 * Deterministic final-draft validator for madugong-perspective.
 *
 * Usage:
 *   node scripts/validate_final_draft.mjs <final_draft.md> <final_audit.json> [--json] [--output <file>] [--no-write]
 *
 * The validator always derives every statistic from the real file contents.
 * Numbers declared inside the draft or the audit JSON are reported for
 * transparency but are NEVER trusted for gating. JSON is always printed to
 * stdout and, unless --no-write is given, also written to
 * <draft-dir>/final_validation.json. The compatibility --output option is
 * accepted only when it resolves to that exact task-scoped file.
 */

import fs from "node:fs";
import path from "node:path";

const QUALITY_GATES = [
  "事实与归因",
  "因果与边界",
  "多方约束",
  "可执行方案",
  "口播与去模板",
  "反驳与风险",
];

const SOLUTION_KEYS = [
  "执行主体",
  "权限或资金来源",
  "受影响方及补偿",
  "试点或过渡安排",
  "衡量指标",
  "停止或退出条件",
];

const DASH_CHAR = /[\u2014\u2013\uFF0D\u2015]/gu; // —  –  －  ―
const DASH_RUN = /[\u2014\u2013\uFF0D\u2015]+/gu;

const PLACEHOLDERS = [
  "同上",
  "见前文",
  "见上文",
  "内容略",
  "此处省略",
  "[同上]",
  "（略）",
  "(略)",
  "略去",
  "此处从略",
];

const SOURCE_META_PHRASES = [
  "据《睡前消息》",
  "据睡前消息",
  "据节目",
  "据该节目",
  "据某节目",
  "据节目组",
  "据某回答",
  "据回答",
  "据知乎",
  "据官方账号",
  "据某节目/某回答所说",
  "节目第",
  "该节目",
  "节目明确观点",
  "官方账号对当下事件",
  "官方账号补充",
  "知乎回答",
  "节目原文",
  "来源前缀",
  "来源：",
  "来源:",
  "所说",
];

const NON_BODY_MARKERS = [
  "评分表",
  "可审计评分",
  "验证记录",
  "核查附录",
  "bodyChars",
  "nonWhitespaceChars",
  "violations",
];

const LAUNCHER_LINE = /^(Launching skill|Loaded a skill|Got the result|SKILL\.md 已加载)/i;
const FORBIDDEN_STAGE_PHRASES = [
  "等待执行结果",
  "Waiting for execution result",
  "等待后台",
  "等待异步",
  "等待结果",
  "waiting for result",
];

const TEMPLATE_PATTERNS = [
  { name: "不是…而是…", re: /不是[^。！？；\n]{0,40}而是/g },
  { name: "这一层/下一层", re: /这一层|下一层/g },
  { name: "拆开看", re: /拆开看/g },
  { name: "第一第二第三", re: /第一[、，,]?[^。！？\n]{0,24}第二[^。！？\n]{0,24}第三/g },
  { name: "为什么…因为", re: /为什么[^。！？\n]{0,30}因为/g },
  { name: "这就是/这说明堆叠", re: /这就是|这说明/g },
  { name: "三条路", re: /三条路/g },
];

const GENERIC_EVIDENCE = [
  "隐含存在",
  "见评分表",
  "见上表",
  "同上",
  "已包含",
  "见正文",
  "N/A",
  "无",
  "略",
];

function parseArgs(argv) {
  const positionals = [];
  const unknown = [];
  let output = null;
  let noWrite = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json") continue; // JSON is always printed; flag kept for compatibility
    if (arg === "--no-write") noWrite = true;
    else if (arg === "--output") output = argv[++i] ?? null;
    else if (arg.startsWith("--")) unknown.push(arg);
    else positionals.push(arg);
  }
  return { draftPath: positionals[0], auditPath: positionals[1], output, noWrite, unknown };
}

function matchesOf(text, regex) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  const out = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    out.push({ index: match.index, match: match[0] });
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return out;
}

function lineColumn(text, index) {
  const before = text.slice(0, index);
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function hit(text, item) {
  const pos = lineColumn(text, item.index);
  return { index: item.index, line: pos.line, column: pos.column, match: item.match };
}

function countHits(text, phrases) {
  let total = 0;
  const hits = [];
  for (const phrase of phrases) {
    const found = matchesOf(text, new RegExp(escapeRegExp(phrase), "g"));
    total += found.length;
    for (const item of found) hits.push({ phrase, ...hit(text, item) });
  }
  return { total, hits };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nonWhitespaceCount(text) {
  let count = 0;
  for (const char of text) if (!/\s/u.test(char)) count += 1;
  return count;
}

function repetitionStats(body) {
  const sentences = body
    .split(/[。！？\n]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10);

  const seen = new Map();
  for (const sentence of sentences) seen.set(sentence, (seen.get(sentence) ?? 0) + 1);
  const duplicateSentences = [...seen.entries()]
    .filter(([, count]) => count > 1)
    .map(([sentence, count]) => ({ sentence: sentence.slice(0, 80), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const bigrams = (s) => {
    const set = new Set();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const nearDuplicatePairs = [];
  const sets = sentences.map(bigrams);
  for (let i = 0; i < sentences.length; i += 1) {
    for (let j = i + 1; j < sentences.length; j += 1) {
      const a = sets[i];
      const b = sets[j];
      if (!a.size || !b.size) continue;
      let intersection = 0;
      for (const gram of a) if (b.has(gram)) intersection += 1;
      const similarity = intersection / (a.size + b.size - intersection);
      if (similarity >= 0.8) {
        nearDuplicatePairs.push({
          a: sentences[i].slice(0, 60),
          b: sentences[j].slice(0, 60),
          similarity: Number(similarity.toFixed(3)),
        });
        if (nearDuplicatePairs.length >= 20) break;
      }
    }
    if (nearDuplicatePairs.length >= 20) break;
  }

  const grams = new Map();
  for (const size of [2, 3, 4]) {
    for (let i = 0; i + size <= body.length; i += 1) {
      const gram = body.slice(i, i + size);
      if (!/^[\u4e00-\u9fa5]+$/u.test(gram)) continue;
      grams.set(gram, (grams.get(gram) ?? 0) + 1);
    }
  }
  const topTerms = [...grams.entries()]
    .filter(([term, count]) => term.length >= 2 && count >= 3)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 25)
    .map(([term, count]) => ({ term, count }));

  return {
    sentenceCount: sentences.length,
    duplicateSentences,
    nearDuplicatePairs,
    topTerms,
    note: "供语义去重复核，不作为硬门计数",
  };
}

function checkStageFile(filePath, kind) {
  const status = {
    file: path.basename(filePath),
    exists: false,
    nonEmpty: false,
    meaningfulChars: 0,
    launcherOnly: false,
    forbiddenPhrases: [],
    missingMarkers: [],
    violations: [],
    pass: false,
  };
  if (!fs.existsSync(filePath)) {
    status.violations.push("阶段文件缺失");
    return status;
  }
  status.exists = true;
  const text = fs.readFileSync(filePath, "utf8");
  status.nonEmpty = text.trim().length > 0;

  for (const phrase of FORBIDDEN_STAGE_PHRASES) {
    if (text.includes(phrase)) status.forbiddenPhrases.push(phrase);
  }
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const meaningful = lines.filter((line) => !LAUNCHER_LINE.test(line)).join("\n");
  status.meaningfulChars = nonWhitespaceCount(meaningful);
  status.launcherOnly = meaningful.trim().length === 0;

  if (!status.nonEmpty) status.violations.push("阶段文件为空");
  if (status.launcherOnly) status.violations.push("阶段文件只有技能启动/加载确认");
  if (status.forbiddenPhrases.length) {
    status.violations.push(`阶段文件含禁止文字：${status.forbiddenPhrases.join("、")}`);
  }
  if (status.meaningfulChars < 20) status.violations.push("阶段文件有效内容不足 20 字");

  if (kind === "review1") {
    const markers = ["诊断", "问题", "原句", "位置", "行号"];
    const found = markers.filter((marker) => text.includes(marker));
    if (found.length < 2) {
      status.missingMarkers.push("具体诊断要素（至少含 诊断/问题/原句/位置/行号 中的两项）");
    }
  }
  if (kind === "refactor") {
    if (!text.includes("修改")) status.missingMarkers.push("修改项记录");
    const pointsToDraft = text.includes("final_draft.md");
    const hasFullBody = status.meaningfulChars >= 1000;
    if (!pointsToDraft && !hasFullBody) {
      status.violations.push("sepia_refactor.md 既未指向 final_draft.md，也未包含完整修改稿");
    }
  }
  if (kind === "review2") {
    if (!text.includes("已修复")) status.missingMarkers.push("已修复项");
    if (!/剩余|通过|未通过|不通过/u.test(text)) status.missingMarkers.push("剩余问题/是否通过");
    if (!/位置|行号|段落|第/u.test(text)) status.missingMarkers.push("对应位置");
  }
  if (status.missingMarkers.length) {
    status.violations.push(`阶段文件缺少必需内容：${status.missingMarkers.join("、")}`);
  }
  status.pass = status.violations.length === 0;
  return status;
}

function normalizeQualityGates(audit) {
  const raw = audit?.qualityGates ?? audit?.质量门 ?? {};
  const map = new Map();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const name = item.name ?? item.dimension ?? item.维度 ?? item.key;
      if (name) map.set(String(name), item);
    }
  } else if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) map.set(key, value);
  }
  return map;
}

function validate(draftPath, auditPath, violations) {
  const body = fs.readFileSync(draftPath, "utf8");
  const auditRaw = fs.readFileSync(auditPath, "utf8");
  let audit;
  try {
    audit = JSON.parse(auditRaw);
  } catch (error) {
    violations.push(`final_audit.json 不是合法 JSON：${error.message}`);
    audit = {};
  }

  const bodyChars = body.length;
  const nonWhitespaceChars = nonWhitespaceCount(body);
  if (nonWhitespaceChars < 3000 || nonWhitespaceChars > 5000) {
    violations.push(`正文非空白字符数 ${nonWhitespaceChars}，不在 3000 至 5000 之间`);
  }

  const dashFound = matchesOf(body, DASH_CHAR);
  const dashRuns = matchesOf(body, DASH_RUN);
  const dashCount = dashFound.length;
  const dashHits = dashFound.slice(0, 200).map((item) => ({ ...hit(body, item), char: item.match }));
  if (dashCount !== 0) violations.push(`正文破折号字符 ${dashCount} 个，硬门要求为 0`);

  const programHits = matchesOf(body, /睡前消息/g);
  const programNameCount = programHits.length;
  if (programNameCount !== 0) violations.push(`正文节目名命中 ${programNameCount} 次，硬门要求为 0`);

  const episodeHits = matchesOf(body, /第\s*[0-9零一二三四五六七八九十百千〇两]+\s*期/g);
  const episodeReferenceCount = episodeHits.length;
  if (episodeReferenceCount !== 0) violations.push(`正文节目期数命中 ${episodeReferenceCount} 次，硬门要求为 0`);

  const sourceMeta = countHits(body, SOURCE_META_PHRASES);
  const sourceMetaCount = sourceMeta.total;
  if (sourceMetaCount !== 0) violations.push(`正文来源前缀/元话语命中 ${sourceMetaCount} 次，硬门要求为 0`);

  const placeholders = countHits(body, PLACEHOLDERS);
  const placeholderCount = placeholders.total;
  if (placeholderCount !== 0) violations.push(`正文占位符命中 ${placeholderCount} 次，硬门要求为 0`);

  const mdLinks = matchesOf(body, /\[[^\]]*\]\([^)]*\)/g);
  const urls = matchesOf(body, /https?:\/\//g);
  const linkCount = mdLinks.length + urls.length;
  if (linkCount !== 0) violations.push(`正文含链接 ${linkCount} 处，final_draft.md 必须保存完整正文`);

  for (const marker of NON_BODY_MARKERS) {
    if (body.includes(marker)) violations.push(`final_draft.md 混入非正文内容：${marker}`);
  }

  const templateHits = TEMPLATE_PATTERNS.map(({ name, re }) => {
    const found = matchesOf(body, re);
    return {
      name,
      pattern: re.source,
      threshold: 0,
      count: found.length,
      hits: found.slice(0, 50).map((item) => hit(body, item)),
    };
  });
  for (const template of templateHits) {
    if (template.count > 0) {
      violations.push(`模板句「${template.name}」命中 ${template.count} 次（阈值 ${template.threshold}，不得静默忽略）`);
    }
  }

  // Solution elements: audit must quote real sentences out of the draft.
  const solutionElements = {};
  const rawElements = audit?.solutionElements ?? audit?.方案六要素 ?? {};
  for (const key of SOLUTION_KEYS) {
    const item = rawElements?.[key];
    let evidence = "";
    if (typeof item === "string") evidence = item;
    else if (item && typeof item === "object") evidence = item.evidence ?? item.原句 ?? item.quote ?? "";
    const declaredEvidence = String(evidence ?? "");
    const trimmed = declaredEvidence.trim();
    const reasons = [];
    if (!trimmed) reasons.push("缺少正文原句证据");
    if (GENERIC_EVIDENCE.some((generic) => trimmed === generic || trimmed.includes("隐含"))) {
      reasons.push("只有『隐含存在』一类判断，不是正文证据");
    }
    if (trimmed && nonWhitespaceCount(trimmed) < 8) reasons.push("证据过短，不足以定位正文");
    const evidenceFound = trimmed.length > 0 && body.includes(trimmed);
    if (trimmed && !evidenceFound) reasons.push("证据未原样出现在 final_draft.md");
    if (PLACEHOLDERS.some((p) => trimmed.includes(p))) reasons.push("证据含占位符");
    if (reasons.length) violations.push(`方案六要素「${key}」不合格：${reasons.join("；")}`);
    solutionElements[key] = {
      declaredEvidence: trimmed,
      evidenceFound,
      pass: reasons.length === 0,
      reasons,
    };
  }

  // Six evidence-backed quality gates. These are pass/fail claims, not scores.
  const gateMap = normalizeQualityGates(audit);
  const qualityGates = {};
  for (const gate of QUALITY_GATES) {
    const entry = gateMap.get(gate);
    const reasons = [];
    if (!entry || typeof entry !== "object") {
      reasons.push("缺少质量门记录");
      qualityGates[gate] = { declaredPass: null, evidence: "", evidenceFound: false, pass: false, reasons };
      violations.push(`质量门「${gate}」不合格：${reasons.join("；")}`);
      continue;
    }

    const declaredPass = entry.pass ?? entry.result ?? entry.通过;
    const evidence = String(entry.evidence ?? entry.正文证据 ?? entry.证据 ?? "").trim();
    const reason = String(entry.reason ?? entry.失败原因 ?? "").trim();
    if (typeof declaredPass !== "boolean") reasons.push("pass 必须是布尔值");
    if (declaredPass !== true) reasons.push("质量门未通过");
    if (!evidence) reasons.push("通过项缺少正文证据");
    if (evidence && nonWhitespaceCount(evidence) < 4) reasons.push("证据过短，不足以定位正文");
    const evidenceFound = evidence.length > 0 && body.includes(evidence);
    const locationReference = /第\s*\d+\s*[段句行]/u.test(evidence);
    if (evidence && !evidenceFound && !locationReference) reasons.push("证据未出现在正文，也不是明确位置引用");
    if (declaredPass === false && !reason) reasons.push("失败项缺少具体原因");
    if (PLACEHOLDERS.some((p) => evidence.includes(p))) reasons.push("证据含占位符");

    if (reasons.length) violations.push(`质量门「${gate}」不合格：${reasons.join("；")}`);
    qualityGates[gate] = {
      declaredPass: typeof declaredPass === "boolean" ? declaredPass : null,
      evidence,
      evidenceFound,
      locationReference,
      reason,
      pass: reasons.length === 0,
      reasons,
    };
  }

  const remainingIssues = audit?.remainingIssues ?? audit?.剩余问题 ?? null;
  const hasRemaining =
    (Array.isArray(remainingIssues) && remainingIssues.length > 0) ||
    (typeof remainingIssues === "string" && !/^(无|none|无剩余问题)$/iu.test(remainingIssues.trim()));
  if (hasRemaining) violations.push("审计文件声明存在剩余问题，不允许总体通过");

  // Sepia stage files and the audit/draft files themselves.
  const stageDir = path.dirname(path.resolve(draftPath));
  const stageFiles = {};
  const stageSpecs = [
    ["sepia_review_1.md", "review1"],
    ["sepia_refactor.md", "refactor"],
    ["sepia_review_2.md", "review2"],
  ];
  for (const [file, kind] of stageSpecs) {
    const status = checkStageFile(path.join(stageDir, file), kind);
    stageFiles[file] = status;
    for (const message of status.violations) violations.push(`${file}：${message}`);
  }
  stageFiles["final_draft.md"] = {
    file: "final_draft.md",
    exists: true,
    nonEmpty: body.trim().length > 0,
    pass: body.trim().length > 0,
    violations: body.trim().length > 0 ? [] : ["final_draft.md 为空"],
  };
  stageFiles["final_audit.json"] = {
    file: "final_audit.json",
    exists: true,
    nonEmpty: auditRaw.trim().length > 0,
    pass: Object.keys(audit ?? {}).length > 0,
    violations: Object.keys(audit ?? {}).length > 0 ? [] : ["final_audit.json 为空对象"],
  };

  const auditReported = {
    bodyChars: audit?.bodyChars ?? audit?.reported?.bodyChars ?? audit?.summary?.bodyChars ?? null,
    nonWhitespaceChars: audit?.nonWhitespaceChars ?? audit?.reported?.nonWhitespaceChars ?? null,
    dashCount: audit?.dashCount ?? audit?.reported?.dashCount ?? null,
    note: "以上数字仅用于对照，硬门一律由验证器从文件真实内容重新计算",
  };

  return {
    bodyChars,
    nonWhitespaceChars,
    dashCount,
    dashGroupCount: dashRuns.length,
    dashHits,
    programNameCount,
    programNameHits: programHits.slice(0, 50).map((item) => hit(body, item)),
    episodeReferenceCount,
    episodeReferenceHits: episodeHits.slice(0, 50).map((item) => hit(body, item)),
    sourceMetaCount,
    sourceMetaHits: sourceMeta.hits.slice(0, 100),
    placeholderCount,
    placeholderHits: placeholders.hits.slice(0, 100),
    linkCount,
    linkHits: [...mdLinks, ...urls].slice(0, 100).map((item) => hit(body, item)),
    templateHits,
    repetitionStats: repetitionStats(body),
    solutionElements,
    qualityGates,
    qualityGatePassCount: QUALITY_GATES.filter((gate) => qualityGates[gate]?.pass).length,
    stageFiles,
    auditReported,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let { draftPath, auditPath } = args;
  const { output, noWrite, unknown } = args;
  const violations = [];
  for (const option of unknown) violations.push(`未知参数：${option}`);

  let result;
  if (!draftPath || !auditPath) {
    violations.push("用法：node scripts/validate_final_draft.mjs <final_draft.md> <final_audit.json> [--json] [--output <file>] [--no-write]");
    result = { violations };
  } else if (!fs.existsSync(draftPath)) {
    violations.push(`找不到 final_draft.md：${draftPath}`);
    result = { violations };
  } else if (!fs.existsSync(auditPath)) {
    violations.push(`找不到 final_audit.json：${auditPath}`);
    result = { violations };
  } else {
    draftPath = fs.realpathSync.native(path.resolve(draftPath));
    auditPath = fs.realpathSync.native(path.resolve(auditPath));
    const taskDir = path.dirname(draftPath);
    if (path.basename(draftPath) !== "final_draft.md") violations.push("稿件文件名必须是 final_draft.md");
    if (path.basename(auditPath) !== "final_audit.json") violations.push("审计文件名必须是 final_audit.json");
    if (path.dirname(auditPath) !== taskDir) violations.push("final_audit.json 必须与 final_draft.md 位于同一任务目录");

    const defaultOutput = path.join(taskDir, "final_validation.json");
    let outputPath = defaultOutput;
    if (output) {
      try {
        const requested = path.resolve(output);
        const requestedPath = path.join(
          fs.realpathSync.native(path.dirname(requested)),
          path.basename(requested),
        );
        if (requestedPath !== defaultOutput) {
          violations.push("--output 只能指向稿件同目录的 final_validation.json");
          outputPath = null;
        }
      } catch {
        violations.push("--output 的父目录不存在或不可访问");
        outputPath = null;
      }
    }
    if (!noWrite && outputPath && fs.existsSync(outputPath)) {
      const outputStat = fs.lstatSync(outputPath);
      if (outputStat.isSymbolicLink()) {
        violations.push("拒绝通过符号链接写入 final_validation.json");
        outputPath = null;
      } else if (!outputStat.isFile()) {
        violations.push("final_validation.json 必须是普通文件");
        outputPath = null;
      } else if (outputStat.nlink > 1) {
        violations.push("拒绝覆盖存在硬链接的 final_validation.json");
        outputPath = null;
      }
    }
    result = {
      ...validate(draftPath, auditPath, violations),
      validationOutputPath: noWrite ? null : outputPath,
    };
  }

  result.violations = violations;
  result.pass = violations.length === 0;
  result.exitCode = result.pass ? 0 : 1;
  const payload = {
    schemaVersion: 1,
    validator: "validate_final_draft.mjs",
    generatedAt: new Date().toISOString(),
    draftPath: draftPath ?? null,
    auditPath: auditPath ?? null,
    ...result,
  };
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  process.stdout.write(json);
  if (!noWrite && payload.validationOutputPath) {
    const target = payload.validationOutputPath;
    const tempTarget = path.join(
      path.dirname(target),
      `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`,
    );
    try {
      fs.writeFileSync(tempTarget, json, { encoding: "utf8", flag: "wx", mode: 0o600 });
      fs.renameSync(tempTarget, target);
    } finally {
      if (fs.existsSync(tempTarget)) fs.rmSync(tempTarget, { force: true });
    }
  }
  process.exitCode = payload.exitCode;
}

main();

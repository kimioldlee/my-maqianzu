#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [indexPath, outputPath] = process.argv.slice(2);
if (!indexPath || !outputPath) {
  console.error("Usage: node generate_corpus_digest.mjs <index-json> <output-md>");
  process.exit(1);
}

function readRegularFile(filePath, label) {
  const resolved = path.resolve(filePath);
  const target = fs.lstatSync(resolved);
  if (!target.isFile() || target.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file: ${resolved}`);
  }
  return fs.readFileSync(resolved, "utf8");
}

function writeAtomic(filePath, content) {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  if (fs.existsSync(resolved)) {
    const target = fs.lstatSync(resolved);
    if (!target.isFile() || target.isSymbolicLink() || target.nlink !== 1) {
      throw new Error(`Output must be a regular single-link file: ${resolved}`);
    }
  }
  const temporary = path.join(
    path.dirname(resolved),
    `.${path.basename(resolved)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, resolved);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

const index = JSON.parse(readRegularFile(indexPath, "Index input"));
if (!Array.isArray(index.episodes) || !Array.isArray(index.supplements) || typeof index.coverage !== "object" || index.coverage === null) {
  throw new Error("Index input is missing required episodes, supplements, or coverage fields.");
}
const documents = [...index.episodes, ...index.supplements];
const clean = (value = "") => String(value).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const list = (values = []) => values.map(clean).filter(Boolean).join("、") || "-";
const flags = (value = {}) => [
  value.corrections ? "订正" : "",
  value.verified ? "已核对" : "",
  value.pending ? "待核对" : "",
].filter(Boolean).join("/") || "无附录标记";

documents.sort((left, right) => {
  const leftNumber = left.episode ? Number(left.episode) : Number.POSITIVE_INFINITY;
  const rightNumber = right.episode ? Number(right.episode) : Number.POSITIVE_INFINITY;
  return leftNumber - rightNumber || left.path.localeCompare(right.path);
});

const lines = [
  "# 《睡前消息》全量语料离线摘要",
  "",
  `> 由 \`bedtime-transcript-index.json\` 生成。它覆盖现有 ${documents.length} 篇文稿，用于离线召回和跨期比较；它不是正文替代品。回答具体事件时，若原文可用，仍须回读正文与附录。`,
  ">",
  `> 生成文稿数：${documents.length}；编号文稿：${index.episodes.length}；补充材料：${index.supplements.length}；最高编号：${index.coverage.highestEpisodeNumber}。`,
  "",
  "| 类型/期号 | 日期 | 标题 | 主题 | 章节与问题 | 跨期引用 | 附录 | 表达标记 | 开场摘要 |",
  "|---|---|---|---|---|---|---|---|---|",
];

for (const document of documents) {
  const id = document.episode ? `第${document.episode}期` : `补充:${document.supplement}`;
  const questions = document.questions?.slice(0, 4) ?? [];
  const markers = document.expressionMarkers ?? {};
  const markerText = `问${markers.questionLead ?? 0}/让步${markers.concession ?? 0}/因果${markers.causal ?? 0}/条件${markers.conditional ?? 0}/第一人称${markers.firstPerson ?? 0}/回引${markers.priorEpisode ?? 0}`;
  lines.push(`| ${clean(id)} | ${clean(document.date)} | ${clean(document.title)} | ${list(document.topics)} | ${list([...(document.sections ?? []).slice(0, 8), ...questions])} | ${list(document.referencedEpisodes)} | ${flags(document.appendixFlags)} | ${markerText} | ${clean(document.opening)} |`);
}

writeAtomic(outputPath, `${lines.join("\n")}\n`);
console.log(`Generated ${documents.length} digest rows.`);

#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [repoRoot, query] = process.argv.slice(2);

if (!repoRoot || !query) {
  console.error("Usage: node search_bedtime_transcripts.mjs <transcript-repo> <term[,term...]> [limit]");
  process.exit(1);
}

const limit = Number(process.argv[4] ?? 20);
const root = path.join(repoRoot, "contents", "ShuiQianXiaoXi");
const terms = query
  .split(",")
  .map((term) => term.trim())
  .filter(Boolean);
const sourceUrl = "https://bedtimenewsstudio.github.io/BedtimeNews-Transcripts/contents/ShuiQianXiaoXi/";

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function occurrences(text, term) {
  let count = 0;
  let from = 0;
  while (true) {
    const index = text.indexOf(term, from);
    if (index === -1) return count;
    count += 1;
    from = index + term.length;
  }
}

function snippet(text, term) {
  const index = text.indexOf(term);
  if (index === -1) return "";
  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + term.length + 220);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

const results = [];
for (const filePath of walk(root).filter((file) => {
  const name = path.basename(file);
  return /^\d{4}(?:\.\d+)?\.md$/.test(name) || (path.dirname(file) === path.join(root, "misc") && name !== "INDEX.md");
})) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!terms.every((term) => raw.includes(term))) continue;

  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const date = raw.match(/^\*\*发布日期\*\*\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? "";
  const sections = [...raw.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
  const score = terms.reduce((total, term) => {
    const titleWeight = title.includes(term) ? 12 : 0;
    const sectionWeight = sections.filter((section) => section.includes(term)).length * 6;
    return total + titleWeight + sectionWeight + occurrences(raw, term);
  }, 0);
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
  results.push({
    episode: /^\d{4}(?:\.\d+)?\.md$/.test(path.basename(filePath)) ? path.basename(filePath, ".md") : "",
    supplement: /^\d{4}(?:\.\d+)?\.md$/.test(path.basename(filePath)) ? "" : path.basename(filePath, ".md"),
    date,
    title,
    path: relativePath,
    url: `${sourceUrl}${relativePath.replace(/\.md$/, ".html")}`,
    score,
    matchedSections: sections.filter((section) => terms.some((term) => section.includes(term))),
    snippets: terms.map((term) => ({ term, text: snippet(raw, term) })).filter((item) => item.text),
  });
}

results.sort((left, right) => right.score - left.score || right.date.localeCompare(left.date));
console.log(JSON.stringify({ query: terms, total: results.length, results: results.slice(0, limit) }, null, 2));

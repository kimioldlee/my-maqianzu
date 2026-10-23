#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [answerRoot, query] = process.argv.slice(2);

if (!answerRoot || !query) {
  console.error("Usage: node search_zhihu_official_answers.mjs <answer-root> <term[,term...]> [limit]");
  process.exit(1);
}

const limit = Number(process.argv[4] ?? 20);
const terms = query.split(",").map((term) => term.trim()).filter(Boolean);
const answersRoot = path.join(answerRoot, "answers");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function frontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return {};
  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([^:]+):\s*(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key.trim(), value.trim()]),
  );
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
  return text.slice(Math.max(0, index - 100), Math.min(text.length, index + term.length + 220)).replace(/\s+/g, " ").trim();
}

const results = [];
for (const filePath of walk(answersRoot).filter((file) => path.extname(file) === ".md")) {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!terms.every((term) => raw.includes(term))) continue;
  const meta = frontMatter(raw);
  const title = meta.title ?? raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const score = terms.reduce((total, term) => total + (title.includes(term) ? 12 : 0) + occurrences(raw, term), 0);
  results.push({
    answerId: meta.answer_id ?? "",
    date: (meta.created ?? "").slice(0, 10),
    title,
    account: meta.author ?? "马前卒official（睡前消息节目组账号）",
    url: meta.url ?? "",
    path: path.relative(answerRoot, filePath).replaceAll(path.sep, "/"),
    score,
    snippets: terms.map((term) => ({ term, text: snippet(raw, term) })).filter((item) => item.text),
  });
}

results.sort((left, right) => right.score - left.score || right.date.localeCompare(left.date));
console.log(JSON.stringify({ query: terms, total: results.length, results: results.slice(0, limit) }, null, 2));

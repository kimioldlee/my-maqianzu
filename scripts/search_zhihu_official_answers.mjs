#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const answerRoot = args[0];
const query = args[1];

if (!answerRoot || !query) {
  console.error("Usage: node search_zhihu_official_answers.mjs <answer-root> <term[,term...]> [limit] [--max-chars N]");
  process.exit(1);
}

let limit = 20;
let maxChars = 12000;
for (let index = 2; index < args.length; index += 1) {
  if (/^\d+$/.test(args[index])) {
    limit = Math.max(1, Number(args[index]));
  } else if (args[index] === "--max-chars") {
    const value = Number(args[++index]);
    if (!Number.isInteger(value) || value < 1) throw new Error("--max-chars requires a positive integer.");
    maxChars = value;
  } else {
    throw new Error(`Unknown option: ${args[index]}`);
  }
}
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

function boundedJson(payload, budget) {
  let output = JSON.stringify(payload, null, 2);
  while (output.length > budget && payload.results.length) {
    const last = payload.results.at(-1);
    if (last.snippets.length) {
      const snippetItem = last.snippets.at(-1);
      if (snippetItem.text.length > 80) {
        snippetItem.text = `${snippetItem.text.slice(0, Math.max(80, Math.floor(snippetItem.text.length * 0.7)))} [TRUNCATED]`;
      } else {
        last.snippets.pop();
      }
    } else if (last.path.length > 120) {
      last.path = `${last.path.slice(0, 117)}...`;
    } else if (last.title.length > 120) {
      last.title = `${last.title.slice(0, 117)}...`;
    } else if (last.url.length > 120) {
      last.url = `${last.url.slice(0, 117)}...`;
    } else if (last.answerId || last.date || last.account) {
      last.answerId = "";
      last.date = "";
      last.account = "";
    } else {
      payload.results.pop();
    }
    output = JSON.stringify(payload, null, 2);
  }
  return output.length <= budget ? output : JSON.stringify({ query: payload.query, total: payload.total, returned: 0, maxChars: budget, results: [] });
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
const payload = {
  query: terms,
  total: results.length,
  returned: Math.min(results.length, limit),
  maxChars,
  results: results.slice(0, limit),
};
const output = boundedJson(payload, maxChars);
const parsedOutput = JSON.parse(output);
parsedOutput.returned = parsedOutput.results.length;
const finalOutput = JSON.stringify(parsedOutput, null, 2);
console.log(finalOutput.length <= maxChars ? finalOutput : JSON.stringify({ query: terms, total: results.length, returned: 0, maxChars, results: [] }));

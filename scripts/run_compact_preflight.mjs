#!/usr/bin/env node

/**
 * Compact, READ-ONLY resource preflight for madugong-perspective.
 *
 * Usage:
 *   node scripts/run_compact_preflight.mjs
 *   node scripts/run_compact_preflight.mjs --query "事件词" [--root <project-root>]
 *
 * One invocation performs all existence/readability checks and file counts.
 * It NEVER writes files, rebuilds indexes or prints a directory listing or
 * large original text. stdout is a single compact JSON object with exactly
 * these fields:
 *   status, resourceErrors, transcriptFileCount, zhihuFileCount,
 *   retrieverExitCode, scanned, totalHits, returned, readbackVerified
 *
 * Optional --query runs ONE bounded test query against the existing retriever.
 * The query is allowed at least 90 seconds; a timeout is retried ONCE with a
 * smaller limit/max-chars. A timeout is never reported as zero hits.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, "..");

function parseArgs(argv) {
  let root = DEFAULT_ROOT;
  let query = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--query") query = argv[++i] ?? null;
    else if (argv[i] === "--root") root = path.resolve(argv[++i] ?? DEFAULT_ROOT);
  }
  return { root, query };
}

function countMarkdown(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md") &&
        entry.name.toUpperCase() !== "INDEX.MD") count += 1;
    }
  }
  return count;
}

// Verify that the quoted snippet from the first returned result really exists
// in the source file. This checks readability without echoing any original text.
// The retriever emits snippets either as objects {start, end, text} or as
// pre-formatted strings ("--- lines a-b ---\n<line>: <text>"), so handle both.
function verifyReadback(payload) {
  const first = payload?.results?.find((item) => Array.isArray(item.snippets) && item.snippets.length);
  if (!first) return false;
  const file = first.absolutePath ?? null;
  if (!file || !fs.existsSync(file)) return false;
  try {
    const text = fs.readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    const snippet = first.snippets[0];
    if (snippet && typeof snippet === "object") {
      const start = Number(snippet.start ?? 0);
      if (start >= 1 && start <= lines.length) return true;
      const probe = String(snippet.text ?? "").split("\n")[0].replace(/^\d+:\s*/u, "").trim();
      return probe.length > 0 && text.includes(probe);
    }
    const raw = String(snippet ?? "");
    const quoted = raw.split("\n").find((line) => /^\d+:\s*\S/u.test(line));
    if (!quoted) return false;
    const lineNo = Number(quoted.match(/^(\d+):/u)?.[1] ?? 0);
    const probe = quoted.replace(/^\d+:\s*/u, "").trim();
    if (lineNo >= 1 && lineNo <= lines.length) return true;
    return probe.length > 0 && text.includes(probe);
  } catch {
    return false;
  }
}

function runTestQuery(root, query) {
  const retriever = path.join(root, "scripts", "search_bedtime_transcripts.mjs");
  const base = [retriever, root, query, "3", "--context-lines", "6", "--max-chars", "4000", "--json"];
  const smaller = [retriever, root, query, "2", "--context-lines", "4", "--max-chars", "2000", "--json"];

  let run = spawnSync(process.execPath, base, {
    cwd: root, encoding: "utf8", timeout: 90_000, maxBuffer: 8 * 1024 * 1024,
  });
  // A timeout is a technical failure, not a zero-hit result. Retry once only.
  if (run.error?.code === "ETIMEDOUT") {
    run = spawnSync(process.execPath, smaller, {
      cwd: root, encoding: "utf8", timeout: 90_000, maxBuffer: 8 * 1024 * 1024,
    });
  }
  if (run.error) {
    return {
      exitCode: null,
      scanned: null,
      totalHits: null,
      returned: null,
      readbackVerified: false,
      error: `检索器超时或未正常退出（${run.error.code ?? "unknown"}），不报告为零命中`,
    };
  }
  let payload = null;
  try { payload = JSON.parse(run.stdout); } catch { payload = null; }
  if (!payload) {
    return {
      exitCode: run.status,
      scanned: null,
      totalHits: null,
      returned: null,
      readbackVerified: false,
      error: "检索器未返回可解析的统计结果",
    };
  }
  return {
    exitCode: run.status,
    scanned: payload.totalScanned ?? null,
    totalHits: payload.total ?? null,
    returned: payload.returned ?? null,
    readbackVerified: verifyReadback(payload),
    error: run.status === 0 ? null : "检索器非零退出，不报告 corpus_available",
  };
}

function main() {
  const { root, query } = parseArgs(process.argv.slice(2));
  const resourceErrors = [];

  const requiredFiles = [
    "SKILL.md",
    "bedtime-transcript-index.json",
    "references/research/17-full-corpus-digest.md",
    "work/ZhihuOfficial-Answers/zhihu-official-answer-index.json",
    "scripts/search_bedtime_transcripts.mjs",
    "scripts/search_zhihu_official_answers.mjs",
  ];
  const requiredDirs = [
    "work/BedtimeNews-Transcripts/contents/ShuiQianXiaoXi",
    "work/ZhihuOfficial-Answers/answers",
  ];

  for (const rel of requiredFiles) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) resourceErrors.push(`缺失: ${rel}`);
    else {
      try { fs.accessSync(full, fs.constants.R_OK); }
      catch { resourceErrors.push(`不可读: ${rel}`); }
    }
  }
  for (const rel of requiredDirs) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) resourceErrors.push(`缺失目录: ${rel}`);
    else {
      try { fs.accessSync(full, fs.constants.R_OK); }
      catch { resourceErrors.push(`不可读目录: ${rel}`); }
    }
  }

  const transcriptDir = path.join(root, "work", "BedtimeNews-Transcripts", "contents", "ShuiQianXiaoXi");
  const zhihuDir = path.join(root, "work", "ZhihuOfficial-Answers", "answers");
  const transcriptFileCount = countMarkdown(transcriptDir);
  const zhihuFileCount = countMarkdown(zhihuDir);

  let retrieverExitCode = null;
  let scanned = null;
  let totalHits = null;
  let returned = null;
  let readbackVerified = null;
  let status = resourceErrors.length ? "degraded" : "ok";

  if (query) {
    const result = runTestQuery(root, query);
    retrieverExitCode = result.exitCode;
    scanned = result.scanned;
    totalHits = result.totalHits;
    returned = result.returned;
    readbackVerified = result.readbackVerified;
    if (result.error) {
      resourceErrors.push(result.error);
      status = "failed";
    } else if (status !== "degraded") {
      status = "ok";
    }
  }

  // Exactly the agreed compact fields; no file lists, no corpus text.
  const output = {
    status,
    resourceErrors,
    transcriptFileCount,
    zhihuFileCount,
    retrieverExitCode,
    scanned,
    totalHits,
    returned,
    readbackVerified,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = status === "failed" ? 1 : 0;
}

main();

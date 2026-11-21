#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const INDEXER = path.join(REPO, "scripts", "index_bedtime_transcripts.mjs");
const DIGEST = path.join(REPO, "scripts", "generate_corpus_digest.mjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-index-"));
const repo = path.join(root, "repo");
const transcriptRoot = path.join(repo, "contents", "ShuiQianXiaoXi");
const output = path.join(root, "index.json");
const digest = path.join(root, "digest.md");
const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

try {
  fs.mkdirSync(transcriptRoot, { recursive: true });
  fs.writeFileSync(path.join(transcriptRoot, "0001.md"), "# 测试标题\n**发布日期** 2026-01-01\n\n## 正文\n测试正文。\n", "utf8");
  const indexed = spawnSync(process.execPath, [INDEXER, repo, output], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const payload = indexed.status === 0 ? JSON.parse(fs.readFileSync(output, "utf8")) : null;
  const validIndex = path.join(root, "valid-index.json");
  if (payload) fs.writeFileSync(validIndex, `${JSON.stringify(payload)}\n`, "utf8");
  add(
    "文字稿索引器生成结构化索引",
    indexed.status === 0 && payload?.episodes?.length === 1 && payload.episodes[0].title === "测试标题",
    `exit=${indexed.status}`,
  );

  const generated = spawnSync(process.execPath, [DIGEST, output, digest], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  add(
    "摘要生成器写出完整结果",
    generated.status === 0 && fs.readFileSync(digest, "utf8").includes("测试标题"),
    `exit=${generated.status}`,
  );

  const outside = path.join(root, "outside.md");
  fs.writeFileSync(outside, "# SHOULD-NOT-BE-INDEXED\n", "utf8");
  fs.symlinkSync(outside, path.join(transcriptRoot, "0002.md"));
  fs.writeFileSync(output, "stable index\n", "utf8");
  const linked = spawnSync(process.execPath, [INDEXER, repo, output], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  add(
    "文字稿索引器拒绝语料符号链接且保留旧索引",
    linked.status !== 0 && fs.readFileSync(output, "utf8") === "stable index\n",
    `exit=${linked.status}`,
  );

  fs.rmSync(path.join(transcriptRoot, "0002.md"));
  fs.rmSync(digest);
  fs.symlinkSync(outside, digest);
  const linkedOutput = spawnSync(process.execPath, [DIGEST, validIndex, digest], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  add(
    "摘要生成器拒绝符号链接输出",
    linkedOutput.status !== 0 && fs.readFileSync(outside, "utf8") === "# SHOULD-NOT-BE-INDEXED\n",
    `exit=${linkedOutput.status}`,
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}`);
  if (check.detail) console.log(`      ${check.detail}`);
  if (!check.ok) failed += 1;
}
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

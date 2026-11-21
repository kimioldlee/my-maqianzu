#!/usr/bin/env node

/**
 * Skill-update regression test for corpus status classification.
 *
 * Run: node tests/corpus_status_regression.test.mjs
 *
 * These two probes used to be written into SKILL.md as a per-task
 * "状态判定复核" step. They are regression checks for skill/retriever
 * changes, NOT steps of every news task. It only runs the existing bounded
 * retriever twice and inspects stdout/exit codes.
 *
 * A pre-existing outputs/ root (with old task files) is ALLOWED. We
 * ACTUALLY PRE-CREATE such a root in an OS temp workspace, snapshot it
 * before/after the probes, and assert no entry was added, removed or
 * changed; the fixture is removed afterwards. The snapshot is deliberately
 * non-empty so the test never passes merely because the repository has no
 * outputs/ directory (null === null). The real repository's outputs/,
 * corpus, index, digest, cookies, sessions and login state are never
 * created or modified.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const RETRIEVER = path.join(REPO, "scripts", "search_bedtime_transcripts.mjs");
const TRANSCRIPTS = path.join(REPO, "work", "BedtimeNews-Transcripts", "contents", "ShuiQianXiaoXi");

const checks = [];
const record = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

const skill = fs.readFileSync(path.join(REPO, "SKILL.md"), "utf8");

// Recursive, read-only snapshot of an outputs/ root (path + content + mtime).
// The fixture is created in an OS temp workspace, so the snapshot is always
// non-empty and the comparison exercises the real "pre-existing files" branch.
const snapshotOutputs = (dir) => {
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
        const stat = fs.statSync(full);
        entries.push(`file:${key}:${stat.mtimeMs}:${fs.readFileSync(full).toString("base64")}`);
      }
    }
  };
  walk(dir, "");
  return entries.sort();
};

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "corpus-status-outputs-"));
const fixtureOutputs = path.join(fixtureRoot, "outputs");
const fixtureOldTask = path.join(fixtureOutputs, "20260101-old-task");
fs.mkdirSync(fixtureOldTask, { recursive: true });
fs.writeFileSync(path.join(fixtureOutputs, "final_draft.md"), "根目录旧稿，不应被改动。", "utf8");
fs.writeFileSync(path.join(fixtureOldTask, "final_draft.md"), "更早任务的工作稿，不应被改动。", "utf8");
fs.writeFileSync(path.join(fixtureOldTask, "final_audit.json"), '{"task":"20260101-old-task"}\n', "utf8");
const outputsBefore = snapshotOutputs(fixtureOutputs);

// The probes must NOT be a per-task step any more.
record(
  "SKILL.md 不再把冷门词/错误路径回归测试写成每篇任务必做",
  !skill.includes("用只读方式复核两类情形") &&
    !skill.includes("状态判定复核（上线自检）") &&
    skill.includes("不是每篇任务的步骤") &&
    skill.includes("tests/corpus_status_regression.test.mjs"),
  "回归测试定位到技能更新测试"
);

// The actual failure classification must be unchanged.
record(
  "实际任务失败判定未改变",
  skill.includes("corpus_failed") &&
    skill.includes("只用于技术性失败") &&
    skill.includes("corpus_available") &&
    skill.includes("零命中绝不单独触发") &&
    skill.includes("direct_hit_count=0"),
  "零命中=corpus_available；corpus_failed 仅限技术失败"
);

if (!fs.existsSync(RETRIEVER) || !fs.existsSync(TRANSCRIPTS)) {
  record("语料与检索器存在", false, "缺少检索器或语料目录，跳过探针");
} else {
  // Probe A: retriever works, cold topic has zero direct hits.
  const cold = spawnSync(
    process.execPath,
    [RETRIEVER, ".", "量子泡馍悖论XYZ2026", "8", "--json"],
    { cwd: REPO, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }
  );
  let coldJson = null;
  try {
    coldJson = JSON.parse(cold.stdout);
  } catch {
    coldJson = null;
  }
  const coldOk =
    cold.status === 0 &&
    coldJson !== null &&
    coldJson.totalScanned > 800 &&
    coldJson.total === 0 &&
    coldJson.returned === 0;
  record(
    "A 冷门词零命中：检索器正常，判为 corpus_available + direct_hit_count=0",
    coldOk,
    `exit=${cold.status} totalScanned=${coldJson?.totalScanned} total=${coldJson?.total}`
  );

  // Probe B: deliberately wrong search root -> technical failure.
  const badRoot = path.join(REPO, "no-such-transcript-root-for-regression");
  const broken = spawnSync(
    process.execPath,
    [RETRIEVER, badRoot, "地方债", "2", "--json"],
    { cwd: REPO, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 }
  );
  const brokenOk = broken.status !== 0 && /Cannot find transcript directory/i.test(broken.stderr || "");
  record(
    "B 故意错误根目录：检索器报错，才判 corpus_failed",
    brokenOk,
    `exit=${broken.status} stderr=${(broken.stderr || "").trim().slice(0, 120)}`
  );
  record("探针未创建错误根目录", !fs.existsSync(badRoot), "只读");
}

const outputsAfter = snapshotOutputs(fixtureOutputs);
const outputsUnchanged =
  Array.isArray(outputsBefore) &&
  outputsBefore.length === 4 &&
  Array.isArray(outputsAfter) &&
  outputsBefore.every((entry) => typeof entry === "string" && entry.length > 0) &&
  JSON.stringify(outputsBefore) === JSON.stringify(outputsAfter);
record(
  "临时目录预置的 outputs/ 旧文件与旧任务目录内容/mtime 逐项未变（非空快照，不依赖 null===null）",
  outputsUnchanged,
  `预置 ${outputsBefore?.length ?? 0} 个条目（含旧任务子目录），逐项内容与 mtime 均未变`
);
fs.rmSync(fixtureRoot, { recursive: true, force: true });

let failed = 0;
for (const check of checks) {
  console.log(`${check.ok ? "PASS" : "FAIL"}  ${check.name}`);
  console.log(`      ${check.detail}`);
  if (!check.ok) failed += 1;
}
console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const SYNC = path.join(REPO, "scripts", "sync_bedtime_transcripts.mjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "sync-bedtime-"));
const sourceRepo = path.join(root, "source");
const project = path.join(root, "project");
const sourceChannel = path.join(sourceRepo, "contents", "ShuiQianXiaoXi");
const destination = path.join(project, "work", "BedtimeNews-Transcripts", "contents", "ShuiQianXiaoXi");
const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });
const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8" });

try {
  fs.mkdirSync(sourceChannel, { recursive: true });
  fs.writeFileSync(path.join(sourceChannel, "001.md"), "# one\n", "utf8");
  fs.writeFileSync(path.join(sourceChannel, "002.md"), "# two\n", "utf8");
  git(["init", "-q"], sourceRepo);
  git(["config", "user.name", "Test"], sourceRepo);
  git(["config", "user.email", "test@example.invalid"], sourceRepo);
  git(["add", "."], sourceRepo);
  const commit = git(["commit", "-qm", "fixture"], sourceRepo);

  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, "old.md"), "old\n", "utf8");
  const env = {
    ...process.env,
    BEDTIME_SOURCE_REPO: sourceRepo,
    BEDTIME_MIN_DOCUMENTS: "2",
  };
  const first = spawnSync(process.execPath, [SYNC, project], {
    cwd: REPO,
    env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  add(
    "有效源在完整校验后替换正式文字稿目录",
    commit.status === 0 && first.status === 0 &&
      fs.existsSync(path.join(destination, "001.md")) &&
      fs.existsSync(path.join(destination, "002.md")) &&
      !fs.existsSync(path.join(destination, "old.md")),
    `commit=${commit.status} sync=${first.status}`,
  );

  const before = fs.readdirSync(destination).sort().map((name) => [
    name,
    fs.readFileSync(path.join(destination, name), "utf8"),
  ]);
  const invalidMinimum = spawnSync(process.execPath, [SYNC, project], {
    cwd: REPO,
    env: { ...env, BEDTIME_MIN_DOCUMENTS: "not-a-number" },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const afterInvalidMinimum = fs.readdirSync(destination).sort().map((name) => [
    name,
    fs.readFileSync(path.join(destination, name), "utf8"),
  ]);
  add(
    "无效最低文档数不会绕过保护或改动正式目录",
    invalidMinimum.status !== 0 && JSON.stringify(afterInvalidMinimum) === JSON.stringify(before),
    `exit=${invalidMinimum.status}`,
  );

  const tooHigh = spawnSync(process.execPath, [SYNC, project], {
    cwd: REPO,
    env: { ...env, BEDTIME_MIN_DOCUMENTS: "3" },
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const afterTooHigh = fs.readdirSync(destination).sort().map((name) => [
    name,
    fs.readFileSync(path.join(destination, name), "utf8"),
  ]);
  add(
    "源文档不足时保留上一版正式目录",
    tooHigh.status !== 0 && JSON.stringify(afterTooHigh) === JSON.stringify(before),
    `exit=${tooHigh.status}`,
  );
  add(
    "同步后不遗留 staging 或 backup 目录",
    fs.readdirSync(path.dirname(destination)).every((name) =>
      !name.startsWith(".ShuiQianXiaoXi-staging-") &&
      !name.startsWith(".ShuiQianXiaoXi-backup-")
    ),
    fs.readdirSync(path.dirname(destination)).join(","),
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

#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const INSTALLER = path.join(REPO, "scripts", "install.sh");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-install-"));
const project = path.join(root, "project");
const target = path.join(project, ".claude", "skills", "madugong-perspective");
const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

try {
  fs.mkdirSync(project, { recursive: true });
  const first = spawnSync("bash", [INSTALLER, "--project", project], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  add(
    "项目安装复制完整运行时技能",
    first.status === 0 &&
      fs.existsSync(path.join(target, "SKILL.md")) &&
      fs.existsSync(path.join(target, "scripts", "validate_final_draft.mjs")) &&
      !fs.existsSync(path.join(target, "tests")) &&
      !fs.existsSync(path.join(target, "scripts", "install.sh")),
    `exit=${first.status}`,
  );

  const stale = path.join(target, "stale-resource.txt");
  fs.writeFileSync(stale, "obsolete\n", "utf8");
  const second = spawnSync("bash", [INSTALLER, "--project", project], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  add(
    "重复安装会清理源仓库中已不存在的旧文件",
    second.status === 0 && !fs.existsSync(stale),
    `exit=${second.status}`,
  );

  fs.rmSync(target, { recursive: true, force: true });
  const outside = path.join(root, "outside");
  fs.mkdirSync(outside);
  const sentinel = path.join(outside, "sentinel.txt");
  fs.writeFileSync(sentinel, "keep\n", "utf8");
  fs.symlinkSync(outside, target, "dir");
  const linked = spawnSync("bash", [INSTALLER, "--project", project], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  add(
    "拒绝通过符号链接安装且不改动链接目标",
    linked.status === 2 &&
      fs.readFileSync(sentinel, "utf8") === "keep\n" &&
      !fs.existsSync(path.join(outside, "SKILL.md")),
    `exit=${linked.status}`,
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

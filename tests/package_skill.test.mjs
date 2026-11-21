#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const PACKAGER = path.join(REPO, "scripts", "package_skill.sh");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "package-skill-"));
const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

try {
  const relativeOutput = path.join("artifacts", "maqianzu.zip");
  const expectedOutput = path.join(root, relativeOutput);
  const run = spawnSync("bash", [PACKAGER, relativeOutput], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const integrity = spawnSync("unzip", ["-tq", expectedOutput], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const listing = spawnSync("unzip", ["-Z1", expectedOutput], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const entries = listing.stdout.split(/\r?\n/u).filter(Boolean);

  add(
    "仓库外工作目录中的相对输出路径会保留 ZIP",
    run.status === 0 && fs.existsSync(expectedOutput) && fs.statSync(expectedOutput).size > 0,
    `exit=${run.status} path=${expectedOutput}`,
  );
  add(
    "生成的 ZIP 通过完整性检查",
    integrity.status === 0,
    `exit=${integrity.status} stderr=${integrity.stderr.trim()}`,
  );
  add(
    "ZIP 包含技能入口和运行时验证器",
    entries.includes("madugong-perspective/SKILL.md") &&
      entries.includes("madugong-perspective/scripts/validate_final_draft.mjs"),
    `entries=${entries.length}`,
  );
  const forbidden = entries.filter((entry) =>
    entry.includes("/.git/") ||
    entry.includes("/.github/") ||
    entry.includes("/tests/") ||
    entry.includes("/outputs/") ||
    entry.includes("/scripts/zhihu/") ||
    entry.endsWith("/scripts/install.sh") ||
    entry.endsWith("/scripts/package_skill.sh") ||
    entry.endsWith(".tmp") ||
    entry.endsWith("/.DS_Store")
  );
  add(
    "ZIP 不包含开发、会话、测试和打包脚本",
    forbidden.length === 0,
    forbidden.slice(0, 10).join(", "),
  );

  const refusedOutput = path.join(REPO, "package-test-should-not-exist.zip");
  fs.rmSync(refusedOutput, { force: true });
  const refused = spawnSync("bash", [PACKAGER, refusedOutput], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  add(
    "拒绝在源码树内 dist 之外生成 ZIP",
    refused.status === 2 && !fs.existsSync(refusedOutput) &&
      refused.stderr.includes("Refusing output inside the source tree"),
    `exit=${refused.status}`,
  );

  const repoAlias = path.join(root, "repo-alias");
  fs.symlinkSync(REPO, repoAlias, "dir");
  const aliasOutput = path.join(repoAlias, "alias-should-not-exist.zip");
  const aliasRun = spawnSync("bash", [PACKAGER, aliasOutput], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  add(
    "真实路径检查可阻止经符号链接写入源码树",
    aliasRun.status === 2 && !fs.existsSync(path.join(REPO, "alias-should-not-exist.zip")),
    `exit=${aliasRun.status}`,
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

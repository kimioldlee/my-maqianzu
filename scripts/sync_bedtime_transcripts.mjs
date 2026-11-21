#!/usr/bin/env node

/**
 * Refresh only the ShuiQianXiaoXi channel from the public transcript repo.
 * The destination is deliberately constrained to one directory.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const projectRoot = path.resolve(process.argv[2] ?? ".");
const destinationRepo = path.join(projectRoot, "work", "BedtimeNews-Transcripts");
const destination = path.join(destinationRepo, "contents", "ShuiQianXiaoXi");
const sourceUrl = process.env.BEDTIME_SOURCE_REPO ?? "https://github.com/BedtimeNewsStudio/BedtimeNews-Transcripts.git";
const minimumDocuments = Number(process.env.BEDTIME_MIN_DOCUMENTS ?? 700);

async function exists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function walk(directory) {
  const output = [];
  async function visit(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(full);
      else if (entry.isFile()) output.push(full);
    }
  }
  await visit(directory);
  return output;
}

async function copyChannel(source) {
  const sourceFiles = await walk(source);
  if (sourceFiles.length < minimumDocuments) {
    throw new Error(`source channel contains only ${sourceFiles.length} files; refusing to replace ${minimumDocuments}+ local files`);
  }

  const sourceRelative = new Set();
  for (const file of sourceFiles) {
    const relative = path.relative(source, file);
    sourceRelative.add(relative);
    const target = path.join(destination, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(file, target);
  }

  for (const file of await walk(destination)) {
    const relative = path.relative(destination, file);
    if (!sourceRelative.has(relative)) await fs.rm(file);
  }
}

async function main() {
  if (!(await exists(destinationRepo))) throw new Error(`missing destination repo: ${destinationRepo}`);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "bedtime-transcripts-"));
  try {
    await run("git", ["clone", "--depth", "1", sourceUrl, temporary], { cwd: projectRoot, maxBuffer: 4 * 1024 * 1024 });
    const source = path.join(temporary, "contents", "ShuiQianXiaoXi");
    if (!(await exists(source))) throw new Error(`source channel not found: ${source}`);
    await copyChannel(source);
    console.log(`Synced ShuiQianXiaoXi from ${sourceUrl}`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`sync_bedtime_transcripts failed: ${error.message}`);
  process.exitCode = 1;
});

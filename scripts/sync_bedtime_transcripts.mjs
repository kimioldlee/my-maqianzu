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

if (!Number.isSafeInteger(minimumDocuments) || minimumDocuments < 1 || minimumDocuments > 100000) {
  throw new Error("BEDTIME_MIN_DOCUMENTS must be an integer between 1 and 100000");
}

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
      else if (entry.isSymbolicLink()) throw new Error(`source channel contains a symbolic link: ${full}`);
      else throw new Error(`source channel contains an unsupported entry: ${full}`);
    }
  }
  await visit(directory);
  return output;
}

async function validateChannel(source) {
  const sourceFiles = await walk(source);
  const transcriptCount = sourceFiles.filter((file) => path.extname(file).toLowerCase() === ".md").length;
  if (transcriptCount < minimumDocuments) {
    throw new Error(`source channel contains only ${transcriptCount} Markdown files; refusing to replace ${minimumDocuments}+ local files`);
  }
  return transcriptCount;
}

async function replaceChannel(source) {
  const contentsRoot = path.dirname(destination);
  const destinationStat = await fs.lstat(destination);
  if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink()) {
    throw new Error(`destination channel must be a real directory: ${destination}`);
  }
  const stagingRoot = await fs.mkdtemp(path.join(contentsRoot, ".ShuiQianXiaoXi-staging-"));
  const staging = path.join(stagingRoot, "channel");
  const backup = path.join(contentsRoot, `.ShuiQianXiaoXi-backup-${process.pid}-${Date.now()}`);
  let destinationBackedUp = false;
  try {
    await fs.cp(source, staging, { recursive: true, force: false, errorOnExist: true, dereference: false });
    await validateChannel(staging);
    await fs.rename(destination, backup);
    destinationBackedUp = true;
    try {
      await fs.rename(staging, destination);
    } catch (error) {
      await fs.rename(backup, destination);
      destinationBackedUp = false;
      throw error;
    }
    await fs.rm(backup, { recursive: true, force: true });
    destinationBackedUp = false;
  } finally {
    await fs.rm(stagingRoot, { recursive: true, force: true });
    if (destinationBackedUp) {
      console.error(`Previous transcript channel backup retained at: ${backup}`);
    }
  }
}

async function main() {
  if (!(await exists(destinationRepo))) throw new Error(`missing destination repo: ${destinationRepo}`);
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "bedtime-transcripts-"));
  try {
    await run("git", ["clone", "--depth", "1", sourceUrl, temporary], { cwd: projectRoot, maxBuffer: 4 * 1024 * 1024 });
    const source = path.join(temporary, "contents", "ShuiQianXiaoXi");
    if (!(await exists(source))) throw new Error(`source channel not found: ${source}`);
    const transcriptCount = await validateChannel(source);
    await replaceChannel(source);
    console.log(`Validated ${transcriptCount} Markdown transcripts.`);
    console.log(`Synced ShuiQianXiaoXi from ${sourceUrl}`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`sync_bedtime_transcripts failed: ${error.message}`);
  process.exitCode = 1;
});

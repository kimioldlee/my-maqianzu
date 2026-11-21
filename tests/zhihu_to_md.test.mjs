#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const CONVERTER = path.join(REPO, "scripts", "zhihu", "zhihu_to_md.py");
const SEARCH = path.join(REPO, "scripts", "search_zhihu_official_answers.mjs");
const INDEXER = path.join(REPO, "scripts", "index_zhihu_official_answers.mjs");
const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhihu-to-md-"));
const answers = path.join(root, "answers");
const index = path.join(root, "INDEX.md");
const raw = path.join(root, "zhihu-answers-raw.jsonl");
const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok: Boolean(ok), detail });

const snapshot = () => ({
  index: fs.readFileSync(index, "utf8"),
  answers: fs.readdirSync(answers).sort().map((name) => [
    name,
    fs.readFileSync(path.join(answers, name), "utf8"),
  ]),
});

try {
  fs.mkdirSync(answers, { recursive: true });
  fs.writeFileSync(path.join(answers, "old.md"), "old answer\n", "utf8");
  fs.writeFileSync(index, "old index\n", "utf8");

  const record = {
    id: "12345",
    question_id: "67890",
    question_title: "Bad: [x]\n---",
    created_time: 1700000000,
    updated_time: 1700000100,
    voteup_count: 10,
    comment_count: 2,
    content_html: '<p>正文</p><img src="javascript:alert(1)"><img src="https://example.com/a.png">',
  };
  fs.writeFileSync(raw, `${JSON.stringify(record)}\n`, "utf8");
  const env = { ...process.env, ZHIHU_DATA_ROOT: root };
  const first = spawnSync("python3", [CONVERTER], {
    cwd: REPO,
    env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const generated = fs.existsSync(answers) ? fs.readdirSync(answers).filter((name) => name.endsWith(".md")) : [];
  const generatedText = generated.length === 1
    ? fs.readFileSync(path.join(answers, generated[0]), "utf8")
    : "";
  add(
    "转换成功后才替换旧 answers 和 INDEX.md",
    first.status === 0 && generated.length === 1 && !fs.existsSync(path.join(answers, "old.md")) &&
      fs.readFileSync(index, "utf8").includes("共 1 篇"),
    `exit=${first.status} files=${generated.join(",")}`,
  );
  add(
    "外部标题在 YAML 与 Markdown 中被安全引用",
    generatedText.includes('title: "Bad: [x] ---"') &&
      generatedText.includes("# Bad: \\[x\\] ---") &&
      !generatedText.includes("\n---\n---\n"),
    generatedText.slice(0, 180).replaceAll("\n", " | "),
  );
  add(
    "只保留 http/https 图片地址",
    generatedText.includes("![图片](https://example.com/a.png)") &&
      !generatedText.includes("javascript:alert"),
    "javascript: 图片被丢弃",
  );

  const search = spawnSync(process.execPath, [SEARCH, root, "Bad", "5", "--max-chars", "4000"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  let searchPayload = null;
  try { searchPayload = JSON.parse(search.stdout); } catch { searchPayload = null; }
  add(
    "检索器可读取安全引用的 frontmatter 且不保留包裹引号",
    search.status === 0 && searchPayload?.returned === 1 &&
      searchPayload?.results?.[0]?.title === "Bad: [x] ---" &&
      searchPayload?.results?.[0]?.path?.startsWith("answers/"),
    `exit=${search.status} title=${searchPayload?.results?.[0]?.title}`,
  );

  const indexJson = path.join(root, "zhihu-official-answer-index.json");
  const indexed = spawnSync(process.execPath, [INDEXER, root, indexJson], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const indexPayload = indexed.status === 0 ? JSON.parse(fs.readFileSync(indexJson, "utf8")) : null;
  add(
    "索引器可读取安全引用的 frontmatter 且不保留包裹引号",
    indexed.status === 0 && indexPayload?.answers?.[0]?.title === "Bad: [x] ---",
    `exit=${indexed.status} title=${indexPayload?.answers?.[0]?.title}`,
  );

  const beforeFailure = snapshot();
  fs.writeFileSync(raw, `${JSON.stringify(record)}\n{malformed json}\n`, "utf8");
  const failed = spawnSync("python3", [CONVERTER], {
    cwd: REPO,
    env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const afterFailure = snapshot();
  add(
    "原始 JSON 损坏时失败且不删除上一版输出",
    failed.status !== 0 && JSON.stringify(afterFailure) === JSON.stringify(beforeFailure),
    `exit=${failed.status}`,
  );
  add(
    "失败后不遗留 staging 或 backup 目录",
    fs.readdirSync(root).every((name) =>
      !name.startsWith(".answers-staging-") &&
      !name.startsWith(".answers-backup-") &&
      !name.startsWith(".INDEX-staging-") &&
      !name.startsWith(".INDEX-backup-")
    ),
    fs.readdirSync(root).join(","),
  );

  const outsideMarkdown = path.join(root, "outside-secret.md");
  fs.writeFileSync(outsideMarkdown, "TOP-SECRET-SYMLINK-CONTENT\n", "utf8");
  const corpusLink = path.join(answers, "linked.md");
  fs.symlinkSync(outsideMarkdown, corpusLink);
  const linkedSearch = spawnSync(process.execPath, [SEARCH, root, "TOP-SECRET-SYMLINK-CONTENT"], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  add(
    "检索器拒绝跟随语料目录中的符号链接",
    linkedSearch.status !== 0 && !linkedSearch.stdout.includes("TOP-SECRET-SYMLINK-CONTENT"),
    `exit=${linkedSearch.status}`,
  );
  fs.writeFileSync(indexJson, "stable index\n", "utf8");
  const linkedIndex = spawnSync(process.execPath, [INDEXER, root, indexJson], {
    cwd: REPO,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  add(
    "索引器拒绝跟随语料符号链接且保留上一版索引",
    linkedIndex.status !== 0 && fs.readFileSync(indexJson, "utf8") === "stable index\n",
    `exit=${linkedIndex.status}`,
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

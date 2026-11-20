#!/usr/bin/env node

/**
 * Read-only static checks for the "context budget & interruption recovery"
 * hard rules in SKILL.md and README.md.
 *
 * Run: node tests/context_budget_rules.test.mjs
 *
 * This test NEVER writes files, never loads the corpus/index, and never
 * invokes any skill. It only reads the two documents and asserts that the
 * normative sentences are present. Corpus, indexes, digests, retriever
 * behavior, cookies, sessions and login state are intentionally untouched.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");

const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
// Strip inline-code backticks and emphasis markers so assertions can match
// plain sentences regardless of Markdown decoration.
const plain = (text) => text.replace(/[`*]/g, "");

const skill = plain(read("SKILL.md"));
const readme = plain(read("README.md"));

const has = (text, ...needles) => needles.every((n) => text.includes(n));

const checks = [
  // Required check 1: SKILL.md explicitly bans sepia-recreate without a user request.
  [
    "SKILL.md 明确禁止未经用户要求调用 sepia-recreate",
    has(
      skill,
      "禁止在未获得用户明确要求的情况下自动改用 sepia-recreate",
      "只有用户明确要求完全重写时才允许改用 sepia-recreate"
    ),
  ],

  // Required check 2: SKILL.md contains Autocompact / context limit recovery rules.
  [
    "SKILL.md 包含 Autocompact/context limit 中断恢复规则",
    has(
      skill,
      "Autocompact is thrashing",
      "context limit",
      "上下文压缩失败",
      "中断恢复",
      "恢复提示"
    ),
  ],

  // Additional read-only checks covering the rest of the hard rules.
  [
    "固定 Sepia 顺序 review -> refactor -> review",
    skill.includes("sepia-review -> sepia-refactor -> sepia-review") ||
      skill.includes("sepia-review → sepia-refactor → sepia-review"),
  ],
  [
    "初稿生成后立即保存 outputs/final_draft.md",
    has(skill, "初稿生成后", "立即", "outputs/final_draft.md"),
  ],
  [
    "三阶段阶段文件契约齐全",
    has(
      skill,
      "outputs/sepia_review_1.md",
      "outputs/sepia_refactor.md",
      "outputs/sepia_review_2.md"
    ),
  ],
  [
    "阶段以文件路径为输入输出且不复制完整正文",
    has(skill, "文件路径", "不得把完整正文复制进对话上下文"),
  ],
  [
    "sepia-refactor 覆盖初稿且不展示修改前后全文",
    has(skill, "覆盖 outputs/final_draft.md", "不得展示完整修改前正文和修改后正文"),
  ],
  [
    "第二次 sepia-review 只读取修订后的 final_draft.md",
    has(skill, "第二次", "只读取修订后的", "final_draft.md"),
  ],
  [
    "检索阶段只保留 1 至 3 篇且不重复回读全文",
    has(skill, "最相关 1 至 3 篇", "禁止重复读取同一篇完整文字稿"),
  ],
  [
    "禁止检索器完整 JSON / 多篇全文进入上下文",
    has(skill, "禁止把检索器完整 JSON", "多篇全文"),
  ],
  [
    "大型文件分段或定点读取",
    has(skill, "分段读取或定点读取", "完整语料摘要", "审计 JSON"),
  ],
  [
    "验证器原始 JSON 落盘且只读 pass/exitCode/violations",
    has(
      skill,
      "outputs/final_validation.json",
      "pass",
      "exitCode",
      "violations",
      "不得把完整 JSON 重新注入上下文"
    ),
  ],
  [
    "中断时停止加载、保留 outputs、输出恢复提示、不从头重跑",
    has(skill, "停止", "保留", "outputs/", "不得从头重跑"),
  ],
  [
    "断点续跑只继续缺失阶段，不重复已完成有效阶段",
    has(skill, "继续缺失阶段", "不重复已完成且有效"),
  ],
  [
    "既有规则全部保留（低Token/零命中/方案六要素/字数/评分/验证硬门）",
    has(
      skill,
      "低 Token",
      "direct_hit_count=0",
      "corpus_available",
      "方案六要素",
      "3000 至 5000",
      "pass=true"
    ) &&
      (skill.includes("11 项评分") || skill.includes("11项评分")),
  ],
  [
    "README.md 同步说明上下文预算、中断恢复与断点续跑",
    has(
      readme,
      "上下文预算与中断恢复",
      "sepia-recreate",
      "Autocompact is thrashing",
      "context limit",
      "断点续跑",
      "final_validation.json"
    ),
  ],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failed += 1;
}

console.log(`\n${checks.length} checks, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);

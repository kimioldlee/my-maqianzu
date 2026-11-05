#!/usr/bin/env node

/**
 * Bounded local retrieval for the transcript corpus.
 *
 * The old form remains valid:
 *   node scripts/search_bedtime_transcripts.mjs <corpus-or-repo> "term1,term2" [limit]
 *
 * By default this returns matching line ranges, not complete episodes. This
 * keeps retrieval evidence available without pushing the whole corpus into an
 * agent context window.
 */

import fs from "node:fs/promises";
import path from "node:path";

const usage = `Usage:
  node scripts/search_bedtime_transcripts.mjs <corpus-or-repo> "term1,term2" [limit] [options]

Path forms accepted:
  repository root                 (contains work/BedtimeNews-Transcripts)
  transcript repository root      (contains contents/ShuiQianXiaoXi)
  ShuiQianXiaoXi channel directory

Options:
  --context-lines N  lines on each side of a hit (default 24)
  --max-chars N      maximum returned evidence characters (default 24000)
  --max-files N      maximum candidate files (default limit)
  --all-channels     search every channel below contents/
  --json              emit machine-readable JSON
  --full              return complete candidate files; use only for one file`;

const catalogUrl = "https://bedtime.blog/transcripts?channel=ShuiQianXiaoXi";
const legacySourceUrl = "https://bedtimenewsstudio.github.io/BedtimeNews-Transcripts/contents/ShuiQianXiaoXi/";

function positiveInt(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${name} requires a non-negative integer.`);
  return number;
}

function parseArgs(argv) {
  if (argv.length < 2 || argv.includes("--help")) {
    console.error(usage);
    process.exit(argv.includes("--help") ? 0 : 2);
  }

  const [input, rawTerms] = argv;
  const hasLimit = argv[2] !== undefined && /^\d+$/.test(argv[2]);
  const limit = hasLimit ? Math.max(1, Number(argv[2])) : 20;
  const options = {
    contextLines: 24,
    maxChars: 24000,
    maxFiles: limit,
    allChannels: false,
    json: false,
    full: false,
  };

  for (let index = hasLimit ? 3 : 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all-channels") options.allChannels = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--full") options.full = true;
    else if (arg === "--context-lines") options.contextLines = positiveInt(argv[++index], "--context-lines");
    else if (arg === "--max-chars") options.maxChars = positiveInt(argv[++index], "--max-chars");
    else if (arg === "--max-files") options.maxFiles = Math.max(1, positiveInt(argv[++index], "--max-files"));
    else throw new Error(`Unknown option: ${arg}`);
  }

  const terms = rawTerms.split(",").map((term) => term.trim()).filter(Boolean);
  if (!terms.length) throw new Error("At least one search term is required.");
  return { input, terms, limit, options };
}

async function exists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function resolveSearchRoot(input, allChannels) {
  const supplied = path.resolve(input);
  const candidates = [
    { root: path.join(supplied, "work", "BedtimeNews-Transcripts", "contents", "ShuiQianXiaoXi"), kind: "repository" },
    { root: path.join(supplied, "contents", "ShuiQianXiaoXi"), kind: "transcript-repository" },
    { root: supplied, kind: "channel" },
  ];

  for (const candidate of candidates) {
    if (await exists(candidate.root)) {
      if (allChannels && candidate.kind !== "channel") {
        const contents = candidate.kind === "repository"
          ? path.join(supplied, "work", "BedtimeNews-Transcripts", "contents")
          : path.join(supplied, "contents");
        return { root: contents, relativeRoot: contents, scope: "all-channels" };
      }
      return { root: candidate.root, relativeRoot: candidate.root, scope: "ShuiQianXiaoXi" };
    }
  }
  throw new Error(`Cannot find transcript directory below: ${supplied}`);
}

async function walkMarkdown(root) {
  const files = [];
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md") && entry.name.toUpperCase() !== "INDEX.MD") files.push(fullPath);
    }
  }
  await visit(root);
  return files.sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));
}

function folded(text) {
  return text.toLocaleLowerCase("zh-CN");
}

function occurrences(text, term) {
  const source = folded(text);
  const needle = folded(term);
  let count = 0;
  let from = 0;
  while (true) {
    const index = source.indexOf(needle, from);
    if (index === -1) return count;
    count += 1;
    from = index + Math.max(needle.length, 1);
  }
}

function matchingTerms(text, terms) {
  const source = folded(text);
  return terms.filter((term) => source.includes(folded(term)));
}

function titleFrom(lines, file) {
  return lines.find((line) => /^\s*#\s+/.test(line))?.replace(/^\s*#\s+/, "").trim() ?? path.basename(file, ".md");
}

function mergeRanges(ranges) {
  const merged = [];
  for (const range of ranges.sort((left, right) => left[0] - right[0])) {
    const previous = merged.at(-1);
    if (previous && range[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

function snippetsFor(lines, hitLines, contextLines, full) {
  if (full) return [{ start: 1, end: lines.length, text: lines.join("\n") }];
  const ranges = mergeRanges(hitLines.map((line) => [
    Math.max(1, line - contextLines),
    Math.min(lines.length, line + contextLines),
  ]));
  return ranges.map(([start, end]) => ({
    start,
    end,
    text: lines.slice(start - 1, end).map((line, offset) => `${start + offset}: ${line}`).join("\n"),
  }));
}

function fitToBudget(results, maxChars) {
  let used = 0;
  const fitted = [];
  let clipped = false;
  for (const result of results) {
    const header = `${result.relativePath} | ${result.title} | terms=${result.foundTerms.join(",")} | hits=${result.hitLines.join(",")}\n`;
    const snippets = [];
    for (const snippet of result.snippets) {
      const block = `--- lines ${snippet.start}-${snippet.end} ---\n${snippet.text}`;
      const separatorLength = snippets.length ? 1 : 0;
      const remaining = maxChars - used - header.length - snippets.join("\n").length - separatorLength;
      if (remaining <= 0) break;
      if (block.length <= remaining) {
        snippets.push(block);
      } else {
        const marker = "\n[TRUNCATED]";
        const bodyLength = Math.max(0, remaining - marker.length);
        snippets.push(`${block.slice(0, bodyLength)}${marker}`);
        clipped = true;
      }
    }
    if (!snippets.length) break;
    fitted.push({ ...result, snippets });
    used += header.length + snippets.join("\n").length;
    if (used >= maxChars) break;
  }
  return { results: fitted, used, truncated: clipped || fitted.length < results.length };
}

async function main() {
  const { input, terms, limit, options } = parseArgs(process.argv.slice(2));
  const resolved = await resolveSearchRoot(input, options.allChannels);
  const files = await walkMarkdown(resolved.root);
  const matches = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const lines = text.split(/\r?\n/);
    const foundTerms = matchingTerms(text, terms);
    if (foundTerms.length !== terms.length) continue;
    const hitLines = lines.map((line, index) => matchingTerms(line, terms).length ? index + 1 : 0).filter(Boolean);
    const title = titleFrom(lines, file);
    const date = text.match(/^\*\*发布日期\*\*\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? "";
    const sections = [...text.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
    const score = terms.reduce((total, term) => (
      total + (folded(title).includes(folded(term)) ? 12 : 0)
        + sections.filter((section) => folded(section).includes(folded(term))).length * 6
        + occurrences(text, term)
    ), 0);
    const relativePath = path.relative(resolved.relativeRoot, file).replaceAll(path.sep, "/");
    matches.push({
      relativePath,
      absolutePath: file,
      episode: /^(?:\d{4})(?:\.\d+)?\.md$/.test(path.basename(file)) ? path.basename(file, ".md") : "",
      supplement: /^(?:\d{4})(?:\.\d+)?\.md$/.test(path.basename(file)) ? "" : path.basename(file, ".md"),
      title,
      date,
      path: relativePath,
      url: catalogUrl,
      legacyUrl: `${legacySourceUrl}${relativePath.replace(/\.md$/, ".html")}`,
      foundTerms,
      hitLines,
      totalLines: lines.length,
      score,
      matchedSections: sections.filter((section) => terms.some((term) => folded(section).includes(folded(term)))),
      snippets: snippetsFor(lines, hitLines, options.contextLines, options.full),
    });
  }

  matches.sort((left, right) => right.score - left.score || right.date.localeCompare(left.date) || left.relativePath.localeCompare(right.relativePath, "zh-Hans-CN"));
  const candidates = matches.slice(0, Math.min(limit, options.maxFiles));
  const fitted = fitToBudget(candidates, options.maxChars);
  const payload = {
    query: terms,
    scope: resolved.scope,
    searchRoot: resolved.root,
    totalScanned: files.length,
    total: matches.length,
    returned: fitted.results.length,
    outputChars: fitted.used,
    truncated: fitted.truncated,
    contextLines: options.contextLines,
    full: options.full,
    results: fitted.results,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  console.log(`query=${terms.join(",")} scope=${payload.scope} total=${payload.total} returned=${payload.returned} scanned=${payload.totalScanned} chars=${payload.outputChars} truncated=${payload.truncated}`);
  for (const result of payload.results) {
    console.log(`\n## ${result.title}\n${result.relativePath}\nterms: ${result.foundTerms.join(", ")} | hits: ${result.hitLines.join(", ")} | lines: ${result.totalLines}`);
    for (const snippet of result.snippets) console.log(`${snippet}\n`);
  }
}

main().catch((error) => {
  console.error(`search_bedtime_transcripts failed: ${error.message}`);
  process.exitCode = 1;
});

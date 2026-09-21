#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.argv[2];
const outputPath = process.argv[3];

if (!repoRoot || !outputPath) {
  console.error("Usage: node index_bedtime_transcripts.mjs <transcript-repo> <output-json>");
  process.exit(1);
}

const transcriptRoot = path.join(repoRoot, "contents", "ShuiQianXiaoXi");
const catalogUrl = "https://bedtime.blog/transcripts?channel=ShuiQianXiaoXi";
const legacySourceUrl = "https://bedtimenewsstudio.github.io/BedtimeNews-Transcripts/contents/ShuiQianXiaoXi/";
const episodeName = /^\d{4}(?:\.\d+)?\.md$/;
const topicLexicon = {
  fiscal: ["财政", "税收", "转移支付", "地方债", "城投", "预算", "债务"],
  housing: ["房价", "房地产", "土地财政", "房产税", "公积金", "烂尾楼", "保交楼"],
  industry: ["制造业", "产业链", "工业化", "产能", "工厂", "供应链"],
  infrastructure: ["基建", "高铁", "地铁", "铁路", "公路", "水利", "维护费"],
  labor: ["劳动", "工会", "罢工", "工资", "就业", "失业", "外卖", "加班"],
  population: ["生育", "人口", "养老", "社会化抚养", "幼儿园", "孩子"],
  education: ["教育", "高考", "学校", "大学", "补习", "学生", "教师"],
  health: ["医疗", "医保", "医院", "药品", "集采", "医生", "疾病"],
  technology: ["科技", "芯片", "人工智能", "AI", "算法", "航天", "互联网"],
  platform: ["平台", "流量", "支付", "社交媒体", "互联网企业", "垄断"],
  agriculture: ["农业", "农村", "粮食", "种子", "农民", "肥料", "养殖"],
  energy: ["能源", "电力", "天然气", "煤炭", "光伏", "核电", "石油"],
  governance: ["政府", "官员", "治理", "监管", "执法", "考核", "地方政府"],
  law: ["法律", "法院", "司法", "诉讼", "判决", "刑法", "立法"],
  media: ["媒体", "新闻", "舆论", "传播", "记者", "平台内容", "评论区"],
  culture: ["文化", "电影", "小说", "历史", "传统", "科幻", "游戏"],
  international: ["美国", "欧洲", "俄罗斯", "日本", "韩国", "国际", "外国"],
};

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function countMatches(text, pattern) {
  return [...text.matchAll(pattern)].length;
}

function firstSentence(text) {
  const normalized = text
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/\[[^\]]+\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  const limit = Math.min(normalized.length, 240);
  for (let index = 0; index < limit; index += 1) {
    if ("。！？".includes(normalized[index])) return normalized.slice(0, index + 1);
  }
  return normalized.slice(0, limit);
}

function contentAfterHeading(body) {
  const withoutTitle = body.startsWith("#") ? body.slice(body.indexOf("\n") + 1) : body;
  const marker = "## 正文";
  const bodyStart = withoutTitle.indexOf(marker);
  if (bodyStart === -1) return withoutTitle;
  const afterMarker = withoutTitle.slice(bodyStart + marker.length);
  return afterMarker.startsWith("\n") ? afterMarker.slice(1) : afterMarker;
}

function topicHits(text) {
  return Object.entries(topicLexicon)
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([topic]) => topic);
}

function isEpisodeFile(filePath) {
  return episodeName.test(path.basename(filePath));
}

function isSupplementFile(filePath) {
  return path.dirname(filePath) === path.join(transcriptRoot, "misc") && path.basename(filePath) !== "INDEX.md";
}

function parseArticle(filePath, kind = "episode") {
  const raw = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(transcriptRoot, filePath).replaceAll(path.sep, "/");
  const [body, appendix = ""] = raw.split(/^## 附录\s*$/m, 2);
  const bodyLines = body.split("\n");
  const proseLines = bodyLines.filter((line) => !line.startsWith("#"));
  const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "";
  const date = raw.match(/^\*\*发布日期\*\*\s*(\d{4}-\d{2}-\d{2})/m)?.[1] ?? "";
  const sections = [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
  const questions = proseLines
    .filter((line) => line.length >= 4 && line.length <= 180 && /[？?]$/.test(line.trim()))
    .map((line) => line.trim())
    .slice(0, 24);
  const episodeRefs = [...raw.matchAll(/(?:第|睡前消息)(\d{1,4}(?:\.5)?)期/g)]
    .map((match) => match[1])
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 80);
  const headings = sections.filter((heading) => heading !== "正文");
  const expressionMarkers = {
    questionLead: countMatches(body, /(?:^|\n)[^\n]{4,180}[？?](?=\n|$)/g),
    concession: countMatches(body, /(?:当然|但是|不过|必须承认|我承认|的确|确实)/g),
    causal: countMatches(body, /(?:所以|因此|原因是|关键原因|本质上|核心问题)/g),
    conditional: countMatches(body, /(?:如果|只要|除非|否则|一旦)/g),
    firstPerson: countMatches(body, /(?:我认为|我觉得|我建议|我先|我还是|我这里)/g),
    priorEpisode: countMatches(body, /(?:上一期|前面.*期|第\d{1,4}(?:\.5)?期节目)/g),
  };

  return {
    episode: kind === "episode" ? path.basename(filePath, ".md") : "",
    supplement: kind === "supplement" ? path.basename(filePath, ".md") : "",
    date,
    title,
    path: relativePath,
    url: catalogUrl,
    legacyUrl: `${legacySourceUrl}${relativePath.replace(/\.md$/, ".html")}`,
    sections: headings,
    opening: firstSentence(contentAfterHeading(body)),
    questions,
    referencedEpisodes: episodeRefs,
    bodyChars: body.length,
    appendixChars: appendix.length,
    appendixFlags: {
      corrections: /^### 事实订正/m.test(appendix),
      verified: /^### 已核对/m.test(appendix),
      pending: /^### 待核对/m.test(appendix),
    },
    topics: topicHits(body),
    expressionMarkers,
  };
}

const allFiles = walk(transcriptRoot);
const files = allFiles
  .filter(isEpisodeFile)
  .sort((left, right) => Number(path.basename(left, ".md")) - Number(path.basename(right, ".md")));
const episodes = files.map((filePath) => parseArticle(filePath));
const supplementFiles = allFiles.filter(isSupplementFile).sort();
const supplements = supplementFiles.map((filePath) => parseArticle(filePath, "supplement"));
const integerEpisodes = new Set(
  episodes.filter((article) => /^\d{4}$/.test(article.episode)).map((article) => Number(article.episode)),
);
const missingEpisodes = Array.from({ length: 1075 }, (_, index) => index + 1).filter(
  (episode) => !integerEpisodes.has(episode),
);

const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    repository: "https://github.com/BedtimeNewsStudio/BedtimeNews-Transcripts",
    catalogUrl,
    legacySourceUrl,
  },
  coverage: {
    highestEpisodeNumber: 1075,
    indexedDocuments: episodes.length,
    indexedIntegerEpisodes: integerEpisodes.size,
    indexedFractionalEpisodes: episodes.length - integerEpisodes.size,
    missingIntegerEpisodes: missingEpisodes,
    indexedSupplements: supplements.length,
  },
  episodes,
  supplements,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(index)}\n`, "utf8");
console.log(`Indexed ${episodes.length} transcript documents through episode 1075.`);

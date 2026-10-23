#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const [answerRoot, outputPath] = process.argv.slice(2);

if (!answerRoot || !outputPath) {
  console.error("Usage: node index_zhihu_official_answers.mjs <answer-root> <output-json>");
  process.exit(1);
}

const answersRoot = path.join(answerRoot, "answers");
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

function frontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) return {};
  return Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^([^:]+):\s*(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key.trim(), value.trim()]),
  );
}

function firstSentence(raw) {
  const body = raw.replace(/^---[\s\S]*?---\s*/m, "").replace(/^#\s+.*$/m, "").replace(/^[-]{3}\s*$/m, "");
  const normalized = body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const limit = Math.min(normalized.length, 240);
  for (let index = 0; index < limit; index += 1) {
    if ("。！？".includes(normalized[index])) return normalized.slice(0, index + 1);
  }
  return normalized.slice(0, limit);
}

function topicHits(text) {
  return Object.entries(topicLexicon)
    .filter(([, terms]) => terms.some((term) => text.includes(term)))
    .map(([topic]) => topic);
}

const answers = walk(answersRoot)
  .filter((filePath) => path.extname(filePath) === ".md")
  .map((filePath) => {
    const raw = fs.readFileSync(filePath, "utf8");
    const meta = frontMatter(raw);
    return {
      answerId: meta.answer_id ?? "",
      questionId: meta.question_id ?? "",
      date: (meta.created ?? "").slice(0, 10),
      created: meta.created ?? "",
      updated: meta.updated ?? "",
      title: meta.title ?? raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "",
      author: meta.author ?? "马前卒official（睡前消息节目组账号）",
      url: meta.url ?? "",
      comments: meta.comments ?? "",
      voteup: meta.voteup ?? "",
      path: path.relative(answerRoot, filePath).replaceAll(path.sep, "/"),
      opening: firstSentence(raw),
      bodyChars: raw.length,
      topics: topicHits(raw),
    };
  })
  .sort((left, right) => left.created.localeCompare(right.created) || left.answerId.localeCompare(right.answerId));

const coverageByYear = answers.reduce((counts, answer) => {
  const year = answer.date.slice(0, 4);
  counts[year] = (counts[year] ?? 0) + 1;
  return counts;
}, {});
const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: {
    account: "马前卒official",
    accountUrl: "https://www.zhihu.com/people/shui-qian-xiao-xi",
    attribution: "睡前消息节目组账号；除非另有个人署名证据，不将其自动归为任冲昊个人原话。",
  },
  coverage: {
    indexedAnswers: answers.length,
    dateRange: {
      earliest: answers.at(0)?.date ?? "",
      latest: answers.at(-1)?.date ?? "",
    },
    byYear: coverageByYear,
  },
  answers,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(index)}\n`, "utf8");
console.log(`Indexed ${answers.length} Zhihu official answers.`);

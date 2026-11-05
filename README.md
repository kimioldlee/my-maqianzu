# 马督工（马前卒）思维操作系统

> 以《睡前消息》文字稿为主、知乎同类事件回答为补充的观点检索与分析框架。

[![Nuwa](https://img.shields.io/badge/Built%20with-Nuwa%20Engine-ff6b6b)](#)
[![Research Depth](https://img.shields.io/badge/Primary-Sleeping%20News%20Transcripts-success)](#)
[![License](https://img.shields.io/badge/License-MIT-yellow)](#)

---

## 📖 简介

先检索《睡前消息》对同一事件或同类机制的既有观点，再用节目方法分析新事件。2047 篇 `马前卒official` 知乎回答只补充节目未充分覆盖的相似案例；该账号是节目组专用号，不自动等同于任冲昊个人原话。

文字稿目录：<https://bedtime.blog/transcripts?channel=ShuiQianXiaoXi>

> 这不是角色扮演，是思维框架的转移。

---

## 🧠 核心能力

### 节目主方法

| # | 方法 | 一句话 |
|---|------|--------|
| 1 | **合理诉求排序** | 多方都可能有道理，但有限资源要求明确优先级。 |
| 2 | **效率公平边界** | 找出何处应允许市场试错，何处必须提供公共底线。 |
| 3 | **背景资料先行** | 严肃批判先交代进步、制度功能和历史条件。 |
| 4 | **物质制度解释** | 查生产率、财政、人口、地理、产业链和激励。 |
| 5 | **全生命周期成本** | 建设、运营、维护、转型和退出分别算账。 |
| 6 | **政策二阶效应** | 检查套利、抢数据、风险转移和后任成本。 |
| 7 | **标准品与专业劳动** | 可规模压价的产品，不等于可同样压价的人力。 |
| 8 | **人均与存量增量** | 不让宏大总量遮蔽个人处境和长期负担。 |
| 9 | **可执行替代方案** | 写清主体、资金、补偿、指标和过渡。 |

### 证据顺序

1. 同一事件的《睡前消息》文字稿。
2. 机制相似的节目及更晚回顾期。
3. 个人署名知乎回答，仅补充相似事件观点。
4. 节目未直接覆盖的当下热点，`马前卒official` 对同一事件的直接回答可优先于旧节目机制类比，但必须标为官方账号回应；若节目随后发布了更晚的直接回应，以更晚节目为准。
5. 其他 `马前卒official` 节目组账号回答，仅在节目没有直接材料时补充相似机制。
6. 当前一手数据，用于时效校正。

### 表达 DNA

- **归因清楚**：区分节目明确观点、框架推演和助手补充。
- **期号可查**：观点附期号、日期和文稿链接。
- **订正优先**：检查每页事实订正与待核对项。
- **节目为主**：知乎不能覆盖更完整或更新的节目观点。

---

## 🔬 调研深度

### 现有分段资料

| 文件 | 覆盖期数 |
|------|---------|
| `07-episodes-001-110.md` | 试播期 + 第 1-110 期 |
| `08-episodes-101-200.md` | 第 101-200 集 |
| `09-episodes-201-400.md` | 第 201-400 期 |
| `10-episodes-401-600.md` | 第 401-600 期 |
| `12-episodes-601-900.md` | 第 601-900 期 |
| `13-episodes-901-1100.md` | 第 901-1100 期 |

### 资料索引

| 文件 | 维度 |
|------|------|
| `01-writings.md` | 文字作品（《大目标》《临高启明》、公众号等） |
| `02-conversations.md` | 对话与即兴（播客访谈） |
| `03-expression-dna.md` | 表达 DNA 深度分析 |
| `04-external-views.md` | 外界评价与争议 |
| `05-decisions.md` | 关键决策记录 |
| `06-timeline.md` | 完整时间线（1981 至今） |
| `14-zhihu-answers.md` | 知乎账号边界与相似事件补充观点 |
| `15-transcript-framework.md` | 文字稿检索规则、节目方法论与跨期观点索引 |
| `16-coverage-matrix.md` | 合理终点定义、主题覆盖矩阵与检索回归场景 |
| `17-full-corpus-digest.md` | 892篇文稿的离线召回摘要 |
| `18-zhihu-official-corpus.md` | 2047篇官方账号回答的语料范围、检索和归因边界 |

> 文字稿目录核验截至 2026 年 11 月 2 日，覆盖到第1124期。所有现实数据仍需在使用时核验。

---

## 🚀 安装与使用

### 获取文件

首次使用请获取整个仓库，而不是只打开或复制 `SKILL.md`。本技能的离线索引、892篇节目文稿摘要、节目全文、2047篇知乎回答、检索脚本和原始 HTML 备份都在仓库的附属路径中；某些平台仍可能只自动挂载 `SKILL.md` 和 `SOUL.md`，这时技能会按 `SKILL.md` 中的 Raw/在线降级规则运行。

```bash
# 方式一：git clone（推荐）
git clone https://github.com/kimioldlee/my-maqianzu.git

# 方式二：npx（可能不保留大文件或目录，不推荐）
npx degit kimioldlee/my-maqianzu madugong-perspective

# 方式三：下载 ZIP
curl -LO https://github.com/kimioldlee/my-maqianzu/archive/refs/heads/main.zip
```

仓库为私有时，`git clone`、下载 ZIP 和 GitHub Raw 都要求当前 GitHub 账号或访问令牌拥有该仓库权限。若 AI 平台只加载 `SKILL.md`，却没有挂载附属目录，也无法在未认证条件下用 Raw 链接读取私有语料；应将完整克隆目录作为本地项目打开。

### 低上下文本地检索

本地语料不需要每次全部读入模型。默认使用边界检索器，只返回命中行附近的证据片段：

```powershell
cd my-maqianzu
node scripts/search_bedtime_transcripts.mjs . "事件词,机制词" 8 --context-lines 24 --max-chars 24000 --json
```

它也接受 `work\BedtimeNews-Transcripts` 或 `contents\ShuiQianXiaoXi` 作为路径。先看片段和行号，再按需要回读单篇原文；只有明确使用 `--full` 时才返回候选全文。完整规则见 [`LOCAL_RETRIEVAL.md`](LOCAL_RETRIEVAL.md)。

检索器默认对少量常见概念做别名扩展，例如“地方债”会关联“地方政府债务、隐性债务、城投债”。这是为冷门话题提供低成本的额外召回，不是语义模型；未知专名仍需补充同义词或改写查询。用 `--no-expand` 可关闭扩展。

### 每周自动刷新

节目稿同步已配置为 `.github/workflows/weekly-transcript-sync.yml`：每周日自动从公开的 `BedtimeNews-Transcripts` 源仓库拉取 `ShuiQianXiaoXi`，重建索引和离线摘要，检查文稿数量后自动提交到本私有仓库。GitHub Actions 页面也可手动运行。

知乎回答依赖本地已登录的浏览器会话，不能把 Cookie 放进 GitHub Actions。Windows 用户可在本机注册每周任务：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register_weekly_sync.ps1 -ProjectRoot (Get-Location)
schtasks /Run /TN "MyMaqianzu-WeeklyZhihuSync"
```

知乎任务会在临时目录抓取新增回答、重建全文和索引、校验文件数，再替换正式语料并提交推送。登录过期、验证码或设备验证会使本次任务失败，不会提交半成品；恢复登录后重新运行即可。详细说明见 [`LOCAL_RETRIEVAL.md`](LOCAL_RETRIEVAL.md)。

### 注入到 AI Agent

将 `SKILL.md` 全部内容作为 System Prompt 注入即可。具体方式取决于你用的 AI 工具：

| 工具 | 注入方式 |
|------|---------|
| **Claude Code** | `claude.md` 或 `CLAUDE.md` 文件 |
| **Cursor** | `.cursorrules` 或 Project Rules |
| **Windsurf** | `.windsurfrules` |
| **GitHub Copilot** | `.github/copilot-instructions.md` |
| **VS Code Cline** | `.clinerules` |
| **Hermes Agent** | `hermes skills enable madugong-perspective` |
| **任何 LLM API** | 将 SKILL.md 内容拼入 system message |

### 快速使用

安装并启用技能后，用户只需要提供新闻文字、链接、截图或文件，并说明要分析、评论还是生成口播稿。技能会自动完成资源可读性预检、节目主语料分层检索、当下热点的官方账号补充判断、事实和因果核验、多视角分析、口播稿整理以及 Sepia 审校；不要求用户再逐条输入检索命令。

例如：

```
这是关于国内电价调整的新闻，请按马前卒视角分析，并整理成可口播稿。
```

技能会优先检索“电价、能源、输配电、补贴、维护”等直接词和机制词，回读有限的相关原文，再核验当前调价文件。最终会区分节目明确观点、官方账号回应或补充、当前事实和助手推演；若某项资源未实际可读，会如实说明。完整流程和边界见 [`SKILL.md`](SKILL.md)。

> 更多示例见 `examples/usage-examples.md`

---

## 📂 仓库结构

```
madugong-perspective-skill/
├── README.md                    # 本文件
├── SKILL.md                     # 核心检索与分析规则
├── SOUL.md                      # 兼容摘要
├── LICENSE                      # MIT
├── bedtime-transcript-index.json # 892篇节目文稿的召回索引
├── references/
│   └── research/                # 完整调研资料
│       ├── 01-writings.md
│       ├── 02-conversations.md
│       ├── 03-expression-dna.md
│       ├── 04-external-views.md
│       ├── 05-decisions.md
│       ├── 06-timeline.md
│       ├── 07-episodes-001-110.md
│       ├── 08-episodes-101-200.md
│       ├── 09-episodes-201-400.md
│       ├── 10-episodes-401-600.md
│       ├── 12-episodes-601-900.md
│       ├── 13-episodes-901-1100.md
│       ├── 14-zhihu-answers.md
│       ├── 15-transcript-framework.md
│       ├── 16-coverage-matrix.md
│       ├── 17-full-corpus-digest.md
│       └── 18-zhihu-official-corpus.md
├── work/
│   ├── BedtimeNews-Transcripts/ # 892篇节目文稿正文
│   └── ZhihuOfficial-Answers/   # 2047篇官方账号回答与原始 HTML
├── examples/
│   └── usage-examples.md        # 使用示例
└── scripts/
    ├── search_bedtime_transcripts.mjs
    ├── search_zhihu_official_answers.mjs
    ├── zhihu/                  # 可复跑抓取、转写脚本（不含登录态）
    └── install.sh               # 可选安装脚本
```

---

## ⚖️ 免责声明

1. **这不是马督工本人。** 这是基于公开信息提炼的思维框架。
2. **局限性：** 节目观点受当时资料与条件约束，框架推演不等于本人观点。
3. **时效性：** 文字稿目录核验截至 2026 年 11 月 2 日；现实事件仍需实时核验。
4. **开源：** 欢迎 Fork 和贡献，请保留 Nuwa Engine 出处。

---

## 📜 许可与语料权利

MIT License 仅适用于本仓库自行编写的代码与说明文件。`work/BedtimeNews-Transcripts/` 中的节目文稿和 `work/ZhihuOfficial-Answers/` 中的知乎回答，其著作权仍归原权利人；纳入本仓库用于检索、学习、核验与短引，不构成对原文的重新授权。使用、镜像或再发布前应自行确认适用的权利和平台规则。

---

## 🙏 致谢

- [Nuwa Skill Engine](https://github.com/nousresearch/hermes/tree/main/skills/nuwa-skill) — 蒸馏框架
- 《睡前消息》原节目与文字稿整理项目
- 所有在 GitHub 上分享蒸馏人格的先行者们

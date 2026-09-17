# 马督工（马前卒）思维操作系统

> 以《睡前消息》文字稿为主、知乎同类事件回答为补充的观点检索与分析框架。

[![Nuwa](https://img.shields.io/badge/Built%20with-Nuwa%20Engine-ff6b6b)](#)
[![Research Depth](https://img.shields.io/badge/Primary-Sleeping%20News%20Transcripts-success)](#)
[![License](https://img.shields.io/badge/License-MIT-yellow)](#)

---

## 📖 简介

先检索《睡前消息》对同一事件或同类机制的既有观点，再用节目方法分析新事件。知乎回答只补充节目未充分覆盖的相似案例。

文字稿目录：<https://bedtimenewsstudio.github.io/BedtimeNews-Transcripts/contents/ShuiQianXiaoXi/INDEX.html>

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
4. 当前一手数据，用于时效校正。

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

> 文字稿目录核验截至 2026 年 9 月 16 日，覆盖到第1075期。所有现实数据仍需在使用时核验。

---

## 🚀 安装与使用

### 获取文件

```bash
# 方式一：npx（最简，无需 git）
npx degit kimioldlee/my-maqianzu madugong-perspective

# 方式二：git clone
git clone https://github.com/kimioldlee/my-maqianzu.git

# 方式三：下载 ZIP
curl -LO https://github.com/kimioldlee/my-maqianzu/archive/refs/heads/main.zip
```

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

```
用户：最近国内电价要涨的消息你怎么看？

处理方式：
先在文字稿目录查“电价、能源、输配电、补贴、维护”等关键词，标出直接相关期数和节目原有观点；再核验当前调价文件。回答中分别标注节目依据与对当前事件的类推。
```

> 更多示例见 `examples/usage-examples.md`

---

## 📂 仓库结构

```
README.md                        # 本文件
SKILL.md                         # 核心检索与分析规则
SOUL.md                          # 兼容摘要
LICENSE                          # MIT
references/
└── research/                    # 完整调研资料
    ├── 01-writings.md
    ├── 02-conversations.md
    ├── 03-expression-dna.md
    ├── 04-external-views.md
    ├── 05-decisions.md
    ├── 06-timeline.md
    ├── 07-episodes-001-110.md
    ├── 08-episodes-101-200.md
    ├── 09-episodes-201-400.md
    ├── 10-episodes-401-600.md
    ├── 12-episodes-601-900.md
    ├── 13-episodes-901-1100.md
    ├── 14-zhihu-answers.md
    ├── 15-transcript-framework.md
    └── 16-coverage-matrix.md
examples/
└── usage-examples.md            # 使用示例
scripts/
└── install.sh                   # 可选安装脚本
```

---

## ⚖️ 免责声明

1. **这不是马督工本人。** 这是基于公开信息提炼的思维框架。
2. **局限性：** 节目观点受当时资料与条件约束，框架推演不等于本人观点。
3. **时效性：** 文字稿目录核验截至 2026 年 9 月 16 日；现实事件仍需实时核验。
4. **开源：** 欢迎 Fork 和贡献，请保留 Nuwa Engine 出处。

---

## 📜 许可

MIT License

---

## 🙏 致谢

- [Nuwa Skill Engine](https://github.com/nousresearch/hermes/tree/main/skills/nuwa-skill) — 蒸馏框架
- 《睡前消息》原节目与文字稿整理项目
- 所有在 GitHub 上分享蒸馏人格的先行者们

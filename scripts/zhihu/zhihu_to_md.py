"""把抓取到的知乎回答 HTML 转成 markdown 文字稿，并按日期生成索引。

输入：zhihu_answers_raw.jsonl
输出：zhihu_md/<日期>-<回答id>.md  以及  zhihu_INDEX.md
"""
import json
import os
import re
import shutil
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent
DATA_ROOT = Path(os.environ.get("ZHIHU_DATA_ROOT", ROOT)).resolve()
SRC = DATA_ROOT / "zhihu-answers-raw.jsonl"
OUT_DIR = DATA_ROOT / "answers"
INDEX = DATA_ROOT / "INDEX.md"
CST = timezone(timedelta(hours=8))

BLOCK = {"p", "div", "blockquote", "li", "h1", "h2", "h3", "h4", "section", "tr"}
SKIP = {"script", "style", "noscript"}


class ZhihuHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.stack: list[str] = []
        self.skip_depth = 0
        self.list_depth = 0
        self.links: list[str] = []

    def handle_starttag(self, tag, attrs):
        attr = dict(attrs)
        if tag in SKIP:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag == "br":
            self.parts.append("\n")
            return
        if tag == "img":
            src = attr.get("data-original") or attr.get("src") or ""
            if src and src.startswith("//"):
                src = "https:" + src
            if src:
                self.parts.append(f"\n![图片]({src})\n")
            return
        if tag == "a":
            href = attr.get("href") or ""
            if href.startswith("/"):
                href = "https://www.zhihu.com" + href
            self.links.append(href)
            self.stack.append("a")
            return
        if tag in ("b", "strong"):
            self.parts.append("**")
            self.stack.append("b")
            return
        if tag in ("i", "em"):
            self.parts.append("*")
            self.stack.append("i")
            return
        if tag in ("ul", "ol"):
            self.list_depth += 1
            self.parts.append("\n")
            self.stack.append(tag)
            return
        if tag == "li":
            self.parts.append("\n- ")
            self.stack.append("li")
            return
        if tag == "blockquote":
            self.parts.append("\n> ")
            self.stack.append(tag)
            return
        if tag in BLOCK:
            self.parts.append("\n")
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in SKIP:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.skip_depth:
            return
        if tag == "a" and "a" in self.stack:
            self.stack.remove("a")
            href = self.links.pop() if self.links else ""
            if href and "zhihu.com" not in href:
                self.parts.append(f"（{href}）")
            return
        if tag in ("b", "strong") and "b" in self.stack:
            self.stack.remove("b")
            self.parts.append("**")
            return
        if tag in ("i", "em") and "i" in self.stack:
            self.stack.remove("i")
            self.parts.append("*")
            return
        if tag in ("ul", "ol") and tag in self.stack:
            self.stack.remove(tag)
            self.list_depth = max(0, self.list_depth - 1)
            self.parts.append("\n")
            return
        if tag in ("li", "blockquote") and tag in self.stack:
            self.stack.remove(tag)
            self.parts.append("\n")
            return
        if tag in BLOCK and tag in self.stack:
            self.stack.remove(tag)
            self.parts.append("\n")

    def handle_data(self, data):
        if self.skip_depth:
            return
        self.parts.append(data)

    def result(self) -> str:
        text = "".join(self.parts)
        text = re.sub(r"\n{3,}", "\n\n", text)
        lines = [ln.rstrip() for ln in text.split("\n")]
        return "\n".join(lines).strip()


def html_to_text(html: str) -> str:
    parser = ZhihuHTMLParser()
    parser.feed(html or "")
    return parser.result()


def safe(name: str, limit: int = 40) -> str:
    name = re.sub(r'[\\/:*?"<>|\r\n\t]', "", name or "").strip()
    return name[:limit] or "untitled"


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    rows = []
    for line in SRC.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))

    seen = set()
    items = []
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        items.append(r)
    items.sort(key=lambda r: r.get("created_time") or 0)

    index_lines = ["# 马前卒official 知乎回答文字稿索引", "",
                   f"账号：<https://www.zhihu.com/people/shui-qian-xiao-xi>",
                   f"导出时间：{datetime.now(CST).strftime('%Y-%m-%d %H:%M')}（UTC+8）",
                   f"共 {len(items)} 篇", "",
                   "| # | 日期 | 问题 | 赞同 | 评论 | 文件 |", "|---|------|------|----|----|------|"]

    for i, r in enumerate(items, 1):
        created = r.get("created_time") or 0
        updated = r.get("updated_time") or 0
        dt = datetime.fromtimestamp(created, CST) if created else None
        dts = dt.strftime("%Y-%m-%d") if dt else "0000-00-00"
        body = html_to_text(r.get("content_html") or "")
        title = (r.get("question_title") or "").strip()
        fname = f"{dts}-{r['id']}-{safe(title)}.md"
        vote = r.get("voteup_count")
        vote_txt = "未知" if vote is None else str(vote)
        front = [
            "---",
            f"title: {title}",
            f"question_id: {r.get('question_id')}",
            f"answer_id: {r['id']}",
            f"url: {r.get('url')}",
            f"author: 马前卒official（睡前消息节目组账号）",
            f"created: {dt.strftime('%Y-%m-%d %H:%M') if dt else '未知'}",
            f"updated: {datetime.fromtimestamp(updated, CST).strftime('%Y-%m-%d %H:%M') if updated else '未知'}",
            f"voteup: {vote_txt}",
            f"comments: {r.get('comment_count')}",
            "---",
            "",
            f"# {title}", "",
            f"- 链接：{r.get('url')}",
            f"- 发布：{dt.strftime('%Y-%m-%d %H:%M') if dt else '未知'}（UTC+8）　赞同 {vote_txt}　评论 {r.get('comment_count')}",
            "", "---", "",
        ]
        (OUT_DIR / fname).write_text("\n".join(front) + body + "\n", encoding="utf-8")
        index_lines.append(
            f"| {i} | {dts} | {title.replace('|', '/')} | {vote_txt} | "
            f"{r.get('comment_count')} | [{fname}](answers/{fname}) |"
        )

    INDEX.write_text("\n".join(index_lines) + "\n", encoding="utf-8")
    print(f"已生成 {len(items)} 篇文字稿 -> {OUT_DIR}，索引 -> {INDEX}")


if __name__ == "__main__":
    main()

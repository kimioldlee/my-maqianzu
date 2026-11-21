"""把抓取到的知乎回答 HTML 转成 markdown 文字稿，并按日期生成索引。

输入：zhihu_answers_raw.jsonl
输出：answers/<日期>-<回答id>.md  以及  INDEX.md（链接前缀为 answers/）
"""
import json
import os
import re
import shutil
import tempfile
import uuid
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).parent
DATA_ROOT = Path(os.environ.get("ZHIHU_DATA_ROOT", ROOT)).resolve()
SRC = DATA_ROOT / "zhihu-answers-raw.jsonl"
OUT_DIR = DATA_ROOT / "answers"
INDEX = DATA_ROOT / "INDEX.md"
CST = timezone(timedelta(hours=8))

BLOCK = {"p", "div", "blockquote", "li", "h1", "h2", "h3", "h4", "section", "tr"}
SKIP = {"script", "style", "noscript"}


def safe_http_url(value: str) -> str:
    candidate = str(value or "").strip()
    if candidate.startswith("//"):
        candidate = "https:" + candidate
    parsed = urlparse(candidate)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return ""
    if re.search(r"[\s()<>{}\x00-\x1f]", candidate):
        return ""
    return candidate


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
            src = safe_http_url(attr.get("data-original") or attr.get("src") or "")
            if src:
                self.parts.append(f"\n![图片]({src})\n")
            return
        if tag == "a":
            href = attr.get("href") or ""
            if href.startswith("/"):
                href = "https://www.zhihu.com" + href
            self.links.append(safe_http_url(href))
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
    name = re.sub(r'[\\/:*?"<>|\r\n\t\[\]()#]', "", name or "").strip()
    return name[:limit] or "untitled"


def one_line(value) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def markdown_inline(value) -> str:
    return re.sub(r"([\\`*_\[\]<>])", r"\\\1", one_line(value)).replace("|", "/")


def yaml_string(value) -> str:
    return json.dumps(str(value), ensure_ascii=False)


def timestamp(value, field: str, line_number: int) -> int:
    if value in (None, ""):
        return 0
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"第 {line_number} 行的 {field} 不是整数时间戳") from exc
    if number < 0:
        raise ValueError(f"第 {line_number} 行的 {field} 不能为负数")
    return number


def load_rows() -> list[dict]:
    if not SRC.is_file():
        raise FileNotFoundError(f"找不到原始知乎数据：{SRC}")
    rows = []
    for line_number, line in enumerate(SRC.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"第 {line_number} 行不是有效 JSON，未改写现有 Markdown") from exc
        if not isinstance(row, dict):
            raise ValueError(f"第 {line_number} 行必须是 JSON 对象")
        answer_id = one_line(row.get("id"))
        if not re.fullmatch(r"\d+", answer_id):
            raise ValueError(f"第 {line_number} 行缺少有效的回答 ID")
        question_id = one_line(row.get("question_id"))
        if not re.fullmatch(r"\d+", question_id):
            raise ValueError(f"第 {line_number} 行缺少有效的问题 ID")
        row["id"] = answer_id
        row["question_id"] = question_id
        row["created_time"] = timestamp(row.get("created_time"), "created_time", line_number)
        row["updated_time"] = timestamp(row.get("updated_time"), "updated_time", line_number)
        rows.append(row)
    return rows


def remove_path(target: Path) -> None:
    if not target.exists() and not target.is_symlink():
        return
    if target.is_dir() and not target.is_symlink():
        shutil.rmtree(target)
    else:
        target.unlink()


def promote(staged_answers: Path, staged_index: Path) -> None:
    if OUT_DIR.is_symlink() or INDEX.is_symlink():
        raise RuntimeError("拒绝通过符号链接替换 answers 或 INDEX.md")
    token = f"{os.getpid()}-{uuid.uuid4().hex}"
    backup_answers = DATA_ROOT / f".answers-backup-{token}"
    backup_index = DATA_ROOT / f".INDEX-backup-{token}.md"
    answers_backed_up = False
    index_backed_up = False
    answers_promoted = False
    index_promoted = False
    try:
        if OUT_DIR.exists():
            OUT_DIR.replace(backup_answers)
            answers_backed_up = True
        if INDEX.exists():
            INDEX.replace(backup_index)
            index_backed_up = True
        staged_answers.replace(OUT_DIR)
        answers_promoted = True
        staged_index.replace(INDEX)
        index_promoted = True
    except Exception:
        if answers_promoted:
            remove_path(OUT_DIR)
        if index_promoted:
            remove_path(INDEX)
        if answers_backed_up and backup_answers.exists():
            backup_answers.replace(OUT_DIR)
        if index_backed_up and backup_index.exists():
            backup_index.replace(INDEX)
        raise
    else:
        remove_path(backup_answers)
        remove_path(backup_index)


def main() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    rows = load_rows()

    seen = set()
    items = []
    for r in rows:
        if r["id"] in seen:
            continue
        seen.add(r["id"])
        items.append(r)
    items.sort(key=lambda r: r.get("created_time") or 0)

    staged_answers = Path(tempfile.mkdtemp(prefix=".answers-staging-", dir=DATA_ROOT))
    staged_index = DATA_ROOT / f".INDEX-staging-{os.getpid()}-{uuid.uuid4().hex}.md"

    index_lines = ["# 马前卒official 知乎回答文字稿索引", "",
                   f"账号：<https://www.zhihu.com/people/shui-qian-xiao-xi>",
                   f"导出时间：{datetime.now(CST).strftime('%Y-%m-%d %H:%M')}（UTC+8）",
                   f"共 {len(items)} 篇", "",
                   "| # | 日期 | 问题 | 赞同 | 评论 | 文件 |", "|---|------|------|----|----|------|"]

    try:
        for i, r in enumerate(items, 1):
            created = r.get("created_time") or 0
            updated = r.get("updated_time") or 0
            dt = datetime.fromtimestamp(created, CST) if created else None
            dts = dt.strftime("%Y-%m-%d") if dt else "0000-00-00"
            body = html_to_text(r.get("content_html") or "")
            title = one_line(r.get("question_title"))
            display_title = markdown_inline(title)
            fname = f"{dts}-{r['id']}-{safe(title)}.md"
            vote = r.get("voteup_count")
            vote_txt = "未知" if vote is None else one_line(vote)
            comments_txt = one_line(r.get("comment_count")) or "未知"
            answer_url = f"https://www.zhihu.com/question/{one_line(r.get('question_id'))}/answer/{r['id']}"
            created_txt = dt.strftime("%Y-%m-%d %H:%M") if dt else "未知"
            updated_txt = datetime.fromtimestamp(updated, CST).strftime("%Y-%m-%d %H:%M") if updated else "未知"
            front = [
                "---",
                f"title: {yaml_string(title)}",
                f"question_id: {yaml_string(one_line(r.get('question_id')))}",
                f"answer_id: {yaml_string(r['id'])}",
                f"url: {yaml_string(answer_url)}",
                f"author: {yaml_string('马前卒official（睡前消息节目组账号）')}",
                f"created: {yaml_string(created_txt)}",
                f"updated: {yaml_string(updated_txt)}",
                f"voteup: {yaml_string(vote_txt)}",
                f"comments: {yaml_string(comments_txt)}",
                "---",
                "",
                f"# {display_title}", "",
                f"- 链接：{answer_url}",
                f"- 发布：{created_txt}（UTC+8）　赞同 {vote_txt}　评论 {comments_txt}",
                "", "---", "",
            ]
            (staged_answers / fname).write_text("\n".join(front) + body + "\n", encoding="utf-8")
            index_lines.append(
                f"| {i} | {dts} | {display_title} | {vote_txt} | "
                f"{comments_txt} | [{fname}](answers/{fname}) |"
            )

        staged_index.write_text("\n".join(index_lines) + "\n", encoding="utf-8")
        promote(staged_answers, staged_index)
    finally:
        remove_path(staged_answers)
        remove_path(staged_index)
    print(f"已生成 {len(items)} 篇文字稿 -> {OUT_DIR}，索引 -> {INDEX}")


if __name__ == "__main__":
    main()

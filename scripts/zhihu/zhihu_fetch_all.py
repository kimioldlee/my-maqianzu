"""在已登录浏览器会话内分页抓取「马前卒official」全部知乎回答（含正文 HTML）。

用法：python zhihu_fetch_all.py [每页条数，默认20]
输出：zhihu-answers-raw.jsonl（按回答 ID 保留最新版本）
"""
import json
import os
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
DATA_ROOT = Path(os.environ.get("ZHIHU_DATA_ROOT", ROOT)).resolve()
PROFILE = ROOT / "zhihu-session"
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
OUT = DATA_ROOT / "zhihu-answers-raw.jsonl"

INCLUDE = ("data%5B*%5D.is_normal%2Cadmin_closed_comment%2Creward_info%2Cis_collapsed%2C"
           "annotation_action%2Cannotation_detail%2Ccollapse_reason%2Cis_sticky%2Ccollapsed_by%2C"
           "suggest_edit%2Ccomment_count%2Ccan_comment%2Ccontent%2Ceditable_content%2Cvoteup_count%2C"
           "reshipment_settings%2Ccomment_permission%2Ccreated_time%2Cupdated_time%2C"
           "review_info%2Crelevant_info%2Cquestion.excerpt%2Crelationship.is_author%2C"
           "is_author%2Cvoting%2Cis_thanked%2Cis_nothelp%2Cis_labeled%2Cis_recognized%2C"
           "paid_info%2Cpaid_info_content%2Cauthor.badge%5B%3F(type%3Dbest_answerer)%5D.topics")

API = ("https://www.zhihu.com/api/v4/members/shui-qian-xiao-xi/answers"
       f"?include={INCLUDE}&offset={{offset}}&limit={{limit}}&sort_by=created")

JS = """async (api) => {
  const r = await fetch(api, { headers: { 'x-requested-with': 'fetch' }, credentials: 'include' });
  const t = await r.text();
  return { status: r.status, body: t };
}"""


def main() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 2:
        raise SystemExit("用法：python zhihu_fetch_all.py [每页条数，1-100]")
    try:
        limit = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    except ValueError as exc:
        raise SystemExit("每页条数必须是 1-100 的整数") from exc
    if not 1 <= limit <= 100:
        raise SystemExit("每页条数必须在 1-100 之间")
    records = {}
    if OUT.exists():
        for line_number, line in enumerate(OUT.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as exc:
                raise RuntimeError(
                    f"现有原始语料第 {line_number} 行不是有效 JSON；为避免丢失旧记录，本次停止写入。"
                ) from exc
            if not isinstance(rec, dict) or not str(rec.get("id") or "").strip().isdigit():
                raise RuntimeError(
                    f"现有原始语料第 {line_number} 行缺少回答 ID；为避免丢失旧记录，本次停止写入。"
                )
            records[str(rec["id"])] = rec
    print(f"已有 {len(records)} 条，检查新增和更新。", flush=True)

    with sync_playwright() as p:
        kwargs = {"user_data_dir": str(PROFILE), "headless": False,
                  "args": ["--disable-blink-features=AutomationControlled"], "no_viewport": True}
        if Path(CHROME).exists():
            kwargs["executable_path"] = CHROME
        ctx = p.chromium.launch_persistent_context(**kwargs)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://www.zhihu.com/people/shui-qian-xiao-xi/answers", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(3000)

        offset = 0
        total = None
        added = updated = 0
        while True:
            res = page.evaluate(JS, API.format(offset=offset, limit=limit))
            if res["status"] != 200:
                print(f"offset={offset} 返回 {res['status']}，等待后重试", flush=True)
                page.wait_for_timeout(5000)
                res = page.evaluate(JS, API.format(offset=offset, limit=limit))
                if res["status"] != 200:
                    raise RuntimeError(f"知乎 API 在 offset={offset} 连续失败，HTTP {res['status']}；原始语料未改写。")
            try:
                data = json.loads(res["body"])
            except Exception as exc:  # noqa: BLE001
                raise RuntimeError(f"知乎 API 在 offset={offset} 返回无效 JSON；原始语料未改写。") from exc
            if total is None:
                total = data.get("paging", {}).get("totals")
                print(f"总量：{total}", flush=True)
            items = data.get("data", [])
            if not isinstance(items, list):
                raise RuntimeError(f"知乎 API 在 offset={offset} 返回的 data 不是数组；原始语料未改写。")
            if not items:
                if data.get("paging", {}).get("is_end"):
                    print("已到末页。", flush=True)
                    break
                raise RuntimeError(f"知乎 API 在 offset={offset} 提前返回空页；原始语料未改写。")

            page_added = page_updated = 0
            for it in items:
                if not isinstance(it, dict) or not str(it.get("id") or "").strip().isdigit():
                    raise RuntimeError(f"知乎 API 在 offset={offset} 返回缺少回答 ID 的记录；原始语料未改写。")
                q = it.get("question") or {}
                if not isinstance(q, dict) or not str(q.get("id") or "").strip().isdigit():
                    raise RuntimeError(f"知乎 API 在 offset={offset} 返回缺少问题 ID 的记录；原始语料未改写。")
                rec = {
                    "id": str(it.get("id")),
                    "question_id": q.get("id"),
                    "question_title": q.get("title"),
                    "question_excerpt": (q.get("excerpt") or "")[:500],
                    "created_time": it.get("created_time"),
                    "updated_time": it.get("updated_time"),
                    "voteup_count": it.get("voteup_count"),
                    "comment_count": it.get("comment_count"),
                    "excerpt": it.get("excerpt"),
                    "content_html": it.get("content"),
                    "url": f"https://www.zhihu.com/question/{q.get('id')}/answer/{it.get('id')}",
                }
                key = rec["id"]
                if key not in records:
                    page_added += 1
                elif records[key] != rec:
                    page_updated += 1
                records[key] = rec
            added += page_added
            updated += page_updated
            print(f"offset={offset}: 本页 {len(items)}，新增 {page_added}，更新 {page_updated}", flush=True)
            if data.get("paging", {}).get("is_end"):
                print("已到末页。", flush=True)
                break
            offset += limit
            time.sleep(1.2)
        ctx.close()

    temp_out = OUT.with_suffix(OUT.suffix + ".tmp")
    with temp_out.open("w", encoding="utf-8", newline="\n") as fh:
        for rec in records.values():
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
    temp_out.replace(OUT)
    print(f"完成：新增 {added} 条，更新 {updated} 条，共 {len(records)} 条 -> {OUT}")


if __name__ == "__main__":
    main()

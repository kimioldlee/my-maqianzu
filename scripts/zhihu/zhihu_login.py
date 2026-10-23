"""打开一个独立浏览器窗口，等待用户现场登录知乎，然后保存登录态。

用法：python zhihu_login.py
登录后 login state 写入 zhihu_state.json，供后续抓取脚本复用。
"""
import json
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).parent
PROFILE = ROOT / "zhihu-session"
STATE = ROOT / "zhihu_state.json"
TARGET = "https://www.zhihu.com/people/shui-qian-xiao-xi/answers"
CHROME = r"C:/Program Files/Google/Chrome/Application/chrome.exe"
WAIT_SECONDS = 900  # 最长等 15 分钟给用户登录


def main() -> None:
    PROFILE.mkdir(exist_ok=True)
    with sync_playwright() as p:
        launch_kwargs = {
            "user_data_dir": str(PROFILE),
            "headless": False,
            "args": ["--disable-blink-features=AutomationControlled", "--start-maximized"],
            "no_viewport": True,
        }
        if Path(CHROME).exists():
            launch_kwargs["executable_path"] = CHROME
        ctx = p.chromium.launch_persistent_context(**launch_kwargs)
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(TARGET, wait_until="domcontentloaded", timeout=60000)

        print("浏览器已打开，请在窗口内登录知乎（扫码或账密）。登录成功后脚本会自动继续。", flush=True)

        deadline = time.time() + WAIT_SECONDS
        logged_in = False
        while time.time() < deadline:
            cookies = {c["name"]: c["value"] for c in ctx.cookies()}
            if cookies.get("z_c0"):
                logged_in = True
                break
            time.sleep(3)

        if not logged_in:
            print("未检测到登录态（超时）。", flush=True)
            ctx.close()
            return

        ctx.storage_state(path=str(STATE))
        print(f"登录态已保存：{STATE}", flush=True)
        page.goto(TARGET, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        title = page.title()
        print(f"页面标题：{title}", flush=True)
        print("保持窗口打开 20 秒以便人工确认。", flush=True)
        page.wait_for_timeout(20000)
        ctx.close()


if __name__ == "__main__":
    main()

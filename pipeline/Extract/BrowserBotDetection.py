"""
Browser-render fallback, used only when curl_bot_detection fails (bot
challenge, JS-gated content). Most India news sites won't need this.

NOTE: needs crawl4ai + playwright installed, not available in this sandbox,
so this file is untested here. Verify locally.
"""

import asyncio

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

RENDER_DELAY = 6

UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"


def _desktop_view() -> BrowserConfig:
    return BrowserConfig(
        headless=True,
        browser_type="chromium",
        enable_stealth=True,
        user_agent=UA_DESKTOP,
        user_agent_mode="random",
        headers={"Accept-Language": "en-US,en;q=0.9"},
        viewport_width=1920,
        viewport_height=1080,
    )


async def _render(url: str) -> str:
    try:
        async with AsyncWebCrawler(config=_desktop_view()) as crawler:
            result = await crawler.arun(
                url, config=CrawlerRunConfig(delay_before_return_html=RENDER_DELAY, wait_for_images=False)
            )
            return result.html if result and result.success else ""
    except Exception as e:
        print(f"[browser_bot_detection] render failed on {url}: {e}")
        return ""


def fetch(url: str) -> str:
    """Sync wrapper -- call from a worker thread if already inside an event loop."""
    return asyncio.run(_render(url))
from enum import Enum

import trafilatura

from Extract import CurlBotDetection, BrowserBotDetection

MIN_WORD_COUNT_FOR_FULL_ARTICLE = 80
CHALLENGE_PAGE_PREFIXES = ("blocked by the site", "blocked: challenge page")


class ExtractionStatus(Enum):
    OK = "ok"
    PAYWALLED = "paywalled"
    BLOCKED = "blocked"
    ERROR = "error"


class HELPER:
    @staticmethod
    def fetch_html(url: str) -> tuple[str, str | None, bool]:
        html, _, problem = CurlBotDetection.fetch(url)
        used_browser_fallback = False

        if problem and problem.startswith(CHALLENGE_PAGE_PREFIXES):
            try:
                rendered_html = BrowserBotDetection.fetch(url)
            except Exception as e:
                rendered_html = ""
                print(f"[content] browser fallback unavailable: {e}")
            if rendered_html:
                html, problem, used_browser_fallback = rendered_html, None, True

        return html, problem, used_browser_fallback

    @staticmethod
    def convert_html_to_markdown(html: str, url: str) -> tuple[str | None, bool]:
        if not html:
            return None, True

        markdown = trafilatura.extract(
            html,
            url=url,
            output_format="markdown",
            with_metadata=False,
            include_comments=False,
            include_tables=True,
        )
        if not markdown:
            return None, True

        is_likely_paywall_stub = len(markdown.split()) < MIN_WORD_COUNT_FOR_FULL_ARTICLE
        return markdown, is_likely_paywall_stub


def extract_filtered_markdown(url: str) -> dict:
    html, problem, used_browser_fallback = HELPER.fetch_html(url)

    if problem and problem.startswith("page not found"):
        return {"url": url, "markdown": None, "status": ExtractionStatus.ERROR, "used_browser_fallback": used_browser_fallback}

    if problem and problem.startswith(("blocked", "could not reach", "too many redirects", "status")):
        return {"url": url, "markdown": None, "status": ExtractionStatus.BLOCKED, "used_browser_fallback": used_browser_fallback}

    markdown, is_likely_paywall_stub = HELPER.convert_html_to_markdown(html, url)

    if markdown is None:
        return {"url": url, "markdown": None, "status": ExtractionStatus.ERROR, "used_browser_fallback": used_browser_fallback}

    is_paywalled = bool(problem and problem.startswith("paywalled")) or is_likely_paywall_stub
    return {
        "url": url,
        "markdown": markdown,
        "status": ExtractionStatus.PAYWALLED if is_paywalled else ExtractionStatus.OK,
        "used_browser_fallback": used_browser_fallback,
    }


if __name__ == "__main__":
    result = extract_filtered_markdown("https://www.thehindu.com/news/national/article-sample.cms")
    print(result["status"], len(result["markdown"] or ""))

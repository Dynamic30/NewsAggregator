import re
from urllib.parse import urljoin

from curl_cffi import requests as curl_requests

HEADERS = {"Accept-Language": "en-US,en;q=0.9"}

# A challenge page normally answers 200, so status alone proves nothing.
# Only <title> + first 2KB are checked to avoid false positives from
# "cloudflare" appearing in normal script tags.
CHALLENGE_MARKERS = [
    "cf_chl_opt", "cf-browser-verification", "just a moment", "attention required",
    "errors.edgesuite.net", "reference #18.",      # akamai
    "geo.captcha-delivery.com",                     # datadome
    "px-captcha",                                   # perimeterx
    "robot check", "are you a human", "unusual traffic", "enter the characters",
]

PAYWALL_MARKERS = [
    "metered-content", "paywall", "subscribe to continue reading",
    "subscribe to read", "this content is for subscribers",
]


def fetch(url: str, timeout: int = 25) -> tuple[str, int, str | None]:
    try:
        with curl_requests.Session() as s:
            for _ in range(5):
                r = s.get(
                    url, impersonate="chrome", timeout=timeout,
                    headers=HEADERS, allow_redirects=False,
                )
                location = r.headers.get("location")
                if r.status_code not in (301, 302, 303, 307, 308) or not location:
                    break
                url = urljoin(url, location)
            else:
                return "", r.status_code, "too many redirects"
    except Exception as e:
        return "", 0, f"could not reach the page: {type(e).__name__}"

    html, status = r.text or "", r.status_code

    if status == 404:
        return html, status, "page not found (404)"
    if status in (401, 403, 429, 503):
        return html, status, f"blocked by the site (status {status})"
    if status >= 400:
        return html, status, f"status {status}"

    m = re.search(r"<title[^>]*>(.*?)</title>", html[:4000], re.S | re.I)
    title = m.group(1).strip().lower() if m else ""
    head = html[:2000].lower()

    for marker in CHALLENGE_MARKERS:
        if marker in title or marker in head:
            return html, status, f"blocked: challenge page ({marker})"

    for marker in PAYWALL_MARKERS:
        if marker in head:
            return html, status, f"paywalled ({marker})"

    return html, status, None
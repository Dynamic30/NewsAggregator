
import asyncio
from urllib.parse import urlparse
 
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
 
DEFAULT_SOURCE = "Economic Times"
FETCH_TIMEOUT_SECONDS = 30
 
 
def source_from_url(url: str) -> str:
    if not url:
        return DEFAULT_SOURCE
    domain = urlparse(url).netloc.replace("www.", "")
    return domain or DEFAULT_SOURCE
 
 
async def fetch_economic_times(feed_path: str) -> list[dict]:
    """feed_path: the path after the domain, e.g. 'tech/rssfeeds/13357270.cms'."""
    url = f"https://economictimes.indiatimes.com/{feed_path}"
 
    async with AsyncSession() as session:
        resp = await session.get(url, impersonate="chrome110", timeout=FETCH_TIMEOUT_SECONDS)
        resp.raise_for_status()
 
    soup = BeautifulSoup(resp.content, "xml")
    results = []
    for item in soup.find_all("item"):
        title_tag = item.find("title")
        link_tag = item.find("link")
        pubdate_tag = item.find("pubDate")
        desc_tag = item.find("description")
 
        article_url = link_tag.get_text(strip=True) if link_tag else None
        results.append({
            "title": title_tag.get_text(strip=True) if title_tag else None,
            "url": article_url,
            "published_date": pubdate_tag.get_text(strip=True) if pubdate_tag else None,
            "description": desc_tag.get_text(strip=True) if desc_tag else None,
            "source": source_from_url(article_url),
        })
    return results
 
 
if __name__ == "__main__":
    articles = asyncio.run(fetch_economic_times("tech/rssfeeds/13357270.cms"))
    print(f"Fetched {len(articles)} articles\n")
    for a in articles[:3]:
        print(a)
 

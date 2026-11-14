import asyncio
from urllib.parse import urlparse
 
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
 
DEFAULT_SOURCE = "NDTV"
 
 
def source_from_url(url: str) -> str:
    if not url:
        return DEFAULT_SOURCE
    domain = urlparse(url).netloc.replace("www.", "")
    return domain or DEFAULT_SOURCE
 
 
async def fetch_ndtv(feed_url: str) -> list[dict]:
    """feed_url: full feedburner URL, e.g. 'https://feeds.feedburner.com/ndtvnews-india-news'."""
    async with AsyncSession() as session:
        resp = await session.get(feed_url, impersonate="chrome110")
        resp.raise_for_status()
 
    soup = BeautifulSoup(resp.content, "xml")
    results = []
    for item in soup.find_all("item"):
        title_tag = item.find("title")
        link_tag = item.find("link")
        pubdate_tag = item.find("pubDate")
        desc_tag = item.find("description")
        media_content_tag = item.find("media:content")

        article_url = link_tag.get_text(strip=True) if link_tag else None
        results.append({
            "title": title_tag.get_text(strip=True) if title_tag else None,
            "url": article_url,
            "published_date": pubdate_tag.get_text(strip=True) if pubdate_tag else None,
            "description": desc_tag.get_text(strip=True) if desc_tag else None,
            "source": source_from_url(article_url),
            "image_url": media_content_tag.get("url") if media_content_tag else None,
        })
    return results
 
 
if __name__ == "__main__":
    articles = asyncio.run(fetch_ndtv("https://feeds.feedburner.com/ndtvnews-india-news"))
    print(f"Fetched {len(articles)} articles\n")
    for a in articles[:3]:
        print(a)
 

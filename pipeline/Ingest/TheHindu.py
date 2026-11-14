import asyncio
from urllib.parse import urlparse
 
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
 
# Fallback label when a link's domain can't be read, e.g. no link at all.
DEFAULT_SOURCE = "The Hindu"
 
 
def source_from_url(url: str) -> str:
    """Derive the publisher from the article URL's domain, instead of assuming."""
    if not url:
        return DEFAULT_SOURCE
    domain = urlparse(url).netloc.replace("www.", "")
    return domain or DEFAULT_SOURCE
 
 
async def fetch_the_hindu(section: str) -> list[dict]:
    """section examples: 'news', 'news/national', 'business/Economy', 'life-and-style/luxury'."""
    url = f"https://www.thehindu.com/{section}/feeder/default.rss"
 
    async with AsyncSession() as session:
        resp = await session.get(url, impersonate="chrome110")
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
    articles = asyncio.run(fetch_the_hindu("life-and-style/luxury"))
    print(f"Fetched {len(articles)} articles\n")
    for a in articles[:3]:
        print(a)
 

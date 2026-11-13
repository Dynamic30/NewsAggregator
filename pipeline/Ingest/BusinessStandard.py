import asyncio
from urllib.parse import urlparse
 
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
 
DEFAULT_SOURCE = "Business Standard"
 
 
def source_from_url(url: str) -> str:
    if not url:
        return DEFAULT_SOURCE
    domain = urlparse(url).netloc.replace("www.", "")
    return domain or DEFAULT_SOURCE
 
 
def resolve_source(item, article_url: str) -> str:
    bs_source = item.find("bs:source")
    if bs_source and bs_source.get_text(strip=True):
        return bs_source.get_text(strip=True)
    dc_publisher = item.find("dc:publisher")
    if dc_publisher and dc_publisher.get_text(strip=True):
        return dc_publisher.get_text(strip=True)
    return source_from_url(article_url)
 
 
async def fetch_business_standard(feed_path: str) -> list[dict]:
    """feed_path examples: 'latest.rss', 'markets-106.rss', 'companies-101.rss'."""
    url = f"https://www.business-standard.com/rss/{feed_path}"
 
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
 
        article_url = link_tag.get_text(strip=True) if link_tag else None
        results.append({
            "title": title_tag.get_text(strip=True) if title_tag else None,
            "url": article_url,
            "published_date": pubdate_tag.get_text(strip=True) if pubdate_tag else None,
            "description": desc_tag.get_text(strip=True) if desc_tag else None,
            "source": resolve_source(item, article_url),
        })
    return results
 
 
if __name__ == "__main__":
    articles = asyncio.run(fetch_business_standard("latest.rss"))
    print(f"Fetched {len(articles)} articles\n")
    for a in articles[:3]:
        print(a)

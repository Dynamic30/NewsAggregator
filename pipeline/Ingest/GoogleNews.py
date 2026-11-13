import asyncio
from urllib.parse import quote
 
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
from googlenewsdecoder import gnewsdecoder


async def fetch_google_news(topic: str, lang: str = "en", country: str = "IN") -> list[dict]:
    hl = f"{lang}-{country}"
    ceid = f"{country}:{lang}"
    url = f"https://news.google.com/rss/search?q={quote(topic)}&hl={hl}&gl={country}&ceid={ceid}"
 
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
        source_tag = item.find("source")

        gnews_url = link_tag.get_text(strip=True) if link_tag else None
        decoded = gnewsdecoder(gnews_url) if gnews_url else None
        article_url = decoded["decoded_url"] if decoded and decoded.get("success") else gnews_url

        results.append({
            "title": title_tag.get_text(strip=True) if title_tag else None,
            "url": article_url,
            "published_date": pubdate_tag.get_text(strip=True) if pubdate_tag else None,
            "description": desc_tag.get_text(strip=True) if desc_tag else None,
            "source": source_tag.get_text(strip=True) if source_tag else None,
        })
    return results
 

if __name__ == "__main__":
    articles = asyncio.run(fetch_google_news("India technology"))
    print(f"Fetched {len(articles)} articles\n")
    for a in articles[:3]:
        print(a)

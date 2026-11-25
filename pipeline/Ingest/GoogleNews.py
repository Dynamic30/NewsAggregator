import asyncio
from urllib.parse import quote

from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
from googlenewsdecoder import gnewsdecoder

DECODE_CONCURRENCY_LIMIT = 4
DECODE_RETRY_DELAY_SECONDS = 2


async def decode_google_news_url(gnews_url, decode_semaphore):
    if not gnews_url:
        return None
    async with decode_semaphore:
        for attempt in range(2):
            decoded = await asyncio.to_thread(gnewsdecoder, gnews_url)
            if decoded and decoded.get("success"):
                return decoded["decoded_url"]
            await asyncio.sleep(DECODE_RETRY_DELAY_SECONDS)
    return None


async def fetch_google_news(topic: str, lang: str = "en", country: str = "IN") -> list[dict]:
    hl = f"{lang}-{country}"
    ceid = f"{country}:{lang}"
    url = f"https://news.google.com/rss/search?q={quote(topic)}&hl={hl}&gl={country}&ceid={ceid}"

    async with AsyncSession() as session:
        resp = await session.get(url, impersonate="chrome110")
        resp.raise_for_status()

    soup = BeautifulSoup(resp.content, "xml")
    items = soup.find_all("item")
    gnews_urls = [item.find("link").get_text(strip=True) if item.find("link") else None for item in items]

    decode_semaphore = asyncio.Semaphore(DECODE_CONCURRENCY_LIMIT)
    decoded_urls = await asyncio.gather(
        *(decode_google_news_url(gnews_url, decode_semaphore) for gnews_url in gnews_urls)
    )

    results = []
    for item, article_url in zip(items, decoded_urls):
        if not article_url:
            continue
        title_tag = item.find("title")
        pubdate_tag = item.find("pubDate")
        desc_tag = item.find("description")
        source_tag = item.find("source")

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

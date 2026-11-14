import asyncio
from email.utils import parsedate_to_datetime

import requests
from sqlalchemy import func, update
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from database_connection import NewsArticle, get_db
from Extract import Content
from Ingest import BusinessStandard, EconomicTimes, GoogleNews, LiveMint, NDTV, TheHindu, TimesOfIndia
from story_clustering import cluster_newly_embedded_articles
from dotenv import load_dotenv
import os
load_dotenv()


TOPIC_BATCH_SIZE = 5

SOURCE_FETCHERS = {
    "GoogleNews": GoogleNews.fetch_google_news,
    "TimesOfIndia": TimesOfIndia.fetch_toi,
    "NDTV": NDTV.fetch_ndtv,
    "TheHindu": TheHindu.fetch_the_hindu,
    "LiveMint": LiveMint.fetch_livemint,
    "BusinessStandard": BusinessStandard.fetch_business_standard,
    "EconomicTimes": EconomicTimes.fetch_economic_times,
}

OLLAMA_EMBED_URL = os.getenv("OLLAMA_EMBED_URL")
EMBEDDING_MODEL = "nomic-embed-text"
EMBEDDING_MARKDOWN_CHAR_LIMIT = 4000

Topics = {
    "National/India": {
        "GoogleNews": "India news",
        "TimesOfIndia": "rssfeedstopstories.cms",
        "NDTV": "https://feeds.feedburner.com/ndtvnews-india-news",
        "TheHindu": "news/national",
        "LiveMint": "news",
        "BusinessStandard": "latest.rss",
        "EconomicTimes": "rssfeedstopstories.cms",
    },
    "Business/Economy": {
        "GoogleNews": "India business economy",
        "TimesOfIndia": "rssfeeds/1898055.cms",
        "TheHindu": "business",
        "LiveMint": "money",
        "BusinessStandard": "latest.rss",
        "EconomicTimes": "news/economy/rssfeeds/1373380680.cms",
    },
    "Technology": {
        "GoogleNews": "India technology",
        "TimesOfIndia": "rssfeeds/66949542.cms",
        "NDTV": "https://feeds.feedburner.com/gadgets360-latest",
        "TheHindu": "sci-tech/technology",
        "LiveMint": "technology",
        "EconomicTimes": "tech/rssfeeds/13357270.cms",
    },
    "Sports": {
        "GoogleNews": ["India sports", "India cricket"],
        "TimesOfIndia": ["rssfeeds/4719148.cms", "rssfeeds/54829575.cms"],
        "NDTV": "https://sports.ndtv.com/rss/cricket",
        "TheHindu": "sport",
        "LiveMint": "sports",
        "EconomicTimes": "news/sports/rssfeeds/26407562.cms",
    },
    "Entertainment": {
        "GoogleNews": "India entertainment bollywood",
        "TimesOfIndia": "rssfeeds/1081479906.cms",
        "NDTV": "https://feeds.feedburner.com/ndtvmovies-latest",
        "TheHindu": "entertainment",
        "EconomicTimes": "industry/media/entertainment/rssfeeds/13357212.cms",
    },
    "Science & Health": {
        "GoogleNews": "India science health",
        "TimesOfIndia": "rssfeeds/-2128672765.cms",
        "TheHindu": "sci-tech",
        "LiveMint": "science",
        "EconomicTimes": [
            "news/science/rssfeeds/39872847.cms",
            "industry/healthcare/biotech/rssfeeds/13358050.cms",
        ],
    },
    "Education": {
        "GoogleNews": "India education",
        "TimesOfIndia": "rssfeeds/913168846.cms",
        "TheHindu": "education",
        "LiveMint": "education",
    },
    "Environment/Climate": {
        "GoogleNews": "India environment climate",
        "TimesOfIndia": "rssfeeds/2647163.cms",
        "TheHindu": "sci-tech/energy-and-environment",
        "EconomicTimes": "news/environment/rssfeeds/2647163.cms",
    },
    "Markets/Stocks": {
        "GoogleNews": "India stock market",
        "TheHindu": "business/markets",
        "LiveMint": "markets",
        "EconomicTimes": "markets/rssfeeds/1977021501.cms",
    },
    "Politics": {
        "GoogleNews": "India politics",
        "TheHindu": "elections",
        "LiveMint": "politics",
        "EconomicTimes": "news/politics-and-nation/rssfeeds/1052732854.cms",
    },
}


def parse_published_date(raw_published_date):
    if not raw_published_date:
        return None
    try:
        return parsedate_to_datetime(raw_published_date)
    except (TypeError, ValueError):
        return None


class DATABASE_PUSH:
    def __init__(self):
        self._db_gen = get_db()
        self.session = next(self._db_gen)

    def close(self):
        self._db_gen.close()

    def save_ingested_articles(self, articles, topic):
        if not articles:
            return
        rows = [
            {
                "url": article["url"],
                "title": article["title"],
                "description": article.get("description"),
                "source": article["source"],
                "article_topic": topic,
                "published_at": parse_published_date(article.get("published_date")),
                "image_url": article.get("image_url"),
            }
            for article in articles
        ]
        statement = postgres_insert(NewsArticle).values(rows).on_conflict_do_nothing(index_elements=["url"])
        try:
            self.session.execute(statement)
            self.session.commit()
        except Exception as error:
            self.session.rollback()
            print(f"[database_push] failed to save ingested articles for topic {topic}: {error}")

    def save_extracted_markdown(self, extract_results):
        for result in extract_results:
            try:
                self.session.execute(
                    update(NewsArticle)
                    .where(NewsArticle.url == result["url"])
                    .values(
                        markdown=result["markdown"],
                        extract_status=result["status"].value,
                        used_browser=result["used_browser_fallback"],
                        image_url=func.coalesce(NewsArticle.image_url, result["image_url"]),
                        extracted_at=func.now(),
                    )
                )
                self.session.commit()
            except Exception as error:
                self.session.rollback()
                print(f"[database_push] failed to save extracted markdown for {result['url']}: {error}")

    def save_embeddings(self, embedded_articles):
        for article_url, embedding in embedded_articles:
            try:
                self.session.execute(
                    update(NewsArticle)
                    .where(NewsArticle.url == article_url)
                    .values(embedding=embedding, enriched_at=func.now())
                )
                self.session.commit()
            except Exception as error:
                self.session.rollback()
                print(f"[database_push] failed to save embedding for {article_url}: {error}")


async def run_ingest(topic, region="IN"):
    sources_for_topic = Topics.get(topic, {})
    articles = []
    for source_name, feed_identifiers in sources_for_topic.items():
        fetch_function = SOURCE_FETCHERS[source_name]
        if isinstance(feed_identifiers, str):
            feed_identifiers = [feed_identifiers]
        for feed_identifier in feed_identifiers:
            try:
                if source_name == "GoogleNews":
                    fetched_articles = await fetch_function(feed_identifier, country=region)
                else:
                    fetched_articles = await fetch_function(feed_identifier)
                articles.extend(fetched_articles)
            except Exception as error:
                print(f"[run_ingest] {source_name} failed for topic {topic}: {error}")
                continue
    return articles


async def run_extract(url):
    return await asyncio.to_thread(Content.extract_filtered_markdown, url)


def run_enrich(text):
    response = requests.post(OLLAMA_EMBED_URL, json={"model": EMBEDDING_MODEL, "input": text})
    response.raise_for_status()
    return response.json()["embeddings"][0]


def run_political_lean(article):
    pass


async def main(Topics):
    topic_names = list(Topics.keys())
    database_push = DATABASE_PUSH()

    for batch_start in range(0, len(topic_names), TOPIC_BATCH_SIZE):
        topic_batch = topic_names[batch_start:batch_start + TOPIC_BATCH_SIZE]

        ingest_results = await asyncio.gather(
            *(run_ingest(topic) for topic in topic_batch), return_exceptions=True
        )

        batch_articles = []
        for topic, result in zip(topic_batch, ingest_results):
            if isinstance(result, Exception):
                print(f"[main] ingest failed for topic {topic}: {result}")
                continue
            database_push.save_ingested_articles(result, topic)
            batch_articles.extend(result)

        article_by_url = {article["url"]: article for article in batch_articles}
        urls_to_extract = list(article_by_url.keys())

        extract_results = await asyncio.gather(
            *(run_extract(url) for url in urls_to_extract), return_exceptions=True
        )
        successful_extractions = [result for result in extract_results if not isinstance(result, Exception)]
        database_push.save_extracted_markdown(successful_extractions)

        embedded_articles = []
        for result in successful_extractions:
            if not result["markdown"]:
                continue
            try:
                article = article_by_url[result["url"]]
                embedding_text = "\n\n".join([
                    article["title"],
                    article.get("description") or "",
                    result["markdown"][:EMBEDDING_MARKDOWN_CHAR_LIMIT],
                ])
                embedding = run_enrich(embedding_text)
                embedded_articles.append((result["url"], embedding))
            except Exception as error:
                print(f"[main] enrich failed for {result['url']}: {error}")
        database_push.save_embeddings(embedded_articles)
        cluster_newly_embedded_articles(database_push.session, [url for url, _ in embedded_articles])

        for result in successful_extractions:
            if not result["markdown"]:
                continue
            try:
                run_political_lean(result)
            except Exception as error:
                print(f"[main] political lean failed for {result['url']}: {error}")

    database_push.close()


if __name__ == "__main__":
    asyncio.run(main(Topics))

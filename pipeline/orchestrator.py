import asyncio
import itertools
import time
from concurrent.futures import ThreadPoolExecutor
from email.utils import parsedate_to_datetime

import requests
from sqlalchemy import Boolean, Text, bindparam, column, func, select, update, values
from sqlalchemy.dialects.postgresql import insert as postgres_insert

from clean_article import clean_description, clean_source, clean_title, description_from_markdown
from database_connection import NewsArticle, StoryCluster, get_db
from Extract import Content
from Ingest import BusinessStandard, EconomicTimes, GoogleNews, LiveMint, NDTV, TheHindu, TimesOfIndia
from PoliticalLeanModel.lean_scoring import llm_main
from story_clustering import cluster_newly_embedded_articles
from dotenv import load_dotenv
import os
import logging

load_dotenv(override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler("pipeline.log")],
)
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("pipeline")

TOPIC_BATCH_SIZE = 5
EXTRACT_LOG_EVERY = 25
SAVE_LOG_EVERY = 100
EXTRACT_WRITE_BATCH = 200
EMBED_LOG_EVERY = 100
SCORE_LOG_EVERY = 10

NON_POLITICAL_TOPICS = ("Sports", "Entertainment", "Markets/Stocks")

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
EMBEDDING_DESCRIPTION_CHAR_LIMIT = 1000
EMBEDDING_WRITE_BATCH = 500
EMBEDDING_CONCURRENCY = 4
EMBED_TIMEOUT_SECONDS = 120

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


def log_progress(label, done, total, every):
    if done % every == 0 or done == total:
        log.info(f"{label} {done}/{total}")


class DATABASE_PUSH:
    def __init__(self):
        self._db_gen = get_db()
        self.session = next(self._db_gen)

    def close(self):
        try:
            self._db_gen.close()
        except Exception as error:
            log.warning(f"[database_push] closing the session failed: {str(error).splitlines()[0]}")

    def save_ingested_articles(self, articles, topic):
        if not articles:
            return
        rows = [
            {
                "url": article["url"],
                "title": clean_title(article["title"], article["source"]),
                "description": clean_description(article.get("description")),
                "source": clean_source(article["source"]),
                "article_topic": topic,
                "published_at": parse_published_date(article.get("published_date")),
                "image_url": article.get("image_url"),
            }
            for article in articles
        ]
        statement = postgres_insert(NewsArticle).values(rows).on_conflict_do_nothing(index_elements=["url"])
        for attempt in range(2):
            try:
                self.session.execute(statement)
                self.session.commit()
                break
            except Exception as error:
                self.session.rollback()
                log.error(f"[database_push] failed to save ingested articles for topic {topic} (attempt {attempt + 1}): {str(error).splitlines()[0]}")

    def get_pending_urls(self, urls):
        pending_urls = self.session.execute(
            select(NewsArticle.url).where(NewsArticle.url.in_(urls), NewsArticle.extract_status == "pending")
        ).scalars().all()
        self.session.rollback()
        return pending_urls

    def get_unembedded_articles(self):
        rows = self.session.execute(
            select(
                NewsArticle.url,
                NewsArticle.title,
                NewsArticle.description,
                func.left(NewsArticle.markdown, EMBEDDING_MARKDOWN_CHAR_LIMIT),
            ).where(NewsArticle.markdown.is_not(None), NewsArticle.markdown != "", NewsArticle.embedding.is_(None))
        ).all()
        self.session.rollback()
        return rows

    def save_extracted_markdown(self, extract_results):
        log.info(f"saving {len(extract_results)} extracted pages")
        for start in range(0, len(extract_results), EXTRACT_WRITE_BATCH):
            chunk = extract_results[start:start + EXTRACT_WRITE_BATCH]
            extracted = values(
                column("url", Text),
                column("markdown", Text),
                column("status", Text),
                column("used_browser", Boolean),
                column("image_url", Text),
                column("description", Text),
                name="extracted",
            ).data(
                [
                    (
                        result["url"],
                        result["markdown"],
                        result["status"].value,
                        result["used_browser_fallback"],
                        result["image_url"],
                        description_from_markdown(result["markdown"]),
                    )
                    for result in chunk
                ]
            )
            statement = (
                update(NewsArticle)
                .where(NewsArticle.url == extracted.c.url)
                .values(
                    markdown=extracted.c.markdown,
                    extract_status=extracted.c.status,
                    used_browser=extracted.c.used_browser,
                    image_url=func.coalesce(NewsArticle.image_url, extracted.c.image_url),
                    description=func.coalesce(func.nullif(NewsArticle.description, ""), extracted.c.description),
                    extracted_at=func.now(),
                )
            )
            for attempt in range(2):
                try:
                    self.session.connection().execute(statement)
                    self.session.commit()
                    break
                except Exception as error:
                    self.session.rollback()
                    log.error(f"[database_push] failed to save {len(chunk)} extracted pages (attempt {attempt + 1}): {str(error).splitlines()[0]}")
            log_progress("saved", start + len(chunk), len(extract_results), SAVE_LOG_EVERY)

    def save_embeddings(self, embedded_articles):
        if not embedded_articles:
            return
        statement = (
            update(NewsArticle)
            .where(NewsArticle.url == bindparam("article_url"))
            .values(embedding=bindparam("embedding"), enriched_at=func.now())
            .execution_options(synchronize_session=False)
        )
        for start in range(0, len(embedded_articles), EMBEDDING_WRITE_BATCH):
            chunk = embedded_articles[start:start + EMBEDDING_WRITE_BATCH]
            for attempt in range(2):
                try:
                    self.session.connection().execute(
                        statement,
                        [{"article_url": url, "embedding": embedding} for url, embedding in chunk],
                    )
                    self.session.commit()
                    break
                except Exception as error:
                    self.session.rollback()
                    log.error(f"[database_push] failed to save {len(chunk)} embeddings (attempt {attempt + 1}): {str(error).splitlines()[0]}")

    def get_clusters_to_score(self):
        unscored_member = (
            select(NewsArticle.id)
            .where(
                NewsArticle.political_lean_score.is_(None),
                StoryCluster.member_article_ids.contains(func.to_jsonb(NewsArticle.id)),
            )
            .exists()
        )
        clusters = self.session.execute(
            select(StoryCluster).where(StoryCluster.article_topic.not_in(NON_POLITICAL_TOPICS), unscored_member)
        ).scalars().all()
        clusters_to_score = [
            (
                cluster.id,
                [
                    dict(row)
                    for row in self.session.execute(
                        select(NewsArticle.id, NewsArticle.title, NewsArticle.description, NewsArticle.markdown)
                        .where(NewsArticle.id.in_(cluster.member_article_ids))
                    ).mappings()
                ],
            )
            for cluster in clusters
        ]
        self.session.rollback()
        return clusters_to_score

    def save_lean_results(self, cluster_id, result):
        try:
            for article_id, lean in result["scores"].items():
                self.session.execute(
                    update(NewsArticle)
                    .where(NewsArticle.id == article_id)
                    .values(
                        political_lean=lean["political_lean"],
                        political_lean_score=lean["score"],
                        lean_confidence=lean["confidence"],
                        lean_breakdown=lean["breakdown"],
                    )
                )
            cluster = self.session.get(StoryCluster, cluster_id)
            cluster.lean_summary = result["cluster_summary"]
            cluster.representative_article_id = result["representative_article_id"]
            self.session.commit()
        except Exception as error:
            self.session.rollback()
            log.error(f"[database_push] failed to save lean results for cluster {cluster_id}: {error}")


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
                log.error(f"[run_ingest] {source_name} failed for topic {topic}: {error}")
                continue
    return articles


async def run_extract(url):
    return await asyncio.to_thread(Content.extract_filtered_markdown, url)


def run_enrich(text):
    response = requests.post(OLLAMA_EMBED_URL, json={"model": EMBEDDING_MODEL, "input": text}, timeout=EMBED_TIMEOUT_SECONDS)
    response.raise_for_status()
    return response.json()["embeddings"][0]


def run_political_lean(database_push):
    if not os.getenv("LLM_MODEL"):
        log.warning("[main] political lean skipped: LLM_MODEL not set")
        return

    clusters = database_push.get_clusters_to_score()
    log.info(f"scoring {len(clusters)} clusters")
    for number, (cluster_id, articles) in enumerate(clusters, 1):
        try:
            result = llm_main(articles)
            if result:
                database_push.save_lean_results(cluster_id, result)
        except Exception as error:
            log.error(f"[main] political lean failed for cluster {cluster_id}: {error}")
        log_progress("scored", number, len(clusters), SCORE_LOG_EVERY)


async def main(Topics):
    started = time.monotonic()
    log.info("run started")
    topic_names = list(Topics.keys())
    database_push = DATABASE_PUSH()
    batch_count = len(range(0, len(topic_names), TOPIC_BATCH_SIZE))

    for batch_start in range(0, len(topic_names), TOPIC_BATCH_SIZE):
        topic_batch = topic_names[batch_start:batch_start + TOPIC_BATCH_SIZE]
        log.info(f"batch {batch_start // TOPIC_BATCH_SIZE + 1}/{batch_count}: {', '.join(topic_batch)}")

        ingest_results = await asyncio.gather(
            *(run_ingest(topic) for topic in topic_batch), return_exceptions=True
        )

        batch_articles = []
        for topic, result in zip(topic_batch, ingest_results):
            if isinstance(result, Exception):
                log.error(f"[main] ingest failed for topic {topic}: {result}")
                continue
            database_push.save_ingested_articles(result, topic)
            batch_articles.extend(result)

        urls_to_extract = database_push.get_pending_urls(list({article["url"] for article in batch_articles}))
        log.info(f"ingested {len(batch_articles)} articles, extracting {len(urls_to_extract)} pages")
        extract_done = itertools.count(1)

        async def extract(url):
            try:
                return await run_extract(url)
            finally:
                log_progress("extract", next(extract_done), len(urls_to_extract), EXTRACT_LOG_EVERY)

        extract_results = await asyncio.gather(
            *(extract(url) for url in urls_to_extract), return_exceptions=True
        )
        successful_extractions = [result for result in extract_results if not isinstance(result, Exception)]
        database_push.save_extracted_markdown(successful_extractions)

        rows = database_push.get_unembedded_articles()
        log.info(f"embedding {len(rows)} articles")
        embed_done = itertools.count(1)

        def embed(row):
            url, title, description, markdown = row
            try:
                return url, run_enrich("\n\n".join([title, (description or "")[:EMBEDDING_DESCRIPTION_CHAR_LIMIT], markdown]))
            except Exception as error:
                log.error(f"[main] enrich failed for {url}: {error}")
                return None
            finally:
                log_progress("embed", next(embed_done), len(rows), EMBED_LOG_EVERY)

        with ThreadPoolExecutor(max_workers=EMBEDDING_CONCURRENCY) as pool:
            embedded_articles = [result for result in pool.map(embed, rows) if result]
        database_push.save_embeddings(embedded_articles)
        log.info(f"saved {len(embedded_articles)} embeddings, clustering")
        cluster_newly_embedded_articles(database_push.session, [url for url, _ in embedded_articles])
        log.info("clustering done")

        run_political_lean(database_push)

    database_push.close()
    log.info(f"run finished in {(time.monotonic() - started) / 60:.1f} min")


if __name__ == "__main__":
    try:
        asyncio.run(main(Topics))
    except Exception:
        log.exception("run crashed")
        raise

from collections import defaultdict
from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select

from database_connection import NewsArticle, StoryCluster

SIMILARITY_THRESHOLD = 0.15


def normalize_source(source):
    return (source or "").lower().removesuffix(".com")


def unit_vector(embedding):
    vector = np.array(embedding, dtype=float)
    norm = np.linalg.norm(vector)
    return vector / norm if norm else None


def cluster_newly_embedded_articles(session, urls):
    """Assigns the given articles to story clusters in one pass: existing
    clusters are loaded once, comparisons happen in memory, and everything is
    written with a single commit."""
    if not urls:
        return

    articles = session.execute(
        select(NewsArticle)
        .where(NewsArticle.url.in_(urls), NewsArticle.embedding.is_not(None))
        .order_by(NewsArticle.published_at.asc().nulls_first(), NewsArticle.id.asc())
    ).scalars().all()
    if not articles:
        return

    topics = {article.article_topic for article in articles}
    clusters = session.execute(select(StoryCluster).where(StoryCluster.article_topic.in_(topics))).scalars().all()

    member_ids = {article_id for cluster in clusters for article_id in cluster.member_article_ids}
    involved_ids = set()
    for cluster in clusters:
        involved_ids.add(cluster.representative_article_id)
        involved_ids.update(cluster.member_article_ids)

    rows = session.execute(
        select(NewsArticle.id, NewsArticle.source, NewsArticle.embedding).where(NewsArticle.id.in_(involved_ids))
    ).all()
    source_of = {article_id: source for article_id, source, _ in rows}
    vector_of = {article_id: unit_vector(embedding) for article_id, _, embedding in rows if embedding is not None}

    clusters_by_topic = defaultdict(list)
    for cluster in clusters:
        representative = vector_of.get(cluster.representative_article_id)
        if representative is None:
            continue
        sources = {normalize_source(source_of.get(article_id)) for article_id in cluster.member_article_ids}
        clusters_by_topic[cluster.article_topic].append([cluster, representative, sources])

    for article in articles:
        if article.id in member_ids:
            continue

        vector = unit_vector(article.embedding)
        if vector is None:
            continue

        article_date = article.published_at or article.ingested_at
        article_source = normalize_source(article.source)

        best = None
        for entry in clusters_by_topic.get(article.article_topic, []):
            distance = 1 - float(vector @ entry[1])
            if distance < SIMILARITY_THRESHOLD and (best is None or distance < best[0]):
                best = (distance, entry)

        if best is None:
            cluster = StoryCluster(
                article_topic=article.article_topic,
                representative_article_id=article.id,
                member_article_ids=[article.id],
                published_at=article_date,
            )
            session.add(cluster)
            clusters_by_topic[article.article_topic].append([cluster, vector, {article_source}])
            member_ids.add(article.id)
            continue

        _, entry = best
        cluster, representative, sources = entry
        if article_source in sources:
            continue

        cluster.member_article_ids = [*cluster.member_article_ids, article.id]
        cluster.updated_at = datetime.now(timezone.utc)
        sources.add(article_source)
        member_ids.add(article.id)
        if article_date > cluster.published_at:
            cluster.representative_article_id = article.id
            cluster.published_at = article_date
            entry[1] = vector

    session.commit()

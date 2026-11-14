from datetime import datetime, timezone

import numpy as np
from sqlalchemy import select

from database_connection import NewsArticle, StoryCluster

SIMILARITY_THRESHOLD = 0.15


def cosine_distance(vector_a, vector_b):
    vector_a = np.array(vector_a)
    vector_b = np.array(vector_b)
    return 1 - (vector_a @ vector_b) / (np.linalg.norm(vector_a) * np.linalg.norm(vector_b))


def normalize_source(source):
    return source.lower().removesuffix(".com")


def assign_to_cluster(session, article):
    """Assigns a freshly-embedded article to an existing story cluster (same
    topic, within SIMILARITY_THRESHOLD of the cluster's representative), or
    creates a new one if no match is found."""
    existing_clusters = session.execute(
        select(StoryCluster, NewsArticle.embedding)
        .join(NewsArticle, NewsArticle.id == StoryCluster.representative_article_id)
        .where(StoryCluster.article_topic == article.article_topic)
    ).all()

    for cluster, _ in existing_clusters:
        if article.id in cluster.member_article_ids:
            return

    article_date = article.published_at or article.ingested_at

    for cluster, representative_embedding in existing_clusters:
        if cosine_distance(article.embedding, representative_embedding) < SIMILARITY_THRESHOLD:
            member_sources = session.execute(
                select(NewsArticle.source).where(NewsArticle.id.in_(cluster.member_article_ids))
            ).scalars().all()
            if normalize_source(article.source) in {normalize_source(source) for source in member_sources}:
                return

            cluster.member_article_ids = [*cluster.member_article_ids, article.id]
            cluster.updated_at = datetime.now(timezone.utc)
            if article_date > cluster.published_at:
                cluster.representative_article_id = article.id
                cluster.published_at = article_date
            return

    session.add(StoryCluster(
        article_topic=article.article_topic,
        representative_article_id=article.id,
        member_article_ids=[article.id],
        published_at=article_date,
    ))


def cluster_newly_embedded_articles(session, urls):
    if not urls:
        return
    articles = session.execute(select(NewsArticle).where(NewsArticle.url.in_(urls))).scalars().all()
    for article in articles:
        try:
            assign_to_cluster(session, article)
            session.commit()
        except Exception as error:
            session.rollback()
            print(f"[story_clustering] failed to cluster {article.url}: {error}")

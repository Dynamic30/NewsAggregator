from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database_connetion import get_db
from model import ARTICLE_TOPICS, NewsArticle, StoryCluster
from schema import AllNews, TopicSection

TOPICS_OVERVIEW_ARTICLES_PER_TOPIC = 3
TOP_NEWS_RECENCY_WINDOW_DAYS = 2

router = APIRouter()

source_count = func.jsonb_array_length(StoryCluster.member_article_ids)


@router.get("/latest_news", response_model=list[AllNews])
def get_latest_news(db: Session = Depends(get_db), limit: int = Query(30, le=100), offset: int = Query(0, ge=0)):
    return db.execute(
        select(NewsArticle)
        .where(NewsArticle.markdown.is_not(None))
        .order_by(NewsArticle.published_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

@router.get("/news/topic/{topic:path}", response_model=list[AllNews])
def news_topic(topic: str, db: Session = Depends(get_db), limit: int = Query(30, le=100), offset: int = Query(0, ge=0)):
    rows = db.execute(
        select(NewsArticle, source_count)
        .join(StoryCluster, StoryCluster.representative_article_id == NewsArticle.id)
        .where(StoryCluster.article_topic == topic)
        .order_by(StoryCluster.published_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    for article, count in rows:
        article.source_count = count
    return [article for article, _ in rows]

@router.get("/news/all_topics", response_model=list[TopicSection])
def all_topics(db: Session = Depends(get_db)):
    row_number = (
        func.row_number()
        .over(partition_by=StoryCluster.article_topic, order_by=StoryCluster.published_at.desc())
        .label("row_number")
    )
    ranked = (
        select(
            StoryCluster.representative_article_id,
            StoryCluster.article_topic,
            source_count.label("source_count"),
            row_number,
        )
        .subquery()
    )

    rows = db.execute(
        select(NewsArticle, ranked.c.source_count)
        .join(ranked, ranked.c.representative_article_id == NewsArticle.id)
        .where(ranked.c.row_number <= TOPICS_OVERVIEW_ARTICLES_PER_TOPIC)
        .order_by(ranked.c.article_topic, ranked.c.row_number)
    ).all()

    articles_by_topic = {}
    for article, count in rows:
        article.source_count = count
        articles_by_topic.setdefault(article.article_topic, []).append(article)

    return [
        TopicSection(topic=topic, articles=articles_by_topic[topic])
        for topic in ARTICLE_TOPICS
        if topic in articles_by_topic
    ]

@router.get("/top_news", response_model=list[AllNews])
def top_news(db: Session = Depends(get_db), limit: int = Query(10, le=50), offset: int = Query(0, ge=0)):
    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=TOP_NEWS_RECENCY_WINDOW_DAYS)

    rows = db.execute(
        select(NewsArticle, source_count)
        .join(StoryCluster, StoryCluster.representative_article_id == NewsArticle.id)
        .where(StoryCluster.published_at > recent_cutoff)
        .order_by(source_count.desc(), StoryCluster.published_at.desc())
        .limit(limit)
        .offset(offset)
    ).all()

    for article, count in rows:
        article.source_count = count
    return [article for article, _ in rows]

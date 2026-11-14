from math import sqrt

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, aliased

from database_connetion import get_db
from model import ARTICLE_TOPICS, NewsArticle
from schema import AllNews, TopicSection

TOPICS_OVERVIEW_ARTICLES_PER_TOPIC = 3

router = APIRouter()

SIMILARITY_THRESHOLD = 0.15


def cosine_distance(vector_a, vector_b):
    dot_product = sum(a * b for a, b in zip(vector_a, vector_b))
    norm_a = sqrt(sum(a * a for a in vector_a))
    norm_b = sqrt(sum(b * b for b in vector_b))
    if norm_a == 0 or norm_b == 0:
        return 1.0
    return 1 - dot_product / (norm_a * norm_b)


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
    return db.execute(
        select(NewsArticle)
        .where(NewsArticle.article_topic == topic, NewsArticle.markdown.is_not(None))
        .order_by(NewsArticle.published_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

@router.get("/news/all_topics", response_model=list[TopicSection])
def all_topics(db: Session = Depends(get_db)):
    row_number = (
        func.row_number()
        .over(partition_by=NewsArticle.article_topic, order_by=NewsArticle.published_at.desc())
        .label("row_number")
    )
    ranked = (
        select(NewsArticle, row_number)
        .where(NewsArticle.markdown.is_not(None), NewsArticle.article_topic.is_not(None))
        .subquery()
    )
    ranked_article = aliased(NewsArticle, ranked)

    articles = db.execute(
        select(ranked_article)
        .where(ranked.c.row_number <= TOPICS_OVERVIEW_ARTICLES_PER_TOPIC)
        .order_by(ranked_article.article_topic, ranked.c.row_number)
    ).scalars().all()

    articles_by_topic = {}
    for article in articles:
        articles_by_topic.setdefault(article.article_topic, []).append(article)

    return [
        TopicSection(topic=topic, articles=articles_by_topic[topic])
        for topic in ARTICLE_TOPICS
        if topic in articles_by_topic
    ]

@router.get("top_news",response_model="")
async def top_news():
    return

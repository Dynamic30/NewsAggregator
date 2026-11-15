from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from database_connetion import get_db
from model import NewsArticle, StoryCluster
from schema import ArticleDetail, ClusterInfo, ClusterSource, NewsCard

router = APIRouter()


@router.get("/news_card/{article_id}", response_model=NewsCard)
def news_card(article_id: int, db: Session = Depends(get_db)):
    article = db.get(NewsArticle, article_id)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    cluster = db.execute(
        select(StoryCluster).where(StoryCluster.member_article_ids.contains([article_id]))
    ).scalars().first()

    if cluster is None:
        members = [article]
        default_id = article.id
        summary = None
    else:
        members = db.execute(
            select(NewsArticle).where(NewsArticle.id.in_(cluster.member_article_ids))
        ).scalars().all()
        default_id = cluster.representative_article_id
        summary = cluster.lean_summary

    members.sort(key=lambda m: (
        m.id != default_id,
        m.political_lean_score is None,
        abs((m.political_lean_score or 50) - 50),
    ))

    return NewsCard(
        article=ArticleDetail.model_validate(article),
        cluster=ClusterInfo(
            summary=summary,
            sources=[
                ClusterSource(
                    article_id=m.id,
                    source=m.source,
                    published_at=m.published_at,
                    political_lean_score=m.political_lean_score,
                    is_default=m.id == default_id,
                )
                for m in members
            ],
        ),
    )

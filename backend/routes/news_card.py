from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from database_connetion import get_db
from model import NewsArticle, StoryCluster
from schema import ArticleDetail, ClusterInfo, ClusterSource, NewsCard
from limits_decorator import cache, rate_limit

router = APIRouter()


@router.get("/news_card/{article_id}", response_model=NewsCard)
@rate_limit()
@cache()
async def news_card(request: Request,article_id: int, db: Session = Depends(get_db)):
    cluster = db.execute(
        select(StoryCluster).where(StoryCluster.member_article_ids.contains([article_id]))
    ).scalars().first()
    member_ids = cluster.member_article_ids if cluster else [article_id]
    members = db.execute(select(NewsArticle).where(NewsArticle.id.in_(member_ids))).scalars().all()

    article = next((member for member in members if member.id == article_id), None)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    default_id = cluster.representative_article_id if cluster else article.id
    summary = cluster.lean_summary if cluster else None

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

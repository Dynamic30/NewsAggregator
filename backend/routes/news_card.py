from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from database_connetion import get_db
from model import NewsArticle, StoryCluster
from schema import ArticleDetail, ClusterInfo, ClusterSource, NewsCard
from limits_decorator import cache, rate_limit

router = APIRouter()

CARD_COLUMNS = (
    "id", "title", "description", "source", "url", "image_url", "article_topic",
    "published_at", "political_lean_score", "lean_confidence", "lean_breakdown",
)


@router.get("/news_card/{article_id}", response_model=NewsCard)
@rate_limit()
@cache()
async def news_card(request: Request,article_id: int = Path(ge=1), db: Session = Depends(get_db)):
    cluster = (
        select(StoryCluster.member_article_ids, StoryCluster.representative_article_id, StoryCluster.lean_summary)
        .where(StoryCluster.member_article_ids.contains([article_id]))
        .limit(1)
        .subquery()
    )
    members = db.execute(
        select(
            *(getattr(NewsArticle, column) for column in CARD_COLUMNS),
            case((NewsArticle.id == article_id, NewsArticle.markdown)).label("markdown"),
            cluster.c.representative_article_id,
            cluster.c.lean_summary,
        )
        .outerjoin(cluster, cluster.c.member_article_ids.contains(func.jsonb_build_array(NewsArticle.id)))
        .where(or_(NewsArticle.id == article_id, cluster.c.representative_article_id.is_not(None)))
    ).all()

    article = next((member for member in members if member.id == article_id), None)
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found")

    default_id = article.representative_article_id or article.id
    summary = article.lean_summary

    members.sort(key=lambda m: (
        m.id != default_id,
        m.political_lean_score is None,
        abs((m.political_lean_score or 50) - 50),
        m.id,
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
                    lean_breakdown=m.lean_breakdown,
                    url=m.url,
                    is_default=m.id == default_id,
                )
                for m in members
            ],
        ),
    )

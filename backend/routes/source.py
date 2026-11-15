from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database_connetion import get_db
from model import NewsArticle
from schema import SourceSummary

router = APIRouter()


@router.get("/sources", response_model=list[SourceSummary])
def sources(db: Session = Depends(get_db), min_stories: int = Query(3, ge=1)):
    average_score = func.avg(NewsArticle.political_lean_score)
    rows = db.execute(
        select(
            NewsArticle.source,
            func.count().label("story_count"),
            average_score.label("political_score"),
        )
        .where(NewsArticle.markdown.is_not(None))
        .group_by(NewsArticle.source)
        .having(func.count() >= min_stories)
        .order_by(average_score.is_(None), func.abs(average_score - 50), func.count().desc())
    ).all()
    return [
        SourceSummary(name=row.source, story_count=row.story_count, political_score=row.political_score)
        for row in rows
    ]

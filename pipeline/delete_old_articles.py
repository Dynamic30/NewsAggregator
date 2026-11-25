import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select

from database_connection import NewsArticle, SessionLocal, StoryCluster
from dotenv import load_dotenv

load_dotenv(override=True)
RETENTION_DAYS = max(int(os.getenv("RETENTION_DAYS") or "30"), 1)


def delete_old_articles():
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    old_ids = select(NewsArticle.id).where(NewsArticle.ingested_at < cutoff)
    with SessionLocal() as session:
        session.execute(delete(StoryCluster).where(StoryCluster.representative_article_id.in_(old_ids)))
        result = session.execute(delete(NewsArticle).where(NewsArticle.ingested_at < cutoff))
        session.commit()
        return result.rowcount


if __name__ == "__main__":
    deleted_count = delete_old_articles()
    print(f"deleted {deleted_count} articles older than {RETENTION_DAYS} days")

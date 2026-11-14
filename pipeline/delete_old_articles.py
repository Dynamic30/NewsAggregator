import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete

from database_connection import NewsArticle, SessionLocal
from dotenv import load_dotenv

load_dotenv()
RETENTION_DAYS = int(os.getenv("RETENTION_DAYS") or "30")


def delete_old_articles():
    cutoff = datetime.now(timezone.utc) - timedelta(days=RETENTION_DAYS)
    with SessionLocal() as session:
        result = session.execute(delete(NewsArticle).where(NewsArticle.ingested_at < cutoff))
        session.commit()
        return result.rowcount


if __name__ == "__main__":
    deleted_count = delete_old_articles()
    print(f"deleted {deleted_count} articles older than {RETENTION_DAYS} days")

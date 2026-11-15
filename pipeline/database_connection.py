from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Text, create_engine, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

news_db = os.getenv("DATABASE_PIPELINE")

engine = create_engine(news_db)

SessionLocal = sessionmaker(autoflush=False, bind=engine, autocommit=False)

class Base(DeclarativeBase):
    pass

ARTICLE_TOPICS = (
    "National/India",
    "Business/Economy",
    "Technology",
    "Sports",
    "Entertainment",
    "Science & Health",
    "Education",
    "Environment/Climate",
    "Markets/Stocks",
    "Politics",
)

article_topic_enum = Enum(*ARTICLE_TOPICS, name="article_topic_enum", create_type=False)

class NewsArticle(Base):
    __tablename__ = "news_article"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    url: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(Text, nullable=False)
    article_topic: Mapped[str | None] = mapped_column(article_topic_enum)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    image_url: Mapped[str | None] = mapped_column(Text)

    markdown: Mapped[str | None] = mapped_column(Text)
    extract_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    used_browser: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    embedding: Mapped[list[float] | None] = mapped_column(Vector(768))

    political_lean: Mapped[str | None] = mapped_column(Text)
    political_lean_score: Mapped[float | None]
    lean_confidence: Mapped[float | None]
    lean_breakdown: Mapped[dict | None] = mapped_column(JSONB)

    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    extracted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    enriched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class StoryCluster(Base):
    __tablename__ = "story_cluster"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    article_topic: Mapped[str] = mapped_column(article_topic_enum, nullable=False)
    representative_article_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("news_article.id"), nullable=False)
    member_article_ids: Mapped[list[int]] = mapped_column(JSONB, nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    lean_summary: Mapped[str | None] = mapped_column(Text)

def get_db():
    with SessionLocal() as db:
        yield db
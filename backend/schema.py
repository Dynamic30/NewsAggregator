from pydantic import BaseModel, ConfigDict, Field
from enum import Enum
from datetime import datetime


class AllNews(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    source: str
    topic: str = Field(validation_alias="article_topic")
    published_at: datetime | None
    image_url: str | None
    political_lean_score: float | None
    source_count: int | None = None   # only populated by top_news; None elsewhere

class ArticleDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    markdown: str | None
    source: str
    topic: str
    published_at: datetime | None
    political_lean_score: float | None
    lean_confidence: float | None

class TopicSection(BaseModel):
    topic: str
    articles: list[AllNews]


class news_source(BaseModel):
    pass
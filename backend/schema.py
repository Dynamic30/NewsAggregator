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
    source_count: int | None = None

class ArticleDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    markdown: str | None
    source: str
    url: str
    image_url: str | None
    topic: str = Field(validation_alias="article_topic")
    published_at: datetime | None
    political_lean_score: float | None
    lean_confidence: float | None
    lean_breakdown: dict | None

class ClusterSource(BaseModel):
    article_id: int
    source: str
    published_at: datetime | None
    political_lean_score: float | None
    lean_breakdown: dict | None = None
    url: str | None = None
    is_default: bool

class ClusterInfo(BaseModel):
    summary: str | None
    sources: list[ClusterSource]

class NewsCard(BaseModel):
    article: ArticleDetail
    cluster: ClusterInfo

class TopicSection(BaseModel):
    topic: str
    articles: list[AllNews]


class SourceSummary(BaseModel):
    name: str
    story_count: int
    political_score: float | None
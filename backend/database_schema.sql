CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN
    CREATE TYPE article_topic_enum AS ENUM (
        'National/India',
        'Business/Economy',
        'Technology',
        'Sports',
        'Entertainment',
        'Science & Health',
        'Education',
        'Environment/Climate',
        'Markets/Stocks',
        'Politics'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE political_lean_enum AS ENUM ('government', 'opposition', 'neutral');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS source_profile (
    source_name     TEXT PRIMARY KEY,
    political_lean  political_lean_enum,
    political_score REAL, -- nuetral scroe , less than 50 ->pro opp, more than 50 pro govt. closer to 50 is nuetral
    computed_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS news_article (
    id              BIGSERIAL PRIMARY KEY,
    url             TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT,
    source          TEXT NOT NULL,
    article_topic   article_topic_enum,
    published_at    TIMESTAMPTZ,
    image_url       TEXT,

    markdown        TEXT,
    extract_status  TEXT NOT NULL DEFAULT 'pending',
    used_browser    BOOLEAN NOT NULL DEFAULT FALSE,

    embedding       VECTOR(768),

    -- enrich/ phase 2 (political lean, per-article ML output)
    political_lean       political_lean_enum,
    political_lean_score REAL,
    lean_confidence      REAL,


    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    extracted_at    TIMESTAMPTZ,
    enriched_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_news_article_published_at ON news_article (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_article_source ON news_article (source);

CREATE TABLE IF NOT EXISTS story_cluster (
    id                         BIGSERIAL PRIMARY KEY,
    article_topic              article_topic_enum NOT NULL,
    representative_article_id  BIGINT NOT NULL REFERENCES news_article(id),
    member_article_ids         JSONB NOT NULL,
    published_at                TIMESTAMPTZ NOT NULL,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_story_cluster_topic_published ON story_cluster (article_topic, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_cluster_members ON story_cluster USING GIN (member_article_ids);

ALTER TABLE news_article ADD COLUMN IF NOT EXISTS lean_breakdown JSONB;
ALTER TABLE story_cluster ADD COLUMN IF NOT EXISTS lean_summary TEXT;
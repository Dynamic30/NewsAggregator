CREATE TYPE article_topic_enum AS ENUM (
    'National/India',
    'Business/Economy',
    'Technology',
    'Sports',
    'Cricket',
    'Entertainment',
    'Science & Health',
    'Education',
    'Environment/Climate',
    'Markets/Stocks',
    'Politics'
);

CREATE TABLE IF NOT EXISTS source_profile (
    source_name,
    political_lean,
    political_score, -- nuetral scroe , less than 50 ->pro opp, more than 50 pro govt. closer to 50 is nuetral
    computed_at,
);

CREATE TABLE IF NOT EXISTS news_article (
    id              BIGSERIAL PRIMARY KEY,
    url             TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL,
    description     TEXT,
    source          TEXT NOT NULL REFERENCES source(name),
    article_topic   article_topic_enum,
    published_at    TIMESTAMPTZ,

    markdown        TEXT,
    extract_status  TEXT NOT NULL DEFAULT 'pending',
    used_browser    BOOLEAN NOT NULL DEFAULT FALSE,

    embedding       VECTOR(384),
    cluster_id      BIGINT,

    -- enrich/ phase 2 (political lean, per-article ML output)
    political_lean       ENUM ('government', 'opposition', 'neutral'),
    political_lean_score REAL,
    lean_confidence      REAL,


    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    extracted_at    TIMESTAMPTZ,
    enriched_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_news_article_published_at ON news_article (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_article_cluster_id ON news_article (cluster_id);
CREATE INDEX IF NOT EXISTS idx_news_article_source ON news_article (source);
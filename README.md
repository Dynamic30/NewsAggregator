<p align="center">
  <img src="frontend/logo.svg" width="96" alt="SkimFeed logo">
</p>

<h1 align="center">SkimFeed</h1>

<p align="center">Indian news from several outlets, grouped by story, with a look at how each outlet frames it.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12%2B-3776AB" alt="Python 3.12+">
  <img src="https://img.shields.io/badge/FastAPI-0.116-009688" alt="FastAPI">
  <img src="https://img.shields.io/badge/PostgreSQL-pgvector-336791" alt="PostgreSQL with pgvector">
</p>

## What it does

SkimFeed collects Indian news from seven feeds: Google News, Times of India, NDTV, The Hindu, Mint, Business Standard and Economic Times. It groups articles about the same story across outlets into one cluster, so you see one card per story instead of one per outlet.

For political stories, a language model scores how each outlet's article portrays the government and the opposition, and gives a short reason for each score. Every story card shows how many outlets covered it.

## Features

- Top News: stories from the last two days, ordered by how many outlets covered them.
- Latest News: every extracted article, newest first, loaded 30 at a time.
- Topics: an overview of ten topics, plus a page per topic with a carousel and a full list.
- Sources: each outlet's average lean score, a lean bar, and filter chips.
- Article page: the story text, every outlet's version, a lean score per outlet, a "Why?" panel with the model's reasons, and a link to each original article.
- Reader themes on the article page (light, sepia, dark) with a depth slider.
- Light and dark site theme, and three card layouts (standard, classic, compact) in Settings.
- Skeleton placeholders while data loads.

## How it works

```
RSS feeds -> extract -> embed -> cluster -> score -> Postgres -> FastAPI (+ Redis) -> browser
```

1. **Ingest.** `pipeline/Ingest/` reads one feed per outlet and topic. `orchestrator.py` saves new articles, skipping URLs it already has.
2. **Extract.** `pipeline/Extract/` downloads each article with `curl_cffi` and pulls out the text with `trafilatura`. If a site serves a challenge page, it retries in a headless browser (crawl4ai/Playwright). Short texts are marked as paywalled.
3. **Embed.** Title, description and the start of the text are sent to Ollama with the `nomic-embed-text` model. The 768-dimension vectors are stored in a pgvector column.
4. **Cluster.** `story_clustering.py` puts an article in an existing cluster of the same topic if the cosine distance to the cluster's representative is below 0.15. A cluster holds at most one article per outlet.
5. **Score.** For clusters in political topics, an LLM reads the articles with outlet names hidden. It scores how each article portrays government, opposition, public and business from 0 to 100, with a reason for each. Sports, Entertainment and Markets/Stocks are not scored.
6. **Serve.** A FastAPI app reads Postgres and serves the JSON API and the static frontend. Responses are cached in Redis, and requests are rate limited.

Stack: FastAPI, SQLAlchemy, PostgreSQL with pgvector (Neon), Redis for cache and rate limit (Upstash), Ollama for embeddings, an Ollama-compatible chat API for scoring, and a vanilla JavaScript frontend with no build step.

## Project structure

```
app.py                      Entry point for the API, loads backend/main.py
backend/
  main.py                   FastAPI app, static files, page routes, 404 handling
  routes/                   all_news.py, news_card.py, source.py (API endpoints)
  limits_decorator.py       Redis cache and rate limit decorators
  settings.py               Redis clients
  model.py, schema.py       SQLAlchemy models and response models
  database_connetion.py     Engine and schema setup on startup
  database_schema.sql       Tables, enums, indexes (run at startup)
frontend/
  index.html, newscard.html, error.html
  logo.svg                  Logo
  css/                      base, views, error styles
  js/                       api, app, news, newscard, reader, sources, shell, utils
pipeline/
  orchestrator.py           Runs ingest, extract, embed, cluster, score
  Ingest/                   One module per outlet
  Extract/                  Page download and text extraction
  PoliticalLeanModel/       LLM prompt and score calculation
  story_clustering.py       Clustering by embedding distance
  delete_old_articles.py    Retention clean-up
pipeline_automation/        Dockerfile and cron entrypoint for the pipeline
docker-compose.pipeline.yml Runs the pipeline on a schedule
```

## Getting started

### Prerequisites

- Python 3.12 or newer (`requires-python` in `pyproject.toml`).
- A PostgreSQL database with the `vector` extension (Neon works).
- A Redis instance reachable by URL.
- An Ollama server with `nomic-embed-text` pulled, for embeddings.
- An Ollama-compatible chat endpoint and model for lean scoring (optional; scoring is skipped if `LLM_MODEL` is empty).
- Docker, only if you want to run the pipeline in a container.

### Install

The API and the pipeline pin different package sets, so use two virtual environments.

```bash
# API
pip install fastapi==0.116.1 SQLAlchemy==2.0.42 psycopg2-binary==2.9.10 \
  redis==5.3.1 python-dotenv==1.1.1 pgvector==0.1.6 uvicorn==0.46.0

# Pipeline
pip install -r requirements.txt
crawl4ai-setup
python -m playwright install chromium
```

### Configure

Copy `.env.example` to `.env` and fill it in. The file is in `.gitignore`.

| Variable | Used by | Purpose | Example |
| --- | --- | --- | --- |
| `DATABASE` | API | Postgres connection URL | `postgresql://user:pass@host/db` |
| `DATABASE_PIPELINE` | Pipeline | Postgres URL for the pipeline (same database). Not listed in `.env.example`, but the code reads it. | `postgresql://user:pass@host/db` |
| `REDIS_URL` | API | Redis URL for cache and rate limit | `rediss://default:pass@host:6379` |
| `OLLAMA_EMBED_URL` | Pipeline | Ollama embed endpoint | `http://localhost:11434/api/embed` |
| `OLLAMA_EMBED_URL_CONTAINER` | Docker | Same endpoint as seen from inside the container | `http://host.docker.internal:11434/api/embed` |
| `RETENTION_DAYS` | Pipeline | Days to keep articles (30 if empty) | `30` |
| `LLM_URL` | Pipeline | Base URL of the Ollama-compatible chat API | `http://localhost:11434` |
| `LLM_API_KEY` | Pipeline | Bearer token, if the endpoint needs one | `your-api-key` |
| `LLM_MODEL` | Pipeline | Model used for lean scoring | `your-model-name` |

### Run the API and frontend

```bash
uvicorn app:app --reload
```

Open http://127.0.0.1:8000. On startup the app runs `backend/database_schema.sql`, which creates the tables if they do not exist. Start the API once before the first pipeline run. Interactive API docs are at `/docs`.

### Run the pipeline

```bash
cd pipeline
python orchestrator.py
```

It processes topics in batches of five and prints progress to the console. Without Docker, run it yourself or from your own scheduler.

To run it on a schedule in Docker:

```bash
docker compose -f docker-compose.pipeline.yml up -d --build
```

The container runs `orchestrator.py` and `delete_old_articles.py` through cron, both at `0 0 * * *` by default. Change them with `ORCHESTRATOR_CRON_SCHEDULE` and `RETENTION_CRON_SCHEDULE` in the compose file.

### Using the app

Top News opens first. Click a card to open the article page, where each outlet's version is listed with its lean score. "Why?" shows the model's reasons per group, and the link icon opens the original article. Use Topics to browse by section, Sources to see outlet averages, and the gear icon for theme and layout.

## API reference

| Method | Path | Parameters | Returns |
| --- | --- | --- | --- |
| GET | `/top_news` | `limit` (default 10, max 50), `offset` | Recent story cards ordered by outlet count |
| GET | `/latest_news` | `limit` (default 30, max 100), `offset` | Articles with extracted text, newest first |
| GET | `/news/topic/{topic}` | `limit` (30, max 100), `offset` | One card per story in a topic; 404 for an unknown topic |
| GET | `/news/all_topics` | none | Up to 3 latest stories for each topic |
| GET | `/news_card/{article_id}` | none | The article, its cluster summary, and each outlet's score, reasons and URL |
| GET | `/sources` | `min_stories` (default 3) | Per outlet: name, story count, average lean score |

List items have `id`, `title`, `description`, `source`, `topic`, `published_at`, `image_url`, `political_lean_score` and `source_count`. A lean score runs from 0 to 100: below 50 is closer to the opposition, above 50 closer to the government. The pages are served at `/` and `/news/{article_id}`.

## Caching and rate limiting

Every API endpoint is cached in Redis for 600 seconds, keyed by the endpoint and its parameters. Every endpoint is also limited to 120 requests per 60 seconds per client (by IP address), and the next request gets HTTP 429. If Redis is unreachable, the cache is skipped and the limit is not applied (`backend/limits_decorator.py`).

## Data retention

`pipeline/delete_old_articles.py` deletes articles whose ingest time is older than `RETENTION_DAYS` (30 if unset), along with clusters whose representative article is among them. The Docker setup runs it daily.

## Deployment notes

- `pyproject.toml` sets a Vercel entrypoint (`app:app`), and a comment in the rate limiter mentions the Vercel firewall. I have not documented a full deployment beyond that.
- Set `DATABASE` and `REDIS_URL` for the API. The API needs no Ollama access.
- Set the pipeline variables from the table above wherever the pipeline runs. For the container, `.env` is passed in with `env_file`.
- There is no migration tool. Schema changes go in `backend/database_schema.sql`.

## Limitations

- Lean scores are model estimates from article text, not facts. The model can be wrong. "Government" means the BJP-led NDA and the state governments it runs.
- Coverage is limited to seven feeds and ten topics. The region setting is India only.
- Some articles cannot be extracted because of paywalls or bot protection, and those do not appear.
- There are no automated tests, screenshots or license file in the repository yet.

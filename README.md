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

SkimFeed collects Indian news from several news sources, and it groups articles about the same story across outlets into one cluster, so you see one card per story instead of one per outlet.

For political stories, each outlet's article gets a score for how it portrays the government and the opposition, with a short reason. Every story card shows how many outlets covered it.

## Features

- Top News: stories from the last two days, ordered by how many outlets covered them.
- Latest News: every extracted article, newest first, loaded 30 at a time.
- Topics: an overview of ten topics, plus a page per topic with a carousel and a full list.
- Sources: each outlet's average lean score, a lean bar, and filter chips.

## How it works

```
RSS feeds -> extract -> embed -> cluster -> score -> Postgres -> FastAPI (+ Redis) -> browser
```

1. **Ingest.** `pipeline/Ingest/` reads one feed per outlet and topic. `orchestrator.py` saves new articles, skipping URLs it already has.
2. **Extract.** `pipeline/Extract/` downloads each article with `curl_cffi` and pulls out the text with `trafilatura`. If a site serves a challenge page, it retries in a headless browser (crawl4ai/Playwright). Short texts are marked as paywalled.
3. **Embed.** Title, description and the start of the text are turned into embeddings and stored in a pgvector column.
4. **Cluster.** `story_clustering.py` puts an article in an existing cluster of the same topic if the cosine distance to the cluster's representative is below 0.15. A cluster holds at most one article per outlet.
5. **Score.** For clusters in political topics, the articles are scored with outlet names hidden. Each article gets a score from 0 to 100 for how it portrays government, opposition, public and business, with a reason for each. Sports, Entertainment and Markets/Stocks are not scored.
6. **Serve.** A FastAPI app reads Postgres and serves the JSON API and the static frontend. Responses are cached in Redis, and requests are rate limited.

Stack: FastAPI, SQLAlchemy, PostgreSQL with pgvector, Redis for cache and rate limit, and a vanilla JavaScript frontend with no build step.

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
  index.html                Landing page
  topnews.html, latestnews.html, topics.html, topic.html, sources.html
                            One page per section
  newscard.html, error.html Article page and error page
  logo.svg                  Logo
  css/                      base, views, error styles
  js/                       Shared (config, utils, api, chrome, shell) and one script per page
pipeline/
  orchestrator.py           Runs ingest, extract, embed, cluster, score
  Ingest/                   One module per outlet
  Extract/                  Page download and text extraction
  PoliticalLeanModel/       Scoring prompt and score calculation
  story_clustering.py       Clustering by embedding distance
  delete_old_articles.py    Retention clean-up
pipeline_automation/        Dockerfile and cron entrypoint for the pipeline
docker-compose.pipeline.yml Runs the pipeline on a schedule
```

## Getting started

### Prerequisites

- Python 3.12 or newer (`requires-python` in `pyproject.toml`).
- A PostgreSQL database with the `vector` extension.
- A Redis instance reachable by URL.
- A text-embedding service for the embed step.
- A scoring service for the lean scores (optional; scoring is skipped if `LLM_MODEL` is empty).
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

Copy `.env.example` to `.env` and fill in the values. The file is in `.gitignore`.

### Run the API and frontend

```bash
uvicorn app:app --reload
```

Open http://127.0.0.1:8000. On startup the app runs `backend/database_schema.sql`, which creates the tables if they do not exist. Start the API once before the first pipeline run.

### Run the pipeline

```bash
cd pipeline
python orchestrator.py
```

It processes topics in batches of five and logs progress to the console and to `pipeline.log`. Without Docker, run it yourself or from your own scheduler.

To run it on a schedule in Docker:

```bash
docker compose -f docker-compose.pipeline.yml up -d --build
```

The container runs `orchestrator.py` and `delete_old_articles.py` through cron, both at `0 0 * * *` by default. Change them with `ORCHESTRATOR_CRON_SCHEDULE` and `RETENTION_CRON_SCHEDULE` in the compose file.

### Using the app

Top News opens first. Click a card to open the article page, where each outlet's version is listed with its lean score. "Why?" shows the reasons per group, and the link icon opens the original article. Use Topics to browse by section, Sources to see outlet averages, and the gear icon for theme and layout.

## Limitations

- Lean scores are estimates from the article text, not facts, and they can be wrong.
- Some articles cannot be extracted because of paywalls or bot protection, and those do not appear.


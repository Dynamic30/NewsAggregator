from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from database_connetion import setup_database_schema
from settings import redis_cache, redis_rate_limiter
from routes import all_news, news_card, source


@asynccontextmanager
async def lifespan(app:FastAPI):
    setup_database_schema()

    yield
    await redis_cache.aclose()
    await redis_rate_limiter.aclose()

    return


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = FastAPI(title="News Aggregator", lifespan=lifespan)

app.mount("/css", StaticFiles(directory=FRONTEND_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=FRONTEND_DIR / "js"), name="js")

app.include_router(all_news.router)
app.include_router(news_card.router)
app.include_router(source.router)


@app.get("/")
def index():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/news/{article_id:int}")
def news_page(article_id: int):
    return FileResponse(FRONTEND_DIR / "newscard.html")

@app.get("/top-news", include_in_schema=False)
def top_news_page():
    return FileResponse(FRONTEND_DIR / "topnews.html")


@app.get("/latest-news", include_in_schema=False)
def latest_news_page():
    return FileResponse(FRONTEND_DIR / "latestnews.html")


@app.get("/topics", include_in_schema=False)
def topics_page():
    return FileResponse(FRONTEND_DIR / "topics.html")


@app.get("/topic/{slug}", include_in_schema=False)
def topic_page(slug: str):
    return FileResponse(FRONTEND_DIR / "topic.html")


@app.get("/source", include_in_schema=False)
def sources_page():
    return FileResponse(FRONTEND_DIR / "sources.html")


@app.exception_handler(404)
async def not_found(request, exc):
    if "text/html" in request.headers.get("accept", ""):          # browser opening a URL
        return FileResponse(FRONTEND_DIR / "error.html", status_code=404)
    return JSONResponse({"detail": exc.detail}, status_code=404)   # fetch() / API clients
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
from database_connetion import setup_database_schema
from settings import redis_cache, redis_rate_limiter


@asynccontextmanager
async def lifespan(app:FastAPI):
    setup_database_schema()

    yield
    await redis_cache.aclose()
    await redis_rate_limiter.aclose()

    return


app = FastAPI("News Aggregator",lifespan=lifespan)


@app.get("/")
def index():
    return FileResponse()



@app.exception_handler(404)
async def not_found(request, exc):
    if "text/html" in request.headers.get("accept", ""):          # browser opening a URL
        return FileResponse("file path", status_code=404)
    return JSONResponse({"detail": exc.detail}, status_code=404)   # fetch() / API clients
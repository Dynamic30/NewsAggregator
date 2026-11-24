from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

news_db = os.getenv("DATABASE")

engine = create_engine(news_db, isolation_level="AUTOCOMMIT", pool_recycle=240,pool_pre_ping=True)

SessionLocal = sessionmaker(autoflush=False, bind=engine, autocommit=False)

class Base(DeclarativeBase):
    pass

SCHEMA_FILE_PATH = Path(__file__).parent / "database_schema.sql"

def setup_database_schema():
    schema_sql = SCHEMA_FILE_PATH.read_text(encoding="utf-8")
    with engine.connect() as connection:
        connection.exec_driver_sql(schema_sql)
        connection.commit()

def get_db():
    with SessionLocal() as db:
        yield db
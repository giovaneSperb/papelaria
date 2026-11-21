import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import NullPool

from backend.config import get_settings

# Em serverless cada invocação pode ser um processo novo: sem pool próprio,
# quem faz o pooling é o Postgres gerenciado (use a URL "pooled" do Neon).
_serverless = bool(os.getenv("VERCEL"))

engine = create_engine(
    get_settings().sqlalchemy_url,
    pool_pre_ping=True,
    **({"poolclass": NullPool} if _serverless else {}),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "sqlite+aiosqlite:///./trippin.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    # 모델 모듈을 import 해야 Base.metadata 에 테이블이 등록됨
    from app.models import user, trip, place_cache  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # SQLite ALTER TABLE — 신규 컬럼이 없으면 추가 (멱등)
        for sql in [
            "ALTER TABLE place_review_cache ADD COLUMN photo_refs TEXT DEFAULT ''",
        ]:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass  # 이미 존재하면 무시

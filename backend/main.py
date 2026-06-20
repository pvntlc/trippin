from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.router import router as api_v1_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    print(f"[Startup] Trippin API [{settings.app_env}] on :{settings.app_port}")
    yield
    print("[Shutdown] Trippin API 종료")


app = FastAPI(
    title="Trippin API",
    description="해외여행 일정 플래너 — 일정표·지도·장소검색·이동시간·예산·체크리스트·멤버공유",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "trippin"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.app_host, port=settings.app_port, reload=True)

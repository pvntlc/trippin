import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
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


# 프론트엔드 정적 파일 서빙 (운영 배포 시 backend/web 에 Expo web 빌드를 풀어둠).
# API/health 라우트가 먼저 등록되므로 "/" 마운트는 나머지 경로만 처리한다.
# SPA(react-navigation) 딥링크(/trip/123 등) 새로고침 시에도 index.html 을 돌려준다.
class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as e:
            if e.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


_WEB_DIR = os.path.join(os.path.dirname(__file__), "web")
if os.path.isdir(_WEB_DIR):
    app.mount("/", SPAStaticFiles(directory=_WEB_DIR, html=True), name="web")
elif not __debug__:
    # 운영에서 web 디렉터리가 없으면 배포 누락이므로 눈에 띄게 로그
    print("[WARN] web 디렉터리가 없어 정적 서빙 비활성")


if __name__ == "__main__":
    uvicorn.run("main:app", host=settings.app_host, port=settings.app_port, reload=True)

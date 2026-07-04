import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
import uvicorn

from app.core.config import settings
from app.core.database import init_db
from app.core.limiter import limiter
from app.api.v1.router import router as api_v1_router


def _assert_secure_config():
    """운영 환경에서 필수 시크릿 누락 시 시작을 막는다(fail-closed)."""
    if settings.app_env == "production":
        if not settings.jwt_secret or settings.jwt_secret == "dev_only_insecure_secret_change_me":
            raise RuntimeError(
                "JWT_SECRET 미설정/기본값 — 운영 시작 불가. GitHub Secret JWT_SECRET 확인."
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _assert_secure_config()
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

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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


@app.get("/auth/kakao/bridge")
async def kakao_bridge(code: str = "", error: str = ""):
    """카카오 로그인 네이티브 브리지.

    카카오는 로그인 Redirect URI 로 커스텀 스킴을 허용하지 않으므로, https 인 이 페이지를
    Redirect URI 로 등록한다. 카카오가 ?code 를 붙여 여기로 돌아오면, 앱 커스텀 스킴
    trippin://oauth 로 딥링크해 인가코드를 앱에 되돌려준다(WebBrowser 세션이 이를 감지).
    """
    import json
    from fastapi.responses import HTMLResponse

    q = f"code={code}" if code else f"error={error or 'login_failed'}"
    target = f"trippin://oauth?{q}"
    t = json.dumps(target)
    html = (
        "<!doctype html><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        f"<script>location.replace({t})</script>"
        "<p style='font-family:sans-serif;text-align:center;margin-top:48px;color:#333'>"
        f"앱으로 돌아가는 중… <br><a href={t}>자동으로 안 되면 여기를 누르세요</a></p>"
    )
    return HTMLResponse(html)


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

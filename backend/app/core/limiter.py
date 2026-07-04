"""공유 rate limiter — 인증 엔드포인트 브루트포스/열거 방어.

IP 기준 인메모리 카운터(단일 uvicorn 프로세스라 충분). 프록시(nginx) 뒤라
X-Forwarded-For 를 신뢰해 실제 클라이언트 IP 로 제한한다.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _client_ip(request: Request) -> str:
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip, default_limits=[])

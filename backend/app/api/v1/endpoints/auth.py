import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.limiter import limiter
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import KakaoLoginRequest, TokenResponse, UserOut

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    """기존 이메일 계정 로그인 (신규 가입은 카카오만). 소셜 계정은 비번이 빈 문자열이라 통과 못 함."""
    user = await db.scalar(select(User).where(User.email == form.username))
    if user is None or not user.hashed_password or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않음")
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/kakao", response_model=TokenResponse)
@limiter.limit("20/minute")
async def kakao_login(request: Request, body: KakaoLoginRequest, db: AsyncSession = Depends(get_db)):
    """카카오 인가코드 → 서버에서 토큰 교환 → 사용자 정보 조회 → 계정 upsert → 자체 JWT 발급.

    client_secret 은 서버에만 두고 교환을 서버에서 처리(코드 가로채기 방지).
    """
    if not settings.kakao_rest_api_key:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "카카오 로그인 미설정(KAKAO_REST_API_KEY)")

    token_params = {
        "grant_type": "authorization_code",
        "client_id": settings.kakao_rest_api_key,
        "redirect_uri": body.redirect_uri,
        "code": body.code,
    }
    if settings.kakao_client_secret:
        token_params["client_secret"] = settings.kakao_client_secret

    async with httpx.AsyncClient(timeout=10) as client:
        tok = await client.post(
            "https://kauth.kakao.com/oauth/token",
            data=token_params,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if tok.status_code != 200:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"카카오 토큰 교환 실패: {tok.text[:200]}")
        kakao_access = tok.json().get("access_token")
        if not kakao_access:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "카카오 토큰 없음")

        me = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {kakao_access}"},
        )
        if me.status_code != 200:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "카카오 사용자 정보 조회 실패")
        info = me.json()

    kakao_id = str(info.get("id") or "")
    if not kakao_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "카카오 사용자 ID 없음")
    account = info.get("kakao_account") or {}
    profile = account.get("profile") or {}
    nickname = profile.get("nickname") or "카카오 사용자"
    real_email = account.get("email")  # 동의 안 하면 없음

    user = await db.scalar(
        select(User).where(User.provider == "kakao", User.provider_id == kakao_id)
    )
    if user is None:
        # 이메일 컬럼은 NOT NULL + unique — 실이메일이 있고 중복 아니면 사용, 아니면 합성
        email = real_email
        if email:
            dup = await db.scalar(select(User).where(User.email == email))
            if dup is not None:
                email = None
        if not email:
            email = f"kakao_{kakao_id}@trippin.social"
        user = User(
            email=email,
            hashed_password="",
            name=nickname,
            provider="kakao",
            provider_id=kakao_id,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user

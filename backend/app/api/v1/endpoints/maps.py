import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.place_cache import PlaceReviewCache
from app.services import google_maps as gmaps
from app.services.llm import summarize_reviews

router = APIRouter()

# 캐시 유효기간 — 이 기간이 지나면 평점/요약을 다시 갱신
_CACHE_TTL = timedelta(days=30)


@router.get("/search")
async def search(
    q: str = Query(min_length=1, description="검색어 (예: '라멘')"),
    near: str | None = Query(None, description="목적지명(예: 'Tokyo'). 그 지역으로 결과 바이어스"),
    language: str = "ko",
    _: User = Depends(get_current_user),
):
    try:
        loc = await gmaps.geocode(near) if near else None
        return {"results": await gmaps.search_places(q, language, location=loc)}
    except gmaps.GoogleMapsError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))


@router.get("/details/{place_id}")
async def details(place_id: str, language: str = "ko", _: User = Depends(get_current_user)):
    try:
        return await gmaps.place_details(place_id, language)
    except gmaps.GoogleMapsError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))


@router.get("/place/{place_id}/summary")
async def place_summary(
    place_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """평점·리뷰수 + 리뷰 AI 요약. google_place_id 단위로 DB 캐시(30일)."""
    now = datetime.now(timezone.utc)

    cached = await db.scalar(
        select(PlaceReviewCache).where(PlaceReviewCache.google_place_id == place_id)
    )
    if cached:
        updated = cached.updated_at
        if updated.tzinfo is None:  # SQLite 는 naive 로 돌아올 수 있음
            updated = updated.replace(tzinfo=timezone.utc)
        if now - updated < _CACHE_TTL:
            try:
                photos = json.loads(cached.photo_refs) if cached.photo_refs else []
            except Exception:
                photos = []
            return {
                "rating": cached.rating,
                "user_ratings_total": cached.user_ratings_total,
                "review_summary": cached.review_summary,
                "review_count_used": cached.review_count_used,
                "photos": photos,
                "cached": True,
            }

    # 캐시 없음/만료 → 구글에서 리뷰 가져와 요약
    try:
        info = await gmaps.place_reviews(place_id)
    except gmaps.GoogleMapsError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))
    summary = await summarize_reviews(info["name"], info["reviews"])
    photos = info["photo_refs"]
    photos_json = json.dumps(photos)

    # Anthropic 키가 있을 때만 캐시에 기록 (키 미설정으로 빈 요약이 굳지 않게)
    if settings.app_anthropic_api_key:
        if cached:
            cached.rating = info["rating"]
            cached.user_ratings_total = info["user_ratings_total"]
            cached.review_summary = summary
            cached.review_count_used = len(info["reviews"])
            cached.photo_refs = photos_json
            cached.updated_at = now
        else:
            db.add(PlaceReviewCache(
                google_place_id=place_id,
                rating=info["rating"],
                user_ratings_total=info["user_ratings_total"],
                review_summary=summary,
                review_count_used=len(info["reviews"]),
                photo_refs=photos_json,
                updated_at=now,
            ))
        await db.commit()

    return {
        "rating": info["rating"],
        "user_ratings_total": info["user_ratings_total"],
        "review_summary": summary,
        "review_count_used": len(info["reviews"]),
        "photos": photos,
        "cached": False,
    }


@router.get("/directions")
async def route(
    origin: str = Query(description="'lat,lng'"),
    destination: str = Query(description="'lat,lng'"),
    mode: str = Query("transit", pattern="^(driving|walking|bicycling|transit)$"),
    depart: str | None = Query(None, description="출발 시각 'HH:MM' (대중교통 시간대 기준)"),
    _: User = Depends(get_current_user),
):
    try:
        return await gmaps.directions(origin, destination, mode, depart=depart)
    except gmaps.GoogleMapsError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))

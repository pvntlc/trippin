from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.deps import get_current_user
from app.models.user import User
from app.services import google_maps as gmaps

router = APIRouter()


@router.get("/search")
async def search(
    q: str = Query(min_length=1, description="검색어 (예: '도쿄 라멘')"),
    language: str = "ko",
    _: User = Depends(get_current_user),
):
    try:
        return {"results": await gmaps.search_places(q, language)}
    except gmaps.GoogleMapsError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))


@router.get("/details/{place_id}")
async def details(place_id: str, language: str = "ko", _: User = Depends(get_current_user)):
    try:
        return await gmaps.place_details(place_id, language)
    except gmaps.GoogleMapsError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))


@router.get("/directions")
async def route(
    origin: str = Query(description="'lat,lng' 또는 'place_id:xxx'"),
    destination: str = Query(description="'lat,lng' 또는 'place_id:xxx'"),
    mode: str = Query("transit", pattern="^(driving|walking|bicycling|transit)$"),
    _: User = Depends(get_current_user),
):
    try:
        return await gmaps.directions(origin, destination, mode)
    except gmaps.GoogleMapsError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(e))

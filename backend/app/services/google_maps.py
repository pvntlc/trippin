"""Google Maps Platform 프록시.

프론트엔드는 이 백엔드를 거쳐서만 구글 API를 호출한다 → API 키가 클라이언트에
노출되지 않는다. 여기서는 Places API / Directions API 의 classic REST 엔드포인트를 사용.
(키 발급 시 'Places API'와 'Directions API'를 활성화해야 함.)
"""
import httpx

from app.core.config import settings

_PLACES_TEXT = "https://maps.googleapis.com/maps/api/place/textsearch/json"
_PLACE_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"
_DIRECTIONS = "https://maps.googleapis.com/maps/api/directions/json"

_TIMEOUT = httpx.Timeout(10.0)


class GoogleMapsError(RuntimeError):
    pass


def _require_key() -> str:
    if not settings.google_maps_api_key:
        raise GoogleMapsError("GOOGLE_MAPS_API_KEY 가 설정되지 않았습니다.")
    return settings.google_maps_api_key


async def search_places(query: str, language: str = "ko") -> list[dict]:
    """텍스트로 장소 검색. 간략화된 결과 리스트 반환."""
    key = _require_key()
    params = {"query": query, "language": language, "key": key}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(_PLACES_TEXT, params=params)
    data = resp.json()
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        raise GoogleMapsError(f"Places 검색 실패: {status} {data.get('error_message', '')}")
    results = []
    for r in data.get("results", []):
        loc = r.get("geometry", {}).get("location", {})
        results.append(
            {
                "google_place_id": r.get("place_id"),
                "name": r.get("name"),
                "address": r.get("formatted_address", ""),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "rating": r.get("rating"),
                "types": r.get("types", []),
            }
        )
    return results


async def place_details(place_id: str, language: str = "ko") -> dict:
    """place_id 로 상세 정보 조회."""
    key = _require_key()
    fields = "place_id,name,formatted_address,geometry,rating,opening_hours,website,formatted_phone_number,photos"
    params = {"place_id": place_id, "fields": fields, "language": language, "key": key}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(_PLACE_DETAILS, params=params)
    data = resp.json()
    if data.get("status") != "OK":
        raise GoogleMapsError(f"Place 상세 실패: {data.get('status')}")
    r = data.get("result", {})
    loc = r.get("geometry", {}).get("location", {})
    return {
        "google_place_id": r.get("place_id"),
        "name": r.get("name"),
        "address": r.get("formatted_address", ""),
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "rating": r.get("rating"),
        "website": r.get("website"),
        "phone": r.get("formatted_phone_number"),
        "opening_hours": r.get("opening_hours", {}).get("weekday_text", []),
    }


async def directions(origin: str, destination: str, mode: str = "transit", language: str = "ko") -> dict:
    """두 지점 간 경로/소요시간. origin·destination 은 'lat,lng' 또는 place_id:xxx.

    mode: driving | walking | bicycling | transit
    """
    key = _require_key()
    params = {
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "language": language,
        "key": key,
    }
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(_DIRECTIONS, params=params)
    data = resp.json()
    if data.get("status") != "OK":
        raise GoogleMapsError(f"Directions 실패: {data.get('status')}")
    routes = data.get("routes", [])
    if not routes:
        return {"distance_m": None, "duration_s": None, "summary": "", "mode": mode}
    leg = routes[0]["legs"][0]
    return {
        "distance_m": leg.get("distance", {}).get("value"),
        "distance_text": leg.get("distance", {}).get("text"),
        "duration_s": leg.get("duration", {}).get("value"),
        "duration_text": leg.get("duration", {}).get("text"),
        "summary": routes[0].get("summary", ""),
        "mode": mode,
    }

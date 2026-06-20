"""Google Maps Platform 프록시.

프론트엔드는 이 백엔드를 거쳐서만 구글 API를 호출한다 → API 키가 클라이언트에
노출되지 않는다. 여기서는 Places API / Directions API 의 classic REST 엔드포인트를 사용.
(키 발급 시 'Places API'와 'Directions API'를 활성화해야 함.)
"""
import time

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
        photos = r.get("photos", [])
        results.append(
            {
                "google_place_id": r.get("place_id"),
                "name": r.get("name"),
                "address": r.get("formatted_address", ""),
                "lat": loc.get("lat"),
                "lng": loc.get("lng"),
                "rating": r.get("rating"),
                "types": r.get("types", []),
                "photo_reference": photos[0].get("photo_reference") if photos else None,
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


async def place_reviews(place_id: str, language: str = "ko") -> dict:
    """평점·리뷰수·리뷰 텍스트 + 사진(여러 장) 조회 (상세/요약용)."""
    key = _require_key()
    fields = "name,rating,user_ratings_total,reviews,types,photos"
    params = {"place_id": place_id, "fields": fields, "language": language, "key": key}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(_PLACE_DETAILS, params=params)
    data = resp.json()
    if data.get("status") != "OK":
        raise GoogleMapsError(f"Place 상세 실패: {data.get('status')}")
    r = data.get("result", {})
    reviews = [rv.get("text", "") for rv in r.get("reviews", []) if rv.get("text")]
    photo_refs = [p.get("photo_reference") for p in r.get("photos", []) if p.get("photo_reference")][:8]
    return {
        "name": r.get("name", ""),
        "rating": r.get("rating"),
        "user_ratings_total": r.get("user_ratings_total", 0),
        "reviews": reviews,
        "types": r.get("types", []),
        "photo_refs": photo_refs,
    }


_ROUTES_API = "https://routes.googleapis.com/directions/v2:computeRoutes"
_MODE_MAP = {"walking": "WALK", "driving": "DRIVE", "transit": "TRANSIT", "bicycling": "BICYCLE"}


def _fmt_duration(sec: int | None) -> str | None:
    if not sec:
        return None
    m = round(sec / 60)
    if m < 60:
        return f"{m}분"
    return f"{m // 60}시간 {m % 60}분" if m % 60 else f"{m // 60}시간"


def _fmt_distance(meters: int | None) -> str | None:
    if meters is None:
        return None
    return f"{meters / 1000:.1f} km" if meters >= 1000 else f"{meters} m"


def _parse_latlng(s: str) -> dict:
    lat, lng = s.split(",")
    return {"location": {"latLng": {"latitude": float(lat), "longitude": float(lng)}}}


async def directions(origin: str, destination: str, mode: str = "walking", language: str = "ko") -> dict:
    """두 지점('lat,lng') 간 경로/소요시간 — Routes API.

    mode: walking | driving | transit | bicycling
    대중교통은 노선 정보(transit_lines)도 반환. 일본 등 일부 지역은 transit 미지원(no_route).
    """
    key = _require_key()
    travel_mode = _MODE_MAP.get(mode, "WALK")
    body: dict = {
        "origin": _parse_latlng(origin),
        "destination": _parse_latlng(destination),
        "travelMode": travel_mode,
        "languageCode": language,
    }
    if travel_mode == "TRANSIT":
        body["departureTime"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 120))

    field_mask = (
        "routes.duration,routes.distanceMeters,"
        "routes.legs.steps.travelMode,"
        "routes.legs.steps.transitDetails.transitLine.nameShort,"
        "routes.legs.steps.transitDetails.transitLine.name,"
        "routes.legs.steps.transitDetails.stopCount"
    )
    headers = {"Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": field_mask}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(_ROUTES_API, json=body, headers=headers)
    data = resp.json()
    if resp.status_code != 200:
        raise GoogleMapsError(f"Routes 실패: {data.get('error', {}).get('message', resp.status_code)}")

    routes = data.get("routes", [])
    if not routes:
        return {"duration_s": None, "distance_m": None, "duration_text": None,
                "distance_text": None, "mode": mode, "no_route": True, "transit_lines": []}

    rt = routes[0]
    dur_s = int(str(rt.get("duration", "0s")).rstrip("s") or 0)
    dist_m = rt.get("distanceMeters")
    transit_lines: list[str] = []
    for leg in rt.get("legs", []):
        for step in leg.get("steps", []):
            td = step.get("transitDetails")
            if td:
                line = td.get("transitLine", {})
                nm = line.get("nameShort") or line.get("name")
                if nm:
                    transit_lines.append(nm)
    return {
        "duration_s": dur_s,
        "distance_m": dist_m,
        "duration_text": _fmt_duration(dur_s),
        "distance_text": _fmt_distance(dist_m),
        "mode": mode,
        "no_route": False,
        "transit_lines": transit_lines,
    }

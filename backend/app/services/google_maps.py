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
_AUTOCOMPLETE = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
_DIRECTIONS = "https://maps.googleapis.com/maps/api/directions/json"

_TIMEOUT = httpx.Timeout(10.0)


class GoogleMapsError(RuntimeError):
    pass


def _require_key() -> str:
    if not settings.google_maps_api_key:
        raise GoogleMapsError("GOOGLE_MAPS_API_KEY 가 설정되지 않았습니다.")
    return settings.google_maps_api_key


# 목적지 문자열 → 좌표 캐시 (해외 검색을 그 지역으로 바이어스하기 위함)
_geocode_cache: dict[str, tuple[float, float] | None] = {}


async def geocode(place: str) -> tuple[float, float] | None:
    """목적지명을 좌표로(첫 결과). 결과/실패 모두 캐시. 위치 바이어스용."""
    if not place:
        return None
    key_ = place.strip().lower()
    if key_ in _geocode_cache:
        return _geocode_cache[key_]
    try:
        key = _require_key()
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(_PLACES_TEXT, params={"query": place, "key": key})
        rs = resp.json().get("results", [])
        loc = rs[0].get("geometry", {}).get("location", {}) if rs else {}
        out = (loc["lat"], loc["lng"]) if loc.get("lat") is not None else None
    except Exception:
        out = None
    _geocode_cache[key_] = out
    return out


async def search_places(query: str, language: str = "ko", location: tuple[float, float] | None = None) -> list[dict]:
    """텍스트로 장소 검색. location 이 주어지면 그 좌표 주변(50km)으로 결과를 바이어스."""
    key = _require_key()
    params: dict = {"query": query, "language": language, "key": key}
    if location:
        params["location"] = f"{location[0]},{location[1]}"
        params["radius"] = "50000"
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


async def autocomplete(query: str, language: str = "ko", location: tuple[float, float] | None = None) -> list[dict]:
    """입력어로 장소 자동완성 예측. 부분어/오타에 강함(구글맵식 검색). location 으로 지역 바이어스."""
    key = _require_key()
    params: dict = {"input": query, "language": language, "key": key}
    if location:
        params["location"] = f"{location[0]},{location[1]}"
        params["radius"] = "50000"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(_AUTOCOMPLETE, params=params)
    data = resp.json()
    if data.get("status") not in ("OK", "ZERO_RESULTS"):
        raise GoogleMapsError(f"자동완성 실패: {data.get('status')} {data.get('error_message', '')}")
    out = []
    for p in data.get("predictions", []):
        sf = p.get("structured_formatting", {})
        out.append({
            "place_id": p.get("place_id"),
            "name": sf.get("main_text") or p.get("description", ""),
            "secondary": sf.get("secondary_text", ""),
            "types": p.get("types", []),
        })
    return out


async def place_details(place_id: str, language: str = "ko") -> dict:
    """place_id 로 상세 정보 조회. (자동완성 예측 선택 시 좌표/사진 등 채우기에도 사용)"""
    key = _require_key()
    fields = "place_id,name,formatted_address,geometry,rating,types,opening_hours,website,formatted_phone_number,photos"
    params = {"place_id": place_id, "fields": fields, "language": language, "key": key}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(_PLACE_DETAILS, params=params)
    data = resp.json()
    if data.get("status") != "OK":
        raise GoogleMapsError(f"Place 상세 실패: {data.get('status')}")
    r = data.get("result", {})
    loc = r.get("geometry", {}).get("location", {})
    photos = r.get("photos", [])
    return {
        "google_place_id": r.get("place_id"),
        "name": r.get("name"),
        "address": r.get("formatted_address", ""),
        "lat": loc.get("lat"),
        "lng": loc.get("lng"),
        "rating": r.get("rating"),
        "types": r.get("types", []),
        "photo_reference": photos[0].get("photo_reference") if photos else None,
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


def _decode_polyline(encoded: str) -> list[list[float]]:
    """Google encoded polyline → [[lat,lng], ...]."""
    if not encoded:
        return []
    points: list[list[float]] = []
    index = lat = lng = 0
    length = len(encoded)
    while index < length:
        for is_lng in (False, True):
            result = shift = 0
            while True:
                b = ord(encoded[index]) - 63
                index += 1
                result |= (b & 0x1F) << shift
                shift += 5
                if b < 0x20:
                    break
            d = ~(result >> 1) if result & 1 else (result >> 1)
            if is_lng:
                lng += d
            else:
                lat += d
        points.append([lat / 1e5, lng / 1e5])
    return points


def _iso_hhmm(iso: str) -> str:
    """RFC3339('...T14:30:00-04:00') → 'HH:MM' (현지 시각)."""
    return iso[11:16] if iso and len(iso) >= 16 else ""


_CUR_SYM = {"USD": "$", "EUR": "€", "GBP": "£", "JPY": "¥", "KRW": "₩", "AUD": "A$", "CAD": "C$"}


def _fmt_fare(fare: dict | None) -> str | None:
    if not fare:
        return None
    cur = fare.get("currencyCode", "")
    units = int(fare.get("units", 0) or 0)
    amount = units + (fare.get("nanos", 0) or 0) / 1e9
    sym = _CUR_SYM.get(cur)
    if sym:
        return f"{sym}{amount:.2f}" if amount % 1 else f"{sym}{int(amount)}"
    return f"{amount:.2f} {cur}".strip()


async def _google_transit(origin: str, destination: str, language: str, key: str) -> dict:
    """비일본 대중교통 — Google Routes(여러 대안)를 NAVITIME 과 같은 형식(options/steps/stations)으로 변환."""
    body = {
        "origin": _parse_latlng(origin),
        "destination": _parse_latlng(destination),
        "travelMode": "TRANSIT",
        "computeAlternativeRoutes": True,
        "languageCode": language,
        "departureTime": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() + 120)),
    }
    field_mask = (
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,"
        "routes.travelAdvisory.transitFare,"
        "routes.legs.steps.travelMode,routes.legs.steps.staticDuration,"
        "routes.legs.steps.transitDetails.transitLine.name,"
        "routes.legs.steps.transitDetails.transitLine.nameShort,"
        "routes.legs.steps.transitDetails.stopDetails"
    )
    headers = {"Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": field_mask}
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(_ROUTES_API, json=body, headers=headers)
    data = resp.json()
    if resp.status_code != 200:
        raise GoogleMapsError(f"Routes(transit) 실패: {data.get('error', {}).get('message', resp.status_code)}")

    options: list[dict] = []
    for rt in data.get("routes", []):
        steps: list[dict] = []
        stations: list[dict] = []
        walk_secs = 0  # 연속 도보 구간 합산

        def _flush_walk():
            nonlocal walk_secs
            mins = round(walk_secs / 60)
            if mins >= 1:
                steps.append({"mode": "walk", "line": "", "from_time": "", "to_time": "",
                              "from_name": "", "to_name": "", "duration_text": f"{mins}분"})
            walk_secs = 0

        for leg in rt.get("legs", []):
            for step in leg.get("steps", []):
                if step.get("travelMode") == "TRANSIT":
                    _flush_walk()
                    td = step.get("transitDetails", {})
                    sd = td.get("stopDetails", {})
                    line = td.get("transitLine", {})
                    nm = line.get("nameShort") or line.get("name") or "대중교통"
                    dep_stop = sd.get("departureStop", {}).get("name", "")
                    arr_stop = sd.get("arrivalStop", {}).get("name", "")
                    steps.append({
                        "mode": "transit", "line": nm,
                        "from_time": _iso_hhmm(sd.get("departureTime", "")),
                        "to_time": _iso_hhmm(sd.get("arrivalTime", "")),
                        "from_name": dep_stop, "to_name": arr_stop, "duration_text": None,
                    })
                    for nm2, st, is_dep in ((dep_stop, sd.get("departureStop", {}), True),
                                            (arr_stop, sd.get("arrivalStop", {}), False)):
                        loc = st.get("location", {}).get("latLng", {})
                        if nm2 and loc.get("latitude") is not None:
                            stations.append({"name": nm2, "lat": loc["latitude"], "lng": loc["longitude"], "board": is_dep})
                else:
                    walk_secs += int(str(step.get("staticDuration", "0s")).rstrip("s") or 0)
        _flush_walk()
        transit_steps = [s for s in steps if s["mode"] == "transit"]
        dur_s = int(str(rt.get("duration", "0s")).rstrip("s") or 0)
        options.append({
            "duration_text": _fmt_duration(dur_s),
            "fare_text": _fmt_fare(rt.get("travelAdvisory", {}).get("transitFare")),
            "transfers": max(0, len(transit_steps) - 1),
            "depart": transit_steps[0]["from_time"] if transit_steps else "",
            "arrive": transit_steps[-1]["to_time"] if transit_steps else "",
            "steps": steps,
            "shape": _decode_polyline(rt.get("polyline", {}).get("encodedPolyline", "")),
            "stations": stations,
        })
    if not options:
        return {"duration_text": None, "distance_text": None, "mode": "transit",
                "no_route": True, "transit_lines": [], "options": [], "polyline": [], "stations": []}
    best = options[0]
    return {
        "duration_text": best["duration_text"], "distance_text": None, "fare_text": best["fare_text"],
        "mode": "transit", "no_route": False,
        "transit_lines": [s["line"] for s in best["steps"] if s["mode"] == "transit"],
        "options": options, "polyline": best["shape"], "stations": best["stations"],
    }


async def directions(origin: str, destination: str, mode: str = "walking", language: str = "ko", depart: str | None = None) -> dict:
    """두 지점('lat,lng') 간 경로/소요시간 — Routes API.

    mode: walking | driving | transit | bicycling
    대중교통은 노선 정보(transit_lines)도 반환.
    일본 대중교통은 구글 미지원 → NAVITIME 으로 처리(키 있을 때).
    """
    key = _require_key()

    # 대중교통: 일본=NAVITIME(구글 미지원), 그 외=Google Routes 를 options 형식으로
    if mode == "transit":
        from app.services import navitime
        if navitime.in_japan(origin) and settings.navitime_api_key:
            nav = await navitime.transit_route(origin, destination, depart)
            if nav is not None:
                return nav
        return await _google_transit(origin, destination, language, key)

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
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,"
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
    polyline = _decode_polyline(rt.get("polyline", {}).get("encodedPolyline", ""))
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
        "polyline": polyline,
    }

"""NAVITIME(일본 대중교통) 경로. 구글이 일본 transit 미지원이라 대체.

RapidAPI 'NAVITIME Route (totalnavi)' 의 /route_transit 사용.
"""
import time

import httpx

from app.core.config import settings

_HOST = "navitime-route-totalnavi.p.rapidapi.com"
_URL = f"https://{_HOST}/route_transit"
_TIMEOUT = httpx.Timeout(12.0)

# 일본 대략 바운딩 박스 (위/경도)
_JP = {"lat": (24.0, 46.5), "lng": (122.0, 154.0)}


def in_japan(latlng: str) -> bool:
    try:
        lat, lng = map(float, latlng.split(","))
    except Exception:
        return False
    return _JP["lat"][0] <= lat <= _JP["lat"][1] and _JP["lng"][0] <= lng <= _JP["lng"][1]


def _fmt_distance(m: int | None) -> str | None:
    if m is None:
        return None
    return f"{m / 1000:.1f} km" if m >= 1000 else f"{m} m"


async def transit_route(origin: str, destination: str) -> dict | None:
    """일본 대중교통 경로. 키 없거나 호출 실패 시 None(호출측이 구글로 폴백)."""
    key = settings.navitime_api_key
    if not key:
        return None
    # 출발 시각: 지금(JST) +2분
    start_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 9 * 3600 + 120))
    params = {
        "start": origin, "goal": destination, "start_time": start_time,
        "datum": "wgs84", "coord_unit": "degree", "term": "1440", "limit": "1",
    }
    headers = {"X-RapidAPI-Key": key, "X-RapidAPI-Host": _HOST}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(_URL, params=params, headers=headers)
        if resp.status_code != 200:
            return None
        items = resp.json().get("items", [])
    except Exception:
        return None
    if not items:
        return {"duration_text": None, "distance_text": None, "mode": "transit",
                "no_route": True, "transit_lines": []}

    summary = items[0].get("summary", {})
    move = summary.get("move", {})
    minutes = move.get("time")
    distance = move.get("distance")
    # 노선명: walk 가 아닌 이동 구간의 line_name
    lines: list[str] = []
    for s in items[0].get("sections", []):
        if s.get("type") == "move" and s.get("move") != "walk":
            nm = s.get("line_name") or (s.get("transport") or {}).get("name") or s.get("name")
            if nm:
                lines.append(nm)
    # 요금(엔)
    fare = move.get("reference_fare", {}).get("lowest_total_ic") or move.get("reference_fare", {}).get("lowest_total_ticket")
    return {
        "duration_text": f"{minutes}분" if minutes else None,
        "distance_text": _fmt_distance(distance),
        "duration_s": (minutes or 0) * 60,
        "distance_m": distance,
        "mode": "transit",
        "no_route": minutes is None,
        "transit_lines": lines,
        "fare_text": f"{int(fare):,}엔" if fare else None,
    }

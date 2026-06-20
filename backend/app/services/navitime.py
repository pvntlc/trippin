"""NAVITIME(일본 대중교통) 경로. 구글이 일본 transit 미지원이라 대체.

RapidAPI 'NAVITIME Route (totalnavi)' 의 /route_transit 사용.
여러 경로 옵션 + 각 구간 출발/도착 시각 + 한글 노선명(매핑) 제공.
"""
import time

import httpx

from app.core.config import settings

_HOST = "navitime-route-totalnavi.p.rapidapi.com"
_URL = f"https://{_HOST}/route_transit"
_TIMEOUT = httpx.Timeout(12.0)

_JP = {"lat": (24.0, 46.5), "lng": (122.0, 154.0)}

# 일본 노선명(부분일치) → 한글. NAVITIME이 한글을 안 줘서 매핑. 미매핑은 일본어만.
_LINE_KO: list[tuple[str, str]] = [
    ("銀座線", "긴자선"), ("丸ノ内線", "마루노우치선"), ("日比谷線", "히비야선"),
    ("東西線", "도자이선"), ("千代田線", "치요다선"), ("有楽町線", "유라쿠초선"),
    ("半蔵門線", "한조몬선"), ("南北線", "난보쿠선"), ("副都心線", "후쿠토신선"),
    ("浅草線", "아사쿠사선"), ("三田線", "미타선"), ("大江戸線", "오에도선"),
    ("新宿線", "신주쿠선"), ("山手線", "야마노테선"), ("中央線", "주오선"),
    ("総武線", "소부선"), ("京浜東北線", "케이힌토호쿠선"), ("埼京線", "사이쿄선"),
    ("湘南新宿", "쇼난신주쿠라인"), ("東海道", "도카이도선"), ("京葉線", "케이요선"),
    ("横須賀線", "요코스카선"), ("常磐線", "조반선"), ("成田", "나리타선"),
    ("スカイツリーライン", "스카이트리라인"), ("ゆりかもめ", "유리카모메"),
    ("りんかい線", "린카이선"), ("御堂筋線", "미도스지선"), ("谷町線", "다니마치선"),
    ("四つ橋線", "요쓰바시선"), ("堺筋線", "사카이스지선"), ("烏丸線", "가라스마선"),
    ("京阪", "게이한"), ("阪急", "한큐"), ("阪神", "한신"), ("近鉄", "긴테쓰"),
    ("南海", "난카이"), ("京王", "케이오"), ("小田急", "오다큐"), ("東急", "도큐"),
    ("西武", "세이부"), ("東武", "도부"), ("京成", "케이세이"), ("相鉄", "소테쓰"),
    ("モノレール", "모노레일"), ("新幹線", "신칸센"),
]


def _line_label(jp: str) -> str:
    """'한글 (일본어)'. 매핑 없으면 일본어만."""
    if not jp:
        return ""
    for key, ko in _LINE_KO:
        if key in jp:
            return f"{ko} ({jp})"
    return jp


def in_japan(latlng: str) -> bool:
    try:
        lat, lng = map(float, latlng.split(","))
    except Exception:
        return False
    return _JP["lat"][0] <= lat <= _JP["lat"][1] and _JP["lng"][0] <= lng <= _JP["lng"][1]


def _fmt_distance(m) -> str | None:
    if m is None:
        return None
    return f"{m / 1000:.1f} km" if m >= 1000 else f"{m} m"


def _hhmm(iso: str) -> str:
    return iso[11:16] if iso and len(iso) >= 16 else ""


def _fare(move: dict):
    rf = move.get("reference_fare", {})
    return rf.get("lowest_total_ic") or rf.get("lowest_total_ticket")


def _parse_item(it: dict) -> dict:
    mv = it.get("summary", {}).get("move", {})
    minutes = mv.get("time")
    fare = _fare(mv)
    steps = []
    for s in it.get("sections", []):
        if s.get("type") == "move" and s.get("move") != "walk":
            steps.append({
                "line": _line_label(s.get("line_name") or ""),
                "from_time": _hhmm(s.get("from_time", "")),
                "to_time": _hhmm(s.get("to_time", "")),
                "from_name": s.get("from_name", ""),
                "to_name": s.get("to_name", ""),
            })
    return {
        "duration_text": f"{minutes}분" if minutes else None,
        "fare_text": f"{int(fare):,}엔" if fare else None,
        "transfers": mv.get("transit_count", 0),
        "steps": steps,
    }


async def transit_route(origin: str, destination: str) -> dict | None:
    """일본 대중교통 — 여러 경로 옵션. 키 없거나 실패 시 None(구글 폴백)."""
    key = settings.navitime_api_key
    if not key:
        return None
    start_time = time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() + 9 * 3600 + 120))
    params = {
        "start": origin, "goal": destination, "start_time": start_time,
        "datum": "wgs84", "coord_unit": "degree", "term": "1440", "limit": "3",
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
                "no_route": True, "transit_lines": [], "options": []}

    options = [_parse_item(it) for it in items]
    best = options[0]
    first = items[0].get("summary", {}).get("move", {})
    return {
        "duration_text": best["duration_text"],
        "distance_text": _fmt_distance(first.get("distance")),
        "fare_text": best["fare_text"],
        "mode": "transit",
        "no_route": best["duration_text"] is None,
        "transit_lines": [s["line"] for s in best["steps"]],
        "options": options,
    }

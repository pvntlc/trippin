"""여행 날씨 — Open-Meteo(무료·키 불필요). 예보 범위(약 16일) 안이면 실제 예보,
밖이면 작년 같은 날짜의 실측을 '평년' 참고값으로. 좌표별 3시간 캐시."""
import time
from datetime import date, timedelta

import httpx

_cache: dict = {}
_TTL = 3 * 3600

# WMO weather code → (이모지, 한국어)
_WMO = {
    0: ("☀️", "맑음"), 1: ("🌤️", "대체로 맑음"), 2: ("⛅", "구름 조금"), 3: ("☁️", "흐림"),
    45: ("🌫️", "안개"), 48: ("🌫️", "안개"),
    51: ("🌦️", "약한 이슬비"), 53: ("🌦️", "이슬비"), 55: ("🌧️", "강한 이슬비"),
    61: ("🌦️", "약한 비"), 63: ("🌧️", "비"), 65: ("🌧️", "강한 비"),
    66: ("🌧️", "어는 비"), 67: ("🌧️", "어는 비"),
    71: ("🌨️", "약한 눈"), 73: ("❄️", "눈"), 75: ("❄️", "강한 눈"), 77: ("❄️", "싸락눈"),
    80: ("🌦️", "약한 소나기"), 81: ("🌧️", "소나기"), 82: ("⛈️", "강한 소나기"),
    85: ("🌨️", "눈 소나기"), 86: ("❄️", "강한 눈 소나기"),
    95: ("⛈️", "뇌우"), 96: ("⛈️", "우박 뇌우"), 99: ("⛈️", "강한 뇌우"),
}


def _code_info(code):
    return _WMO.get(int(code) if code is not None else -1, ("🌡️", ""))


async def _fetch(lat: float, lng: float, start: str, end: str, historical: bool) -> dict:
    """{date: {tmax,tmin,precip,code}} 반환."""
    key = (round(lat, 2), round(lng, 2), start, end, historical)
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[0] < _TTL:
        return hit[1]
    if historical:
        url = "https://archive-api.open-meteo.com/v1/archive"
        daily = "temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode"
    else:
        url = "https://api.open-meteo.com/v1/forecast"
        daily = "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode"
    params = {"latitude": lat, "longitude": lng, "daily": daily, "timezone": "auto",
              "start_date": start, "end_date": end}
    out: dict = {}
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(url, params=params)
            d = (r.json() or {}).get("daily") or {}
        dates = d.get("time") or []
        tmax = d.get("temperature_2m_max") or []
        tmin = d.get("temperature_2m_min") or []
        codes = d.get("weathercode") or []
        precip = d.get("precipitation_probability_max") if not historical else d.get("precipitation_sum")
        precip = precip or []
        for i, dt in enumerate(dates):
            out[dt] = {
                "tmax": tmax[i] if i < len(tmax) else None,
                "tmin": tmin[i] if i < len(tmin) else None,
                "code": codes[i] if i < len(codes) else None,
                "precip": precip[i] if i < len(precip) else None,
            }
        _cache[key] = (now, out)
    except Exception:
        pass
    return out


async def trip_weather(points: list[tuple[str, float, float]], today: date) -> list[dict]:
    """points: [(date_iso, lat, lng)] (여행 각 날짜의 대표 좌표) → 날짜별 날씨.
    예보 범위 밖이면 작년 동일 날짜 실측(historical=평년 참고)."""
    results = []
    for date_iso, lat, lng in points:
        try:
            d = date.fromisoformat(date_iso)
        except Exception:
            continue
        ahead = (d - today).days
        historical = not (-1 <= ahead <= 15)
        q = d
        if historical:
            # 작년 같은 날짜 실측을 참고값으로
            try:
                q = d.replace(year=d.year - 1)
            except ValueError:
                q = d - timedelta(days=365)
        day = await _fetch(lat, lng, q.isoformat(), q.isoformat(), historical)
        w = day.get(q.isoformat(), {})
        emoji, desc = _code_info(w.get("code"))
        results.append({
            "date": date_iso,
            "emoji": emoji,
            "desc": desc,
            "tmax": round(w["tmax"]) if w.get("tmax") is not None else None,
            "tmin": round(w["tmin"]) if w.get("tmin") is not None else None,
            "precip": round(w["precip"]) if w.get("precip") is not None else None,
            "historical": historical,
        })
    return results

"""환율 — 각 통화 1단위가 몇 원(KRW)인지. 무료 API(open.er-api.com) 6시간 캐시."""
import time

import httpx

_cache: dict = {"ts": 0.0, "krw_per": {}}
_TTL = 6 * 3600


async def krw_rates() -> dict:
    """{'JPY': 9.1, 'USD': 1380.0, 'EUR': ..., 'KRW': 1.0} — 1단위당 원화. 실패 시 마지막 캐시."""
    now = time.time()
    if _cache["krw_per"] and now - _cache["ts"] < _TTL:
        return _cache["krw_per"]
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get("https://open.er-api.com/v6/latest/KRW")
            rates = (r.json() or {}).get("rates") or {}
            # rates[CUR] = 1 KRW 당 CUR → 뒤집으면 1 CUR 당 KRW
            krw_per = {cur: (1.0 / v) for cur, v in rates.items() if isinstance(v, (int, float)) and v}
            krw_per["KRW"] = 1.0
            if len(krw_per) > 1:
                _cache.update(ts=now, krw_per=krw_per)
    except Exception:
        pass  # 네트워크 실패 시 이전 캐시(없으면 빈 dict) 반환
    return _cache["krw_per"]

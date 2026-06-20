"""NAVITIME(일본 대중교통) 경로. 구글이 일본 transit 미지원이라 대체.

RapidAPI 'NAVITIME Route (totalnavi)' 의 /route_transit 사용.
여러 경로 옵션 + 각 구간 출발/도착 시각 + 한글 노선명(매핑) 제공.
"""
import calendar
import time

import httpx

from app.core.config import settings


def _start_time(depart: str | None) -> str:
    """depart='HH:MM' → 오늘(JST) 그 시각 ISO. 과거면 +1일. 없으면 지금+2분."""
    now = time.time() + 9 * 3600  # JST 기준 epoch
    if depart and ":" in depart:
        try:
            hh, mm = depart.split(":")[:2]
            lt = time.gmtime(now)
            target = calendar.timegm((lt.tm_year, lt.tm_mon, lt.tm_mday, int(hh), int(mm), 0, 0, 0, 0))
            if target < now:
                target += 86400
            return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(target))
        except Exception:
            pass
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(now + 120))

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


# 일본 역명 → 한글. NAVITIME이 한글을 안 줘서 매핑. 미매핑은 일본어 유지.
# (자주 가는 도쿄 중심 + 주요 환승역, 오사카/교토/나고야 등)
_STATION_KO: dict[str, str] = {
    # 도쿄 야마노테/주요 터미널
    "東京": "도쿄", "新宿": "신주쿠", "渋谷": "시부야", "池袋": "이케부쿠로",
    "品川": "시나가와", "上野": "우에노", "秋葉原": "아키하바라", "新橋": "신바시",
    "有楽町": "유라쿠초", "浜松町": "하마마쓰초", "田町": "다마치", "高輪ゲートウェイ": "다카나와게이트웨이",
    "五反田": "고탄다", "目黒": "메구로", "恵比寿": "에비스", "原宿": "하라주쿠",
    "代々木": "요요기", "大崎": "오사키", "神田": "간다", "御徒町": "오카치마치",
    "鶯谷": "우구이스다니", "日暮里": "닛포리", "西日暮里": "니시닛포리", "田端": "다바타",
    "駒込": "고마고메", "巣鴨": "스가모", "大塚": "오쓰카",
    # 긴자/마루노우치/도심
    "銀座": "긴자", "日本橋": "니혼바시", "大手町": "오테마치", "東京駅": "도쿄",
    "霞ケ関": "가스미가세키", "霞ヶ関": "가스미가세키", "日比谷": "히비야", "六本木": "롯폰기",
    "赤坂": "아카사카", "赤坂見附": "아카사카미쓰케", "溜池山王": "다메이케산노",
    "永田町": "나가타초", "国会議事堂前": "곳카이기지도마에", "虎ノ門": "도라노몬",
    "神谷町": "가미야초", "麻布十番": "아자부주반", "広尾": "히로오", "表参道": "오모테산도",
    "青山一丁目": "아오야마잇초메", "外苑前": "가이엔마에", "明治神宮前": "메이지진구마에",
    "北参道": "기타산도", "代々木公園": "요요기코엔", "千駄ケ谷": "센다가야", "信濃町": "시나노마치",
    "四ツ谷": "요쓰야", "四谷": "요쓰야", "市ケ谷": "이치가야", "飯田橋": "이다바시",
    "後楽園": "고라쿠엔", "春日": "가스가", "水道橋": "스이도바시", "御茶ノ水": "오차노미즈",
    # 아사쿠사/스카이트리/시타마치
    "浅草": "아사쿠사", "浅草橋": "아사쿠사바시", "押上": "오시아게", "とうきょうスカイツリー": "도쿄스카이트리",
    "業平橋": "나리히라바시", "本所吾妻橋": "혼조아즈마바시", "曳舟": "히키후네", "錦糸町": "긴시초",
    "両国": "료고쿠", "蔵前": "구라마에", "田原町": "다와라마치", "上野御徒町": "우에노오카치마치",
    "北千住": "기타센주", "南千住": "미나미센주",
    # 임해/오다이바
    "新木場": "신키바", "豊洲": "도요스", "月島": "쓰키시마", "勝どき": "가치도키",
    "国際展示場": "고쿠사이텐지조", "東京テレポート": "도쿄텔레포트", "お台場海浜公園": "오다이바카이힌코엔",
    "台場": "다이바", "汐留": "시오도메", "築地": "쓰키지", "築地市場": "쓰키지시조",
    "門前仲町": "몬젠나카초", "木場": "기바", "東陽町": "도요초", "葛西": "가사이", "西葛西": "니시가사이",
    # 디즈니/지바
    "舞浜": "마이하마", "新浦安": "신우라야스", "浦安": "우라야스",
    # 서부/사철
    "中野": "나카노", "高円寺": "고엔지", "荻窪": "오기쿠보", "吉祥寺": "기치조지",
    "三鷹": "미타카", "立川": "다치카와", "国分寺": "고쿠분지", "下北沢": "시모키타자와",
    "明大前": "메이다이마에", "二子玉川": "후타코타마가와", "自由が丘": "지유가오카",
    "中目黒": "나카메구로", "武蔵小杉": "무사시코스기", "武蔵溝ノ口": "무사시미조노쿠치",
    "溝の口": "미조노쿠치", "溝ノ口": "미조노쿠치",
    # 가나가와
    "横浜": "요코하마", "川崎": "가와사키", "新横浜": "신요코하마", "桜木町": "사쿠라기초",
    "みなとみらい": "미나토미라이", "関内": "간나이", "鎌倉": "가마쿠라", "北鎌倉": "기타카마쿠라",
    "藤沢": "후지사와", "小田原": "오다와라", "箱根湯本": "하코네유모토",
    # 공항
    "成田空港": "나리타공항", "空港第2ビル": "공항제2빌딩", "羽田空港": "하네다공항",
    "羽田空港第1": "하네다공항제1", "羽田空港第2": "하네다공항제2", "羽田空港第3": "하네다공항제3",
    # 오사카/교토/나고야/고베/나라
    "大阪": "오사카", "新大阪": "신오사카", "梅田": "우메다", "大阪梅田": "오사카우메다",
    "難波": "난바", "なんば": "난바", "心斎橋": "신사이바시", "天王寺": "덴노지",
    "本町": "혼마치", "京橋": "교바시", "天満": "덴마", "鶴橋": "쓰루하시",
    "京都": "교토", "河原町": "가와라마치", "京都河原町": "교토가와라마치", "祇園四条": "기온시조",
    "烏丸": "가라스마", "四条": "시조", "嵐山": "아라시야마", "伏見稲荷": "후시미이나리",
    "名古屋": "나고야", "金山": "가나야마", "栄": "사카에",
    "三宮": "산노미야", "神戸三宮": "고베산노미야", "神戸": "고베", "元町": "모토마치",
    "奈良": "나라", "近鉄奈良": "긴테쓰나라",
}


def _station_ko(name: str) -> str:
    """일본 역명 → 한글. 미매핑은 일본어 유지. 대괄호 별칭/駅 접미 제거 후 조회."""
    if not name:
        return name
    base = name.split("[")[0].split("（")[0].strip()
    if base.endswith("駅"):
        base = base[:-1]
    return _STATION_KO.get(base, name)


def _clean_pt(name: str) -> str:
    """지점 이름 정리: NAVITIME의 start/goal → 한글, 역명 → 한글."""
    if name == "start":
        return "출발지"
    if name == "goal":
        return "도착지"
    return _station_ko(name)


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


def _coord(pt: dict):
    c = pt.get("coord") or {}
    lat, lon = c.get("lat"), c.get("lon")
    if lat is None or lon is None:
        return None
    return [lat, lon]


def _parse_item(it: dict) -> dict:
    mv = it.get("summary", {}).get("move", {})
    minutes = mv.get("time")
    fare = _fare(mv)
    sections = it.get("sections", [])
    # 경로 지오메트리: NAVITIME은 노선 shape를 안 줘서 지점(역) 좌표를 순서대로 이음
    shape = [c for c in (_coord(s) for s in sections if s.get("type") == "point") if c]
    # 타고/내리는 역(전철 구간의 양 끝 지점) — 지도에 마커로 표시
    stations: list[dict] = []
    seen_st = set()
    for i, s in enumerate(sections):
        if s.get("type") != "move" or s.get("move") == "walk":
            continue
        for j in (i - 1, i + 1):
            pt = sections[j] if 0 <= j < len(sections) and sections[j].get("type") == "point" else None
            if not pt:
                continue
            c = _coord(pt)
            nm = _clean_pt(pt.get("name", ""))
            if c and nm and nm not in seen_st:
                seen_st.add(nm)
                stations.append({"name": nm, "lat": c[0], "lng": c[1], "board": j == i - 1})
    steps = []
    # 실제 이동은 '도보 → 전철 → 도보' 처럼 구성됨. 도보 구간도 모두 포함한다.
    # 역/지점 이름은 인접한 point 섹션에서 가져옴.
    for i, s in enumerate(sections):
        if s.get("type") != "move":
            continue
        prev_pt = sections[i - 1] if i > 0 and sections[i - 1].get("type") == "point" else {}
        next_pt = sections[i + 1] if i + 1 < len(sections) and sections[i + 1].get("type") == "point" else {}
        is_walk = s.get("move") == "walk"
        smin = s.get("time")
        steps.append({
            "mode": "walk" if is_walk else "transit",
            # 전철인데 노선명 매핑이 없으면 빈 문자열 대신 '전철'
            "line": "" if is_walk else (_line_label(s.get("line_name") or "") or "전철"),
            "from_time": _hhmm(s.get("from_time", "")),
            "to_time": _hhmm(s.get("to_time", "")),
            "from_name": _clean_pt(prev_pt.get("name", "")),
            "to_name": _clean_pt(next_pt.get("name", "")),
            "duration_text": f"{smin}분" if smin else None,
        })
    # 출발/도착은 전체 여정 기준(맨 앞 도보 시작 ~ 맨 뒤 도보 끝)
    depart = _hhmm(mv.get("from_time", "")) or (steps[0]["from_time"] if steps else "")
    arrive = _hhmm(mv.get("to_time", "")) or (steps[-1]["to_time"] if steps else "")
    return {
        "duration_text": f"{minutes}분" if minutes else None,
        "fare_text": f"{int(fare):,}엔" if fare else None,
        "transfers": mv.get("transit_count", 0),
        "depart": depart,
        "arrive": arrive,
        "steps": steps,
        "shape": shape,
        "stations": stations,
    }


async def transit_route(origin: str, destination: str, depart: str | None = None) -> dict | None:
    """일본 대중교통 — depart='HH:MM' 기준 이후 출발편 여러 개. 키 없거나 실패 시 None."""
    key = settings.navitime_api_key
    if not key:
        return None
    params = {
        "start": origin, "goal": destination, "start_time": _start_time(depart),
        "datum": "wgs84", "coord_unit": "degree", "term": "1440", "limit": "5",
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
        "transit_lines": [s["line"] for s in best["steps"] if s["mode"] == "transit"],
        "options": options,
        "polyline": best.get("shape", []),
        "stations": best.get("stations", []),
    }

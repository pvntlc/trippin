"""Claude 기반 리뷰 요약 + 영수증 파싱. 저렴·빠른 Haiku 4.5 사용."""
import json

import anthropic

from app.core.config import settings

_EXPENSE_CATS = {"식비", "교통", "숙박", "관광", "쇼핑", "기타"}

CLAUDE_HAIKU = "claude-haiku-4-5-20251001"

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic | None:
    global _client
    if not settings.app_anthropic_api_key:
        return None
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.app_anthropic_api_key)
    return _client


_FOOD_TYPES = {"restaurant", "food", "cafe", "bakery", "bar", "meal_takeaway", "meal_delivery"}


async def summarize_reviews(place_name: str, reviews: list[str], types: list[str] | None = None) -> str:
    """구글 리뷰들을 한국어로 요약. 음식점이면 대표 메뉴·가격대도 정리. 키/리뷰 없으면 빈 문자열."""
    client = _get_client()
    if client is None or not reviews:
        return ""

    is_food = bool(set(types or []) & _FOOD_TYPES)
    joined = "\n---\n".join(r[:600] for r in reviews[:5])
    if is_food:
        prompt = (
            f"다음은 음식점 '{place_name}'에 대한 구글 지도 방문자 리뷰들입니다.\n\n"
            f"{joined}\n\n"
            "여행자가 참고하도록 한국어로 정리하세요. 정확히 아래 형식으로만 출력:\n"
            "한줄평: (분위기·맛·서비스 한두 문장, 담백하게)\n"
            "🍽️ 대표 메뉴: (리뷰에 자주 언급된 메뉴 2~4개, 가능하면 가격을 괄호로. 예: 라멘(¥1,000))\n"
            "💡 팁: (대기·예약·결제 등 주의점 한 줄, 없으면 생략)\n"
            "리뷰에 없는 정보는 지어내지 말고 생략. 외국어 리뷰도 한국어로."
        )
    else:
        prompt = (
            f"다음은 '{place_name}'에 대한 구글 지도 방문자 리뷰들입니다.\n\n"
            f"{joined}\n\n"
            "이 리뷰들을 종합해 여행자가 참고할 만한 한국어 요약을 2~3문장으로 작성하세요. "
            "장점과 주의할 점이 있으면 균형 있게 담되, 과장 없이 담백하게. "
            "리뷰가 외국어여도 한국어로 요약하세요. 다른 말 없이 요약문만 출력."
        )
    try:
        msg = await client.messages.create(
            model=CLAUDE_HAIKU,
            max_tokens=450,
            messages=[{"role": "user", "content": prompt}],
        )
        parts = [b.text for b in msg.content if getattr(b, "type", "") == "text"]
        return "".join(parts).strip()
    except Exception:
        # 요약 실패는 치명적이지 않음 — 빈 요약으로 graceful 처리
        return ""


async def parse_receipt(image_b64: str, media_type: str, default_currency: str = "USD") -> dict:
    """영수증 이미지에서 지출 정보(title/amount/currency/category) 추출. 실패 시 빈 dict."""
    client = _get_client()
    if client is None or not image_b64:
        return {}
    prompt = (
        "이 영수증 사진에서 지출 정보를 추출해 JSON으로만 출력하세요.\n"
        '형식: {"title": "가게 또는 항목명(한국어)", "amount": 총결제금액_숫자, '
        '"currency": "통화 ISO 코드", "category": "식비|교통|숙박|관광|쇼핑|기타 중 하나"}\n'
        "규칙:\n"
        "- amount 는 최종 합계(total, 세금 포함). 통화기호·콤마 없이 숫자만.\n"
        f"- 통화를 못 읽으면 {default_currency}. JPY/USD/KRW/EUR 등 ISO 코드.\n"
        "- category 는 가게 성격으로 추정(식당·카페=식비, 택시·기차=교통, 호텔=숙박 등).\n"
        "- 못 읽는 값은 비우거나 0. 반드시 JSON만, 다른 말 금지."
    )
    try:
        msg = await client.messages.create(
            model=CLAUDE_HAIKU,
            max_tokens=300,
            messages=[{"role": "user", "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ]}],
        )
        text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
        i, j = text.find("{"), text.rfind("}")
        if i < 0 or j < 0:
            return {}
        data = json.loads(text[i:j + 1])
        raw_amt = data.get("amount")
        if isinstance(raw_amt, str):
            raw_amt = raw_amt.replace(",", "").replace(" ", "").replace("¥", "").replace("$", "").replace("₩", "")
        try:
            amount = float(raw_amt or 0)
        except (TypeError, ValueError):
            amount = 0.0
        cat = str(data.get("category") or "").strip()
        return {
            "title": str(data.get("title") or "").strip()[:200],
            "amount": amount,
            "currency": str(data.get("currency") or default_currency).strip()[:8].upper(),
            "category": cat if cat in _EXPENSE_CATS else "기타",
        }
    except Exception:
        return {}

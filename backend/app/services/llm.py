"""Claude 기반 리뷰 요약. 저렴·빠른 Haiku 4.5 사용."""
import anthropic

from app.core.config import settings

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

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


async def summarize_reviews(place_name: str, reviews: list[str]) -> str:
    """구글 리뷰들을 한국어 2~3문장으로 요약. 키 없거나 리뷰 없으면 빈 문자열."""
    client = _get_client()
    if client is None or not reviews:
        return ""

    joined = "\n---\n".join(r[:600] for r in reviews[:5])
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
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        parts = [b.text for b in msg.content if getattr(b, "type", "") == "text"]
        return "".join(parts).strip()
    except Exception:
        # 요약 실패는 치명적이지 않음 — 빈 요약으로 graceful 처리
        return ""

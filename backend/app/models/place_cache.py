from datetime import datetime, timezone

from sqlalchemy import String, DateTime, Float, Integer, Text  # noqa: F401
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PlaceReviewCache(Base):
    """장소별 리뷰 AI 요약 캐시. google_place_id 단위로 1회만 생성 후 재사용."""
    __tablename__ = "place_review_cache"

    id: Mapped[int] = mapped_column(primary_key=True)
    google_place_id: Mapped[str] = mapped_column(String(300), unique=True, index=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    user_ratings_total: Mapped[int] = mapped_column(Integer, default=0)
    review_summary: Mapped[str] = mapped_column(Text, default="")
    review_count_used: Mapped[int] = mapped_column(Integer, default=0)
    # 사진 photo_reference 들을 JSON 배열 문자열로 저장
    photo_refs: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

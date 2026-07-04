from datetime import datetime, timezone

from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    # 소셜 로그인 사용자는 비밀번호가 없다(빈 문자열). 이메일 로그인 경로를 타지 않음.
    hashed_password: Mapped[str] = mapped_column(String(255), default="")
    name: Mapped[str] = mapped_column(String(100))
    # 인증 제공자: 'local'(기존 이메일) | 'kakao'
    provider: Mapped[str] = mapped_column(String(16), default="local", index=True)
    # 제공자별 고유 사용자 ID (kakao 회원번호 등)
    provider_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

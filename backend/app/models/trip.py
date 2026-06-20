from datetime import datetime, timezone, date

from sqlalchemy import String, DateTime, Date, ForeignKey, Float, Integer, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Trip(Base):
    """여행 한 건. 날짜 범위로 Day 들이 자동 구성됨."""
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    destination: Mapped[str] = mapped_column(String(200), default="")
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    # 통화 코드 (예산 표시 기본값). 예: "USD", "JPY", "KRW"
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    members: Mapped[list["TripMember"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )
    places: Mapped[list["Place"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )
    expenses: Mapped[list["Expense"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )
    checklist: Mapped[list["ChecklistItem"]] = relationship(
        back_populates="trip", cascade="all, delete-orphan"
    )


class TripMember(Base):
    """여행 공유 멤버. role: owner | editor | viewer"""
    __tablename__ = "trip_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(16), default="editor")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    trip: Mapped["Trip"] = relationship(back_populates="members")


class Place(Base):
    """일정에 배치된 장소. day_index 가 null 이면 '보관함(미배치)'."""
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), index=True)
    # 0-based. null = 아직 특정 날짜에 배치 안 됨(위시리스트)
    day_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)  # 같은 날 내 정렬

    name: Mapped[str] = mapped_column(String(300))
    google_place_id: Mapped[str | None] = mapped_column(String(300), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str] = mapped_column(String(500), default="")
    category: Mapped[str] = mapped_column(String(50), default="")  # 명소/식당/숙소 등
    planned_time: Mapped[str] = mapped_column(String(20), default="")  # "09:30" 같은 표시용
    note: Mapped[str] = mapped_column(Text, default="")

    trip: Mapped["Trip"] = relationship(back_populates="places")


class Expense(Base):
    """예산/지출 항목."""
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), index=True)
    day_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(8), default="USD")
    category: Mapped[str] = mapped_column(String(50), default="")  # 식비/교통/숙박 등
    paid_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    trip: Mapped["Trip"] = relationship(back_populates="expenses")


class ChecklistItem(Base):
    """준비물/할 일 체크리스트."""
    __tablename__ = "checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), index=True)
    text: Mapped[str] = mapped_column(String(300))
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    trip: Mapped["Trip"] = relationship(back_populates="checklist")

import json
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_trip_for_member, require_trip_editor
from app.models.user import User
from app.models.trip import Trip, TripMember, Place
from app.schemas.trip import TripCreate, TripUpdate, TripOut, MemberOut, InviteRequest
from app.schemas.auth import UserOut

router = APIRouter()


async def _my_role(db: AsyncSession, trip_id: int, user_id: int) -> str | None:
    m = await db.scalar(
        select(TripMember).where(
            TripMember.trip_id == trip_id, TripMember.user_id == user_id
        )
    )
    return m.role if m else None


@router.get("/invites")
async def my_invites(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """내가 받은 수락 대기 초대 목록."""
    rows = await db.execute(
        select(Trip, TripMember.id, TripMember.role)
        .join(TripMember, TripMember.trip_id == Trip.id)
        .where(TripMember.user_id == user.id, TripMember.status == "pending")
        .order_by(Trip.start_date.desc())
    )
    out = []
    for trip, member_id, role in rows.all():
        owner = await db.get(User, trip.owner_id)
        out.append({
            "member_id": member_id, "trip_id": trip.id, "title": trip.title,
            "destination": trip.destination,
            "start_date": trip.start_date.isoformat(), "end_date": trip.end_date.isoformat(),
            "role": role, "invited_by": owner.name if owner else "",
        })
    return out


@router.post("/invites/{member_id}/accept")
async def accept_invite(member_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(TripMember, member_id)
    if m is None or m.user_id != user.id or m.status != "pending":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "초대를 찾을 수 없음")
    m.status = "accepted"
    await db.commit()
    return {"ok": True, "trip_id": m.trip_id}


@router.post("/invites/{member_id}/decline")
async def decline_invite(member_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    m = await db.get(TripMember, member_id)
    if m is None or m.user_id != user.id or m.status != "pending":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "초대를 찾을 수 없음")
    await db.delete(m)
    await db.commit()
    return {"ok": True}


@router.get("", response_model=list[TripOut])
async def list_trips(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    rows = await db.execute(
        select(Trip, TripMember.role)
        .join(TripMember, TripMember.trip_id == Trip.id)
        .where(TripMember.user_id == user.id, TripMember.status == "accepted")
        .order_by(Trip.start_date.desc())
    )
    out = []
    for trip, role in rows.all():
        item = TripOut.model_validate(trip)
        item.my_role = role
        out.append(item)
    return out


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
async def create_trip(body: TripCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if body.end_date < body.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "종료일이 시작일보다 빠를 수 없음")
    data = body.model_dump()
    cities = [c.strip() for c in (data.pop("cities", None) or []) if c and c.strip()]
    # 대표 도시(destination)가 비어있으면 첫 도시로 자동 채움
    if cities and not data.get("destination"):
        data["destination"] = cities[0]
    trip = Trip(cities=json.dumps(cities, ensure_ascii=False), owner_id=user.id, **data)
    db.add(trip)
    await db.flush()
    db.add(TripMember(trip_id=trip.id, user_id=user.id, role="owner"))
    await db.commit()
    await db.refresh(trip)
    out = TripOut.model_validate(trip)
    out.my_role = "owner"
    return out


@router.get("/{trip_id}", response_model=TripOut)
async def get_trip(trip: Trip = Depends(get_trip_for_member), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    out = TripOut.model_validate(trip)
    out.my_role = await _my_role(db, trip.id, user.id)
    return out


@router.patch("/{trip_id}", response_model=TripOut)
async def update_trip(body: TripUpdate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "cities" in data:
        cities = [c.strip() for c in (data.pop("cities") or []) if c and c.strip()]
        trip.cities = json.dumps(cities, ensure_ascii=False)
        # 대표 도시 동기화(명시적 destination 이 함께 오지 않은 경우)
        if cities and "destination" not in data:
            trip.destination = cities[0]
    for field, value in data.items():
        setattr(trip, field, value)
    await db.commit()
    await db.refresh(trip)
    return TripOut.model_validate(trip)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_trip(trip: Trip = Depends(get_trip_for_member), user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if trip.owner_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "여행 소유자만 삭제할 수 있음")
    await db.delete(trip)
    await db.commit()


# ── 멤버/공유 ──────────────────────────────────────────────
@router.get("/{trip_id}/weather")
async def trip_weather_endpoint(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    """여행 날짜별 날씨. 날짜별 대표 좌표(그 날 첫 장소)로 조회 → 도쿄/후지산 등 위치별로 다르게."""
    from app.services.weather import trip_weather

    rows = await db.execute(select(Place).where(Place.trip_id == trip.id))
    places = rows.scalars().all()
    # 날짜별 대표 좌표 (그 날 가장 이른 장소), 없으면 전체 첫 좌표로 폴백
    by_day: dict[int, tuple[float, float]] = {}
    fallback = None
    for p in sorted(places, key=lambda x: (x.planned_time or "99", x.order_index)):
        if p.lat is None or p.lng is None:
            continue
        if fallback is None:
            fallback = (p.lat, p.lng)
        if p.day_index is not None and p.day_index not in by_day:
            by_day[p.day_index] = (p.lat, p.lng)
    if fallback is None:
        return {"days": [], "note": "좌표가 있는 장소가 없어 날씨를 표시할 수 없어요."}

    ndays = (trip.end_date - trip.start_date).days + 1
    points = []
    for i in range(max(1, ndays)):
        d = (trip.start_date + timedelta(days=i)).isoformat()
        lat, lng = by_day.get(i, fallback)
        points.append((d, lat, lng))
    today = datetime.now(timezone.utc).date()
    return {"days": await trip_weather(points, today)}


@router.get("/{trip_id}/export/kml")
async def export_kml(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    """일정 장소들을 KML 로 내보내기 → 구글 My Maps '가져오기'로 지도에 표시.
    좌표 없는 직접입력 항목은 제외(지도에 못 찍음)."""
    from xml.sax.saxutils import escape

    rows = await db.execute(select(Place).where(Place.trip_id == trip.id))
    places = sorted(rows.scalars().all(), key=lambda p: ((p.day_index if p.day_index is not None else 99), p.planned_time or "99", p.order_index))
    marks = []
    for p in places:
        if p.lat is None or p.lng is None:
            continue
        day = "가고 싶은 곳" if p.day_index is None else f"Day {p.day_index + 1}"
        bits = [day]
        if p.planned_time:
            bits.append(p.planned_time)
        if p.category:
            bits.append(p.category)
        if p.note:
            bits.append(p.note)
        desc = " · ".join(bits)
        marks.append(
            "<Placemark>"
            f"<name>{escape(p.name or '')}</name>"
            f"<description>{escape(desc)}</description>"
            f"<Point><coordinates>{p.lng},{p.lat},0</coordinates></Point>"
            "</Placemark>"
        )
    kml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>'
        f"<name>{escape(trip.title or '여행')}</name>"
        + "".join(marks) +
        "</Document></kml>"
    )
    safe = "".join(ch for ch in (trip.title or "trip") if ch.isalnum() or ch in " _-")[:40].strip() or "trip"
    return {"filename": f"{safe}.kml", "content": kml, "count": len(marks)}


@router.get("/{trip_id}/members", response_model=list[MemberOut])
async def list_members(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    rows = await db.execute(
        select(User, TripMember.role, TripMember.status)
        .join(TripMember, TripMember.user_id == User.id)
        .where(TripMember.trip_id == trip.id)
    )
    return [MemberOut(user=UserOut.model_validate(u), role=role, status=st)
            for u, role, st in rows.all()]


@router.post("/{trip_id}/invite", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
async def invite_member(body: InviteRequest, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    if body.role not in ("editor", "viewer"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "role 은 editor 또는 viewer")
    invitee = await db.scalar(select(User).where(User.email == body.email))
    if invitee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "해당 이메일의 가입자가 없음")
    existing = await db.scalar(
        select(TripMember).where(
            TripMember.trip_id == trip.id, TripMember.user_id == invitee.id
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 멤버임")
    db.add(TripMember(trip_id=trip.id, user_id=invitee.id, role=body.role, status="pending"))
    await db.commit()
    return MemberOut(user=UserOut.model_validate(invitee), role=body.role, status="pending")

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_trip_for_member, require_trip_editor
from app.models.user import User
from app.models.trip import Trip, TripMember
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
    trip = Trip(owner_id=user.id, **body.model_dump())
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
    for field, value in body.model_dump(exclude_unset=True).items():
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

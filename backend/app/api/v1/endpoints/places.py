from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_trip_for_member, require_trip_editor
from app.models.trip import Trip, Place
from app.schemas.place import PlaceCreate, PlaceUpdate, PlaceOut

router = APIRouter()


@router.get("/{trip_id}/places", response_model=list[PlaceOut])
async def list_places(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Place)
        .where(Place.trip_id == trip.id)
        .order_by(Place.day_index, Place.order_index)
    )
    return list(rows.all())


@router.post("/{trip_id}/places", response_model=PlaceOut, status_code=status.HTTP_201_CREATED)
async def add_place(body: PlaceCreate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    place = Place(trip_id=trip.id, **body.model_dump())
    db.add(place)
    await db.commit()
    await db.refresh(place)
    return place


@router.patch("/{trip_id}/places/{place_id}", response_model=PlaceOut)
async def update_place(place_id: int, body: PlaceUpdate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    place = await db.get(Place, place_id)
    if place is None or place.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "장소를 찾을 수 없음")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(place, field, value)
    await db.commit()
    await db.refresh(place)
    return place


@router.delete("/{trip_id}/places/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_place(place_id: int, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    place = await db.get(Place, place_id)
    if place is None or place.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "장소를 찾을 수 없음")
    await db.delete(place)
    await db.commit()

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_trip_for_member, require_trip_editor
from app.models.trip import Trip, ChecklistItem
from app.schemas.checklist import ChecklistCreate, ChecklistUpdate, ChecklistOut

router = APIRouter()


@router.get("/{trip_id}/checklist", response_model=list[ChecklistOut])
async def list_checklist(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(ChecklistItem)
        .where(ChecklistItem.trip_id == trip.id)
        .order_by(ChecklistItem.order_index, ChecklistItem.id)
    )
    return list(rows.all())


@router.post("/{trip_id}/checklist", response_model=ChecklistOut, status_code=status.HTTP_201_CREATED)
async def add_item(body: ChecklistCreate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    item = ChecklistItem(trip_id=trip.id, text=body.text)
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{trip_id}/checklist/{item_id}", response_model=ChecklistOut)
async def update_item(item_id: int, body: ChecklistUpdate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    item = await db.get(ChecklistItem, item_id)
    if item is None or item.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "항목을 찾을 수 없음")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{trip_id}/checklist/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(item_id: int, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    item = await db.get(ChecklistItem, item_id)
    if item is None or item.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "항목을 찾을 수 없음")
    await db.delete(item)
    await db.commit()

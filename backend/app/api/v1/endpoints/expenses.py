from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_trip_for_member, require_trip_editor
from app.models.trip import Trip, Expense
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseOut

router = APIRouter()


@router.get("/{trip_id}/expenses", response_model=list[ExpenseOut])
async def list_expenses(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Expense).where(Expense.trip_id == trip.id).order_by(Expense.created_at)
    )
    return list(rows.all())


@router.get("/{trip_id}/expenses/summary")
async def expense_summary(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    """통화별·카테고리별 합계."""
    rows = await db.scalars(select(Expense).where(Expense.trip_id == trip.id))
    by_currency: dict[str, float] = {}
    by_category: dict[str, float] = {}
    for e in rows.all():
        by_currency[e.currency] = by_currency.get(e.currency, 0.0) + e.amount
        if e.category:
            by_category[e.category] = by_category.get(e.category, 0.0) + e.amount
    return {"by_currency": by_currency, "by_category": by_category}


@router.post("/{trip_id}/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def add_expense(body: ExpenseCreate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    expense = Expense(trip_id=trip.id, **body.model_dump())
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return expense


@router.patch("/{trip_id}/expenses/{expense_id}", response_model=ExpenseOut)
async def update_expense(expense_id: int, body: ExpenseUpdate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    expense = await db.get(Expense, expense_id)
    if expense is None or expense.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출 항목을 찾을 수 없음")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    await db.commit()
    await db.refresh(expense)
    return expense


@router.delete("/{trip_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_id: int, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    expense = await db.get(Expense, expense_id)
    if expense is None or expense.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출 항목을 찾을 수 없음")
    await db.delete(expense)
    await db.commit()

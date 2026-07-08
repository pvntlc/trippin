from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
import json

from app.core.deps import get_trip_for_member, require_trip_editor
from app.models.trip import Trip, Expense, TripMember
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseOut

router = APIRouter()


class ReceiptParseRequest(BaseModel):
    # data URL(data:image/...;base64,....) 또는 순수 base64
    image: str = Field(min_length=16)
    media_type: str = "image/jpeg"


@router.post("/{trip_id}/expenses/parse-receipt")
async def parse_receipt_endpoint(body: ReceiptParseRequest, trip: Trip = Depends(require_trip_editor)):
    """영수증 사진 → 지출 정보 자동 추출(title/amount/currency/category). 프론트 폼 프리필용."""
    from app.services.llm import parse_receipt

    img, mt = body.image, body.media_type
    if img.startswith("data:"):
        header, _, b64 = img.partition(",")
        img = b64
        if ":" in header and ";" in header:
            mt = header.split(";")[0].split(":", 1)[1] or mt
    data = await parse_receipt(img, mt, default_currency=trip.currency)
    if not data:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "영수증에서 정보를 읽지 못했어요. 직접 입력해 주세요.")
    return data


@router.get("/{trip_id}/expenses", response_model=list[ExpenseOut])
async def list_expenses(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(
        select(Expense).where(Expense.trip_id == trip.id).order_by(Expense.created_at)
    )
    return list(rows.all())


@router.get("/{trip_id}/expenses/summary")
async def expense_summary(trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    """통화별·카테고리별 합계."""
    rows = (await db.scalars(select(Expense).where(Expense.trip_id == trip.id))).all()
    by_currency: dict[str, float] = {}
    by_category: dict[str, float] = {}
    # 멤버별 정산: paid(낸 돈) - share(부담 몫) = net (+면 받을 돈, -면 낼 돈). 통화별.
    net: dict[str, dict[int, float]] = {}
    for e in rows:
        by_currency[e.currency] = by_currency.get(e.currency, 0.0) + e.amount
        if e.category:
            by_category[e.category] = by_category.get(e.category, 0.0) + e.amount
        try:
            split = json.loads(e.split_user_ids) if e.split_user_ids else []
        except Exception:
            split = []
        payer = e.paid_by
        participants = split or ([payer] if payer else [])
        if not payer or not participants:
            continue
        cur = net.setdefault(e.currency, {})
        share = e.amount / len(participants)
        cur[payer] = cur.get(payer, 0.0) + e.amount
        for uid in participants:
            cur[uid] = cur.get(uid, 0.0) - share

    # 멤버 이름 매핑
    member_rows = (await db.scalars(
        select(TripMember).where(TripMember.trip_id == trip.id)
    )).all()
    names: dict[int, str] = {}
    for m in member_rows:
        u = await db.get(User, m.user_id)
        if u:
            names[u.id] = u.name or u.email

    # 통화별 그리디 정산 (누가 누구에게 얼마)
    settlements: list[dict] = []
    balances_out: dict[str, list[dict]] = {}
    for cur_code, bal in net.items():
        balances_out[cur_code] = [
            {"user_id": uid, "name": names.get(uid, f"#{uid}"), "net": round(v, 2)}
            for uid, v in sorted(bal.items(), key=lambda x: x[1])
        ]
        debtors = sorted([[uid, v] for uid, v in bal.items() if v < -0.01], key=lambda x: x[1])
        creditors = sorted([[uid, v] for uid, v in bal.items() if v > 0.01], key=lambda x: -x[1])
        di, ci = 0, 0
        while di < len(debtors) and ci < len(creditors):
            pay = min(-debtors[di][1], creditors[ci][1])
            settlements.append({
                "from_id": debtors[di][0], "from": names.get(debtors[di][0], "?"),
                "to_id": creditors[ci][0], "to": names.get(creditors[ci][0], "?"),
                "amount": round(pay, 2), "currency": cur_code,
            })
            debtors[di][1] += pay
            creditors[ci][1] -= pay
            if debtors[di][1] > -0.01:
                di += 1
            if creditors[ci][1] < 0.01:
                ci += 1
    return {"by_currency": by_currency, "by_category": by_category,
            "balances": balances_out, "settlements": settlements}


@router.post("/{trip_id}/expenses", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
async def add_expense(body: ExpenseCreate, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    data = body.model_dump()
    data["split_user_ids"] = json.dumps(data.get("split_user_ids") or [])
    expense = Expense(trip_id=trip.id, **data)
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
        if field == "split_user_ids":
            value = json.dumps(value or [])
        setattr(expense, field, value)
    await db.commit()
    await db.refresh(expense)
    return expense


@router.get("/{trip_id}/expenses/{expense_id}/receipt")
async def get_receipt(expense_id: int, trip: Trip = Depends(get_trip_for_member), db: AsyncSession = Depends(get_db)):
    """영수증 사진(data URI) 조회 — 목록엔 없고 필요할 때만 불러옴."""
    expense = await db.get(Expense, expense_id)
    if expense is None or expense.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출 항목을 찾을 수 없음")
    return {"image": expense.receipt_image or ""}


@router.delete("/{trip_id}/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_id: int, trip: Trip = Depends(require_trip_editor), db: AsyncSession = Depends(get_db)):
    expense = await db.get(Expense, expense_id)
    if expense is None or expense.trip_id != trip.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지출 항목을 찾을 수 없음")
    await db.delete(expense)
    await db.commit()

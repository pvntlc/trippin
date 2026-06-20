from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    amount: float = 0.0
    currency: str = "USD"
    category: str = ""
    day_index: int | None = None
    paid_by: int | None = None


class ExpenseUpdate(BaseModel):
    title: str | None = None
    amount: float | None = None
    currency: str | None = None
    category: str | None = None
    day_index: int | None = None
    paid_by: int | None = None


class ExpenseOut(BaseModel):
    id: int
    trip_id: int
    day_index: int | None
    title: str
    amount: float
    currency: str
    category: str
    paid_by: int | None

    class Config:
        from_attributes = True

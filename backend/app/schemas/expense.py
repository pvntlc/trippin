import json

from pydantic import BaseModel, Field, field_validator


class ExpenseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    amount: float = 0.0
    currency: str = "USD"
    category: str = ""
    day_index: int | None = None
    paid_by: int | None = None
    # 분담 참여자 user_id 목록. 빈 리스트 = 낸 사람 혼자 부담.
    split_user_ids: list[int] = []
    # 영수증 사진 (data URI base64). 선택.
    receipt_image: str | None = None


class ExpenseUpdate(BaseModel):
    title: str | None = None
    amount: float | None = None
    currency: str | None = None
    category: str | None = None
    day_index: int | None = None
    paid_by: int | None = None
    split_user_ids: list[int] | None = None
    receipt_image: str | None = None


class ExpenseOut(BaseModel):
    id: int
    trip_id: int
    day_index: int | None
    title: str
    amount: float
    currency: str
    category: str
    paid_by: int | None
    split_user_ids: list[int] = []
    has_receipt: bool = False

    @field_validator("split_user_ids", mode="before")
    @classmethod
    def _parse_split(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v) if v else []
            except Exception:
                return []
        return v or []

    class Config:
        from_attributes = True

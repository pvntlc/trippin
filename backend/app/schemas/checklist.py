from pydantic import BaseModel, Field


class ChecklistCreate(BaseModel):
    text: str = Field(min_length=1, max_length=300)


class ChecklistUpdate(BaseModel):
    text: str | None = None
    is_done: bool | None = None
    order_index: int | None = None


class ChecklistOut(BaseModel):
    id: int
    trip_id: int
    text: str
    is_done: bool
    order_index: int

    class Config:
        from_attributes = True

from datetime import date
from pydantic import BaseModel, Field

from app.schemas.auth import UserOut


class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    destination: str = ""
    start_date: date
    end_date: date
    currency: str = "USD"


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    destination: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    currency: str | None = None


class MemberOut(BaseModel):
    user: UserOut
    role: str


class TripOut(BaseModel):
    id: int
    owner_id: int
    title: str
    destination: str
    start_date: date
    end_date: date
    currency: str
    # 내 역할 (owner/editor/viewer)
    my_role: str | None = None

    class Config:
        from_attributes = True


class InviteRequest(BaseModel):
    email: str
    role: str = "editor"  # editor | viewer

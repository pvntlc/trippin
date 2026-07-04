import json
from datetime import date
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.auth import UserOut


class TripCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    destination: str = ""
    cities: list[str] = []
    start_date: date
    end_date: date
    currency: str = "USD"


class TripUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    destination: str | None = None
    cities: list[str] | None = None
    start_date: date | None = None
    end_date: date | None = None
    currency: str | None = None


class MemberOut(BaseModel):
    user: UserOut
    role: str
    status: str = "accepted"


class TripOut(BaseModel):
    id: int
    owner_id: int
    title: str
    destination: str
    cities: list[str] = []
    start_date: date
    end_date: date
    currency: str
    # 내 역할 (owner/editor/viewer)
    my_role: str | None = None

    class Config:
        from_attributes = True

    @field_validator("cities", mode="before")
    @classmethod
    def _parse_cities(cls, v):
        # DB에는 JSON 문자열로 저장됨 → 리스트로 파싱
        if isinstance(v, str):
            if not v.strip():
                return []
            try:
                parsed = json.loads(v)
                return parsed if isinstance(parsed, list) else [str(parsed)]
            except Exception:
                return [v]
        return v or []

    @model_validator(mode="after")
    def _fallback_to_destination(self):
        # 도시 목록이 비면 기존 destination 1개로 간주(하위호환)
        if not self.cities and self.destination:
            self.cities = [self.destination]
        return self


class InviteRequest(BaseModel):
    email: str
    role: str = "editor"  # editor | viewer

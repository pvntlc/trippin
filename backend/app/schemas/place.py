from pydantic import BaseModel, Field


class PlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    day_index: int | None = None
    google_place_id: str | None = None
    lat: float | None = None
    lng: float | None = None
    address: str = ""
    category: str = ""
    planned_time: str = ""
    note: str = ""


class PlaceUpdate(BaseModel):
    name: str | None = None
    day_index: int | None = None
    order_index: int | None = None
    lat: float | None = None
    lng: float | None = None
    address: str | None = None
    category: str | None = None
    planned_time: str | None = None
    note: str | None = None


class PlaceOut(BaseModel):
    id: int
    trip_id: int
    day_index: int | None
    order_index: int
    name: str
    google_place_id: str | None
    lat: float | None
    lng: float | None
    address: str
    category: str
    planned_time: str
    note: str

    class Config:
        from_attributes = True

from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.trips import router as trips_router
from app.api.v1.endpoints.places import router as places_router
from app.api.v1.endpoints.expenses import router as expenses_router
from app.api.v1.endpoints.checklist import router as checklist_router
from app.api.v1.endpoints.maps import router as maps_router

router = APIRouter()
router.include_router(auth_router, prefix="/auth", tags=["auth"])
router.include_router(maps_router, prefix="/maps", tags=["maps"])
# 여행 하위 리소스는 모두 /trips 프리픽스를 공유 (경로에 {trip_id} 포함)
router.include_router(trips_router, prefix="/trips", tags=["trips"])
router.include_router(places_router, prefix="/trips", tags=["places"])
router.include_router(expenses_router, prefix="/trips", tags=["expenses"])
router.include_router(checklist_router, prefix="/trips", tags=["checklist"])

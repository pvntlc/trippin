from fastapi import APIRouter

router = APIRouter()


@router.get("/krw")
async def krw_rates_endpoint():
    """통화별 원화 환산율(1단위당 KRW). 프론트 환산 표시용."""
    from app.services.fx import krw_rates
    return {"krw_per": await krw_rates()}

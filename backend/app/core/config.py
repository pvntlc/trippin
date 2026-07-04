from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8002

    # Auth (JWT)
    # 기본값 빈 문자열 — 운영에서 JWT_SECRET 미설정 시 시작 자체를 막는다(fail-closed).
    # 하드코딩 기본 시크릿이 있으면 그 값으로 누구나 토큰 위조 가능(인증 우회).
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7일 (기존 30일 → 탈취 시 노출창 축소)

    # Google Maps Platform (서버 전용 키)
    google_maps_api_key: str = ""

    # Anthropic (리뷰 요약). ANTHROPIC_API_KEY 는 시스템 예약 가능 → APP_ 접두사 사용.
    app_anthropic_api_key: str = ""

    # NAVITIME (일본 대중교통 경로, RapidAPI). 구글이 일본 transit 미지원이라 대체.
    navitime_api_key: str = ""

    # CORS (콤마 구분 문자열)
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

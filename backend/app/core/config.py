from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8002

    # Auth (JWT)
    jwt_secret: str = "dev_only_insecure_secret_change_me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 43200  # 30일

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

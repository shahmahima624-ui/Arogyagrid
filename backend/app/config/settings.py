from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application settings."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AarogyaGrid API"
    database_url: str = "postgresql+psycopg://aarogyagrid:change-me@localhost:5432/aarogyagrid"
    cors_origins: str = "http://localhost:3000"
    firebase_project_id: str | None = None
    mock_auth: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application settings supporting standard PostgreSQL and Supabase."""

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")


    app_name: str = "AarogyaGrid API"
    database_url: str = Field(
        default="postgresql://postgres:postgres@localhost:5432/aarogyagrid",
        validation_alias="DATABASE_URL",
    )
    supabase_db_url: str | None = Field(default=None, validation_alias="SUPABASE_DATABASE_URL")
    supabase_database_url: str | None = Field(
        default=None,
        validation_alias="SUPABASE_DATABASE_URL",
    )
    secret_key: str = Field(
        default="aarogyagrid-super-secret-key-change-in-production",
        validation_alias="SECRET_KEY",
    )
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias="GEMINI_API_KEY",
    )
    cors_origins: str = "http://localhost:3000"
    firebase_project_id: str | None = None
    mock_auth: bool = True

    @property
    def effective_database_url(self) -> str:
        """Returns a normalized SQLAlchemy-compatible database connection string for Supabase / PostgreSQL."""
        url = self.supabase_db_url or self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


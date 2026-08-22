from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed application settings supporting standard PostgreSQL and Supabase."""

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    app_name: str = "AarogyaGrid API"
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    database_url: str = Field(
        default="sqlite:///aarogyagrid.db",
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
    supabase_jwt_secret: str | None = Field(default=None, validation_alias="SUPABASE_JWT_SECRET")
    # Supabase JWT claim validation
    # Audience: Supabase sets this to 'authenticated' for user tokens.
    # Set SUPABASE_JWT_AUDIENCE=authenticated in production.
    supabase_jwt_audience: str | None = Field(default=None, validation_alias="SUPABASE_JWT_AUDIENCE")
    # Issuer: Set to your Supabase project URL e.g. https://<ref>.supabase.co/auth/v1
    supabase_jwt_issuer: str | None = Field(default=None, validation_alias="SUPABASE_JWT_ISSUER")
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias="GEMINI_API_KEY",
    )
    cors_origins: str = "http://localhost:3000"
    firebase_project_id: str | None = None
    mock_auth: bool = Field(default=True, validation_alias="MOCK_AUTH")
    allow_backup_restore: bool = Field(default=False, validation_alias="ALLOW_BACKUP_RESTORE")

    @model_validator(mode="after")
    def validate_production_security(self):
        if self.environment.lower() == "production":
            if self.mock_auth:
                raise ValueError("Security Violation: MOCK_AUTH cannot be enabled when ENVIRONMENT=production")
            if self.secret_key == "aarogyagrid-super-secret-key-change-in-production":
                raise ValueError("Security Violation: SECRET_KEY must be changed in production")
            if not self.supabase_jwt_secret:
                raise ValueError(
                    "Security Violation: SUPABASE_JWT_SECRET must be set when ENVIRONMENT=production. "
                    "Generic SECRET_KEY must not be used as a JWT auth fallback in production."
                )
        return self

    @property
    def effective_database_url(self) -> str:
        """Returns a normalized SQLAlchemy-compatible database connection string for Supabase / PostgreSQL / SQLite."""
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

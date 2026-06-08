"""Application settings (pydantic-settings).

S1: only DATABASE_URL is actually consumed (by Alembic + SQLAlchemy engine).
Redis/RabbitMQ/MinIO settings are declared so the env is *ready*, but S1 does
not wire them (per build-plan: S1 connects PostgreSQL only).
"""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_name: str = "Pet Hotel & Grooming System API"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    # Data layer (S1: PostgreSQL only). Host port 5433 → container 5432.
    database_url: str = "postgresql+psycopg://pethotel:pethotel@localhost:5433/pethotel"

    # Auth — real JWT issuance/verification + RBAC land in S2a.
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60
    password_reset_expires_minutes: int = 30

    # File uploads (S2a: vaccine proof). Stored on the local filesystem for now;
    # object storage (MinIO/S3) is wired in S4. Path is relative to backend/.
    upload_dir: str = "uploads"
    max_upload_bytes: int = 10 * 1024 * 1024  # 10 MiB

    # Declared for env-readiness; NOT wired in S1/S2a.
    redis_url: str | None = None
    rabbitmq_url: str | None = None
    minio_endpoint: str | None = None
    minio_access_key: str | None = None
    minio_secret_key: str | None = None


settings = Settings()

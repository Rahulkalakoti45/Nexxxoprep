from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Intelligent Candidate Discovery API"
    app_env: str = "dev"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "candidate_discovery"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"
    sqlalchemy_echo: bool = False

    jwt_secret_key: str = "change_me"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_min: int = 60

    interview_link_ttl_hours: int = 5

    smtp_host: str = "localhost"
    smtp_port: int = 1025
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_sender_email: str = "no-reply@example.com"
    smtp_use_tls: bool = False

    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"

    yash_api_key: str = ""

    app_base_url: str = "http://localhost:8000"
    company_name: str = "Intelligent Candidate Discovery"
    recruiter_contact_email: str = "recruiter@example.com"
    demo_resume_path: str = "app/assets/demo_resume.pdf"
    jd_pdf_path: str = "app/assets/job_description.pdf"

    # Automation Service (self-running candidate intake watcher)
    automation_enabled: bool = True
    automation_incoming_dir: str = "sample_data/incoming"
    automation_processed_dir: str = "sample_data/processed"
    automation_failed_dir: str = "sample_data/failed"
    automation_poll_interval_seconds: float = 2.0
    automation_stability_checks: int = 2

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

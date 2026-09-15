from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "The Lenny Growth Assistant"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Environment & Logging
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "*"
    ]

    # Database
    POSTGRES_USER: str = "lenny_user"
    POSTGRES_PASSWORD: str = "lenny_password"
    POSTGRES_DB: str = "lenny_growth_db"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "sqlite+aiosqlite:///./lenny_growth.db"  # Fallback to local SQLite if Postgres unavailable

    # LLM Providers
    DEFAULT_LLM_PROVIDER: str = "ollama"  # ollama | anthropic | openai
    DEFAULT_LLM_MODEL: str = "llama3.2"
    OLLAMA_BASE_URL: str = "http://host.docker.internal:11434"
    PI_AGENT_URL: str = "http://pi-agent:8090"
    OLLAMA_REQUEST_TIMEOUT_SECONDS: float = 180.0
    OLLAMA_MAX_OUTPUT_TOKENS: int = 1200
    CLOUD_LLM_PROVIDER: str = "anthropic"
    CLOUD_LLM_MODEL: str = "claude-3-5-sonnet-20241022"

    # API Keys
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # RAG Settings
    TOP_K_RETRIEVAL: int = 5
    SIMILARITY_THRESHOLD: float = 0.2

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def default_llm_provider(self) -> str:
        provider = (self.DEFAULT_LLM_PROVIDER or "ollama").strip().lower()
        return provider if provider in {"ollama", "anthropic", "openai"} else "ollama"

    @property
    def default_llm_model(self) -> str:
        model = (self.DEFAULT_LLM_MODEL or "llama3.2").strip().lower()
        return model if model else "llama3.2"

    @property
    def ollama_base_url(self) -> str:
        return self.OLLAMA_BASE_URL or "http://host.docker.internal:11434"

    @property
    def pi_agent_url(self) -> str:
        return (self.PI_AGENT_URL or "http://pi-agent:8090").rstrip("/")

    @property
    def ollama_request_timeout_seconds(self) -> float:
        try:
            value = float(self.OLLAMA_REQUEST_TIMEOUT_SECONDS)
            return value if value > 0 else 180.0
        except (TypeError, ValueError):
            return 180.0

    @property
    def ollama_max_output_tokens(self) -> int:
        try:
            value = int(self.OLLAMA_MAX_OUTPUT_TOKENS)
            return value if value > 0 else 1200
        except (TypeError, ValueError):
            return 1200

    @property
    def cloud_llm_model(self) -> str:
        return self.CLOUD_LLM_MODEL or self.DEFAULT_LLM_MODEL or "claude-3-5-sonnet-20241022"

settings = Settings()

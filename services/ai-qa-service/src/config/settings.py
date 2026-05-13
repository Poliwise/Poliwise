from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    host: str = "0.0.0.0"
    port: int = 8086
    log_level: str = "info"
    internal_api_key: str = "secret-key-for-internal-services"

    database_url: str = "postgresql+asyncpg://poliwise:poliwise_secure_password@postgres:5432/poliwise"
    database_schema: str = "conversation"

    rabbitmq_url: str = "amqp://poliwise:poliwise_secure_password@rabbitmq:5672"
    rabbitmq_exchange: str = "poliwise.events"
    redis_url: str = "redis://localhost:6379/0"

    embedding_url: str = "http://bge-m3-embedding:80"
    reranker_url: Optional[str] = "http://reranker:8002"

    llm_provider: str = "groq"
    llm_api_key: Optional[str] = None
    local_model_name: str = "qwen3-8b"
    groq_model_name: str = "llama-3.3-70b-versatile"
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_max_tokens: int = 1024
    llm_temperature: float = 0.3

    gateway_api_key: Optional[str] = None
    gateway_model: str = "gemini-1.5-flash"
    gateway_enabled: bool = True

    retrieval_limit: int = 10
    rerank_limit: int = 5
    similarity_threshold: float = 0.3
    use_reranker: bool = False

    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60

    max_history_messages: int = 20
    conversation_title_max_length: int = 255


settings = Settings()
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog
import uvicorn

from .config.settings import settings
from .config.rabbitmq import publisher
from .events.consumer import consumer
from .db.session import close_db_pool
from .config.redis import redis_client
from .api.routes import health, chat, conversations, messages, unanswered, models

structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ]
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle."""
    logger.info("starting_ai_qa_service", port=settings.port)
    try:
        await publisher.connect()
        await consumer.connect()
    except Exception as e:
        logger.warning("service_connections_failed", error=str(e))
    yield
    logger.info("stopping_ai_qa_service")
    await consumer.disconnect()
    await publisher.disconnect()
    await close_db_pool()
    await redis_client.close()


app = FastAPI(
    title="Poliwise AI Q&A Service",
    description="RAG-based Q&A service with conversation management",
    version="0.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="")
app.include_router(chat.router, prefix="")
app.include_router(models.router, prefix="")
app.include_router(conversations.router, prefix="")
app.include_router(messages.router, prefix="")
app.include_router(unanswered.router, prefix="")


if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        reload=False
    )
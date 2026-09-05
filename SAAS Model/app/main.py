from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.routers import api_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.middleware.request_context import RequestContextMiddleware
from app.services.automation.file_watcher_service import IncomingFileWatcher

settings = get_settings()
configure_logging(settings.log_level)

incoming_file_watcher: IncomingFileWatcher | None = None


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    global incoming_file_watcher

    if settings.automation_enabled:
        incoming_file_watcher = IncomingFileWatcher(
            incoming_dir=settings.automation_incoming_dir,
            processed_dir=settings.automation_processed_dir,
            failed_dir=settings.automation_failed_dir,
            link_ttl_hours=settings.interview_link_ttl_hours,
            poll_interval_seconds=settings.automation_poll_interval_seconds,
            stability_checks=settings.automation_stability_checks,
        )
        incoming_file_watcher.start()

    yield

    if incoming_file_watcher is not None:
        await incoming_file_watcher.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)
register_exception_handlers(app)
app.include_router(api_router, prefix=settings.api_prefix)

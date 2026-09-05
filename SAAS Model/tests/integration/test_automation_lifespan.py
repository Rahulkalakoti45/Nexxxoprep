from fastapi.testclient import TestClient

from app import main as app_main


def test_automation_watcher_starts_and_stops_with_app_lifespan() -> None:
    """
    Regression guard for the Phase 8 audit finding: automation must start
    automatically with the FastAPI process (no separate command) and must
    shut down cleanly, with no leaked asyncio task.
    """
    assert app_main.incoming_file_watcher is None

    with TestClient(app_main.app) as client:
        assert client.get("/api/v1/health/live").status_code == 200

        watcher = app_main.incoming_file_watcher
        assert watcher is not None, "automation watcher must be created during lifespan startup"
        assert watcher._task is not None
        assert not watcher._task.done(), "automation watcher task must be running while the app is up"

    # after the TestClient context exits, lifespan shutdown has run
    assert app_main.incoming_file_watcher._task.done(), "automation watcher task must stop on app shutdown"

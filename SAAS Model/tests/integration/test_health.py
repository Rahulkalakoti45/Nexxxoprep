from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoints() -> None:
    client = TestClient(app)

    live = client.get("/api/v1/health/live")
    ready = client.get("/api/v1/health/ready")

    assert live.status_code == 200
    assert ready.status_code == 200

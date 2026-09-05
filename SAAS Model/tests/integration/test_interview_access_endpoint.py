from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_interview_access_endpoint_success(monkeypatch):
    session_uuid = uuid4()
    candidate_id = uuid4()

    def fake_validate_access(self, *, session_uuid, token):  # noqa: ARG001
        return {
            "session_uuid": session_uuid,
            "candidate_id": candidate_id,
            "candidate_status": "INTERVIEW_STARTED",
            "expires_at": datetime.now(timezone.utc),
        }

    monkeypatch.setattr("app.services.interview_access_service.InterviewAccessService.validate_access", fake_validate_access)

    client = TestClient(app)
    response = client.get(f"/api/v1/interview/access?session={session_uuid}&token=abc")

    assert response.status_code == 200
    assert response.json()["success"] is True

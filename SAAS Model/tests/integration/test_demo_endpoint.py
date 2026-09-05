from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app


def test_demo_send_test_email_endpoint_success():
    client = TestClient(app)
    mock_result = {
        "success": True,
        "email_sent_to": "rahul@gmail.com",
        "parsed_candidate": {"name": "Rahul Sharma", "email": "rahul@gmail.com", "phone": "9876543210"},
        "session_uuid": "11111111-1111-1111-1111-111111111111",
        "expires_at": "2026-01-01T10:00:00+00:00",
        "message_id": "smtp-abc",
    }
    with patch("app.api.v1.routers.demo.DemoService") as mock_service:
        mock_service.return_value.send_test_email.return_value = mock_result
        response = client.post("/api/v1/demo/send-test-email")
    assert response.status_code == 200
    assert response.json()["email_sent_to"] == "rahul@gmail.com"

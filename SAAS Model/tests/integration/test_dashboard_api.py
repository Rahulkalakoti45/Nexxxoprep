from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.api.v1.schemas.dashboard import (
    CandidatesListResponse,
    DashboardSummaryResponse,
    StatusBreakdownResponse,
    TimelineResponse,
)
from app.main import app


def test_dashboard_summary_endpoint():
    client = TestClient(app)
    mock_summary = DashboardSummaryResponse(
        total_received=5,
        shortlisted=5,
        emails_queued=1,
        emails_sent=4,
        interview_started=2,
        interview_completed=1,
        final_selected=0,
        rejected=0,
        pending=4,
    )
    with patch("app.api.v1.routers.dashboard.DashboardService") as mock_service:
        mock_service.return_value.get_summary.return_value = mock_summary
        response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    assert response.json()["total_received"] == 5


def test_dashboard_candidates_endpoint():
    client = TestClient(app)
    mock_candidates = CandidatesListResponse(total=0, items=[])
    with patch("app.api.v1.routers.dashboard.DashboardService") as mock_service:
        mock_service.return_value.list_candidates.return_value = mock_candidates
        response = client.get("/api/v1/dashboard/candidates?search=rahul&status=INVITED")
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_dashboard_timeline_endpoint():
    client = TestClient(app)
    with patch("app.api.v1.routers.dashboard.DashboardService") as mock_service:
        mock_service.return_value.get_timeline.return_value = TimelineResponse(items=[])
        response = client.get("/api/v1/dashboard/timeline")
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_dashboard_status_breakdown_endpoint():
    client = TestClient(app)
    with patch("app.api.v1.routers.dashboard.DashboardService") as mock_service:
        mock_service.return_value.get_status_breakdown.return_value = StatusBreakdownResponse(items=[])
        response = client.get("/api/v1/dashboard/status-breakdown")
    assert response.status_code == 200
    assert response.json()["items"] == []

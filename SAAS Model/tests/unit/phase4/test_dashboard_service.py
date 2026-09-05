from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.core.constants import CandidateStatus
from app.services.dashboard_service import DashboardService


class FakeDashboardRepo:
    def __init__(self):
        self.candidate_id = uuid4()
        self.candidate = SimpleNamespace(
            id=self.candidate_id,
            candidate_external_id="CAND001",
            name="Rahul Sharma",
            email="rahul@gmail.com",
            candidate_status=CandidateStatus.INVITED,
            updated_at=datetime.now(timezone.utc),
        )

    def count_candidates(self) -> int:
        return 10

    def count_shortlisted(self) -> int:
        return 8

    def count_outbound_by_status(self, status: str) -> int:
        return {"QUEUED": 2, "SENT": 6}.get(status, 0)

    def count_interview_started(self) -> int:
        return 3

    def count_interview_completed(self) -> int:
        return 1

    def count_by_status(self, status: CandidateStatus) -> int:
        return {CandidateStatus.FINAL_SELECTED: 0, CandidateStatus.REJECTED: 1}.get(status, 0)

    def status_breakdown(self):
        return [
            (CandidateStatus.INVITED, 5),
            (CandidateStatus.INTERVIEW_STARTED, 3),
        ]

    def list_candidates(self, *, search=None, status=None):
        return [
            {
                "candidate": self.candidate,
                "resume_score": 91.0,
                "email_status": "SENT",
                "interview_expires_at": datetime.now(timezone.utc),
            }
        ]

    def integration_events(self, limit=100):
        return [
            SimpleNamespace(
                id=uuid4(),
                event_type="SHORTLIST_RECEIVED",
                source_system="YASH",
                request_id="req-1",
                payload_json={"name": "Rahul Sharma", "email": "rahul@gmail.com"},
                created_at=datetime.now(timezone.utc),
            )
        ]

    def outbound_emails(self, limit=100):
        email_id = uuid4()
        return [
            SimpleNamespace(
                id=email_id,
                candidate_id=self.candidate_id,
                recipient_email="rahul@gmail.com",
                status="SENT",
                template_key="candidate_invite",
                provider_message_id="smtp-123",
                created_at=datetime.now(timezone.utc),
            )
        ]

    def notifications_with_candidates(self, limit=100):
        return [
            (
                SimpleNamespace(
                    id=uuid4(),
                    opened_at=datetime.now(timezone.utc),
                    interview_started=True,
                    interview_completed=False,
                    sent_at=datetime.now(timezone.utc),
                ),
                self.candidate,
            )
        ]

    def get_candidate(self, candidate_id):
        return self.candidate if candidate_id == self.candidate_id else None


def make_service() -> DashboardService:
    service = DashboardService(db=None)  # type: ignore[arg-type]
    service.repo = FakeDashboardRepo()
    return service


def test_get_summary_computes_pending():
    summary = make_service().get_summary()
    assert summary.total_received == 10
    assert summary.shortlisted == 8
    assert summary.emails_queued == 2
    assert summary.emails_sent == 6
    assert summary.interview_started == 3
    assert summary.interview_completed == 1
    assert summary.final_selected == 0
    assert summary.rejected == 1
    assert summary.pending == 8


def test_get_status_breakdown_maps_items():
    response = make_service().get_status_breakdown()
    assert len(response.items) == 2
    assert response.items[0].status == CandidateStatus.INVITED
    assert response.items[0].count == 5


def test_list_candidates_maps_rows():
    response = make_service().list_candidates()
    assert response.total == 1
    assert response.items[0].candidate_external_id == "CAND001"
    assert response.items[0].resume_score == 91.0
    assert response.items[0].email_status == "SENT"


def test_get_timeline_builds_ordered_events():
    response = make_service().get_timeline()
    event_types = {event.event_type for event in response.items}
    assert "shortlist_received" in event_types
    assert "email_generated" in event_types
    assert "email_sent" in event_types
    assert "link_opened" in event_types
    assert "interview_started" in event_types
    assert len(response.items) <= 100
    assert response.items[0].occurred_at >= response.items[-1].occurred_at

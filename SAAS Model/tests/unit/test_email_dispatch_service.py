from types import SimpleNamespace
from uuid import uuid4

from app.services.email_dispatch_service import EmailDispatchService


class FakeDB:
    def __init__(self):
        self.committed = 0
        self.rolled_back = 0

    def commit(self):
        self.committed += 1

    def rollback(self):
        self.rolled_back += 1

    def refresh(self, _):
        return None

    def add(self, _):
        return None


def test_email_dispatch_marks_sent():
    db = FakeDB()
    service = EmailDispatchService(db=db, settings=SimpleNamespace(smtp_sender_email="no-reply@example.com"))
    service.smtp_client = SimpleNamespace(
        send_candidate_invitation=lambda **_: {"success": True, "provider_message_id": "abc123"}
    )
    service.email_repo = SimpleNamespace(
        get_candidate_for_outbound=lambda _: SimpleNamespace(id=uuid4(), name="Rahul Sharma"),
        get_latest_shortlist=lambda _: SimpleNamespace(
            shortlist_reasons_json=["A", "B", "C"],
            interview_topics_json=["X", "Y", "Z"],
        ),
    )
    service.notification_repo = SimpleNamespace(mark_email_sent=lambda **_: None)

    outbound = SimpleNamespace(
        id=uuid4(),
        recipient_email="rahul@gmail.com",
        payload_json={"session_uuid": str(uuid4()), "expires_at": "2026-01-01T10:00:00+00:00"},
        status="QUEUED",
        provider_message_id=None,
    )

    result = service.dispatch_candidate_invitation(outbound_email=outbound, raw_token=str(uuid4()))
    assert result.status == "SENT"
    assert db.committed == 1


def test_email_dispatch_marks_failed_on_error():
    db = FakeDB()
    service = EmailDispatchService(db=db, settings=SimpleNamespace(smtp_sender_email="no-reply@example.com"))
    service.smtp_client = SimpleNamespace(send_candidate_invitation=lambda **_: (_ for _ in ()).throw(RuntimeError("smtp")))
    service.email_repo = SimpleNamespace(
        get_candidate_for_outbound=lambda _: SimpleNamespace(id=uuid4(), name="Rahul Sharma"),
        get_latest_shortlist=lambda _: SimpleNamespace(
            shortlist_reasons_json=["A", "B", "C"],
            interview_topics_json=["X", "Y", "Z"],
        ),
    )
    service.notification_repo = SimpleNamespace(mark_email_sent=lambda **_: None)

    outbound = SimpleNamespace(
        id=uuid4(),
        recipient_email="rahul@gmail.com",
        payload_json={"session_uuid": str(uuid4()), "expires_at": "2026-01-01T10:00:00+00:00"},
        status="QUEUED",
        provider_message_id=None,
    )

    result = service.dispatch_candidate_invitation(outbound_email=outbound, raw_token=str(uuid4()))
    assert result.status == "FAILED"
    assert db.rolled_back == 1

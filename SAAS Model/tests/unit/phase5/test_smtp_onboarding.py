from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import AppException
from app.integrations.smtp_client import SMTPClient
from app.services.onboarding.onboarding_email_sender import OnboardingEmailSender


class FakeSettings:
    smtp_host = "localhost"
    smtp_port = 1025
    smtp_username = ""
    smtp_password = ""
    smtp_sender_email = "no-reply@example.com"
    smtp_use_tls = False


def test_smtp_success(monkeypatch):
    client = SMTPClient(FakeSettings())
    monkeypatch.setattr(client, "_send_message", lambda message: {"success": True, "provider_message_id": "msg-123"})
    result = client.send_candidate_invitation(
        recipient_email="test@example.com",
        subject="Hello",
        body="Plain",
        html_body="<p>HTML</p>",
        jd_file_path=None,
    )
    assert result["provider_message_id"] == "msg-123"


def test_smtp_failure_raises_from_onboarding_sender():
    db = MagicMock()
    sender = OnboardingEmailSender(db=db, settings=FakeSettings())
    sender.smtp_client = MagicMock()
    sender.smtp_client.send_candidate_invitation.side_effect = RuntimeError("smtp down")
    sender.notification_repo = MagicMock()
    sender.email_repo = MagicMock()

    outbound = MagicMock()
    outbound.payload_json = {
        "candidate_name": "Jane",
        "position_name": "Engineer",
        "resume_score": 90,
        "shortlist_reasons": ["Reason"],
        "interview_topics": ["Topic"],
        "interview_url": "http://localhost/interview",
        "expires_at": "2026-01-01T10:00:00+00:00",
        "company_name": "ICD",
        "recruiter_contact": "recruiter@example.com",
    }
    outbound.recipient_email = "jane@example.com"
    outbound.candidate_id = "candidate-id"

    with pytest.raises(AppException) as exc:
        sender.send_queued_invitation(outbound_email=outbound, raw_token="token", jd_file_path="missing.pdf")
    assert exc.value.status_code == 502

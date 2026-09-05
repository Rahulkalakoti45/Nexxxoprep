from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.core.constants import CandidateStatus, InterviewSessionStatus
from app.core.errors import AppException
from app.core.security import hash_token
from app.services.interview_access_service import InterviewAccessService


class FakeDB:
    def __init__(self):
        self.commits = 0

    def commit(self):
        self.commits += 1


class FakeSessionRepo:
    def __init__(self, session):
        self.session = session

    def get_by_session_uuid(self, _):
        return self.session


class FakeNotificationRepo:
    def __init__(self, notification):
        self.notification = notification

    def get_by_candidate_id(self, _):
        return self.notification


def make_service_with_session(session):
    db = FakeDB()
    service = InterviewAccessService(db=db)  # type: ignore[arg-type]
    service.session_repo = FakeSessionRepo(session)
    service.notification_repo = FakeNotificationRepo(SimpleNamespace(interview_started=False))
    return service, db


def test_valid_token_marks_interview_started():
    raw_token = str(uuid4())
    session = SimpleNamespace(
        session_uuid=uuid4(),
        token_hash=hash_token(raw_token),
        status=InterviewSessionStatus.CREATED,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        candidate_id=uuid4(),
        candidate=SimpleNamespace(candidate_status=CandidateStatus.INVITED),
    )
    service, db = make_service_with_session(session)

    result = service.validate_access(session_uuid=session.session_uuid, token=raw_token)

    assert result["candidate_status"] == CandidateStatus.INTERVIEW_STARTED
    assert session.candidate.candidate_status == CandidateStatus.INTERVIEW_STARTED
    assert session.status == InterviewSessionStatus.CONSUMED
    assert db.commits == 1


def test_invalid_token_rejected():
    raw_token = str(uuid4())
    session = SimpleNamespace(
        session_uuid=uuid4(),
        token_hash=hash_token(raw_token),
        status=InterviewSessionStatus.CREATED,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        candidate_id=uuid4(),
        candidate=SimpleNamespace(candidate_status=CandidateStatus.INVITED),
    )
    service, _ = make_service_with_session(session)

    with pytest.raises(AppException) as exc:
        service.validate_access(session_uuid=session.session_uuid, token="bad-token")
    assert exc.value.status_code == 401


def test_expired_session_sets_status_and_returns_gone():
    raw_token = str(uuid4())
    session = SimpleNamespace(
        session_uuid=uuid4(),
        token_hash=hash_token(raw_token),
        status=InterviewSessionStatus.CREATED,
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        candidate_id=uuid4(),
        candidate=SimpleNamespace(candidate_status=CandidateStatus.INVITED),
    )
    service, db = make_service_with_session(session)

    with pytest.raises(AppException) as exc:
        service.validate_access(session_uuid=session.session_uuid, token=raw_token)

    assert exc.value.status_code == 410
    assert session.status == InterviewSessionStatus.EXPIRED
    assert db.commits == 1


def test_consumed_session_rejected():
    raw_token = str(uuid4())
    session = SimpleNamespace(
        session_uuid=uuid4(),
        token_hash=hash_token(raw_token),
        status=InterviewSessionStatus.CONSUMED,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        candidate_id=uuid4(),
        candidate=SimpleNamespace(candidate_status=CandidateStatus.INVITED),
    )
    service, _ = make_service_with_session(session)

    with pytest.raises(AppException) as exc:
        service.validate_access(session_uuid=session.session_uuid, token=raw_token)
    assert exc.value.status_code == 410

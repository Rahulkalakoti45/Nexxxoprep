from types import SimpleNamespace
from uuid import uuid4

import pytest
from celery.exceptions import MaxRetriesExceededError, Retry

from app.workers.celery_app import celery_app
from app.workers.tasks import email_dispatch as ed_task


class FakeDB:
    def close(self):
        pass


@pytest.fixture(autouse=True)
def eager_celery():
    """Run Celery tasks synchronously (in-process) for the duration of these tests."""
    original_eager = celery_app.conf.task_always_eager
    original_propagates = celery_app.conf.task_eager_propagates
    celery_app.conf.task_always_eager = True
    celery_app.conf.task_eager_propagates = True
    yield
    celery_app.conf.task_always_eager = original_eager
    celery_app.conf.task_eager_propagates = original_propagates


def test_task_is_registered_with_retry_config():
    task = ed_task.dispatch_candidate_invitation_email_task
    assert task.name == "email.dispatch_candidate_invitation"
    assert task.max_retries == 3
    assert task.default_retry_delay == 30


def test_successful_send_does_not_retry(monkeypatch):
    monkeypatch.setattr(ed_task, "SessionLocal", lambda: FakeDB())
    monkeypatch.setattr(
        ed_task,
        "OutboundEmailRepository",
        lambda db: SimpleNamespace(get_by_id=lambda _id: SimpleNamespace(id=uuid4())),
    )
    monkeypatch.setattr(
        ed_task,
        "EmailDispatchService",
        lambda db, settings: SimpleNamespace(
            dispatch_candidate_invitation=lambda **_: SimpleNamespace(status="SENT")
        ),
    )

    result = ed_task.dispatch_candidate_invitation_email_task.apply(
        args=(str(uuid4()), str(uuid4()))
    ).get()

    assert result == {"success": True, "status": "SENT"}


def _patch_common(monkeypatch, status: str):
    monkeypatch.setattr(ed_task, "SessionLocal", lambda: FakeDB())
    monkeypatch.setattr(
        ed_task,
        "OutboundEmailRepository",
        lambda db: SimpleNamespace(get_by_id=lambda _id: SimpleNamespace(id=uuid4())),
    )
    monkeypatch.setattr(
        ed_task,
        "EmailDispatchService",
        lambda db, settings: SimpleNamespace(
            dispatch_candidate_invitation=lambda **_: SimpleNamespace(status=status)
        ),
    )


def test_failed_send_calls_self_retry_with_backoff(monkeypatch):
    """
    The task's own control flow -- not Celery's broker/eager machinery --
    must call ``self.retry(countdown=...)`` whenever the send comes back
    non-SENT. We stub ``retry`` itself so this test is independent of
    whether a real broker is available.
    """
    _patch_common(monkeypatch, status="FAILED")

    task = ed_task.dispatch_candidate_invitation_email_task
    captured = {}

    def fake_retry(countdown=None, **kwargs):
        captured["countdown"] = countdown
        raise Retry("simulated retry", when=countdown)

    monkeypatch.setattr(task, "retry", fake_retry)

    with pytest.raises(Retry):
        task(str(uuid4()), str(uuid4()))

    assert captured["countdown"] == 30  # 30 * (0 retries so far + 1)


def test_persistent_failure_gives_up_gracefully_after_max_retries(monkeypatch):
    """
    Once Celery itself decides retries are exhausted, ``self.retry()``
    raises ``MaxRetriesExceededError``. The task must catch that itself
    and return a graceful failure result rather than letting it escape
    (which would surface as an unhandled worker error).
    """
    _patch_common(monkeypatch, status="FAILED")

    task = ed_task.dispatch_candidate_invitation_email_task
    monkeypatch.setattr(
        task, "retry", lambda countdown=None, **kwargs: (_ for _ in ()).throw(MaxRetriesExceededError("boom"))
    )

    result = task(str(uuid4()), str(uuid4()))

    assert result["success"] is False
    assert result["status"] == "FAILED"
    assert "retries" in result["message"].lower() or "max" in result["message"].lower()


def test_missing_outbound_email_does_not_retry(monkeypatch):
    monkeypatch.setattr(ed_task, "SessionLocal", lambda: FakeDB())
    monkeypatch.setattr(
        ed_task, "OutboundEmailRepository", lambda db: SimpleNamespace(get_by_id=lambda _id: None)
    )

    result = ed_task.dispatch_candidate_invitation_email_task.apply(
        args=(str(uuid4()), str(uuid4()))
    ).get()

    assert result == {"success": False, "status": "FAILED", "message": "Outbound email not found"}

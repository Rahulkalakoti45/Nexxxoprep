import json
from pathlib import Path
from uuid import uuid4

import pytest

from app.services.automation import candidate_file_processor as cfp


class FakeDB:
    def close(self):
        pass


class FakeIntakeService:
    """Stands in for CandidateIntakeService so no real DB/session is needed."""

    def __init__(self, db, link_ttl_hours):
        self.db = db
        self.link_ttl_hours = link_ttl_hours

    def process_shortlist(self, payload, request_id, source_system="YASH"):
        assert source_system == "YASH_FILE_WATCH", "automation must tag its own source_system"
        if payload.name == "Fail Me":
            raise RuntimeError("simulated downstream failure")
        return {"session_uuid": uuid4(), "candidate_status": "INVITED"}


@pytest.fixture(autouse=True)
def patch_dependencies(monkeypatch):
    monkeypatch.setattr(cfp, "SessionLocal", lambda: FakeDB())
    monkeypatch.setattr(cfp, "CandidateIntakeService", FakeIntakeService)


def _write(tmp_path: Path, name: str, content) -> Path:
    file_path = tmp_path / name
    if isinstance(content, str):
        file_path.write_text(content, encoding="utf-8")
    else:
        file_path.write_text(json.dumps(content), encoding="utf-8")
    return file_path


def _valid_candidate(**overrides) -> dict:
    base = {
        "external_candidate_id": "YASH-1",
        "name": "Jane Doe",
        "email": "jane@example.com",
        "phone": "1234567890",
        "resume_score": 90,
        "shortlist_reasons": ["Great fit"],
        "interview_topics": ["Python"],
    }
    base.update(overrides)
    return base


def test_all_candidates_succeed_marks_file_fully_successful(tmp_path):
    file_path = _write(tmp_path, "candidates.json", [_valid_candidate()])

    result = cfp.process_candidate_file(file_path, link_ttl_hours=5)

    assert result.is_fully_successful
    assert result.file_error is None
    assert len(result.outcomes) == 1
    assert result.outcomes[0].success is True
    assert result.outcomes[0].session_uuid is not None


def test_multiple_candidates_all_processed_independently(tmp_path):
    file_path = _write(
        tmp_path,
        "candidates.json",
        [_valid_candidate(name="A"), _valid_candidate(name="B"), _valid_candidate(name="Fail Me")],
    )

    result = cfp.process_candidate_file(file_path, link_ttl_hours=5)

    assert not result.is_fully_successful
    assert len(result.outcomes) == 3
    assert [o.success for o in result.outcomes] == [True, True, False]
    assert "simulated downstream failure" in result.outcomes[2].error


def test_invalid_schema_marks_candidate_failed_without_calling_service(tmp_path):
    file_path = _write(tmp_path, "candidates.json", [{"name": "Missing Required Fields"}])

    result = cfp.process_candidate_file(file_path, link_ttl_hours=5)

    assert not result.is_fully_successful
    assert result.outcomes[0].success is False
    assert result.outcomes[0].error  # pydantic validation message present


def test_service_exception_marks_candidate_failed(tmp_path):
    file_path = _write(tmp_path, "candidates.json", [_valid_candidate(name="Fail Me")])

    result = cfp.process_candidate_file(file_path, link_ttl_hours=5)

    assert not result.is_fully_successful
    assert "simulated downstream failure" in result.outcomes[0].error


def test_malformed_json_reports_file_level_error(tmp_path):
    file_path = _write(tmp_path, "broken.json", "{not valid json")

    result = cfp.process_candidate_file(file_path, link_ttl_hours=5)

    assert result.file_error is not None
    assert not result.is_fully_successful
    assert result.outcomes == []


def test_single_object_file_is_treated_as_one_candidate(tmp_path):
    file_path = _write(tmp_path, "single.json", _valid_candidate())

    result = cfp.process_candidate_file(file_path, link_ttl_hours=5)

    assert result.is_fully_successful
    assert len(result.outcomes) == 1


def test_report_dict_contains_summary_counts(tmp_path):
    file_path = _write(
        tmp_path, "candidates.json", [_valid_candidate(name="A"), _valid_candidate(name="Fail Me")]
    )

    result = cfp.process_candidate_file(file_path, link_ttl_hours=5)
    report = result.to_report_dict()

    assert report["total_candidates"] == 2
    assert report["succeeded"] == 1
    assert report["failed"] == 1
    assert len(report["candidates"]) == 2

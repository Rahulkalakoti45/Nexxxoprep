"""
Candidate File Processor
=========================

Reads a single incoming candidate JSON file, validates every candidate
against the existing ``YashShortlistPayload`` schema, and hands each valid
candidate to the existing ``CandidateIntakeService`` -- the exact same
service class the ``/api/v1/integrations/yash/shortlists`` HTTP endpoint
uses.

This module intentionally contains ZERO shortlisting / token / email
business logic of its own. It only prepares input for, and calls, the
existing service so behaviour stays identical whether a candidate arrives
via the HTTP API or via a dropped file.
"""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.api.v1.schemas.integration import YashShortlistPayload
from app.db.session import SessionLocal
from app.services.candidate_intake_service import CandidateIntakeService

logger = logging.getLogger(__name__)


@dataclass
class CandidateOutcome:
    """Result of processing a single candidate entry inside a file."""

    index: int
    identifier: str
    success: bool
    session_uuid: str | None = None
    error: str | None = None


@dataclass
class FileProcessingResult:
    """Aggregate result of processing every candidate inside one file."""

    file_name: str
    file_error: str | None = None
    outcomes: list[CandidateOutcome] = field(default_factory=list)

    @property
    def is_fully_successful(self) -> bool:
        if self.file_error:
            return False
        if not self.outcomes:
            return False
        return all(outcome.success for outcome in self.outcomes)

    def to_report_dict(self) -> dict[str, Any]:
        return {
            "file_name": self.file_name,
            "file_error": self.file_error,
            "total_candidates": len(self.outcomes),
            "succeeded": sum(1 for o in self.outcomes if o.success),
            "failed": sum(1 for o in self.outcomes if not o.success),
            "candidates": [
                {
                    "index": o.index,
                    "identifier": o.identifier,
                    "success": o.success,
                    "session_uuid": o.session_uuid,
                    "error": o.error,
                }
                for o in self.outcomes
            ],
        }


def _load_candidates(file_path: Path) -> list[dict[str, Any]]:
    raw_text = file_path.read_text(encoding="utf-8")
    data = json.loads(raw_text)

    if isinstance(data, dict):
        data = [data]

    if not isinstance(data, list):
        raise ValueError("Candidate JSON must be an object or a list of objects")

    if not data:
        raise ValueError("Candidate JSON file contains no candidates")

    return data


def _identify(raw_candidate: dict[str, Any], index: int) -> str:
    return str(
        raw_candidate.get("external_candidate_id")
        or raw_candidate.get("candidate_id")
        or raw_candidate.get("name")
        or f"candidate_{index}"
    )


def process_candidate_file(file_path: Path, link_ttl_hours: int) -> FileProcessingResult:
    """
    Validate and process every candidate inside a single JSON file.

    Reuses ``CandidateIntakeService`` for every candidate -- the same code
    path the manual ``/integrations/yash/shortlists`` endpoint uses. Every
    candidate is isolated: one bad/failing candidate does not stop the rest
    of the file from being attempted, but the file as a whole is only
    considered successful (and moved to ``processed/``) when every
    candidate in it succeeded. See ``architecture.md`` for the full
    rationale behind this file-level-atomicity decision.
    """
    result = FileProcessingResult(file_name=file_path.name)

    try:
        raw_candidates = _load_candidates(file_path)
    except (json.JSONDecodeError, ValueError) as exc:
        result.file_error = f"Invalid candidate file: {exc}"
        logger.error("automation.file_invalid file=%s error=%s", file_path.name, exc)
        return result

    db = SessionLocal()
    try:
        service = CandidateIntakeService(db=db, link_ttl_hours=link_ttl_hours)

        for index, raw_candidate in enumerate(raw_candidates, start=1):
            identifier = _identify(raw_candidate, index)

            try:
                payload = YashShortlistPayload.model_validate(raw_candidate)
            except ValidationError as exc:
                logger.warning(
                    "automation.candidate_schema_invalid file=%s index=%s identifier=%s error=%s",
                    file_path.name,
                    index,
                    identifier,
                    exc,
                )
                result.outcomes.append(
                    CandidateOutcome(index=index, identifier=identifier, success=False, error=str(exc))
                )
                continue

            request_id = f"automation-{uuid.uuid4()}"
            try:
                processed = service.process_shortlist(
                    payload=payload,
                    request_id=request_id,
                    source_system="YASH_FILE_WATCH",
                )
                result.outcomes.append(
                    CandidateOutcome(
                        index=index,
                        identifier=identifier,
                        success=True,
                        session_uuid=str(processed["session_uuid"]),
                    )
                )
                logger.info(
                    "automation.candidate_processed file=%s index=%s identifier=%s session_uuid=%s",
                    file_path.name,
                    index,
                    identifier,
                    processed["session_uuid"],
                )
            except Exception as exc:  # noqa: BLE001 - candidate-level isolation is intentional
                logger.error(
                    "automation.candidate_failed file=%s index=%s identifier=%s error=%s",
                    file_path.name,
                    index,
                    identifier,
                    exc,
                )
                result.outcomes.append(
                    CandidateOutcome(index=index, identifier=identifier, success=False, error=str(exc))
                )
    finally:
        db.close()

    return result

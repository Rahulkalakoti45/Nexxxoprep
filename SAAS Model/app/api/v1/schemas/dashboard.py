from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.core.constants import CandidateStatus


class DashboardSummaryResponse(BaseModel):
    total_received: int
    shortlisted: int
    emails_queued: int
    emails_sent: int
    interview_started: int
    interview_completed: int
    final_selected: int
    rejected: int
    pending: int


class StatusBreakdownItem(BaseModel):
    status: CandidateStatus
    count: int


class StatusBreakdownResponse(BaseModel):
    items: list[StatusBreakdownItem]


class CandidateRow(BaseModel):
    id: UUID
    candidate_external_id: str
    name: str
    email: str
    resume_score: float | None
    candidate_status: CandidateStatus
    email_status: str
    interview_expires_at: datetime | None


class CandidatesListResponse(BaseModel):
    total: int
    items: list[CandidateRow]


class TimelineEvent(BaseModel):
    id: str
    event_type: str
    label: str
    candidate_name: str | None
    candidate_email: str | None
    occurred_at: datetime
    metadata: dict = {}


class TimelineResponse(BaseModel):
    items: list[TimelineEvent]

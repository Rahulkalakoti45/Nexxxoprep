from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.core.constants import CandidateStatus


class InterviewAccessResponse(BaseModel):
    success: bool = True
    message: str
    request_id: str
    session_uuid: UUID
    candidate_id: UUID
    candidate_status: CandidateStatus
    expires_at: datetime

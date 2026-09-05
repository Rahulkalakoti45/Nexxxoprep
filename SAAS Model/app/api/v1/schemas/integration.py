from uuid import UUID
from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, model_validator

from app.core.constants import CandidateStatus


class YashShortlistPayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    candidate_id: str | None = None
    external_candidate_id: str | None = None

    name: str
    email: EmailStr
    phone: str
    resume_score: float

    position_name: str | None = None
    skills: list[str] = []
    summary: str | None = None
    experience_level: str | None = None
    jd_match_percentage: float | None = None
    strengths: list[str] = []
    recommended_role: str | None = None

    shortlist_reasons: list[str]
    interview_topics: list[str]

    @model_validator(mode="after")
    def populate_candidate_id(self):
        if not self.candidate_id:
            self.candidate_id = self.external_candidate_id

        if not self.candidate_id:
            raise ValueError(
                "Either candidate_id or external_candidate_id is required"
            )

        return self


class YashShortlistResponse(BaseModel):
    success: bool = True
    message: str
    request_id: str
    candidate_db_id: UUID
    candidate_status: CandidateStatus
    session_uuid: UUID
    expires_at: datetime
    interview_token: str
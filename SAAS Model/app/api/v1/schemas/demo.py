from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class ParsedCandidateResponse(BaseModel):
    name: str
    email: EmailStr
    phone: str


class DemoEmailResponse(BaseModel):
    success: bool = True
    email_sent_to: EmailStr
    parsed_candidate: ParsedCandidateResponse
    session_uuid: UUID
    expires_at: datetime
    message_id: str | None = None

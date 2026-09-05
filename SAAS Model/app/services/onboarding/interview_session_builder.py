from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import generate_interview_token, hash_token
from app.db.models.interview_session import InterviewSession
from app.db.repositories.interview_session_repo import InterviewSessionRepository


@dataclass
class InterviewSessionResult:
    session: InterviewSession
    raw_token: str
    expires_at: datetime


class InterviewSessionBuilder:
    def __init__(self, db: Session, link_ttl_hours: int):
        self.db = db
        self.link_ttl_hours = link_ttl_hours
        self.session_repo = InterviewSessionRepository(db)

    def build_for_candidate(self, candidate_id) -> InterviewSessionResult:
        raw_token = generate_interview_token()
        token_hash = hash_token(raw_token)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=self.link_ttl_hours)
        session = self.session_repo.create(
            candidate_id=candidate_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        return InterviewSessionResult(session=session, raw_token=raw_token, expires_at=expires_at)

    @staticmethod
    def build_interview_url(*, base_url: str, session_uuid, raw_token: str) -> str:
        base = base_url.rstrip("/")
        return f"{base}/api/v1/interview/access?session={session_uuid}&token={raw_token}"

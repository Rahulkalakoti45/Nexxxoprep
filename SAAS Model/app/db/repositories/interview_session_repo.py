from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import InterviewSessionStatus
from app.db.models.interview_session import InterviewSession


class InterviewSessionRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        *,
        candidate_id,
        token_hash: str,
        expires_at: datetime,
    ) -> InterviewSession:
        row = InterviewSession(
            candidate_id=candidate_id,
            token_hash=token_hash,
            expires_at=expires_at,
            status=InterviewSessionStatus.CREATED,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_by_session_uuid(self, session_uuid) -> InterviewSession | None:
        stmt = select(InterviewSession).where(InterviewSession.session_uuid == session_uuid)
        return self.db.scalar(stmt)

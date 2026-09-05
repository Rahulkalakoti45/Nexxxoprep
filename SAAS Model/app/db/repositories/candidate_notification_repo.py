from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.candidate_notification import CandidateNotification


class CandidateNotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_candidate_id(self, candidate_id):
        stmt = select(CandidateNotification).where(CandidateNotification.candidate_id == candidate_id)
        return self.db.scalar(stmt)

    def create_invited(self, *, candidate_id) -> CandidateNotification:
        row = CandidateNotification(
            candidate_id=candidate_id,
            email_sent=False,
            sent_at=None,
            email_opened=False,
            interview_started=False,
            interview_completed=False,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def mark_email_sent(self, *, candidate_id) -> CandidateNotification | None:
        row = self.get_by_candidate_id(candidate_id)
        if row is None:
            return None
        row.email_sent = True
        row.sent_at = datetime.now(timezone.utc)
        self.db.flush()
        return row

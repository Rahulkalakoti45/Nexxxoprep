from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.constants import CandidateStatus, InterviewSessionStatus
from app.core.errors import AppException
from app.core.security import verify_token
from app.db.repositories.candidate_notification_repo import CandidateNotificationRepository
from app.db.repositories.interview_session_repo import InterviewSessionRepository


class InterviewAccessService:
    def __init__(self, db: Session):
        self.db = db
        self.session_repo = InterviewSessionRepository(db)
        self.notification_repo = CandidateNotificationRepository(db)

    def validate_access(self, *, session_uuid: UUID, token: str) -> dict:
        session = self.session_repo.get_by_session_uuid(session_uuid)
        if session is None:
            raise AppException("Interview session not found", status_code=404)

        if not verify_token(token, session.token_hash):
            raise AppException("Invalid token", status_code=401)

        if session.status == InterviewSessionStatus.CONSUMED:
            raise AppException("Interview session already consumed", status_code=410)
        if session.status == InterviewSessionStatus.EXPIRED:
            raise AppException("Interview session expired", status_code=410)

        now = datetime.now(timezone.utc)
        if now > session.expires_at:
            session.status = InterviewSessionStatus.EXPIRED
            self.db.commit()
            raise AppException("Interview session expired", status_code=410)

        session.status = InterviewSessionStatus.CONSUMED
        session.candidate.candidate_status = CandidateStatus.INTERVIEW_STARTED
        notification = self.notification_repo.get_by_candidate_id(session.candidate_id)
        if notification is not None:
            notification.interview_started = True
        self.db.commit()
        return {
            "session_uuid": session.session_uuid,
            "candidate_id": session.candidate_id,
            "candidate_status": session.candidate.candidate_status,
            "expires_at": session.expires_at,
        }

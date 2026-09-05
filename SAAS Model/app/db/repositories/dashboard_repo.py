from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from app.core.constants import CandidateStatus
from app.db.models.candidate import Candidate
from app.db.models.candidate_notification import CandidateNotification
from app.db.models.candidate_shortlist import CandidateShortlist
from app.db.models.integration_event import IntegrationEvent
from app.db.models.interview_session import InterviewSession
from app.db.models.outbound_email import OutboundEmail


class DashboardRepository:
    def __init__(self, db: Session):
        self.db = db

    def count_candidates(self) -> int:
        return self.db.scalar(select(func.count()).select_from(Candidate)) or 0

    def count_by_status(self, status: CandidateStatus) -> int:
        stmt = select(func.count()).select_from(Candidate).where(Candidate.candidate_status == status)
        return self.db.scalar(stmt) or 0

    def count_shortlisted(self) -> int:
        stmt = select(func.count(func.distinct(CandidateShortlist.candidate_id)))
        return self.db.scalar(stmt) or 0

    def count_outbound_by_status(self, status: str) -> int:
        stmt = select(func.count()).select_from(OutboundEmail).where(OutboundEmail.status == status)
        return self.db.scalar(stmt) or 0

    def count_interview_started(self) -> int:
        stmt = (
            select(func.count())
            .select_from(CandidateNotification)
            .where(CandidateNotification.interview_started.is_(True))
        )
        return self.db.scalar(stmt) or 0

    def count_interview_completed(self) -> int:
        stmt = (
            select(func.count())
            .select_from(CandidateNotification)
            .where(CandidateNotification.interview_completed.is_(True))
        )
        return self.db.scalar(stmt) or 0

    def status_breakdown(self) -> list[tuple[CandidateStatus, int]]:
        stmt = (
            select(Candidate.candidate_status, func.count())
            .group_by(Candidate.candidate_status)
            .order_by(Candidate.candidate_status)
        )
        return list(self.db.execute(stmt).all())

    def list_candidates(
        self,
        *,
        search: str | None = None,
        status: CandidateStatus | None = None,
    ) -> list[dict]:
        latest_shortlist = (
            select(
                CandidateShortlist.candidate_id,
                func.max(CandidateShortlist.created_at).label("max_created"),
            )
            .group_by(CandidateShortlist.candidate_id)
            .subquery()
        )
        shortlist = aliased(CandidateShortlist)
        latest_session = (
            select(
                InterviewSession.candidate_id,
                func.max(InterviewSession.created_at).label("max_created"),
            )
            .group_by(InterviewSession.candidate_id)
            .subquery()
        )
        session = aliased(InterviewSession)
        latest_email = (
            select(
                OutboundEmail.candidate_id,
                func.max(OutboundEmail.created_at).label("max_created"),
            )
            .group_by(OutboundEmail.candidate_id)
            .subquery()
        )
        email = aliased(OutboundEmail)

        stmt = (
            select(
                Candidate,
                shortlist.resume_score,
                email.status.label("email_status"),
                session.expires_at.label("interview_expires_at"),
            )
            .outerjoin(latest_shortlist, Candidate.id == latest_shortlist.c.candidate_id)
            .outerjoin(
                shortlist,
                (shortlist.candidate_id == latest_shortlist.c.candidate_id)
                & (shortlist.created_at == latest_shortlist.c.max_created),
            )
            .outerjoin(latest_session, Candidate.id == latest_session.c.candidate_id)
            .outerjoin(
                session,
                (session.candidate_id == latest_session.c.candidate_id)
                & (session.created_at == latest_session.c.max_created),
            )
            .outerjoin(latest_email, Candidate.id == latest_email.c.candidate_id)
            .outerjoin(
                email,
                (email.candidate_id == latest_email.c.candidate_id)
                & (email.created_at == latest_email.c.max_created),
            )
            .order_by(Candidate.created_at.desc())
        )

        if status is not None:
            stmt = stmt.where(Candidate.candidate_status == status)
        if search:
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(or_(Candidate.name.ilike(pattern), Candidate.email.ilike(pattern)))

        rows = self.db.execute(stmt).all()
        return [
            {
                "candidate": row[0],
                "resume_score": row[1],
                "email_status": row[2] or "NONE",
                "interview_expires_at": row[3],
            }
            for row in rows
        ]

    def integration_events(self, limit: int = 100) -> list[IntegrationEvent]:
        stmt = select(IntegrationEvent).order_by(IntegrationEvent.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def outbound_emails(self, limit: int = 100) -> list[OutboundEmail]:
        stmt = select(OutboundEmail).order_by(OutboundEmail.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def notifications_with_candidates(self, limit: int = 100) -> list[tuple[CandidateNotification, Candidate]]:
        stmt = (
            select(CandidateNotification, Candidate)
            .join(Candidate, Candidate.id == CandidateNotification.candidate_id)
            .order_by(Candidate.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(stmt).all())

    def get_candidate(self, candidate_id: UUID) -> Candidate | None:
        return self.db.get(Candidate, candidate_id)

import logging
import traceback
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.api.v1.schemas.integration import YashShortlistPayload
from app.core.constants import CandidateStatus
from app.core.errors import AppException
from app.core.security import generate_interview_token, hash_token
from app.db.repositories.candidate_notification_repo import CandidateNotificationRepository
from app.db.repositories.candidate_repo import CandidateRepository
from app.db.repositories.candidate_shortlist_repo import CandidateShortlistRepository
from app.db.repositories.integration_event_repo import IntegrationEventRepository
from app.db.repositories.interview_session_repo import InterviewSessionRepository
from app.db.repositories.outbound_email_repo import OutboundEmailRepository
from app.workers.tasks.email_dispatch import dispatch_candidate_invitation_email_task

logger = logging.getLogger(__name__)

class CandidateIntakeService:
    def __init__(self, db: Session, link_ttl_hours: int):
        self.db = db
        self.link_ttl_hours = link_ttl_hours

        self.candidate_repo = CandidateRepository(db)
        self.shortlist_repo = CandidateShortlistRepository(db)
        self.session_repo = InterviewSessionRepository(db)
        self.notification_repo = CandidateNotificationRepository(db)
        self.outbound_email_repo = OutboundEmailRepository(db)
        self.integration_repo = IntegrationEventRepository(db)

    def process_shortlist(
        self,
        payload: YashShortlistPayload,
        request_id: str,
        source_system: str = "YASH",
     ) -> dict:
        """
        Run the full onboarding pipeline for one candidate.

        ``source_system`` defaults to "YASH" to preserve the exact existing
        behavior for the HTTP integration router. Callers such as the
        Automation Service pass a distinct value (e.g. "YASH_FILE_WATCH")
        purely for audit-trail / dashboard-timeline traceability -- it does
        not change any onboarding behavior.
        """
        try:
            integration_event = self.integration_repo.create(
                source_system=source_system,
                event_type="SHORTLIST_RECEIVED",
                request_id=request_id,
                payload=payload.model_dump(mode="json"),
                status="RECEIVED",
            )

            candidate = self.candidate_repo.upsert(
                external_id=payload.candidate_id,
                name=payload.name,
                email=payload.email,
                phone=payload.phone,
            )

            self.shortlist_repo.create(
                candidate_id=candidate.id,
                resume_score=payload.resume_score,
                shortlist_reasons=payload.shortlist_reasons,
                interview_topics=payload.interview_topics,
            )

            candidate.candidate_status = CandidateStatus.SHORTLISTED

            raw_token = generate_interview_token()
            token_hash = hash_token(raw_token)
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(hours=self.link_ttl_hours)
            session = self.session_repo.create(candidate_id=candidate.id, token_hash=token_hash, expires_at=expires_at)

            self.notification_repo.create_invited(candidate_id=candidate.id)

            from app.core.config import get_settings
            settings = get_settings()

            outbound_email = self.outbound_email_repo.create_candidate_invite(
                candidate_id=candidate.id,
                recipient_email=candidate.email,
                payload={
                    "candidate_name": candidate.name,
                    "position_name": payload.position_name,
                    "resume_score": payload.resume_score,
                    "shortlist_reasons": payload.shortlist_reasons,
                    "interview_topics": payload.interview_topics,
                    "skills": payload.skills,
                    "session_uuid": str(session.session_uuid),
                    "expires_at": expires_at.isoformat(),
                    "company_name": settings.company_name,
                    "recruiter_contact": settings.recruiter_contact_email,
                },
            )

            candidate.candidate_status = CandidateStatus.INVITED

            self.integration_repo.update_status(row=integration_event, status="PROCESSED")

            self.db.commit()
            self.db.refresh(candidate)
            self.db.refresh(session)

            try:
                dispatch_candidate_invitation_email_task.delay(
                    str(outbound_email.id),
                    raw_token,
                )
                print("✅ Celery task queued successfully")

            except Exception as exc:
                print("=" * 80)
                print("❌ CELERY ERROR")
                print(repr(exc))
                traceback.print_exc()
                print("=" * 80)
                raise

            return {
                "candidate_db_id": candidate.id,
                "candidate_status": candidate.candidate_status,
                "session_uuid": session.session_uuid,
                "expires_at": session.expires_at,
                "interview_token": raw_token,
            }

        except Exception as exc:
            self.db.rollback()
            raise AppException(
                message=f"Failed to process shortlist: {exc}"
            ) from exc
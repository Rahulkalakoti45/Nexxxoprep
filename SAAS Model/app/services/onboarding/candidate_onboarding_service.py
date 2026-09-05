import re
import uuid

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.constants import CandidateStatus
from app.core.errors import AppException
from app.db.repositories.candidate_notification_repo import CandidateNotificationRepository
from app.db.repositories.candidate_repo import CandidateRepository
from app.db.repositories.candidate_shortlist_repo import CandidateShortlistRepository
from app.db.repositories.outbound_email_repo import OutboundEmailRepository
from app.services.onboarding.attachment_builder import AttachmentBuilder
from app.services.onboarding.interview_session_builder import InterviewSessionBuilder
from app.services.onboarding.onboarding_email_sender import OnboardingEmailSender
from app.services.onboarding.email_template_builder import EmailTemplateBuilder
from app.services.resume.models import ParsedResume


class CandidateOnboardingService:
    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings
        self.candidate_repo = CandidateRepository(db)
        self.shortlist_repo = CandidateShortlistRepository(db)
        self.notification_repo = CandidateNotificationRepository(db)
        self.outbound_email_repo = OutboundEmailRepository(db)
        self.session_builder = InterviewSessionBuilder(db, settings.interview_link_ttl_hours)
        self.attachment_builder = AttachmentBuilder(settings.jd_pdf_path)
        self.email_sender = OnboardingEmailSender(db, settings)

    def process_onboarding(
        self,
        *,
        parsed: ParsedResume,
        position_name: str,
        resume_score: float,
        shortlist_reasons: list[str],
        interview_topics: list[str],
        candidate_external_id: str | None = None,
    ) -> dict:
        if not parsed.email:
            raise AppException("Missing contact information: email is required", status_code=422)

        name = parsed.name or "Candidate"
        phone = parsed.phone or "0000000000"
        external_id = candidate_external_id or self._build_external_id(parsed.email)

        try:
            candidate = self.candidate_repo.upsert(
                external_id=external_id,
                name=name,
                email=parsed.email,
                phone=phone,
            )

            self.shortlist_repo.create(
                candidate_id=candidate.id,
                resume_score=resume_score,
                shortlist_reasons=shortlist_reasons,
                interview_topics=interview_topics,
            )
            candidate.candidate_status = CandidateStatus.SHORTLISTED

            session_result = self.session_builder.build_for_candidate(candidate.id)
            interview_url = InterviewSessionBuilder.build_interview_url(
                base_url=self.settings.app_base_url,
                session_uuid=session_result.session.session_uuid,
                raw_token=session_result.raw_token,
            )

            self.notification_repo.create_invited(candidate_id=candidate.id)

            jd_path = self.attachment_builder.resolve_jd_attachment(
                position_name=position_name,
                company_name=self.settings.company_name,
            )

            outbound_email = self.outbound_email_repo.create_candidate_invite(
                candidate_id=candidate.id,
                recipient_email=candidate.email,
                payload={
                    "candidate_name": candidate.name,
                    "position_name": position_name,
                    "resume_score": resume_score,
                    "shortlist_reasons": shortlist_reasons,
                    "interview_topics": interview_topics,
                    "skills": parsed.skills,
                    "interview_instructions": EmailTemplateBuilder.DEFAULT_INSTRUCTIONS,
                    "session_uuid": str(session_result.session.session_uuid),
                    "interview_url": interview_url,
                    "expires_at": session_result.expires_at.isoformat(),
                    "company_name": self.settings.company_name,
                    "recruiter_contact": self.settings.recruiter_contact_email,
                    "jd_file_path": str(jd_path),
                    "email_format": "html",
                },
            )

            candidate.candidate_status = CandidateStatus.INVITED
            self.db.commit()
            self.db.refresh(candidate)
            self.db.refresh(outbound_email)
            self.db.refresh(session_result.session)

            sent_record = self.email_sender.send_queued_invitation(
                outbound_email=outbound_email,
                raw_token=session_result.raw_token,
                jd_file_path=str(jd_path),
            )

            return {
                "success": True,
                "email_sent_to": candidate.email,
                "parsed_candidate": {
                    "name": name,
                    "email": parsed.email,
                    "phone": phone,
                },
                "session_uuid": session_result.session.session_uuid,
                "expires_at": session_result.expires_at,
                "message_id": sent_record.provider_message_id,
            }
        except AppException:
            self.db.rollback()
            raise
        except Exception as exc:
            self.db.rollback()
            raise AppException(message=f"Onboarding failed: {exc}", status_code=500) from exc

    @staticmethod
    def _build_external_id(email: str) -> str:
        local = email.split("@")[0]
        safe = re.sub(r"[^A-Za-z0-9]", "", local).upper()[:12] or "CAND"
        return f"DEMO-{safe}-{uuid.uuid4().hex[:6].upper()}"

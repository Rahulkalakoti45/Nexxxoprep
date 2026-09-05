from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppException
from app.db.models.candidate import Candidate
from app.db.models.candidate_shortlist import CandidateShortlist
from app.db.models.outbound_email import OutboundEmail
from app.db.repositories.candidate_notification_repo import CandidateNotificationRepository
from app.db.repositories.outbound_email_repo import OutboundEmailRepository
from app.integrations.smtp_client import SMTPClient
from app.services.onboarding.email_template_builder import EmailTemplateBuilder, EmailTemplateContext


class EmailDispatchService:
    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings
        self.smtp_client = SMTPClient(settings)
        self.email_repo = OutboundEmailRepository(db)
        self.notification_repo = CandidateNotificationRepository(db)
        self.template_builder = EmailTemplateBuilder()

    def _build_candidate_invitation_email(
        self,
        *,
        candidate: Candidate,
        shortlist: CandidateShortlist | None,
        payload: dict,
        raw_token: str,
    ) -> tuple[str, str, str]:
        # Prepend base URL to relative URL if not present
        interview_url = payload.get("interview_url")
        if not interview_url:
            relative_url = f"/interview/access?session={payload['session_uuid']}&token={raw_token}"
            base_url = getattr(self.settings, "app_base_url", "http://localhost:8000")
            interview_url = f"{base_url}{relative_url}"

        company_name = getattr(self.settings, "company_name", "Intelligent Candidate Discovery")
        recruiter_email = getattr(self.settings, "recruiter_contact_email", "recruiter@example.com")

        context = EmailTemplateContext(
            candidate_name=candidate.name,
            position_name=payload.get("position_name"),
            resume_score=float(getattr(shortlist, "resume_score", 0.0) or payload.get("resume_score", 0.0)),
            shortlist_reasons=getattr(shortlist, "shortlist_reasons_json", None) or payload.get("shortlist_reasons", []),
            interview_topics=getattr(shortlist, "interview_topics_json", None) or payload.get("interview_topics", []),
            interview_instructions=payload.get("interview_instructions") or EmailTemplateBuilder.DEFAULT_INSTRUCTIONS,
            interview_url=interview_url,
            link_expiry=payload["expires_at"],
            company_name=payload.get("company_name") or company_name,
            recruiter_contact=payload.get("recruiter_contact") or recruiter_email,
            skills=payload.get("skills"),
            interview_mode=payload.get("interview_mode") or payload.get("mode"),
            interview_duration=payload.get("interview_duration") or payload.get("duration"),
        )
        return self.template_builder.build(context)

    def dispatch_candidate_invitation(self, *, outbound_email: OutboundEmail, raw_token: str) -> OutboundEmail:
        candidate = self.email_repo.get_candidate_for_outbound(outbound_email.id)

        if candidate is None:
            raise AppException("Candidate not found")

        shortlist = self.email_repo.get_latest_shortlist(candidate.id)

        if shortlist is None:
            raise AppException("Shortlist not found")

        subject, html_body, body = self._build_candidate_invitation_email(
            candidate=candidate,
            shortlist=shortlist,
            payload=outbound_email.payload_json,
            raw_token=raw_token,
        )
        try:
            smtp_result = self.smtp_client.send_candidate_invitation(
                recipient_email=outbound_email.recipient_email,
                subject=subject,
                body=body,
                html_body=html_body,
                jd_file_path=outbound_email.payload_json.get("jd_file_path"),
            )
            outbound_email.status = "SENT"
            outbound_email.provider_message_id = smtp_result["provider_message_id"]
            self.notification_repo.mark_email_sent(candidate_id=candidate.id)
            self.db.commit()
            self.db.refresh(outbound_email)
            return outbound_email
        except Exception as e:
            print(f"Email sending failed: {e}")
            self.db.rollback()
            outbound_email.status = "FAILED"
            self.db.add(outbound_email)
            self.db.commit()
            self.db.refresh(outbound_email)
            return outbound_email

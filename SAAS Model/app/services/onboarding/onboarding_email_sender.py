from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppException
from app.db.models.outbound_email import OutboundEmail
from app.db.repositories.candidate_notification_repo import CandidateNotificationRepository
from app.db.repositories.outbound_email_repo import OutboundEmailRepository
from app.integrations.smtp_client import SMTPClient
from app.services.onboarding.email_template_builder import EmailTemplateBuilder, EmailTemplateContext


class OnboardingEmailSender:
    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings
        self.smtp_client = SMTPClient(settings)
        self.email_repo = OutboundEmailRepository(db)
        self.notification_repo = CandidateNotificationRepository(db)
        self.template_builder = EmailTemplateBuilder()

    def send_queued_invitation(
        self,
        *,
        outbound_email: OutboundEmail,
        raw_token: str,
        jd_file_path: str,
    ) -> OutboundEmail:
        payload = outbound_email.payload_json
        context = EmailTemplateContext(
            candidate_name=payload["candidate_name"],
            position_name=payload["position_name"],
            resume_score=float(payload["resume_score"]),
            shortlist_reasons=payload["shortlist_reasons"],
            interview_topics=payload["interview_topics"],
            interview_instructions=payload.get("interview_instructions")
            or EmailTemplateBuilder.DEFAULT_INSTRUCTIONS,
            interview_url=payload["interview_url"],
            link_expiry=payload["expires_at"],
            company_name=payload["company_name"],
            recruiter_contact=payload["recruiter_contact"],
            skills=payload.get("skills"),
            interview_mode=payload.get("interview_mode") or payload.get("mode"),
            interview_duration=payload.get("interview_duration") or payload.get("duration"),
        )
        subject, html_body, plain_body = self.template_builder.build(context)

        try:
            smtp_result = self.smtp_client.send_candidate_invitation(
                recipient_email=outbound_email.recipient_email,
                subject=subject,
                body=plain_body,
                html_body=html_body,
                jd_file_path=jd_file_path,
            )
            outbound_email.status = "SENT"
            outbound_email.provider_message_id = smtp_result["provider_message_id"]
            self.notification_repo.mark_email_sent(candidate_id=outbound_email.candidate_id)
            self.db.commit()
            self.db.refresh(outbound_email)
            return outbound_email
        except Exception as exc:
            self.db.rollback()
            outbound_email.status = "FAILED"
            self.db.add(outbound_email)
            self.db.commit()
            self.db.refresh(outbound_email)
            raise AppException(message=f"SMTP failure: {exc}", status_code=502) from exc

from uuid import UUID

from celery.exceptions import MaxRetriesExceededError

from app.core.config import get_settings
from app.db.repositories.outbound_email_repo import OutboundEmailRepository
from app.db.session import SessionLocal
from app.services.email_dispatch_service import EmailDispatchService
from app.workers.celery_app import celery_app


@celery_app.task(
    name="email.dispatch_candidate_invitation",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def dispatch_candidate_invitation_email_task(self, outbound_email_id: str, raw_token: str) -> dict:
    """
    Send a candidate's interview invitation email.

    ``EmailDispatchService`` already marks the outbound_email row SENT or
    FAILED and never raises on an SMTP error (see
    app/services/email_dispatch_service.py). This task adds the missing
    piece: if the attempt came back FAILED (e.g. SMTP server temporarily
    unreachable), retry the *same* task up to 3 times with a 30s/60s/90s
    backoff before giving up. No business logic is duplicated here -- this
    task only decides *whether to try again*, the actual send/mark-status
    logic still lives entirely in EmailDispatchService.
    """
    db = SessionLocal()
    try:
        email_repo = OutboundEmailRepository(db)
        outbound_email = email_repo.get_by_id(UUID(outbound_email_id))
        if outbound_email is None:
            return {"success": False, "status": "FAILED", "message": "Outbound email not found"}

        service = EmailDispatchService(db, get_settings())
        sent_record = service.dispatch_candidate_invitation(outbound_email=outbound_email, raw_token=raw_token)

        if sent_record.status != "SENT":
            try:
                raise self.retry(countdown=30 * (self.request.retries + 1))
            except MaxRetriesExceededError:
                return {
                    "success": False,
                    "status": sent_record.status,
                    "message": "Max retries exceeded while sending candidate invitation email",
                }

        return {"success": True, "status": sent_record.status}
    finally:
        db.close()

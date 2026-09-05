import smtplib
import uuid
from email.message import EmailMessage
from pathlib import Path

from app.core.config import Settings


class SMTPClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _send_message(self, message: EmailMessage) -> dict:
        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=10) as smtp:
            if self.settings.smtp_use_tls:
                smtp.starttls()
            if self.settings.smtp_username and self.settings.smtp_password:
                smtp.login(self.settings.smtp_username, self.settings.smtp_password)
            smtp.send_message(message)
        return {"success": True, "provider_message_id": f"smtp-{uuid.uuid4()}"}

    def send_candidate_invitation(
        self,
        *,
        recipient_email: str,
        subject: str,
        body: str,
        html_body: str | None = None,
        jd_file_path: str | None = None,
    ) -> dict:
        message = EmailMessage()
        message["From"] = self.settings.smtp_sender_email
        message["To"] = recipient_email
        message["Subject"] = subject
        message.set_content(body)
        if html_body:
            message.add_alternative(html_body, subtype="html")

        if jd_file_path:
            file_path = Path(jd_file_path)
            if file_path.exists() and file_path.is_file():
                message.add_attachment(
                    file_path.read_bytes(),
                    maintype="application",
                    subtype="pdf",
                    filename=file_path.name,
                )
        return self._send_message(message)

    def send_recruiter_summary(self, *, recipient_email: str, subject: str, body: str) -> dict:
        message = EmailMessage()
        message["From"] = self.settings.smtp_sender_email
        message["To"] = recipient_email
        message["Subject"] = subject
        message.set_content(body)
        return self._send_message(message)

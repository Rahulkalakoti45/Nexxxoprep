from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.models.candidate import Candidate
from app.db.models.candidate_shortlist import CandidateShortlist
from app.db.models.outbound_email import OutboundEmail


class OutboundEmailRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_candidate_invite(self, *, candidate_id, recipient_email: str, payload: dict) -> OutboundEmail:
        row = OutboundEmail(
            candidate_id=candidate_id,
            recipient_email=recipient_email,
            template_key="candidate_invitation",
            payload_json=payload,
            status="QUEUED",
        )
        self.db.add(row)
        self.db.flush()
        return row

    def get_by_id(self, outbound_email_id) -> OutboundEmail | None:
        stmt = select(OutboundEmail).where(OutboundEmail.id == outbound_email_id)
        return self.db.scalar(stmt)

    def get_candidate_for_outbound(self, outbound_email_id):
        stmt = (
            select(Candidate)
            .join(OutboundEmail, OutboundEmail.candidate_id == Candidate.id)
            .where(OutboundEmail.id == outbound_email_id)
        )
        return self.db.scalar(stmt)

    def get_latest_shortlist(self, candidate_id):
        stmt = (
            select(CandidateShortlist)
            .where(CandidateShortlist.candidate_id == candidate_id)
            .order_by(CandidateShortlist.created_at.desc())
            .limit(1)
        )
        return self.db.scalar(stmt)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.constants import CandidateStatus
from app.db.models.candidate import Candidate


class CandidateRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_external_id(self, external_id: str) -> Candidate | None:
        stmt = select(Candidate).where(Candidate.candidate_external_id == external_id)
        return self.db.scalar(stmt)

    def upsert(self, *, external_id: str, name: str, email: str, phone: str) -> Candidate:
        candidate = self.get_by_external_id(external_id)
        if candidate is None:
            candidate = Candidate(
                candidate_external_id=external_id,
                name=name,
                email=email,
                phone=phone,
                candidate_status=CandidateStatus.SHORTLISTED,
            )
            self.db.add(candidate)
            self.db.flush()
            return candidate

        candidate.name = name
        candidate.email = email
        candidate.phone = phone
        return candidate

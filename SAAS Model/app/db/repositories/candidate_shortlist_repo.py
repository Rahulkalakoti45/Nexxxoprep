from sqlalchemy.orm import Session

from app.db.models.candidate_shortlist import CandidateShortlist


class CandidateShortlistRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        *,
        candidate_id,
        resume_score: float,
        shortlist_reasons: list[str],
        interview_topics: list[str],
    ) -> CandidateShortlist:
        row = CandidateShortlist(
            candidate_id=candidate_id,
            resume_score=resume_score,
            shortlist_reasons_json=shortlist_reasons,
            interview_topics_json=interview_topics,
        )
        self.db.add(row)
        self.db.flush()
        return row

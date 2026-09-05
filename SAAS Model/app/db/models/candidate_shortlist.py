import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, JSON, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CandidateShortlist(Base):
    __tablename__ = "candidate_shortlists"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    resume_score: Mapped[float] = mapped_column(Float, nullable=False)
    shortlist_reasons_json: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    interview_topics_json: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    candidate = relationship("Candidate", back_populates="shortlists")

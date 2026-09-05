import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import CandidateStatus
from app.db.base import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    candidate_external_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(32), nullable=False)
    candidate_status: Mapped[CandidateStatus] = mapped_column(
        Enum(CandidateStatus, name="candidate_status_enum", create_type=False),
        nullable=False,
        default=CandidateStatus.SHORTLISTED,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    shortlists = relationship("CandidateShortlist", back_populates="candidate")
    notifications = relationship("CandidateNotification", back_populates="candidate", uselist=False)
    interview_sessions = relationship("InterviewSession", back_populates="candidate")

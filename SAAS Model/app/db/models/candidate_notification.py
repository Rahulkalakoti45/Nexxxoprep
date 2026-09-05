import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CandidateNotification(Base):
    __tablename__ = "candidate_notifications"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("candidates.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    email_opened: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    interview_started: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    interview_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    candidate = relationship("Candidate", back_populates="notifications")

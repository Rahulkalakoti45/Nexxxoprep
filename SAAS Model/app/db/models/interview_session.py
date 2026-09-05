import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import InterviewSessionStatus
from app.db.base import Base


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    session_uuid: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, unique=True, index=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[InterviewSessionStatus] = mapped_column(
        Enum(InterviewSessionStatus, name="interview_session_status_enum", create_type=False),
        nullable=False,
        default=InterviewSessionStatus.CREATED,
        index=True,
    )

    candidate = relationship("Candidate", back_populates="interview_sessions")

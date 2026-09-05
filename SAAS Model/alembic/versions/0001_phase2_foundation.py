"""phase2 foundation tables

Revision ID: 0001_phase2_foundation
Revises:
Create Date: 2026-06-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_phase2_foundation"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    candidate_status_enum = sa.Enum(
        "SHORTLISTED",
        "INVITED",
        "INTERVIEW_STARTED",
        "INTERVIEW_COMPLETED",
        "FINAL_SELECTED",
        "REJECTED",
        name="candidate_status_enum",
    )
    session_status_enum = sa.Enum(
        "CREATED",
        "EXPIRED",
        "CONSUMED",
        name="interview_session_status_enum",
    )

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)

    op.create_table(
        "candidates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_external_id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("candidate_status", candidate_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("candidate_external_id"),
    )
    op.create_index(op.f("ix_candidates_candidate_external_id"), "candidates", ["candidate_external_id"], unique=False)
    op.create_index(op.f("ix_candidates_candidate_status"), "candidates", ["candidate_status"], unique=False)
    op.create_index(op.f("ix_candidates_email"), "candidates", ["email"], unique=False)

    op.create_table(
        "candidate_shortlists",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("resume_score", sa.Float(), nullable=False),
        sa.Column("shortlist_reasons_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("interview_topics_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "candidate_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_opened", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("interview_started", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("interview_completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("candidate_id"),
    )
    op.create_index(
        op.f("ix_candidate_notifications_candidate_id"), "candidate_notifications", ["candidate_id"], unique=True
    )

    op.create_table(
        "interview_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_uuid", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", session_status_enum, nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_uuid"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_interview_sessions_expires_at"), "interview_sessions", ["expires_at"], unique=False)
    op.create_index(op.f("ix_interview_sessions_session_uuid"), "interview_sessions", ["session_uuid"], unique=False)
    op.create_index(op.f("ix_interview_sessions_status"), "interview_sessions", ["status"], unique=False)
    op.create_index(op.f("ix_interview_sessions_token_hash"), "interview_sessions", ["token_hash"], unique=False)

    op.create_table(
        "outbound_emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("candidate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("recipient_email", sa.String(length=255), nullable=False),
        sa.Column("template_key", sa.String(length=64), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_outbound_emails_recipient_email"), "outbound_emails", ["recipient_email"], unique=False)

    op.create_table(
        "integration_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_system", sa.String(length=64), nullable=False),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("request_id", sa.String(length=128), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_system", "request_id", name="uq_integration_source_request"),
    )


def downgrade() -> None:
    op.drop_table("integration_events")
    op.drop_index(op.f("ix_outbound_emails_recipient_email"), table_name="outbound_emails")
    op.drop_table("outbound_emails")
    op.drop_index(op.f("ix_interview_sessions_token_hash"), table_name="interview_sessions")
    op.drop_index(op.f("ix_interview_sessions_status"), table_name="interview_sessions")
    op.drop_index(op.f("ix_interview_sessions_session_uuid"), table_name="interview_sessions")
    op.drop_index(op.f("ix_interview_sessions_expires_at"), table_name="interview_sessions")
    op.drop_table("interview_sessions")
    op.drop_index(op.f("ix_candidate_notifications_candidate_id"), table_name="candidate_notifications")
    op.drop_table("candidate_notifications")
    op.drop_table("candidate_shortlists")
    op.drop_index(op.f("ix_candidates_email"), table_name="candidates")
    op.drop_index(op.f("ix_candidates_candidate_status"), table_name="candidates")
    op.drop_index(op.f("ix_candidates_candidate_external_id"), table_name="candidates")
    op.drop_table("candidates")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    sa.Enum(name="interview_session_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="candidate_status_enum").drop(op.get_bind(), checkfirst=True)

from app.api.v1.schemas.dashboard import (
    CandidateRow,
    CandidatesListResponse,
    DashboardSummaryResponse,
    StatusBreakdownItem,
    StatusBreakdownResponse,
    TimelineEvent,
    TimelineResponse,
)
from app.core.constants import CandidateStatus
from app.db.repositories.dashboard_repo import DashboardRepository
from sqlalchemy.orm import Session


class DashboardService:
    def __init__(self, db: Session):
        self.repo = DashboardRepository(db)

    def get_summary(self) -> DashboardSummaryResponse:
        total = self.repo.count_candidates()
        shortlisted = self.repo.count_shortlisted()
        emails_queued = self.repo.count_outbound_by_status("QUEUED")
        emails_sent = self.repo.count_outbound_by_status("SENT")
        interview_started = self.repo.count_interview_started()
        interview_completed = self.repo.count_interview_completed()
        final_selected = self.repo.count_by_status(CandidateStatus.FINAL_SELECTED)
        rejected = self.repo.count_by_status(CandidateStatus.REJECTED)
        pending = max(
            0,
            total - interview_completed - final_selected - rejected,
        )
        return DashboardSummaryResponse(
            total_received=total,
            shortlisted=shortlisted,
            emails_queued=emails_queued,
            emails_sent=emails_sent,
            interview_started=interview_started,
            interview_completed=interview_completed,
            final_selected=final_selected,
            rejected=rejected,
            pending=pending,
        )

    def get_status_breakdown(self) -> StatusBreakdownResponse:
        breakdown = self.repo.status_breakdown()
        items = [StatusBreakdownItem(status=status, count=count) for status, count in breakdown]
        return StatusBreakdownResponse(items=items)

    def list_candidates(
        self,
        *,
        search: str | None = None,
        status: CandidateStatus | None = None,
    ) -> CandidatesListResponse:
        rows = self.repo.list_candidates(search=search, status=status)
        items = [
            CandidateRow(
                id=row["candidate"].id,
                candidate_external_id=row["candidate"].candidate_external_id,
                name=row["candidate"].name,
                email=row["candidate"].email,
                resume_score=row["resume_score"],
                candidate_status=row["candidate"].candidate_status,
                email_status=row["email_status"],
                interview_expires_at=row["interview_expires_at"],
            )
            for row in rows
        ]
        return CandidatesListResponse(total=len(items), items=items)

    def get_timeline(self) -> TimelineResponse:
        events: list[TimelineEvent] = []

        for event in self.repo.integration_events():
            if event.event_type != "SHORTLIST_RECEIVED":
                continue
            payload = event.payload_json or {}
            events.append(
                TimelineEvent(
                    id=f"integration-{event.id}",
                    event_type="shortlist_received",
                    label="Shortlist received",
                    candidate_name=payload.get("name"),
                    candidate_email=payload.get("email"),
                    occurred_at=event.created_at,
                    metadata={"source": event.source_system, "request_id": event.request_id},
                )
            )

        for email in self.repo.outbound_emails():
            candidate = self.repo.get_candidate(email.candidate_id)
            events.append(
                TimelineEvent(
                    id=f"email-generated-{email.id}",
                    event_type="email_generated",
                    label="Email generated",
                    candidate_name=candidate.name if candidate else None,
                    candidate_email=email.recipient_email,
                    occurred_at=email.created_at,
                    metadata={"status": email.status, "template": email.template_key},
                )
            )
            if email.status == "SENT":
                events.append(
                    TimelineEvent(
                        id=f"email-sent-{email.id}",
                        event_type="email_sent",
                        label="Email sent",
                        candidate_name=candidate.name if candidate else None,
                        candidate_email=email.recipient_email,
                        occurred_at=email.created_at,
                        metadata={"provider_message_id": email.provider_message_id},
                    )
                )

        for notification, candidate in self.repo.notifications_with_candidates():
            if notification.opened_at:
                events.append(
                    TimelineEvent(
                        id=f"link-opened-{notification.id}",
                        event_type="link_opened",
                        label="Link opened",
                        candidate_name=candidate.name,
                        candidate_email=candidate.email,
                        occurred_at=notification.opened_at,
                        metadata={},
                    )
                )
            if notification.interview_started:
                events.append(
                    TimelineEvent(
                        id=f"interview-started-{notification.id}",
                        event_type="interview_started",
                        label="Interview started",
                        candidate_name=candidate.name,
                        candidate_email=candidate.email,
                        occurred_at=notification.sent_at or candidate.updated_at,
                        metadata={},
                    )
                )
            if notification.interview_completed:
                events.append(
                    TimelineEvent(
                        id=f"interview-completed-{notification.id}",
                        event_type="interview_completed",
                        label="Interview completed",
                        candidate_name=candidate.name,
                        candidate_email=candidate.email,
                        occurred_at=candidate.updated_at,
                        metadata={},
                    )
                )
                events.append(
                    TimelineEvent(
                        id=f"vishwas-placeholder-{notification.id}",
                        event_type="vishwas_result",
                        label="Vishwas result received (future)",
                        candidate_name=candidate.name,
                        candidate_email=candidate.email,
                        occurred_at=candidate.updated_at,
                        metadata={"placeholder": True},
                    )
                )

        events.sort(key=lambda e: e.occurred_at, reverse=True)
        return TimelineResponse(items=events[:100])

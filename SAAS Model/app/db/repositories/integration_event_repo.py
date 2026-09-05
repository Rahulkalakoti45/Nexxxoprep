from sqlalchemy.orm import Session

from app.db.models.integration_event import IntegrationEvent


class IntegrationEventRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, *, source_system: str, event_type: str, request_id: str, payload: dict, status: str) -> IntegrationEvent:
        row = IntegrationEvent(
            source_system=source_system,
            event_type=event_type,
            request_id=request_id,
            payload_json=payload,
            status=status,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def update_status(self, *, row: IntegrationEvent, status: str) -> IntegrationEvent:
        row.status = status
        self.db.flush()
        return row

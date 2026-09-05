from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.v1.schemas.dashboard import (
    CandidatesListResponse,
    DashboardSummaryResponse,
    StatusBreakdownResponse,
    TimelineResponse,
)
from app.core.constants import CandidateStatus
from app.db.session import get_db
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(db: Session = Depends(get_db)):
    return DashboardService(db).get_summary()


@router.get("/candidates", response_model=CandidatesListResponse)
def dashboard_candidates(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    status: CandidateStatus | None = Query(default=None),
):
    return DashboardService(db).list_candidates(search=search, status=status)


@router.get("/timeline", response_model=TimelineResponse)
def dashboard_timeline(db: Session = Depends(get_db)):
    return DashboardService(db).get_timeline()


@router.get("/status-breakdown", response_model=StatusBreakdownResponse)
def dashboard_status_breakdown(db: Session = Depends(get_db)):
    return DashboardService(db).get_status_breakdown()

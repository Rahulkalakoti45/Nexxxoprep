from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.v1.schemas.interview import InterviewAccessResponse
from app.db.session import get_db
from app.services.interview_access_service import InterviewAccessService

router = APIRouter(prefix="/interview", tags=["interview"])


@router.get("/access", response_model=InterviewAccessResponse)
def access_interview(
    request: Request,
    session: UUID = Query(...),
    token: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
):
    result = InterviewAccessService(db).validate_access(session_uuid=session, token=token)
    return InterviewAccessResponse(
        success=True,
        message="Interview access granted",
        request_id=getattr(request.state, "request_id", "-"),
        **result,
    )

from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.api.v1.schemas.integration import YashShortlistPayload, YashShortlistResponse
from app.core.config import Settings, get_settings
from app.core.errors import AppException
from app.db.session import get_db
from app.services.candidate_intake_service import CandidateIntakeService

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.post("/yash/shortlists", response_model=YashShortlistResponse)
def intake_yash_shortlist(
    payload: YashShortlistPayload,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    x_api_key: str = Header(default=""),
    x_request_id: str = Header(default=""),
):
    print("YASH_API_KEY =", repr(settings.yash_api_key))
    print("HEADER =", repr(x_api_key))

    if settings.yash_api_key and x_api_key != settings.yash_api_key:
        raise AppException("Unauthorized integration request", status_code=401)

    if not x_request_id:
        raise AppException("x-request-id header is required", status_code=400)

    result = CandidateIntakeService(db=db, link_ttl_hours=settings.interview_link_ttl_hours).process_shortlist(
        payload=payload,
        request_id=x_request_id,
    )
    return YashShortlistResponse(
        success=True,
        message="Candidate shortlisted and invited successfully",
        request_id=x_request_id,
        **result,
    )

import json

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.schemas.demo import DemoEmailResponse, ParsedCandidateResponse
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.services.onboarding.demo_service import DemoService

router = APIRouter(prefix="/demo", tags=["demo"])


def _parse_csv_field(value: str) -> list[str]:
    value = value.strip()
    if not value:
        return []
    if value.startswith("["):
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    return [item.strip() for item in value.split(",") if item.strip()]


@router.post("/send-test-email", response_model=DemoEmailResponse)
async def send_test_email(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    resume: UploadFile | None = File(default=None),
    position_name: str = Form(default="Software Engineer"),
    resume_score: float = Form(default=85.0),
    shortlist_reasons: str = Form(
        default="Production ML Systems,Vector Databases,Retrieval Systems",
    ),
    interview_topics: str = Form(default="RAG,FAISS,Semantic Search"),
):
    file_bytes = await resume.read() if resume is not None else None
    filename = resume.filename if resume is not None else None

    result = DemoService(db=db, settings=settings).send_test_email(
        file_bytes=file_bytes,
        filename=filename,
        position_name=position_name,
        resume_score=resume_score,
        shortlist_reasons=_parse_csv_field(shortlist_reasons),
        interview_topics=_parse_csv_field(interview_topics),
    )

    return DemoEmailResponse(
        success=result["success"],
        email_sent_to=result["email_sent_to"],
        parsed_candidate=ParsedCandidateResponse(**result["parsed_candidate"]),
        session_uuid=result["session_uuid"],
        expires_at=result["expires_at"],
        message_id=result.get("message_id"),
    )

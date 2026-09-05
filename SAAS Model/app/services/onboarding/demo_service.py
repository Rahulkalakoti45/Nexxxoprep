from sqlalchemy.orm import Session
from app.core.config import Settings
from app.core.errors import AppException
from app.services.onboarding.candidate_onboarding_service import CandidateOnboardingService
from app.services.resume.demo_assets import ensure_demo_resume
from app.services.resume.parser import ResumeParserService


class DemoService:
    DEFAULT_SHORTLIST_REASONS = [
        "Production ML Systems",
        "Vector Databases",
        "Retrieval Systems",
    ]
    DEFAULT_INTERVIEW_TOPICS = [
        "RAG",
        "FAISS",
        "Semantic Search",
    ]

    def __init__(self, db: Session, settings: Settings):
        self.db = db
        self.settings = settings
        self.parser = ResumeParserService()
        self.onboarding = CandidateOnboardingService(db, settings)

    def send_test_email(
        self,
        *,
        file_bytes: bytes | None,
        filename: str | None,
        position_name: str,
        resume_score: float,
        shortlist_reasons: list[str] | None,
        interview_topics: list[str] | None,
    ) -> dict:
        parsed = self._parse_resume(file_bytes=file_bytes, filename=filename)
        return self.onboarding.process_onboarding(
            parsed=parsed,
            position_name=position_name,
            resume_score=resume_score,
            shortlist_reasons=shortlist_reasons or self.DEFAULT_SHORTLIST_REASONS,
            interview_topics=interview_topics or self.DEFAULT_INTERVIEW_TOPICS,
        )

    def _parse_resume(self, *, file_bytes: bytes | None, filename: str | None):
        if file_bytes is not None and filename:
            if not file_bytes:
                raise AppException("Invalid resume: uploaded file is empty", status_code=400)
            return self.parser.parse_bytes(file_bytes, filename)

        demo_path = ensure_demo_resume(self.settings.demo_resume_path)
        return self.parser.parse_file(str(demo_path))

from pathlib import Path

from app.core.errors import AppException
from app.services.resume.candidate_extractor import CandidateExtractor
from app.services.resume.docx_parser import extract_text_from_docx
from app.services.resume.models import ParsedResume
from app.services.resume.pdf_parser import extract_text_from_pdf

SUPPORTED_EXTENSIONS = {".pdf", ".docx"}


class ResumeParserService:
    def __init__(self):
        self.extractor = CandidateExtractor()

    def parse_bytes(self, file_bytes: bytes, filename: str) -> ParsedResume:
        extension = Path(filename).suffix.lower()
        if extension not in SUPPORTED_EXTENSIONS:
            raise AppException(
                f"Unsupported resume format '{extension}'. Supported: PDF, DOCX",
                status_code=400,
            )
        if extension == ".pdf":
            text = extract_text_from_pdf(file_bytes)
        else:
            text = extract_text_from_docx(file_bytes)
        return self.extractor.extract(text)

    def parse_file(self, file_path: str) -> ParsedResume:
        path = Path(file_path)
        if not path.exists():
            raise AppException(f"Resume file not found: {file_path}", status_code=404)
        return self.parse_bytes(path.read_bytes(), path.name)

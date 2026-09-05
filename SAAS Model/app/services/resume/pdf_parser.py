from io import BytesIO

from pypdf import PdfReader

from app.core.errors import AppException


def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(BytesIO(file_bytes))
        pages = [page.extract_text() or "" for page in reader.pages]
        text = "\n".join(pages).strip()
        if not text:
            raise AppException("Unable to extract text from PDF resume", status_code=422)
        return text
    except AppException:
        raise
    except Exception as exc:
        raise AppException(f"PDF parsing failed: {exc}", status_code=422) from exc

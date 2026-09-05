from io import BytesIO

from docx import Document

from app.core.errors import AppException


def extract_text_from_docx(file_bytes: bytes) -> str:
    try:
        document = Document(BytesIO(file_bytes))
        paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
        text = "\n".join(paragraphs).strip()
        if not text:
            raise AppException("Unable to extract text from DOCX resume", status_code=422)
        return text
    except AppException:
        raise
    except Exception as exc:
        raise AppException(f"DOCX parsing failed: {exc}", status_code=422) from exc

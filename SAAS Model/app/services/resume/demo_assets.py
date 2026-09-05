from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def generate_demo_resume_pdf() -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    lines = [
        "Rahul Sharma",
        "rahul@gmail.com",
        "9876543210",
        "https://linkedin.com/in/rahulsharma",
        "https://github.com/rahulsharma",
        "",
        "Skills",
        "Python, FastAPI, PostgreSQL, RAG, FAISS, Semantic Search",
        "",
        "Experience",
        "Built production ML systems and retrieval pipelines.",
        "",
        "Education",
        "B.Tech Computer Science",
        "",
        "Projects",
        "Candidate Discovery Platform",
        "",
        "Certifications",
        "AWS Cloud Practitioner",
    ]

    y = height - 72
    for line in lines:
        pdf.drawString(72, y, line)
        y -= 18

    pdf.save()
    buffer.seek(0)
    return buffer.getvalue()


def ensure_demo_resume(path: str) -> Path:
    resume_path = Path(path)
    resume_path.parent.mkdir(parents=True, exist_ok=True)
    if not resume_path.exists():
        resume_path.write_bytes(generate_demo_resume_pdf())
    return resume_path

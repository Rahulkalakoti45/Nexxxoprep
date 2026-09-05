from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


class AttachmentBuilder:
    def __init__(self, jd_pdf_path: str, generated_dir: str = "app/assets/generated"):
        self.jd_pdf_path = Path(jd_pdf_path)
        self.generated_dir = Path(generated_dir)
        self.generated_dir.mkdir(parents=True, exist_ok=True)

    def resolve_jd_attachment(self, *, position_name: str, company_name: str) -> Path:
        if self.jd_pdf_path.exists() and self.jd_pdf_path.is_file():
            return self.jd_pdf_path
        return self._generate_placeholder_jd(position_name=position_name, company_name=company_name)

    def _generate_placeholder_jd(self, *, position_name: str, company_name: str) -> Path:
        output_path = self.generated_dir / "job_description_placeholder.pdf"
        pdf = canvas.Canvas(str(output_path), pagesize=letter)
        width, height = letter

        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(72, height - 72, f"{company_name} — Job Description")

        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(72, height - 110, f"Position: {position_name}")

        pdf.setFont("Helvetica", 11)
        body_lines = [
            "Role Overview:",
            "We are seeking a motivated professional to join our engineering team.",
            "",
            "Key Responsibilities:",
            "- Build scalable backend services and integrations.",
            "- Collaborate with cross-functional teams on product delivery.",
            "- Participate in code reviews and technical design discussions.",
            "",
            "Requirements:",
            "- Strong problem-solving and communication skills.",
            "- Experience with modern software development practices.",
            "",
            "This document was auto-generated for interview onboarding.",
        ]
        y = height - 150
        for line in body_lines:
            pdf.drawString(72, y, line)
            y -= 16

        pdf.save()
        return output_path

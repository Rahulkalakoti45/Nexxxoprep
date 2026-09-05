import re

from app.services.resume.models import ParsedResume

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}\b")
LINKEDIN_PATTERN = re.compile(r"(https?://(?:www\.)?linkedin\.com/in/[A-Za-z0-9\-_%/]+)", re.IGNORECASE)
GITHUB_PATTERN = re.compile(r"(https?://(?:www\.)?github\.com/[A-Za-z0-9\-_]+)", re.IGNORECASE)

SECTION_HEADERS = {
    "skills": ("skills", "technical skills", "core competencies"),
    "experience": ("experience", "work experience", "professional experience", "employment"),
    "education": ("education", "academic background"),
    "projects": ("projects", "personal projects"),
    "certifications": ("certifications", "certificates", "licenses"),
}


class CandidateExtractor:
    def extract(self, text: str) -> ParsedResume:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        email = self._first_match(EMAIL_PATTERN, text)
        phone = self._normalize_phone(self._first_match(PHONE_PATTERN, text))
        linkedin = self._first_match(LINKEDIN_PATTERN, text)
        github = self._first_match(GITHUB_PATTERN, text)
        name = self._extract_name(lines, email)
        sections = self._extract_sections(lines)

        return ParsedResume(
            name=name,
            email=email,
            phone=phone,
            skills=sections["skills"],
            experience=sections["experience"],
            education=sections["education"],
            projects=sections["projects"],
            certifications=sections["certifications"],
            linkedin_url=linkedin,
            github_url=github,
            raw_text=text,
        )

    def _first_match(self, pattern: re.Pattern[str], text: str) -> str | None:
        match = pattern.search(text)
        return match.group(0).strip() if match else None

    def _normalize_phone(self, phone: str | None) -> str | None:
        if not phone:
            return None
        digits = re.sub(r"\D", "", phone)
        if len(digits) < 10:
            return phone.strip()
        return digits[-10:]

    def _extract_name(self, lines: list[str], email: str | None) -> str | None:
        for line in lines[:5]:
            if email and email in line:
                continue
            if "@" in line or "http" in line.lower():
                continue
            if len(line.split()) <= 5 and re.match(r"^[A-Za-z .'-]+$", line):
                return line.title()
        return None

    def _extract_sections(self, lines: list[str]) -> dict[str, list[str]]:
        sections = {key: [] for key in SECTION_HEADERS}
        current: str | None = None

        for line in lines:
            normalized = line.lower().strip(":").strip()
            matched = next(
                (key for key, headers in SECTION_HEADERS.items() if normalized in headers),
                None,
            )
            if matched:
                current = matched
                continue
            if current and not self._is_header_line(line):
                sections[current].append(line)

        return {key: values[:10] for key, values in sections.items()}

    def _is_header_line(self, line: str) -> bool:
        normalized = line.lower().strip(":").strip()
        return any(normalized in headers for headers in SECTION_HEADERS.values())

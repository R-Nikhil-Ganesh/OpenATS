import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class NormalizedResume:
    raw_text: str           # cleaned version of the full markdown
    contact_section: str
    experience_section: str
    education_section: str
    skills_section: str
    summary_section: str
    other_sections: str
    candidate_name: Optional[str]
    candidate_email: Optional[str]
    candidate_phone: Optional[str]
    word_count: int


# ---------------------------------------------------------------------------
# Section header detection patterns (order matters – first match wins)
# ---------------------------------------------------------------------------
_SECTION_PATTERNS: dict[str, str] = {
    "summary":    r"(?i)\b(summary|objective|profile|about|overview)\b",
    "experience": r"(?i)\b((work\s+)?experience|employment|career|professional\s+history)\b",
    "education":  r"(?i)\b(education|academic|degree|university|college)\b",
    "skills":     r"(?i)\b(skills?|technical\s+skills?|competencies|technologies|tools)\b",
    "contact":    r"(?i)\b(contact|personal\s+info(rmation)?)\b",
}


def _strip_markdown(text: str) -> str:
    """Remove common Markdown formatting artifacts from a string."""
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)   # **bold**
    text = re.sub(r"\*([^*]+)\*", r"\1", text)        # *italic*
    text = re.sub(r"__([^_]+)__", r"\1", text)        # __bold__
    text = re.sub(r"_([^_]+)_", r"\1", text)          # _italic_
    text = re.sub(r"#{1,6}\s+", "", text)              # # headings
    text = re.sub(r"[-–—]{3,}", "---", text)           # horizontal rules
    text = re.sub(r"`{1,3}[^`]*`{1,3}", "", text)     # inline code / fences
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # [link](url)
    text = re.sub(r"\n{3,}", "\n\n", text)             # collapse blank lines
    return text.strip()


def _detect_section(line: str) -> Optional[str]:
    """
    Return the section key if *line* looks like a section header, else None.
    A header is a short line (< 60 chars) that matches one of the patterns.
    """
    stripped = line.strip()
    if not stripped or len(stripped) >= 60:
        return None
    for section, pattern in _SECTION_PATTERNS.items():
        if re.search(pattern, stripped):
            return section
    return None


def normalize_resume(markdown: str) -> NormalizedResume:
    """
    Clean and section-detect a resume given as raw Markdown.

    Sections are detected heuristically by scanning for header-like lines;
    content between headers is grouped under the detected section key.
    """
    # ── 1. Clean ────────────────────────────────────────────────────────────
    text = _strip_markdown(markdown)

    # ── 2. Contact extraction ────────────────────────────────────────────────
    email_match = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", text)
    candidate_email = email_match.group(0).lower() if email_match else None

    phone_match = re.search(
        r"[\+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,3}[)]?[-\s.]?[0-9]{3,4}[-\s.]?[0-9]{3,4}",
        text,
    )
    candidate_phone = phone_match.group(0).strip() if phone_match else None

    # Name: first non-empty line that isn't an email/phone and is reasonably short
    non_empty_lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    candidate_name: Optional[str] = None
    for ln in non_empty_lines:
        if len(ln) < 80 and not re.search(r"[@\d{3}]", ln):
            candidate_name = ln
            break

    # ── 3. Section splitting ────────────────────────────────────────────────
    section_content: dict[str, list[str]] = {
        "summary": [],
        "experience": [],
        "education": [],
        "skills": [],
        "contact": [],
        "other": [],
    }

    current_section = "other"
    for line in text.split("\n"):
        detected = _detect_section(line)
        if detected is not None:
            current_section = detected
        else:
            section_content[current_section].append(line)

    def _join(key: str) -> str:
        return "\n".join(section_content.get(key, [])).strip()

    return NormalizedResume(
        raw_text=text,
        contact_section=_join("contact"),
        experience_section=_join("experience"),
        education_section=_join("education"),
        skills_section=_join("skills"),
        summary_section=_join("summary"),
        other_sections=_join("other"),
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        candidate_phone=candidate_phone,
        word_count=len(text.split()),
    )

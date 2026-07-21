import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Optional, Tuple

import httpx
from pydantic import BaseModel, Field

from config import config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Load the system prompt once at import time
# ---------------------------------------------------------------------------
_PROMPT_PATH = Path(__file__).parent / "prompts" / "profile_prompt.txt"
PROFILE_SYSTEM_PROMPT: str = _PROMPT_PATH.read_text(encoding="utf-8")

# Same rationale as scorer.py: local single-instance servers queue badly under
# unbounded concurrency, so cap in-flight requests to this backend.
_llm_semaphore = asyncio.Semaphore(config.vllm_max_concurrent_requests)


def _describe_error(exc: Exception) -> str:
    """httpx timeout/connection errors often stringify to '' — always include the type."""
    text = str(exc)
    return f"{type(exc).__name__}: {text}" if text else type(exc).__name__


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------

class ProfileLinks(BaseModel):
    linkedin: str = ""
    github: str = ""
    portfolio: str = ""


class ExperienceItem(BaseModel):
    title: str = ""
    company: str = ""
    duration: str = ""
    highlights: list[str] = []


class EducationItem(BaseModel):
    degree: str = ""
    institution: str = ""
    year: str = ""


class ResumeProfile(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    links: ProfileLinks = Field(default_factory=ProfileLinks)
    summary: str = ""
    skills: list[str] = []
    experience: list[ExperienceItem] = []
    education: list[EducationItem] = []


# ---------------------------------------------------------------------------
# Helper: strip markdown code fences that the model might accidentally emit
# ---------------------------------------------------------------------------

def _strip_code_fences(raw: str) -> str:
    """Remove leading/trailing ``` or ```json fences from model output."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[\w]*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```$", "", cleaned)
    return cleaned.strip()


# ---------------------------------------------------------------------------
# Main profile-building function
# ---------------------------------------------------------------------------

async def build_profile(
    resume_markdown: str,
    model_name: Optional[str] = None,
    max_retries: int = 3,
) -> Tuple[ResumeProfile, str]:
    """
    Call the configured OpenAI-compatible LLM endpoint to turn a resume's
    markdown into a structured, JD-independent candidate profile.

    Returns
    -------
    (ResumeProfile, raw_response_text)
        A validated Pydantic model and the raw string returned by the LLM.

    Raises
    ------
    RuntimeError
        If all retry attempts fail (JSON parse error or HTTP error).
    """
    model = model_name or config.vllm_profile_model

    # Truncate to stay within context limits (same ceiling as scorer.py's resume input)
    resume_snippet = resume_markdown[:6_000]

    user_prompt = f"Resume:\n{resume_snippet}\n\nNow output the JSON profile:"

    last_error: Optional[Exception] = None

    async with httpx.AsyncClient(timeout=config.vllm_timeout_seconds) as client:
        for attempt in range(max_retries):
            try:
                async with _llm_semaphore:
                    response = await client.post(
                        f"{config.vllm_base_url}/v1/chat/completions",
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": PROFILE_SYSTEM_PROMPT},
                                {"role": "user", "content": user_prompt},
                            ],
                            "max_tokens": config.vllm_profile_max_tokens,
                            "temperature": config.vllm_temperature,
                            "response_format": {"type": "json_object"},
                        },
                        headers={"Content-Type": "application/json"},
                    )
                response.raise_for_status()

                data = response.json()
                raw_content: str = data["choices"][0]["message"]["content"]

                clean = _strip_code_fences(raw_content)

                parsed_dict = json.loads(clean)
                result = ResumeProfile(**parsed_dict)

                logger.info(
                    "Profile built (attempt %d): name=%s skills=%d experience=%d",
                    attempt + 1,
                    result.name or "?",
                    len(result.skills),
                    len(result.experience),
                )
                return result, raw_content

            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "Profile attempt %d/%d failed (parse error): %s. Retrying…",
                    attempt + 1,
                    max_retries,
                    exc,
                )
                await asyncio.sleep(2**attempt)  # exponential back-off: 1s, 2s, 4s

            except httpx.HTTPStatusError as exc:
                last_error = exc
                logger.error(
                    "vLLM returned HTTP %d on attempt %d/%d: %s",
                    exc.response.status_code,
                    attempt + 1,
                    max_retries,
                    exc.response.text[:500],
                )
                await asyncio.sleep(5)

            except httpx.RequestError as exc:
                last_error = exc
                logger.error(
                    "vLLM connection error on attempt %d/%d: %s",
                    attempt + 1,
                    max_retries,
                    _describe_error(exc),
                )
                await asyncio.sleep(5)

    raise RuntimeError(
        f"Profile build failed after {max_retries} attempts. "
        f"Last error: {_describe_error(last_error) if last_error else 'unknown'}"
    )

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
_PROMPT_PATH = Path(__file__).parent / "prompts" / "scoring_prompt.txt"
SCORING_SYSTEM_PROMPT: str = _PROMPT_PATH.read_text(encoding="utf-8")

# Local single-instance LLM servers (Ollama, single-GPU vLLM) generally can't
# handle several scoring calls in parallel without each one queueing behind the
# others until it exceeds the client timeout. Serialize calls to the backend
# regardless of how many resumes the worker is processing concurrently.
_llm_semaphore = asyncio.Semaphore(config.vllm_max_concurrent_requests)


def _describe_error(exc: Exception) -> str:
    """httpx timeout/connection errors often stringify to '' — always include the type."""
    text = str(exc)
    return f"{type(exc).__name__}: {text}" if text else type(exc).__name__


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------

class MatchedSkill(BaseModel):
    skill: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str = ""


class Reasons(BaseModel):
    strengths: list[str] = []
    weaknesses: list[str] = []
    cultural_fit_notes: str = ""


class ScoringResult(BaseModel):
    tier: str = Field(pattern=r"^[ABC]$")
    score: int = Field(ge=0, le=100)
    matched_skills: list[MatchedSkill] = []
    missing_requirements: list[str] = []
    reasons: Reasons = Field(default_factory=Reasons)
    recommendation: str = ""


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
# Main scoring function
# ---------------------------------------------------------------------------

async def score_resume(
    job_description: str,
    normalized_resume: str,
    model_name: Optional[str] = None,
    max_retries: int = 3,
) -> Tuple[ScoringResult, str]:
    """
    Call the vLLM OpenAI-compatible endpoint with Qwen3-8B to score a resume
    against a job description.

    Returns
    -------
    (ScoringResult, raw_response_text)
        A validated Pydantic model and the raw string returned by the LLM.

    Raises
    ------
    RuntimeError
        If all retry attempts fail (JSON parse error or HTTP error).
    """
    model = model_name or config.vllm_model

    # Truncate inputs to stay within context limits
    jd_snippet = job_description[:4_000]
    resume_snippet = normalized_resume[:6_000]

    user_prompt = (
        f"Job Description:\n{jd_snippet}\n\n"
        f"---\n\n"
        f"Resume:\n{resume_snippet}\n\n"
        f"Now output the JSON evaluation:"
    )

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
                                {"role": "system", "content": SCORING_SYSTEM_PROMPT},
                                {"role": "user", "content": user_prompt},
                            ],
                            "max_tokens": config.vllm_max_tokens,
                            "temperature": config.vllm_temperature,
                            # Ask vLLM to enforce JSON output (supported by vLLM ≥ 0.4)
                            "response_format": {"type": "json_object"},
                            # Ollama-specific: skip chain-of-thought for hybrid
                            # reasoning models (e.g. Qwen3) so the token budget
                            # goes to the JSON answer instead of "thinking".
                            # Ignored by servers that don't recognize it.
                            "think": False,
                        },
                        headers={"Content-Type": "application/json"},
                    )
                response.raise_for_status()

                data = response.json()
                raw_content: str = data["choices"][0]["message"]["content"]

                # Best-effort cleanup in case the model wraps in fences
                clean = _strip_code_fences(raw_content)

                parsed_dict = json.loads(clean)
                result = ScoringResult(**parsed_dict)

                logger.info(
                    "Scoring complete (attempt %d): tier=%s score=%d",
                    attempt + 1,
                    result.tier,
                    result.score,
                )
                return result, raw_content

            except (json.JSONDecodeError, ValueError) as exc:
                last_error = exc
                logger.warning(
                    "Scoring attempt %d/%d failed (parse error): %s. Retrying…",
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
        f"Scoring failed after {max_retries} attempts. "
        f"Last error: {_describe_error(last_error) if last_error else 'unknown'}"
    )

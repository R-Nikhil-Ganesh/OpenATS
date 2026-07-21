"""
One-off backfill: build structured profiles for resumes that were processed
before the profile-extraction step existed.

Finds every resume with extracted_markdown already stored but no profile_json
yet, and runs the same build_profile() the live pipeline uses (main.py Step
2.5) so the two paths never drift apart.

Usage (inside the resume_worker container/venv):
    python backfill_profiles.py [--limit N] [--dry-run]
"""

import argparse
import asyncio
import logging

from config import config
from db import TransactionDB, close_pool, get_pool, get_setting
from profiler import build_profile

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("backfill_profiles")


async def _fetch_pending(limit: int) -> list[dict]:
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, extracted_markdown
            FROM resumes
            WHERE extracted_markdown IS NOT NULL
              AND profile_json IS NULL
            ORDER BY created_at ASC
            LIMIT $1
            """,
            limit,
        )
    return [dict(r) for r in rows]


async def _apply_profile(resume_id: str, profile, profile_model: str, dry_run: bool) -> None:
    if dry_run:
        logger.info("[dry-run] resume=%s name=%s skills=%d", resume_id, profile.name or "?", len(profile.skills))
        return

    async with TransactionDB() as conn:
        await conn.execute(
            """
            UPDATE resumes
            SET profile_json  = $1,
                profile_model = $2,
                profiled_at   = now(),
                updated_at    = now()
            WHERE id = $3
            """,
            profile.model_dump_json(),
            profile_model,
            resume_id,
        )

        if profile.email or profile.name or profile.links.linkedin or profile.links.github:
            await conn.execute(
                """
                UPDATE candidates
                SET full_name    = COALESCE(full_name, $1),
                    email        = COALESCE(email, NULLIF($2, '')),
                    phone        = COALESCE(phone, NULLIF($3, '')),
                    linkedin_url = COALESCE(linkedin_url, NULLIF($4, '')),
                    github_url   = COALESCE(github_url, NULLIF($5, '')),
                    location     = COALESCE(location, NULLIF($6, '')),
                    updated_at   = now()
                WHERE id = (
                    SELECT candidate_id FROM resumes WHERE id = $7
                )
                """,
                profile.name or None,
                profile.email,
                profile.phone,
                profile.links.linkedin,
                profile.links.github,
                profile.location,
                resume_id,
            )


async def run(limit: int, dry_run: bool) -> None:
    await get_pool()
    profile_model = await get_setting("profile_model", config.vllm_profile_model)
    logger.info("Backfilling profiles with model=%s (limit=%d, dry_run=%s)", profile_model, limit, dry_run)

    resumes = await _fetch_pending(limit)
    logger.info("Found %d resume(s) needing a profile", len(resumes))

    done = 0
    failed = 0
    for row in resumes:
        resume_id = str(row["id"])
        markdown = row["extracted_markdown"]
        try:
            profile, _raw = await build_profile(markdown, model_name=profile_model)
            await _apply_profile(resume_id, profile, profile_model, dry_run)
            done += 1
            logger.info("✓ resume=%s (%d/%d)", resume_id, done + failed, len(resumes))
        except Exception as exc:
            failed += 1
            logger.error("✗ resume=%s failed: %s", resume_id, exc)

    logger.info("Backfill complete: %d succeeded, %d failed, %d total", done, failed, len(resumes))
    await close_pool()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=10_000, help="Max resumes to process in this run")
    parser.add_argument("--dry-run", action="store_true", help="Build profiles but don't write them to the DB")
    args = parser.parse_args()
    asyncio.run(run(limit=args.limit, dry_run=args.dry_run))


if __name__ == "__main__":
    main()

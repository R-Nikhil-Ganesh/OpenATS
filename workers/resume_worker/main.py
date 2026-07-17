import asyncio
import json
import logging
import signal
import traceback
from datetime import datetime, timezone

import asyncpg
from bullmq import Job, Worker

from config import config
from db import (
    TransactionDB,
    close_pool,
    find_application,
    get_candidate_by_email,
    get_pool,
    get_setting,
    record_candidate_conflict,
    update_application_status,
    update_processing_job,
)
from embedder import embed_text, get_model
from extractor import extract_pdf_to_markdown
from normalizer import normalize_resume
from profiler import build_profile
from scorer import score_resume

# ---------------------------------------------------------------------------
# Logging configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("resume_worker")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _utcnow() -> datetime:
    """Return a timezone-aware UTC datetime."""
    return datetime.now(tz=timezone.utc)


async def _fail_job(
    application_id: str,
    proc_job_id: str,
    error_message: str,
) -> None:
    """
    Best-effort: mark the processing job as failed and reset the application
    status back to 'uploaded' so the job can be retried manually.
    Swallows all inner exceptions to avoid masking the original error.
    """
    try:
        await update_application_status(application_id, "uploaded")
    except Exception as inner:
        logger.error("_fail_job: could not reset application status: %s", inner)

    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE resume_processing_jobs
                SET status = 'failed',
                    error_message = $1,
                    updated_at = now()
                WHERE id = $2
                """,
                error_message,
                proc_job_id,
            )
    except Exception as inner:
        logger.error("_fail_job: could not update processing job: %s", inner)


async def _pause_for_candidate_conflict(
    *,
    application_id: str,
    proc_job_id: str,
    job_id: str,
    extracted_email: str,
    extracted_name: str,
    step: str,
) -> None:
    """
    Called when merging extracted resume fields into ``candidates`` hit a
    unique-email collision with a different, pre-existing candidate. Instead
    of letting that exception crash the job (which just retries into the
    same error 3x and leaves the application frozen), look up who the
    collision is with and pause the application for a recruiter decision.
    """
    conflicting_candidate = await get_candidate_by_email(extracted_email) if extracted_email else None
    conflicting_application = None
    if conflicting_candidate:
        conflicting_application = await find_application(conflicting_candidate["id"], job_id)

    conflict_payload = {
        "extracted_email": extracted_email,
        "extracted_name": extracted_name,
        "conflicting_candidate_id": str(conflicting_candidate["id"]) if conflicting_candidate else None,
        "conflicting_candidate_name": conflicting_candidate["full_name"] if conflicting_candidate else None,
        "conflicting_application_id": str(conflicting_application["id"]) if conflicting_application else None,
        # Same candidate + same job already has an application → this upload
        # is a newer resume for that same application. Different job → this
        # is genuinely the same person applying elsewhere; merge identities.
        "conflict_type": "same_job_duplicate" if conflicting_application else "cross_job_merge",
        "detected_at_step": step,
    }
    logger.warning(
        "Candidate email conflict for app %s: email=%s conflicting_candidate=%s type=%s",
        application_id,
        extracted_email,
        conflict_payload["conflicting_candidate_id"],
        conflict_payload["conflict_type"],
    )
    await record_candidate_conflict(application_id, proc_job_id, conflict_payload)


async def _process_profile_only(application_id: str, resume_id: str, keep_separate: bool) -> dict:
    """
    Lightweight on-demand path: (re-)generate a resume's structured profile
    without touching extraction/embedding/scoring. Triggered by the API when
    a candidate detail page is opened and no profile exists yet — profiling
    is JD-independent and scoring never reads it, so it doesn't need to run
    on the critical path of every upload.
    """
    async with TransactionDB() as conn:
        resume_row = await conn.fetchrow(
            "SELECT extracted_markdown FROM resumes WHERE id = $1", resume_id
        )
    if not resume_row or not resume_row["extracted_markdown"]:
        logger.warning("Profile-only job for resume %s: no extracted_markdown yet", resume_id)
        return {"status": "no_markdown"}

    normalized = normalize_resume(resume_row["extracted_markdown"])

    profile_model = await get_setting("profile_model", config.vllm_profile_model)
    profile, _raw_profile = await build_profile(normalized.raw_text, model_name=profile_model)

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

    merge_profile_email = None if keep_separate else profile.email
    if merge_profile_email or profile.name or profile.links.linkedin or profile.links.github:
        try:
            async with TransactionDB() as conn:
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
                        SELECT candidate_id FROM applications WHERE id = $7
                    )
                    """,
                    profile.name or None,
                    merge_profile_email,
                    profile.phone,
                    profile.links.linkedin,
                    profile.links.github,
                    profile.location,
                    application_id,
                )
        except asyncpg.exceptions.UniqueViolationError:
            # Unlike the upload-time merge (Step 2), this can run long after
            # the application has already progressed past review — silently
            # skip the enrichment merge rather than pausing an in-progress
            # application over a background contact-info fetch.
            logger.warning(
                "Profile-only job for app %s: candidate email merge skipped "
                "(conflicts with an existing candidate)",
                application_id,
            )

    logger.info("Profile built on-demand for resume %s (model=%s)", resume_id, profile_model)
    return {"status": "profiled"}


# ---------------------------------------------------------------------------
# Main processing pipeline
# ---------------------------------------------------------------------------

async def process_resume(job: Job, job_token: str) -> dict:
    """
    BullMQ processor function – called once per job.

    Expected job.data shape:
    {
        "applicationId": str,
        "resumePath":    str,   # absolute path on the worker's filesystem
        "jobId":         str,   # job_requisition id
        "reprocess":     bool,  # optional
        "stage":         str,   # optional hint
        "keepSeparate":  bool,  # optional — recruiter chose to keep this
                                # candidate distinct after a prior email
                                # conflict; skip re-merging the email so we
                                # don't immediately hit the same conflict.
        "profileOnly":   bool,  # optional — skip straight to the on-demand
                                # profile-generation path (see
                                # _process_profile_only); requires "resumeId"
                                # instead of "resumePath"/"jobId".
        "resumeId":      str,   # required when profileOnly is set
    }
    """
    data: dict = job.data
    application_id: str = data["applicationId"]
    keep_separate: bool = bool(data.get("keepSeparate"))

    if data.get("profileOnly"):
        resume_id: str = data["resumeId"]
        logger.info(
            "▶  Profile-only job %s | app=%s | resume=%s",
            job.id,
            application_id,
            resume_id,
        )
        return await _process_profile_only(application_id, resume_id, keep_separate)

    resume_path: str = data["resumePath"]

    logger.info(
        "▶  Job %s | app=%s | path=%s",
        job.id,
        application_id,
        resume_path,
    )

    # ── Fetch DB records ────────────────────────────────────────────────────
    async with TransactionDB() as conn:
        proc_job_row = await conn.fetchrow(
            """
            SELECT id
            FROM resume_processing_jobs
            WHERE application_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            application_id,
        )
        if not proc_job_row:
            raise RuntimeError(
                f"No processing job record found for application {application_id}"
            )
        proc_job_id: str = str(proc_job_row["id"])

        app_row = await conn.fetchrow(
            """
            SELECT jr.raw_jd,
                   jr.normalized_jd,
                   r.id AS resume_id
            FROM   applications a
            JOIN   job_requisitions jr ON a.job_id  = jr.id
            JOIN   resumes          r  ON a.resume_id = r.id
            WHERE  a.id = $1
            """,
            application_id,
        )
        if not app_row:
            raise RuntimeError(f"Application {application_id} not found")

        jd_text: str = app_row["normalized_jd"] or app_row["raw_jd"] or ""
        resume_id: str = str(app_row["resume_id"])

    # ── Step 1: PDF Extraction ───────────────────────────────────────────────
    await update_application_status(application_id, "extracting")
    await update_processing_job(
        proc_job_id,
        status="extracting",
        progress=10,
        started_at=_utcnow(),
    )
    await job.updateProgress(10)

    try:
        extraction = extract_pdf_to_markdown(resume_path)
    except Exception as exc:
        err_msg = f"Extraction failed: {exc}\n{traceback.format_exc()}"
        logger.error(err_msg)
        await _fail_job(application_id, proc_job_id, err_msg)
        raise

    # ── Step 2: Normalise ────────────────────────────────────────────────────
    normalized = normalize_resume(extraction["markdown"])
    logger.info(
        "Normalised resume: name=%s email=%s words=%d",
        normalized.candidate_name,
        normalized.candidate_email,
        normalized.word_count,
    )

    async with TransactionDB() as conn:
        await conn.execute(
            """
            UPDATE resumes
            SET extracted_markdown  = $1,
                extraction_metadata = $2,
                content_hash        = $3,
                extracted_at        = now(),
                updated_at          = now()
            WHERE id = $4
            """,
            extraction["markdown"],
            json.dumps(extraction["extraction_metadata"]),
            extraction["content_hash"],
            resume_id,
        )

    merge_email = None if keep_separate else normalized.candidate_email
    if merge_email or normalized.candidate_name:
        try:
            async with TransactionDB() as conn:
                await conn.execute(
                    """
                    UPDATE candidates
                    SET full_name  = COALESCE($1, full_name),
                        email      = COALESCE(NULLIF($2, ''), email),
                        phone      = COALESCE($3, phone),
                        updated_at = now()
                    WHERE id = (
                        SELECT candidate_id FROM applications WHERE id = $4
                    )
                    """,
                    normalized.candidate_name,
                    merge_email or "",
                    normalized.candidate_phone,
                    application_id,
                )
        except asyncpg.exceptions.UniqueViolationError:
            await _pause_for_candidate_conflict(
                application_id=application_id,
                proc_job_id=proc_job_id,
                job_id=data["jobId"],
                extracted_email=normalized.candidate_email,
                extracted_name=normalized.candidate_name,
                step="normalize",
            )
            return {"status": "duplicate_candidate"}

    await update_application_status(application_id, "extracted")
    await update_processing_job(
        proc_job_id, status="extracted", progress=50
    )
    await job.updateProgress(50)

    # Step 2.5 (structured profile extraction) is no longer run automatically
    # here — it's JD-independent and scoring never reads it (see
    # _process_profile_only), so it's generated lazily on first view of the
    # candidate detail page instead of on every upload's critical path.

    # ── Step 3: Embedding ────────────────────────────────────────────────────
    try:
        embedding = embed_text(normalized.raw_text)
        # pgvector accepts the string representation '[0.1,0.2,…]'
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

        async with TransactionDB() as conn:
            await conn.execute(
                """
                INSERT INTO resume_embeddings
                    (resume_id, model_name, embedding)
                VALUES ($1, $2, $3::vector)
                ON CONFLICT (resume_id, model_name)
                DO UPDATE SET embedding   = EXCLUDED.embedding,
                              created_at  = now()
                """,
                resume_id,
                config.embedding_model,
                embedding_str,
            )
        logger.info("Embedding stored for resume %s", resume_id)
    except Exception as exc:
        # Embedding failure is non-fatal; log and continue
        logger.warning("Embedding step failed (non-fatal): %s", exc)

    # ── Step 4: Score with vLLM ──────────────────────────────────────────────
    await update_application_status(application_id, "scoring")
    await update_processing_job(
        proc_job_id, status="scoring", progress=60
    )
    await job.updateProgress(60)

    resume_text_for_scoring = (
        f"Name: {normalized.candidate_name or 'Unknown'}\n\n"
        f"SUMMARY:\n{normalized.summary_section or 'N/A'}\n\n"
        f"EXPERIENCE:\n{normalized.experience_section or 'N/A'}\n\n"
        f"EDUCATION:\n{normalized.education_section or 'N/A'}\n\n"
        f"SKILLS:\n{normalized.skills_section or 'N/A'}"
    )

    # The scoring model is user-selectable from the Settings page; fall back
    # to the configured default if nothing has been saved.
    scoring_model = await get_setting("scoring_model", config.vllm_model)

    try:
        scoring_result, raw_response = await score_resume(
            job_description=jd_text,
            normalized_resume=resume_text_for_scoring,
            model_name=scoring_model,
        )
    except Exception as exc:
        err_msg = f"Scoring failed: {exc}\n{traceback.format_exc()}"
        logger.error(err_msg)
        await _fail_job(application_id, proc_job_id, err_msg)
        raise

    # ── Step 5: Persist AI evaluation ────────────────────────────────────────
    async with TransactionDB() as conn:
        await conn.execute(
            """
            INSERT INTO application_ai_evaluations (
                application_id,
                model_name,
                tier,
                score,
                matched_skills,
                missing_requirements,
                reasons,
                recommendation,
                raw_response,
                scored_at
            )
            VALUES ($1, $2, $3::ai_tier, $4, $5, $6, $7, $8, $9, now())
            """,
            application_id,
            scoring_model,
            scoring_result.tier,
            scoring_result.score,
            json.dumps([s.model_dump() for s in scoring_result.matched_skills]),
            json.dumps(scoring_result.missing_requirements),
            json.dumps(scoring_result.reasons.model_dump()),
            scoring_result.recommendation,
            raw_response,
        )

    # ── Step 6: Mark complete ────────────────────────────────────────────────
    await update_application_status(application_id, "reviewable")
    await update_processing_job(
        proc_job_id,
        status="completed",
        progress=100,
        completed_at=_utcnow(),
    )
    await job.updateProgress(100)

    logger.info(
        "✓  Job %s complete | tier=%s score=%d",
        job.id,
        scoring_result.tier,
        scoring_result.score,
    )
    return {"tier": scoring_result.tier, "score": scoring_result.score}


# ---------------------------------------------------------------------------
# Graceful shutdown
# ---------------------------------------------------------------------------

async def _shutdown(worker: Worker) -> None:
    logger.info("Shutdown signal received – draining worker…")
    await worker.close()
    await close_pool()
    logger.info("Worker shut down cleanly.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    logger.info("Starting resume processing worker")
    logger.info(
        "Queue=%s  Concurrency=%d  vLLM=%s  Model=%s",
        config.queue_name,
        config.concurrency,
        config.vllm_base_url,
        config.vllm_model,
    )

    # Pre-warm the embedding model so the first job isn't slow
    logger.info("Pre-loading embedding model…")
    get_model()

    # Initialise the DB connection pool
    await get_pool()
    logger.info("DB pool ready.")

    worker = Worker(
        config.queue_name,
        process_resume,
        {
            "connection": {
                "host": config.redis_host,
                "port": config.redis_port,
            },
            "concurrency": config.concurrency,
        },
    )

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(
                sig,
                lambda: asyncio.create_task(_shutdown(worker)),
            )
        except NotImplementedError:
            # Windows does not support add_signal_handler for all signals
            pass

    logger.info("Worker ready – waiting for jobs…")
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())

import asyncio
import json
import logging
import signal
import traceback
from datetime import datetime, timezone

from bullmq import Job, Worker

from config import config
from db import (
    TenantDB,
    close_pool,
    get_pool,
    update_application_status,
    update_processing_job,
)
from embedder import embed_text, get_model
from extractor import extract_pdf_to_markdown
from normalizer import normalize_resume
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
    tenant_id: str,
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
        await update_application_status(tenant_id, application_id, "uploaded")
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
        "tenantId":      str,
        "reprocess":     bool,  # optional
        "stage":         str,   # optional hint
    }
    """
    data: dict = job.data
    application_id: str = data["applicationId"]
    resume_path: str = data["resumePath"]
    tenant_id: str = data["tenantId"]

    logger.info(
        "▶  Job %s | app=%s | tenant=%s | path=%s",
        job.id,
        application_id,
        tenant_id,
        resume_path,
    )

    # ── Fetch DB records ────────────────────────────────────────────────────
    async with TenantDB(tenant_id) as conn:
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
    await update_application_status(tenant_id, application_id, "extracting")
    await update_processing_job(
        tenant_id,
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
        await _fail_job(tenant_id, application_id, proc_job_id, err_msg)
        raise

    # ── Step 2: Normalise ────────────────────────────────────────────────────
    normalized = normalize_resume(extraction["markdown"])
    logger.info(
        "Normalised resume: name=%s email=%s words=%d",
        normalized.candidate_name,
        normalized.candidate_email,
        normalized.word_count,
    )

    async with TenantDB(tenant_id) as conn:
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

        if normalized.candidate_email or normalized.candidate_name:
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
                normalized.candidate_email or "",
                normalized.candidate_phone,
                application_id,
            )

    await update_application_status(tenant_id, application_id, "extracted")
    await update_processing_job(
        tenant_id, proc_job_id, status="extracted", progress=50
    )
    await job.updateProgress(50)

    # ── Step 3: Embedding ────────────────────────────────────────────────────
    try:
        embedding = embed_text(normalized.raw_text)
        # pgvector accepts the string representation '[0.1,0.2,…]'
        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

        async with TenantDB(tenant_id) as conn:
            await conn.execute(
                """
                INSERT INTO resume_embeddings
                    (tenant_id, resume_id, model_name, embedding)
                VALUES ($1, $2, $3, $4::vector)
                ON CONFLICT (resume_id, model_name)
                DO UPDATE SET embedding   = EXCLUDED.embedding,
                              created_at  = now()
                """,
                tenant_id,
                resume_id,
                config.embedding_model,
                embedding_str,
            )
        logger.info("Embedding stored for resume %s", resume_id)
    except Exception as exc:
        # Embedding failure is non-fatal; log and continue
        logger.warning("Embedding step failed (non-fatal): %s", exc)

    # ── Step 4: Score with vLLM ──────────────────────────────────────────────
    await update_application_status(tenant_id, application_id, "scoring")
    await update_processing_job(
        tenant_id, proc_job_id, status="scoring", progress=60
    )
    await job.updateProgress(60)

    resume_text_for_scoring = (
        f"Name: {normalized.candidate_name or 'Unknown'}\n\n"
        f"SUMMARY:\n{normalized.summary_section or 'N/A'}\n\n"
        f"EXPERIENCE:\n{normalized.experience_section or 'N/A'}\n\n"
        f"EDUCATION:\n{normalized.education_section or 'N/A'}\n\n"
        f"SKILLS:\n{normalized.skills_section or 'N/A'}"
    )

    try:
        scoring_result, raw_response = await score_resume(
            job_description=jd_text,
            normalized_resume=resume_text_for_scoring,
        )
    except Exception as exc:
        err_msg = f"Scoring failed: {exc}\n{traceback.format_exc()}"
        logger.error(err_msg)
        await _fail_job(tenant_id, application_id, proc_job_id, err_msg)
        raise

    # ── Step 5: Persist AI evaluation ────────────────────────────────────────
    async with TenantDB(tenant_id) as conn:
        await conn.execute(
            """
            INSERT INTO application_ai_evaluations (
                tenant_id,
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
            VALUES ($1, $2, $3, $4::ai_tier, $5, $6, $7, $8, $9, $10, now())
            """,
            tenant_id,
            application_id,
            config.vllm_model,
            scoring_result.tier,
            scoring_result.score,
            json.dumps([s.model_dump() for s in scoring_result.matched_skills]),
            json.dumps(scoring_result.missing_requirements),
            json.dumps(scoring_result.reasons.model_dump()),
            scoring_result.recommendation,
            raw_response,
        )

    # ── Step 6: Mark complete ────────────────────────────────────────────────
    await update_application_status(tenant_id, application_id, "reviewable")
    await update_processing_job(
        tenant_id,
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

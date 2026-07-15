import json
import logging
import asyncpg
from config import config
from typing import Optional

logger = logging.getLogger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """Return (or lazily create) the global connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            config.database_url,
            min_size=2,
            max_size=10,
        )
    return _pool


async def close_pool() -> None:
    """Gracefully close the global connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


class TransactionDB:
    """
    Async context manager that acquires a connection from the pool and
    wraps operations in a transaction.
    """

    def __init__(self) -> None:
        self.conn: Optional[asyncpg.Connection] = None
        self._pool: Optional[asyncpg.Pool] = None

    async def __aenter__(self) -> asyncpg.Connection:
        self._pool = await get_pool()
        self.conn = await self._pool.acquire()
        await self.conn.execute("BEGIN")
        return self.conn

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.conn is not None and self._pool is not None:
            if exc_type is not None:
                await self.conn.execute("ROLLBACK")
            else:
                await self.conn.execute("COMMIT")
            await self._pool.release(self.conn)
            self.conn = None


async def get_setting(key: str, default: str) -> str:
    """
    Read a value from the app_settings key/value table, returning ``default``
    if the key (or the table itself) is missing. Used to pick up model choices
    saved from the Settings page without a worker restart.
    """
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            value = await conn.fetchval(
                "SELECT value FROM app_settings WHERE key = $1", key
            )
        return value if value else default
    except Exception as exc:  # table absent, DB hiccup, etc.
        logger.warning("get_setting(%s) failed, using default: %s", key, exc)
        return default


async def update_application_status(
    application_id: str, status: str
) -> None:
    """Transition an application to a new status."""
    async with TransactionDB() as conn:
        await conn.execute(
            "UPDATE applications SET status = $1::application_status, updated_at = now() WHERE id = $2",
            status,
            application_id,
        )


async def get_candidate_by_email(email: str) -> Optional[dict]:
    """Look up an existing candidate by email, if any."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, full_name FROM candidates WHERE email = $1", email
        )
    return dict(row) if row else None


async def find_application(candidate_id: str, job_id: str) -> Optional[dict]:
    """Look up an existing application for a given candidate + job, if any."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT id, status FROM applications WHERE candidate_id = $1 AND job_id = $2",
            candidate_id,
            job_id,
        )
    return dict(row) if row else None


async def record_candidate_conflict(
    application_id: str, proc_job_id: str, conflict: dict
) -> None:
    """
    Pause a job that hit a candidates.email collision instead of letting it
    crash-retry-fail: persist what was found so a recruiter can decide
    whether to override (merge) or discard, then park the application in
    'duplicate_candidate' for review.
    """
    await update_processing_job(
        proc_job_id,
        status="needs_review",
        conflict_data=json.dumps(conflict),
    )
    await update_application_status(application_id, "duplicate_candidate")


async def update_processing_job(
    job_id: str, **kwargs
) -> None:
    """
    Update arbitrary columns on ``resume_processing_jobs``.
    Uses a raw SET clause built from **kwargs, so only pass trusted
    column names (never user-supplied strings).
    """
    if not kwargs:
        return

    sets: list[str] = []
    values: list = []
    for i, (k, v) in enumerate(kwargs.items(), start=1):
        sets.append(f"{k} = ${i}")
        values.append(v)
    values.append(job_id)

    sql = (
        f"UPDATE resume_processing_jobs "
        f"SET {', '.join(sets)}, updated_at = now() "
        f"WHERE id = ${len(values)}"
    )

    # This update is infrastructure-level, so we use the
    # pool directly rather than TransactionDB to avoid an extra round-trip.
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(sql, *values)

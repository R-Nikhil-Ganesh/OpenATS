import asyncpg
from config import config
from typing import Optional

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


class TenantDB:
    """
    Async context manager that acquires a connection from the pool and
    immediately sets ``app.current_tenant_id`` so that PostgreSQL RLS
    policies are applied for the correct tenant.
    """

    def __init__(self, tenant_id: str) -> None:
        self.tenant_id = tenant_id
        self.conn: Optional[asyncpg.Connection] = None
        self._pool: Optional[asyncpg.Pool] = None

    async def __aenter__(self) -> asyncpg.Connection:
        self._pool = await get_pool()
        self.conn = await self._pool.acquire()
        # SET applies to the session. We must reset it before returning to the pool.
        await self.conn.execute(
            f"SET ROLE openats_app; SET app.current_tenant_id = '{self.tenant_id}';"
        )
        return self.conn

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.conn is not None and self._pool is not None:
            await self.conn.execute("RESET app.current_tenant_id; RESET ROLE;")
            await self._pool.release(self.conn)
            self.conn = None


async def update_application_status(
    tenant_id: str, application_id: str, status: str
) -> None:
    """Transition an application to a new status."""
    async with TenantDB(tenant_id) as conn:
        await conn.execute(
            "UPDATE applications SET status = $1::application_status, updated_at = now() WHERE id = $2",
            status,
            application_id,
        )


async def update_processing_job(
    tenant_id: str, job_id: str, **kwargs
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

    # This update is infrastructure-level (not tenant-data), so we use the
    # pool directly rather than TenantDB to avoid an extra round-trip.
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(sql, *values)

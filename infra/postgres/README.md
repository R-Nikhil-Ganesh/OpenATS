# PostgreSQL Init Scripts

This directory contains numbered SQL migration files that are executed **in lexicographic order** by PostgreSQL's `docker-entrypoint-initdb.d` mechanism during container first-boot. They run **once**, on a fresh data volume.

> **Note:** If you change the schema after the container has already initialized, you must destroy the `postgres_data` volume and restart: `docker compose down -v && docker compose up -d`

---

## File Execution Order

| File | Purpose |
|------|---------|
| `001_extensions_and_types.sql` | Enables `pgcrypto`, `vector` (pgvector), and `pg_trgm`. Defines all custom ENUM types: `application_status`, `user_role`, `job_status`, `ai_tier`, `processing_job_status`. |
| `002_tenants_and_users.sql` | Creates the multi-tenancy foundation: `tenants`, `users`, and `refresh_tokens` tables. All other tables reference `tenants(id)`. |
| `003_jobs.sql` | Creates `job_requisitions` — the core entity representing an open role. Stores both raw and AI-normalized job descriptions plus required/nice-to-have skills as JSONB arrays. |
| `004_candidates_and_resumes.sql` | Creates `candidates` (de-duplicated person profiles, one per email per tenant) and `resumes` (uploaded file records with extracted markdown content and SHA-256 deduplication hash). |
| `005_applications.sql` | Creates `applications` (the join between candidate + resume + job), `application_ai_evaluations` (LLM scoring results with full audit trail), `application_state_history` (immutable state transition log), `resume_processing_jobs` (BullMQ job tracking), and `role_history_snapshots` (denormalized point-in-time records). |
| `006_embeddings.sql` | Creates `resume_embeddings` and `job_embeddings` tables using `vector(384)` columns for `all-MiniLM-L6-v2` embeddings. Supports semantic similarity search via pgvector. |
| `007_rls.sql` | Enables **Row-Level Security** on all tenant-scoped tables. Each policy reads `app.current_tenant_id` from the PostgreSQL session (set by the API via `SET LOCAL`). Also creates the `openats_app` database role with appropriate grants. |
| `008_indexes.sql` | Creates B-tree indexes on high-cardinality lookup columns and **IVFFlat** indexes on embedding columns for fast approximate nearest-neighbor (ANN) cosine-distance queries. |

---

## RLS Design

The API sets `SET LOCAL app.current_tenant_id = '<uuid>'` at the start of each transaction. The RLS policies evaluate:

```sql
tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
```

This means:
- Superuser connections bypass RLS (for migrations and maintenance).
- The `openats_app` role (used by the API at runtime) is subject to all policies.
- An unset or empty `app.current_tenant_id` returns `NULL`, causing all rows to be invisible — a safe default.

---

## Vector Search

Embedding tables use `ivfflat` indexes with cosine distance (`vector_cosine_ops`). To query:

```sql
SET LOCAL app.current_tenant_id = '<tenant-uuid>';

SELECT r.id, r.original_filename,
       1 - (re.embedding <=> $1::vector) AS similarity
FROM   resume_embeddings re
JOIN   resumes r ON r.id = re.resume_id
ORDER  BY re.embedding <=> $1::vector
LIMIT  20;
```

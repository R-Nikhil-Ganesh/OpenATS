# PostgreSQL Init Scripts

This directory contains numbered SQL migration files that are executed **in lexicographic order** by PostgreSQL's `docker-entrypoint-initdb.d` mechanism during container first-boot. They run **once**, on a fresh data volume.

> **Note:** If you change the schema after the container has already initialized, you must destroy the `postgres_data` volume and restart: `docker compose down -v && docker compose up -d`

---

## File Execution Order

| File | Purpose |
|------|---------|
| `001_extensions_and_types.sql` | Enables `pgcrypto`, `vector` (pgvector), and `pg_trgm`. Defines all custom ENUM types: `application_status`, `user_role`, `job_status`, `ai_tier`, `processing_job_status`. |
| `002_users.sql` | Creates the core tables for authentication and authorization: `users` and `refresh_tokens`. |
| `003_jobs.sql` | Creates `job_requisitions` — the core entity representing an open role. Stores both raw and AI-normalized job descriptions plus required/nice-to-have skills as JSONB arrays. |
| `004_candidates_and_resumes.sql` | Creates `candidates` (de-duplicated person profiles) and `resumes` (uploaded file records with extracted markdown content and SHA-256 deduplication hash). |
| `005_applications.sql` | Creates `applications` (the join between candidate + resume + job), `application_ai_evaluations` (LLM scoring results with full audit trail), `application_state_history` (immutable state transition log), `resume_processing_jobs` (BullMQ job tracking), and `role_history_snapshots` (denormalized point-in-time records). |
| `006_embeddings.sql` | Creates `resume_embeddings` and `job_embeddings` tables using `vector(384)` columns for `all-MiniLM-L6-v2` embeddings. Supports semantic similarity search via pgvector. |
| `008_indexes.sql` | Creates B-tree indexes on high-cardinality lookup columns and **IVFFlat** indexes on embedding columns for fast approximate nearest-neighbor (ANN) cosine-distance queries. |
| `009_seed_admin.sql` | Automatically seeds a default admin user (`admin@local.com`) for the single-tenant environment. |

---

## Vector Search

Embedding tables use `ivfflat` indexes with cosine distance (`vector_cosine_ops`). To query:

```sql
SELECT r.id, r.original_filename,
       1 - (re.embedding <=> $1::vector) AS similarity
FROM   resume_embeddings re
JOIN   resumes r ON r.id = re.resume_id
ORDER  BY re.embedding <=> $1::vector
LIMIT  20;
```

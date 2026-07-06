# OpenATS AI Agent Documentation - Patch 1

This file contains additional context and missing details pulled from the full source files (API, Worker, Frontend, Database) to supplement the primary `AGENTS.md` guide.

## 1. Frontend Specifics (Next.js & React)

### Real-Time SSE (Server-Sent Events)
*   **SSE Hook (`useSSE.ts`)**: The frontend subscribes to real-time updates for job processing via SSE.
*   **Endpoint Mismatch Note**: In `useSSE.ts`, the URL is defined as `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'}/events/processing`. Ensure the API matches this path or adjust the environment variables.
*   **Polling Fallback**: The Job Detail page (`/jobs/[id]`) polls the `/jobs/:id/stats` endpoint every 10 seconds if there are `processing` or `queued` applications, acting as a fallback to ensure the UI updates if SSE drops.

### API Client Interceptors (`api.ts`)
*   The `apiClient` automatically attaches the `Bearer` token from `localStorage`.
*   If a `401 Unauthorized` response is received, the interceptor automatically clears tokens and forcefully redirects the user to `/login` via `window.location.href`.

### Data Transformation
*   In `jobsApi.getApplications` and `applicationsApi.get`, the frontend transforms flat row data from the backend into nested objects (`candidate` and `ai_analysis`). If the API changes its return shape, these transformers must be updated.

## 2. Worker Pipeline (Python)

### RLS Context Management
*   The worker uses a custom `TenantDB` async context manager (`db.py`).
*   This context manager acquires a connection, starts an explicit transaction (`BEGIN`), executes `SELECT set_config('app.current_tenant_id', $1, true)`, and `COMMIT`s on exit. This ensures all worker queries are RLS-compliant.

### Extraction & Normalization
*   **Extractor**: Uses `pymupdf4llm` to extract PDF to Markdown (`extract_pdf_to_markdown`). It captures the document's `content_hash` (SHA-256 of raw bytes) to detect duplicates.
*   **Normalizer**: Uses Regex heuristics to detect sections (Summary, Experience, Education, Skills) and strip markdown artifacts. It extracts basic contact info (email, phone, name) which is then used to update the `candidates` table.

### Embeddings
*   Uses `sentence-transformers` (`all-MiniLM-L6-v2`, 384 dimensions).
*   Text is truncated to ~8,000 characters to prevent token overflow.
*   The embeddings are stored in `resume_embeddings` as a `vector` using `pgvector`.

### Scoring & LLM
*   Calls a local vLLM instance (Qwen3-8B) via an OpenAI-compatible `/v1/chat/completions` endpoint.
*   The system prompt explicitly demands JSON output and enforces Tier thresholds (A: 75-100, B: 50-74, C: 0-49).
*   The worker retries up to 3 times on JSON parse failures or HTTP errors with exponential backoff.
*   If a job fails at any stage, `_fail_job` resets the application status to `uploaded` and logs the error to `resume_processing_jobs` so it can be safely retried.

## 3. Database Schema Details

### Strict Enums
PostgreSQL ENUMs are immutable and strictly enforced. Do not attempt to insert strings that aren't in these lists:
*   `application_status`: 'uploaded', 'queued', 'extracting', 'extracted', 'scoring', 'reviewable', 'screening', 'interviewing', 'hired', 'rejected', 'archived'
*   `user_role`: 'owner', 'hiring_manager', 'recruiter', 'viewer'
*   `job_status`: 'draft', 'active', 'paused', 'closed', 'archived'
*   `ai_tier`: 'A', 'B', 'C', 'unscored'
*   `processing_job_status`: 'queued', 'extracting', 'extracted', 'scoring', 'completed', 'failed'

### Application State Tracking
*   `application_state_history` acts as an immutable audit log for all transitions of an application.
*   `role_history_snapshots` stores a denormalized snapshot (JSONB) of the evaluation and candidate info whenever a candidate reaches a milestone (e.g., 'screening', 'hired').

### Row Level Security (RLS)
*   **007_rls.sql** enforces that all tables (except `tenants`) use `app.current_tenant_id`.
*   A superuser role `openats_app` (or `erode_app` depending on rename status) can bypass these if needed, but standard operations must go through the standard roles and set the session variable.

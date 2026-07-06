# OpenATS — Full Codebase Documentation for AI Agents

> **Purpose**: This document is the authoritative, deep-dive reference for any AI agent working on the OpenATS codebase. It covers architecture, every module, every data model, every API route, every frontend component, all critical invariants, and known pitfalls. Read top-to-bottom before making any changes.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Repository Layout](#2-repository-layout)
3. [Environment & Configuration](#3-environment--configuration)
4. [Database Layer — PostgreSQL](#4-database-layer--postgresql)
5. [API Server — apps/api](#5-api-server--appsapi)
6. [Frontend — apps/web](#6-frontend--appsweb)
7. [Python Worker — workers/resume_worker](#7-python-worker--workersresume_worker)
8. [Docker Compose Stack](#8-docker-compose-stack)
9. [Critical Invariants & Pitfalls](#9-critical-invariants--pitfalls)
10. [Data Flow: End-to-End Resume Processing](#10-data-flow-end-to-end-resume-processing)
11. [Enum Reference](#11-enum-reference)
12. [API Route Reference](#12-api-route-reference)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          BROWSER (port 3000)                            │
│  Next.js 14 App Router · React Query · Axios · SSE client              │
└────────────────────────────┬────────────────────────────────────────────┘
                             │ HTTP / SSE
┌────────────────────────────▼────────────────────────────────────────────┐
│                     API SERVER (port 3001)                              │
│  Express 4 · TypeScript · JWT Auth · Multer · Zod validation           │
│  Routes: /auth /jobs /applications /upload /candidates                  │
│          /role-history /dashboard /events (SSE)                         │
└──────────┬──────────────────────────┬───────────────────────────────────┘
           │ pg Pool                  │ ioredis / BullMQ Queue
┌──────────▼──────────┐   ┌──────────▼──────────────────────────────────┐
│  PostgreSQL 16      │   │  Redis 7                                     │
│  pgvector · RLS     │   │  BullMQ job queue (resume-processing)        │
│  openats DB         │   └──────────┬───────────────────────────────────┘
└─────────────────────┘              │ BullMQ Worker
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│                  PYTHON WORKER (workers/resume_worker)                  │
│  python-bullmq · asyncpg · PyMuPDF4LLM · sentence-transformers         │
│  Pipeline: PDF extract → normalize → embed → LLM score → write DB      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ OpenAI-compatible HTTP
┌────────────────────────────────────▼────────────────────────────────────┐
│                    vLLM (port 8000, optional GPU)                       │
│  Model: Qwen/Qwen3-8B (quantized AWQ)                                  │
│  Used only by the Python worker for resume scoring                      │
└─────────────────────────────────────────────────────────────────────────┘
```

**Single-Tenancy**: The application operates in a single-tenant environment, meaning there are no `tenant_id` tracking columns or complex RLS policies. It is designed for single-organization usage on a local host.

---

## 2. Repository Layout

```
D:\openats\
├── .env                          # Active environment (gitignored)
├── .env.example                  # Template for all env vars
├── .gitignore
├── README.md                     # User-facing setup guide
├── AGENTS.md                     # THIS FILE — AI agent documentation
├── docker-compose.yml            # Orchestrates all 5 services
├── package.json                  # Root monorepo (pnpm workspaces)
├── pnpm-workspace.yaml           # workspace: apps/*, workers/*
│
├── apps/
│   ├── api/                      # Node.js Express API
│   │   ├── Dockerfile
│   │   ├── package.json          # @openats/api
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts          # App bootstrap, route mounting
│   │       ├── config.ts         # All env var config (single source of truth)
│   │       ├── db/
│   │       │   ├── pool.ts       # pg Pool + withTenant/withTransaction
│   │       │   └── redis.ts      # IORedis + BullMQ Queue
│   │       ├── middleware/
│   │       │   ├── auth.ts       # JWT authenticate + requireRole
│   │       │   ├── errorHandler.ts
│   │       │   └── validate.ts   # Zod request body validator
│   │       ├── routes/
│   │       │   ├── auth.ts       # /auth/*
│   │       │   ├── jobs.ts       # /jobs/*
│   │       │   ├── upload.ts     # POST /jobs/:id/resumes
│   │       │   ├── applications.ts
│   │       │   ├── candidates.ts
│   │       │   ├── dashboard.ts
│   │       │   └── roleHistory.ts
│   │       ├── sse/
│   │       │   └── events.ts     # SSE handler + per-tenant client map
│   │       └── types/
│   │           └── index.ts      # All TS interfaces + Express augmentation
│   │
│   └── web/                      # Next.js 14 App Router frontend
│       ├── Dockerfile
│       ├── package.json          # @openats/web
│       ├── next.config.mjs
│       └── src/
│           ├── app/
│           │   ├── layout.tsx              # Root layout + React Query provider
│           │   ├── globals.css             # Global CSS + animations + dark theme
│           │   ├── (auth)/
│           │   │   ├── login/page.tsx
│           │   │   └── register/page.tsx
│           │   └── (dashboard)/
│           │       ├── layout.tsx          # Auth guard + Sidebar + TopBar
│           │       ├── page.tsx            # → DashboardPage.tsx
│           │       ├── DashboardPage.tsx   # Main dashboard stats
│           │       ├── jobs/
│           │       │   ├── page.tsx        # Job list
│           │       │   ├── new/page.tsx    # Create job form
│           │       │   └── [id]/
│           │       │       ├── page.tsx    # Job detail + applications list
│           │       │       ├── board/page.tsx   # Kanban board
│           │       │       └── upload/page.tsx  # Resume upload dropzone
│           │       ├── candidates/[id]/page.tsx
│           │       └── role-history/
│           │           ├── page.tsx
│           │           └── RoleHistoryPage.tsx
│           ├── components/
│           │   ├── layout/       # Sidebar, TopBar
│           │   ├── ui/           # Button, Input, Badge, Card, Modal, Spinner, EmptyState
│           │   ├── dashboard/    # StatsGrid, FunnelChart
│           │   ├── jobs/         # CreateJobForm, JobCard
│           │   ├── candidates/   # CandidateSplitScreen, TierTabs
│           │   ├── kanban/       # KanbanBoard
│           │   ├── upload/       # DropZone
│           │   └── roleHistory/  # RoleHistoryTable, SimilarSearch
│           ├── hooks/
│           │   ├── useAuth.ts    # React Query auth hook
│           │   └── useSSE.ts     # SSE event subscription hook
│           ├── lib/
│           │   ├── api.ts        # All API client functions + TypeScript types
│           │   ├── auth.ts       # localStorage token helpers
│           │   ├── sse.ts        # SSE EventSource wrapper
│           │   └── utils.ts      # Date formatting, status colors, etc.
│           └── providers/
│               └── ReactQueryProvider.tsx
│
├── workers/
│   └── resume_worker/            # Python async worker
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── config.py             # Dataclass config from env
│       ├── db.py                 # asyncpg pool + TenantDB context manager
│       ├── extractor.py          # PyMuPDF4LLM PDF → Markdown
│       ├── normalizer.py         # Text cleaning + section detection
│       ├── embedder.py           # sentence-transformers embedding
│       ├── scorer.py             # vLLM HTTP call + Pydantic parsing
│       ├── main.py               # BullMQ Worker loop + pipeline orchestration
│       └── prompts/
│           └── scoring_prompt.txt  # System prompt for Qwen3-8B
│
└── infra/
    └── postgres/
        ├── 001_extensions_and_types.sql  # pgcrypto, vector, pg_trgm + all enums
        ├── 002_users.sql                 # users, refresh_tokens
        ├── 003_jobs.sql                  # job_requisitions
        ├── 004_candidates_and_resumes.sql # candidates, resumes
        ├── 005_applications.sql          # applications, evaluations, history, processing jobs, role snapshots
        ├── 006_embeddings.sql            # resume_embeddings, job_embeddings (pgvector)
        ├── 008_indexes.sql               # All performance + IVFFlat indexes
        └── 009_seed_admin.sql            # Seed admin user
```

---

## 3. Environment & Configuration

All configuration lives in `D:\openats\.env`. The Docker Compose stack reads it via `env_file: .env`.

| Variable | Default | Used By | Purpose |
|---|---|---|---|
| `POSTGRES_HOST` | `localhost` | API, Worker | DB host (use `postgres` inside Docker) |
| `POSTGRES_PORT` | `5432` | API, Worker | DB port |
| `POSTGRES_DB` | `openats` | API, Worker | DB name |
| `POSTGRES_USER` | `openats` | API, Worker | DB user (Docker auto-creates) |
| `POSTGRES_PASSWORD` | `changeme` | API, Worker | DB password |
| `DATABASE_URL` | `postgresql://openats:changeme@localhost:5432/openats` | Worker | Full asyncpg DSN |
| `REDIS_HOST` | `localhost` | API, Worker | Redis host (use `redis` inside Docker) |
| `REDIS_PORT` | `6379` | API, Worker | Redis port |
| `JWT_ACCESS_SECRET` | `access_secret_dev` | API | HMAC secret for access tokens |
| `JWT_REFRESH_SECRET` | `refresh_secret_dev` | API | HMAC secret for refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | API | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | API | Refresh token TTL |
| `API_PORT` | `3001` | API | Listening port |
| `UPLOAD_DIR` | `./uploads` | API, Worker | Where PDFs are stored on disk |
| `MAX_FILE_SIZE_MB` | `20` | API | Multer file size limit |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Web | Axios base URL (**baked at build time**) |
| `VLLM_BASE_URL` | `http://localhost:8000` | Worker | vLLM inference endpoint |
| `VLLM_MODEL` | `Qwen/Qwen3-8B` | Worker | Model identifier |
| `VLLM_MAX_TOKENS` | `2048` | Worker | Max output tokens per scoring call |
| `VLLM_TEMPERATURE` | `0.1` | Worker | Low temp for deterministic JSON output |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Worker | HuggingFace sentence-transformers ID |
| `EMBEDDING_DIM` | `384` | Worker | Embedding vector dimension |
| `BULLMQ_QUEUE_NAME` | `resume-processing` | API, Worker | Shared BullMQ queue name (must match exactly) |
| `WORKER_CONCURRENCY` | `2` | Worker | Parallel job slots |

> ⚠️ `NEXT_PUBLIC_API_URL` is baked into the Next.js bundle at build time. Changing it requires a full `docker-compose up -d --build web`. A simple restart does NOT re-evaluate it.

---

## 4. Database Layer — PostgreSQL

### Schema Init

SQL files in `infra/postgres/` run **once** (in numeric order) via the Docker `docker-entrypoint-initdb.d` mount, only on a fresh/empty volume. To re-run them, you must do `docker-compose down -v`.

### 4.1 Enums (001_extensions_and_types.sql)

These are the only valid string values for their respective columns. PostgreSQL will throw `invalid input value for enum` on anything else.

| Enum Type | Valid Values |
|---|---|
| `application_status` | `uploaded`, `queued`, `extracting`, `extracted`, `scoring`, `reviewable`, `screening`, `interviewing`, `hired`, `rejected`, `archived` |
| `user_role` | `owner`, `hiring_manager`, `recruiter`, `viewer` |
| `job_status` | `draft`, `active`, `paused`, `closed`, `archived` |
| `ai_tier` | `A`, `B`, `C`, `unscored` |
| `processing_job_status` | `queued`, `extracting`, `extracted`, `scoring`, `completed`, `failed` |

### 4.2 Table Reference



#### `users`
```
id UUID PK, email, password_hash, full_name,
role::user_role DEFAULT 'recruiter', is_active, last_login_at, created_at, updated_at
UNIQUE (email)
```

#### `refresh_tokens`
```
id UUID PK, user_id FK, token_hash UNIQUE,
expires_at, revoked_at (null = active), created_at
```
> Stores SHA-256 hash of the JWT refresh token (not the raw token).

#### `job_requisitions`
```
id UUID PK, title, department, location, employment_type,
status::job_status DEFAULT 'draft',
raw_jd TEXT,          -- original JD text (always present)
normalized_jd TEXT,   -- AI-cleaned JD (null until worker processes)
required_skills JSONB DEFAULT '[]',
nice_to_have_skills JSONB DEFAULT '[]',
experience_years_min INT, experience_years_max INT,
created_by FK → users, closed_at, created_at, updated_at
```

#### `candidates`
```
id UUID PK, full_name, email, phone,
linkedin_url, github_url, location, created_at, updated_at
UNIQUE (email)
```
> Candidate profiles are per-tenant. The same real person at two different companies = two separate candidate rows.

#### `resumes`
```
id UUID PK, candidate_id FK,
original_filename, storage_path,  -- absolute path on the shared volume
file_size_bytes INT, mime_type DEFAULT 'application/pdf',
content_hash VARCHAR(64),         -- SHA-256 of raw file bytes (for dedup)
extracted_markdown TEXT,          -- null until worker extracts
extraction_metadata JSONB DEFAULT '{}',  -- {page_count, word_count, char_count, ...}
extracted_at, created_at, updated_at
```

#### `applications`
```
id UUID PK,
candidate_id FK → candidates,
resume_id FK → resumes,
job_id FK → job_requisitions,
status::application_status DEFAULT 'uploaded',
applied_at, reviewed_by FK → users, reviewer_notes TEXT,
created_at, updated_at
UNIQUE (candidate_id, job_id)
```

#### `application_ai_evaluations`
```
id UUID PK, application_id FK,
model_name, model_version,
tier::ai_tier DEFAULT 'unscored',
score NUMERIC(5,2) CHECK (0 <= score <= 100),
matched_skills JSONB DEFAULT '[]',       -- [{skill, confidence, evidence}]
missing_requirements JSONB DEFAULT '[]', -- ["string", ...]
reasons JSONB DEFAULT '{}',             -- {strengths: [], weaknesses: [], cultural_fit_notes: ""}
recommendation TEXT,
raw_response TEXT,   -- full raw LLM output (for audit/debugging)
scored_at, created_at
```

#### `application_state_history`
```
id UUID PK, application_id FK,
from_status::application_status,  -- null on first transition
to_status::application_status,
changed_by FK → users,
note TEXT,
changed_at
```

#### `resume_processing_jobs`
```
id UUID PK, application_id FK,
bullmq_job_id VARCHAR(255),  -- BullMQ's internal job ID
status::processing_job_status DEFAULT 'queued',
progress INT DEFAULT 0 CHECK (0 <= progress <= 100),
error_message TEXT, error_stack TEXT,
attempts INT DEFAULT 0,
started_at, completed_at, created_at, updated_at
```

#### `role_history_snapshots`
```
id UUID PK,
job_id FK → job_requisitions,
application_id FK → applications,
evaluation_id FK → application_ai_evaluations,
milestone::application_status,  -- e.g. 'screening', 'hired'
snapshot_data JSONB NOT NULL DEFAULT '{}',  -- ALL candidate data packed here
captured_at
```
> `snapshot_data` is a fully denormalized JSONB blob. Do NOT try to insert individual columns — they don't exist. The packing schema:
> ```json
> {
>   "candidate_name": "...", "candidate_email": "...",
>   "job_title": "...", "department": "...",
>   "tier": "A", "score": 85,
>   "matched_skills": [...], "missing_requirements": [...],
>   "strengths": [...], "weaknesses": [...]
> }
> ```

#### `resume_embeddings` / `job_embeddings`
```
id UUID PK, resume_id/job_id FK,
model_name VARCHAR DEFAULT 'all-MiniLM-L6-v2',
embedding vector(384),   -- pgvector type, cosine-normalized
created_at
UNIQUE (resume_id/job_id, model_name)
```

---

## 5. API Server — apps/api

### 5.1 Bootstrap — `src/index.ts`

Routes are mounted **without** a `/api/v1` prefix:
```typescript
app.use('/auth', authRouter);
app.use('/jobs', jobsRouter);
app.use('/jobs', uploadRouter);        // shares /jobs for POST /jobs/:id/resumes
app.use('/applications', applicationsRouter);
app.use('/candidates', candidatesRouter);
app.use('/role-history', roleHistoryRouter);
app.use('/dashboard', dashboardRouter);
app.get('/events', sseHandler);        // SSE
```

### 5.2 Database Pool

```typescript
export async function withTransaction<T>(fn: (client) => Promise<T>): Promise<T>
```

**Implementation**:
```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const result = await fn(client);
  await client.query('COMMIT');
  return result;
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

### 5.3 Type Definitions — `src/types/index.ts`

```typescript
type ApplicationStatus = 'uploaded' | 'queued' | 'extracting' | 'extracted' |
  'scoring' | 'reviewable' | 'screening' | 'interviewing' | 'hired' | 'rejected' | 'archived';

type ProcessingJobStatus = 'queued' | 'extracting' | 'extracted' | 'scoring' | 'completed' | 'failed';

type AiTier = 'A' | 'B' | 'C' | 'unscored';
type UserRole = 'owner' | 'hiring_manager' | 'recruiter' | 'viewer';

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
}

// Express Request augmented with:
// req.user?: JwtPayload
// req.
```

### 5.4 Auth Routes — `src/routes/auth.ts`

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| POST | `/auth/register-tenant` | None | ``{ fullName, email, password }` · Creates user |
| POST | `/auth/login` | None | `{ email, password }` · Returns `{ accessToken, refreshToken, user }` · Stores SHA-256 of refresh token |
| POST | `/auth/refresh` | None | `{ refreshToken }` · Returns `{ accessToken }` |
| POST | `/auth/logout` | ✅ | `{ refreshToken? }` · Revokes token(s) |
| GET | `/auth/me` | ✅ | Returns `{ id, email, fullName, role, lastLoginAt, createdAt }` |

### 5.5 Jobs Routes — `src/routes/jobs.ts`

| Method | Path | Notes |
|---|---|---|
| GET | `/jobs` | `?status&page&limit` · Returns `{ data: Job[], pagination }` with applicant tier/processing counts per job |
| POST | `/jobs` | `{ title, department, location, employment_type, raw_jd, experience_years_min?, experience_years_max? }` |
| GET | `/jobs/:id` | Single job with stats |
| PUT | `/jobs/:id` | Partial job update · owner/hiring_manager only |
| DELETE | `/jobs/:id` | Sets status='archived' (soft delete) |
| GET | `/jobs/:id/stats` | `{ total_applications, by_status, by_tier, processing_depth, failed_count, avg_score }` |
| GET | `/jobs/:id/applications` | `?tier&status&page&limit` · Flat JOIN including candidate + latest evaluation fields |

> The `/jobs/:id/applications` response is a **flat SQL row** — not nested. The frontend `api.ts` reshapes it into `{ candidate: {...}, ai_analysis: {...} }`.

### 5.6 Upload Routes — `src/routes/upload.ts`

**POST `/jobs/:jobId/resumes`** — multipart/form-data, field name: `resumes`

Per-file pipeline (all inside `withTransaction`):
1. Save to disk at `<UPLOAD_DIR>/<tenantId>/<jobId>/<filename>` via Multer
2. SHA-256 hash of file bytes
3. Upsert candidate by email (or placeholder `<hash>@placeholder.openats`)
4. Insert resume row with `storage_path`, `content_hash`
5. Insert application (`status='uploaded'`)
6. Insert `resume_processing_jobs` (`status='queued'`)
7. Update application `status='queued'`
8. Push BullMQ job: `{ applicationId, resumePath, jobId }`

Returns: `[{ filename, applicationId, candidateId, status: 'queued' }]`

### 5.7 Applications Routes — `src/routes/applications.ts`

| Method | Path | Notes |
|---|---|---|
| GET | `/applications/:id` | Full detail: candidate + resume + latest evaluation + history + processing status |
| PATCH | `/applications/:id/status` | `{ status, note? }` · Validates allowed transitions · Writes state history · Creates role snapshot at 'screening'/'hired' |
| POST | `/applications/:id/reprocess` | Resets processing job + re-queues. Body: `{ stage?: 'extraction'\|'scoring' }` |
| GET | `/applications/:id/history` | Array of state transitions |

**Status transition graph**:
```
reviewable ──→ screening ──→ interviewing ──→ hired
    │              │               │
    └──→ rejected  └──→ rejected   └──→ rejected
                                         │
                              hired/rejected → archived
```

### 5.8 Dashboard Routes — `src/routes/dashboard.ts`

| Method | Path | Returns |
|---|---|---|
| GET | `/dashboard/summary` | `{ active_jobs, total_applicants, queue_backlog, failed_count, tier_distribution, recent_jobs }` |
| GET | `/dashboard/queue-status` | BullMQ `queue.getJobCounts()` result |

Queue backlog query uses: `status IN ('queued', 'extracting', 'scoring')` — these are the three valid in-flight values.

### 5.9 Role History Routes — `src/routes/roleHistory.ts`

| Method | Path | Notes |
|---|---|---|
| GET | `/role-history` | `?department&milestone&page&limit` · Queries `snapshot_data` JSONB with `->>` operator · Returns `{ data, pagination }` |
| GET | `/role-history/similar` | `?job_id` · Fetches job embedding → pgvector `<=>` cosine search against resume_embeddings → returns ranked candidates |

### 5.10 SSE — `src/sse/events.ts`

- Clients subscribe at `GET /events` (requires auth token)
- `sseClients: Set<Response>` — registry of live connections
- `sendSSEEvent({ type, data })` — broadcasts JSON event to all tenant clients
- Heartbeat: `data: heartbeat` every 30 seconds
- BullMQ `QueueEvents` listener fires SSE on `completed`, `failed`, `progress`

---

## 6. Frontend — apps/web

### 6.1 Route Groups

- `(auth)` group: login, register — no auth protection
- `(dashboard)` group: all other routes — guarded by `layout.tsx`

### 6.2 Auth Guard — `(dashboard)/layout.tsx`

```typescript
// 1. Sync check (instant)
if (!isAuthenticated()) router.replace('/login');

// 2. Async check (React Query)
const { isLoading, isError } = useAuth();
if (isError) router.replace('/login');
if (isLoading) return <LoadingSpinner />;
```

### 6.3 API Client — `src/lib/api.ts`

Base URL: `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`

**Key response mappings** (backend flat → frontend nested):

```typescript
// jobsApi.list():
// Backend: { data: Job[], pagination: { total } }
// Frontend: { jobs: Job[], total: number }

// jobsApi.getApplications():
// Backend: flat row { full_name, email, matched_skills, ... }
// Frontend: { candidate: { id, full_name, email, ... }, ai_analysis: { matched_skills, ... } }

// applicationsApi.get():
// Backend: flat row with all joined fields
// Frontend: nested Application object with candidate + ai_analysis

// roleHistoryApi.list():
// Backend: { data: entry[], pagination: { total } }
// Frontend: { entries: entry[], total: number }
```

### 6.4 Auth Token Storage — `src/lib/auth.ts`

```typescript
localStorage key: 'openats_access_token'   // JWT, expires in 15m
localStorage key: 'openats_refresh_token'   // JWT, expires in 7d
```

### 6.5 useAuth Hook — `src/hooks/useAuth.ts`

- `login(credentials)`: POST to `/auth/login` → stores tokens → invalidates `['auth', 'me']` React Query cache
- `logout()`: POST to `/auth/logout` → clears localStorage → hard redirect to `/login`
- `isAuthenticated`: `!!user && !isError` (both token present AND `/auth/me` succeeded)

### 6.6 Component Architecture

All UI components use **inline styles** (no Tailwind). Dark theme: background `#0A0B0D`, accent `#6366F1` (indigo).

| Component | Location | Purpose |
|---|---|---|
| `Sidebar` | `components/layout/` | Navigation, tenant/user display |
| `TopBar` | `components/layout/` | Page title, actions |
| `Button` | `components/ui/` | `variant: primary\|secondary\|ghost\|danger` |
| `Input` | `components/ui/` | Labeled input with error state |
| `Badge` | `components/ui/` | Status/tier color chips |
| `Card` | `components/ui/` | Glassmorphism container |
| `Modal` | `components/ui/` | Overlay dialog |
| `Spinner` | `components/ui/` | Loading indicator |
| `EmptyState` | `components/ui/` | Zero-data placeholder |
| `StatsGrid` | `components/dashboard/` | Metric cards row |
| `FunnelChart` | `components/dashboard/` | Hiring funnel visualization |
| `CreateJobForm` | `components/jobs/` | Job creation form |
| `JobCard` | `components/jobs/` | Job list item with stats |
| `CandidateSplitScreen` | `components/candidates/` | Left list + right detail panel |
| `TierTabs` | `components/candidates/` | A/B/C tier filter tabs |
| `KanbanBoard` | `components/kanban/` | Drag-drop application pipeline |
| `DropZone` | `components/upload/` | PDF drag-drop upload with preview |
| `RoleHistoryTable` | `components/roleHistory/` | Snapshot listing |
| `SimilarSearch` | `components/roleHistory/` | pgvector similarity search UI |

---

## 7. Python Worker — workers/resume_worker

### 7.1 Pipeline (main.py)

```
BullMQ Job: { applicationId, resumePath, jobId }
    │
    ├─→ application.status = 'extracting', processing_job.progress = 10
    │
    ├─→ [extractor.py] extract_pdf_to_markdown(resumePath)
    │       PyMuPDF4LLM → page-chunked markdown
    │       SHA-256 hash of raw bytes
    │       Returns: { markdown, content_hash, extraction_metadata }
    │
    ├─→ [normalizer.py] normalize_resume(markdown)
    │       Strips markdown syntax (bold, italic, headers)
    │       Extracts email/phone/name via regex
    │       Splits into sections (experience, education, skills, summary, contact)
    │       Returns: NormalizedResume dataclass
    │
    ├─→ application.status = 'extracted', progress = 50
    │   resumes.extracted_markdown, content_hash updated
    │   candidates.email, phone, full_name updated (COALESCE — no overwrite)
    │
    ├─→ [embedder.py] embed_text(normalized.raw_text)
    │       all-MiniLM-L6-v2 on CPU, 384-dim, cosine-normalized
    │       Upserts resume_embeddings (resume_id, model_name)
    │
    ├─→ progress = 75, application.status = 'scoring'
    │
    ├─→ [scorer.py] score_resume(jd_text, normalized_text)
    │       POST to vLLM /v1/chat/completions
    │       3 retries with exponential backoff
    │       Parses JSON → ScoringResult (Pydantic)
    │       Returns: (ScoringResult, raw_response_text)
    │
    ├─→ INSERT application_ai_evaluations
    ├─→ application.status = 'reviewable'
    └─→ processing_job.status = 'completed', progress = 100
```

### 7.2 TenantDB Context Manager — `db.py`

```python
async with TenantDB(tenant_id) as conn:
    # conn has RLS active for this tenant
    result = await conn.fetchrow("SELECT ...", ...)
```

Internals:
```python
await self.conn.execute("BEGIN")
await self.conn.execute("SELECT set_config('NO LONGER APPLICABLE', $1, true)", tenant_id)
# ... on __aexit__:
await self.conn.execute("COMMIT" or "ROLLBACK")
await pool.release(self.conn)
```

### 7.3 ScoringResult Schema — `scorer.py`

```python
class ScoringResult(BaseModel):
    tier: str           # "A", "B", or "C"
    score: int          # 0-100
    matched_skills: list[MatchedSkill]   # [{skill, confidence: 0.0-1.0, evidence}]
    missing_requirements: list[str]
    reasons: Reasons    # {strengths: [], weaknesses: [], cultural_fit_notes: ""}
    recommendation: str
```

Tier thresholds (defined in scoring_prompt.txt):
- **A** = score 75-100 (strong fit)
- **B** = score 50-74 (partial fit)
- **C** = score 0-49 (weak fit)

### 7.4 vLLM Integration

The worker calls vLLM at `{VLLM_BASE_URL}/v1/chat/completions` (OpenAI-compatible). The vLLM service is **optional** — if it's not running, the scoring step fails and the processing job status becomes `'failed'`. The rest of the pipeline (extraction, embedding) still completes.

Current model: `Qwen/Qwen3-8B` with AWQ quantization. The scoring prompt is in `prompts/scoring_prompt.txt` and instructs the model to output **only valid JSON** with no markdown wrapping.

---

## 8. Docker Compose Stack

### Services

| Service | Image / Build | Port | Depends On |
|---|---|---|---|
| `openats-postgres` | `pgvector/pgvector:pg16` | 5432 | — |
| `openats-redis` | `redis:7-alpine` | 6379 | — |
| `openats-api` | `./apps/api` | 3001 | postgres (healthy), redis (healthy) |
| `openats-web` | `./apps/web` | 3000 | api |
| `openats-worker` | `./workers/resume_worker` | — | postgres, redis, api |

### Named Volumes

- `postgres_data` — PostgreSQL data directory
- `redis_data` — Redis AOF persistence

### Shared Bind Mounts

- `./uploads:/app/uploads` — shared between `openats-api` and `openats-worker` (must be identical path)
- `./infra/postgres:/docker-entrypoint-initdb.d:ro` — SQL init scripts

### Common Commands

```bash
# Start everything
docker-compose up -d --build

# Rebuild a single service
docker-compose up -d --build api

# View logs
docker-compose logs -f api
docker-compose logs -f worker

# Full reset (wipes database)
docker-compose down -v
docker-compose up -d --build

# Run SQL in the database
docker exec -it openats-postgres psql -U openats -d openats
```

---

## 9. Critical Invariants & Pitfalls

### ❌ Never Use These Enum String Values

| Wrong | Correct |
|---|---|
| `'processing'` | `'extracting'` or `'scoring'` |
| `'done'` | `'completed'` |
| `'complete'` | `'completed'` |
| `'pending'` | `'queued'` |
| `'in_progress'` | Use the specific stage name |

### ❌ Never Call `query()` For Tenant Data

`query()` (bare pool call) runs as superuser with no tenant context. It bypasses RLS and can read across tenants. Only use it for:
- Looking up a tenant by slug during login
- Checking slug uniqueness during registration

For everything else, **always** use `withTenant(req.tenantId!, ...)`.

### ❌ Never Insert Individual Columns Into role_history_snapshots

The table only has `snapshot_data JSONB`. Pack all data into that JSON object.

### ❌ Never Change NEXT_PUBLIC_API_URL Without Rebuilding Web

This env var is baked into the Next.js bundle. A `docker-compose restart web` does NOT re-read it.

### ❌ Do Not Asymmetrically Mount the Uploads Directory

The API stores files at `/app/uploads/<tenantId>/<jobId>/<file>`. The worker receives this path in the BullMQ job payload and must be able to open it. Both must mount `./uploads:/app/uploads`.

### ✅ Always COALESCE When Updating Candidate Contact Info

The worker updates candidate info after extraction using `COALESCE($1, existing_value)` — never blindly overwrite. The worker may extract an email from a resume that differs from the user-provided email, so we only fill in missing fields.

### ✅ Role History Snapshots Are Created Automatically

When `PATCH /applications/:id/status` moves to `'screening'` or `'hired'`, the route handler automatically creates a `role_history_snapshots` row. You do not need to call a separate endpoint.

### ✅ Anonymous Candidate Email Pattern

When no email is found in the filename during upload: `<sha256_of_filename>@placeholder.openats`. The worker later overwrites this with the real email found in the resume (using COALESCE).

---

## 10. Data Flow: End-to-End Resume Processing

```
1. Recruiter uploads PDF(s) → POST /jobs/:jobId/resumes
   └─ Multer saves to disk: uploads/<tenantId>/<jobId>/<filename>
   └─ DB transaction per file:
       candidates ← upsert by email
       resumes ← insert (storage_path, content_hash)
       applications ← insert (status='uploaded')
       resume_processing_jobs ← insert (status='queued')
       applications ← update status='queued'
   └─ BullMQ ← push { applicationId, resumePath, jobId }
   └─ SSE ← broadcast { type: 'queued', applicationId }

2. Python worker picks up job from BullMQ
   └─ applications.status = 'extracting'
   └─ processing_job.status = 'extracting', progress = 10

3. PyMuPDF4LLM extracts PDF → Markdown
   └─ resumes.extracted_markdown = <markdown>
   └─ resumes.content_hash = <sha256>
   └─ resumes.extraction_metadata = { page_count, word_count, ... }

4. Normalizer cleans text, extracts contact info
   └─ candidates.email, full_name, phone updated (COALESCE)
   └─ applications.status = 'extracted'
   └─ processing_job.progress = 50

5. Embedder generates 384-dim vector
   └─ resume_embeddings ← upsert (resume_id, model_name, embedding)

6. Scorer calls vLLM (Qwen3-8B)
   └─ application_ai_evaluations ← insert (tier, score, matched_skills, ...)
   └─ applications.status = 'reviewable'
   └─ processing_job.status = 'completed', progress = 100
   └─ SSE ← broadcast { type: 'completed', applicationId, tier, score }

7. Recruiter reviews candidates at /jobs/:id
   └─ TierTabs show A/B/C candidates
   └─ CandidateSplitScreen shows resume + AI analysis

8. Recruiter advances status via PATCH /applications/:id/status
   └─ application_state_history ← insert (from, to, changed_by, note)
   └─ If status = 'screening' or 'hired':
       role_history_snapshots ← insert (snapshot_data JSONB)

9. Role history searchable at /role-history
   └─ GET /role-history/similar?job_id=<id>
       └─ Fetch job_embeddings for job_id
       └─ pgvector: SELECT ... ORDER BY embedding <=> $1::vector LIMIT 10
       └─ Returns ranked similar candidates across all past hires
```

---

## 11. Enum Reference (Quick Lookup)

### application_status

| Value | Who Sets It | Meaning |
|---|---|---|
| `uploaded` | API (upload) | File received |
| `queued` | API (upload) | In BullMQ queue |
| `extracting` | Worker | PDF extraction running |
| `extracted` | Worker | Text extracted |
| `scoring` | Worker | LLM scoring running |
| `reviewable` | Worker | Ready for human review |
| `screening` | API (status route) | Phone/first screen |
| `interviewing` | API (status route) | In interviews |
| `hired` | API (status route) | Offer accepted |
| `rejected` | API (status route) | Rejected |
| `archived` | API (status route) | Closed out |

### processing_job_status

| Value | Meaning |
|---|---|
| `queued` | Waiting in BullMQ |
| `extracting` | PDF extraction in progress |
| `extracted` | Text extracted, embedding next |
| `scoring` | LLM scoring in progress |
| `completed` | Full pipeline done |
| `failed` | Terminal error |

---

## 12. API Route Reference

Base URL: `http://localhost:3001` (no `/api/v1` prefix).  
All authenticated routes require: `Authorization: Bearer <accessToken>`

```
AUTH
  POST  /auth/register-tenant    Body: { tenantName, tenantSlug, fullName, email, password }
  POST  /auth/login              Body: { email, password }
  POST  /auth/refresh            Body: { refreshToken }
  POST  /auth/logout             Auth · Body: { refreshToken? }
  GET   /auth/me                 Auth

JOBS
  GET   /jobs                    Auth · ?status&page&limit
  POST  /jobs                    Auth · { title, department, location, employment_type, raw_jd, ... }
  GET   /jobs/:id                Auth
  PUT   /jobs/:id                Auth · Partial update
  DELETE /jobs/:id               Auth · Soft delete (archived)
  GET   /jobs/:id/stats          Auth
  GET   /jobs/:id/applications   Auth · ?tier&status&page&limit (flat JOIN response)

UPLOAD
  POST  /jobs/:jobId/resumes     Auth · multipart/form-data · field: "resumes" (up to 20 PDFs)

APPLICATIONS
  GET   /applications/:id        Auth · Full detail (nested)
  PATCH /applications/:id/status Auth · { status, note? }
  POST  /applications/:id/reprocess Auth · { stage?: 'extraction'|'scoring' }
  GET   /applications/:id/history Auth

CANDIDATES
  GET   /candidates/:id          Auth

ROLE HISTORY
  GET   /role-history            Auth · ?department&milestone&page&limit
  GET   /role-history/similar    Auth · ?job_id (required)

DASHBOARD
  GET   /dashboard/summary       Auth
  GET   /dashboard/queue-status  Auth

SSE
  GET   /events                  Auth · text/event-stream · real-time processing updates
```

---

*Last updated: July 2026. Maintained in `D:\openats\AGENTS.md`.*


---

## 13. Supplementary Details (Patch 1)

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

### Database Context Management
*   The worker uses a custom `TransactionDB` async context manager (`db.py`).
*   This context manager acquires a connection, starts an explicit transaction (`BEGIN`), and `COMMIT`s on exit.

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

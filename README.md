# OpenATS — AI-Powered Applicant Tracking System

OpenATS is a modern, self-hosted Applicant Tracking System that uses generative AI to screen, score, and rank resumes automatically. It's built to run entirely on local infrastructure — local LLM inference (Ollama/vLLM) and a local PostgreSQL/pgvector database — so a hiring pipeline can process resumes without sending candidate data to a third-party API.

## ✨ Features

### Jobs, uploads & the AI processing pipeline
- **Job requisitions** — create jobs with title, department, location, employment type, experience range, and a full job description; jobs move through `draft → active → paused/closed → archived`.
- **Bulk resume upload** — drag-and-drop up to 20 PDFs at once per job.
- **Duplicate detection** — every upload is SHA-256 hashed; re-uploading the same resume to the same job is flagged as a duplicate and skipped instead of reprocessed.
- **Live pipeline visibility** — each resume streams through **Extraction → Normalization → Embedding → Scoring → Review-ready** with real-time progress pushed to the browser over Server-Sent Events (percent complete, stage transitions, completion, or failure) — no polling or manual refresh needed.
- **Reprocessing** — a stuck or failed resume can be resent through the pipeline from the UI.

### AI resume analysis (Python worker)
- **PDF extraction** — resumes are converted to Markdown (PyMuPDF/PyMuPDF4LLM), recovering icon-only hyperlinks (e.g. GitHub/LinkedIn buttons) that plain text extraction would lose.
- **Structured candidate profiles** — an LLM turns each resume into a JD-independent profile (contact info, links, skills, experience, education), generated lazily on first view and backfillable in bulk.
- **Semantic embeddings** — resume text is embedded with a local sentence-transformer (384-dim) into pgvector for similarity search.
- **AI scoring against the job description** — matched skills with confidence levels, missing requirements, strengths/weaknesses, a 0–100 score, a **Tier A/B/C** rating (A = 75–100, B = 50–74, C = 0–49), and a one-line recommendation.
- **Candidate conflict resolution** — if a resume's extracted email collides with an existing candidate, the application pauses in a `duplicate_candidate` state instead of silently merging or crashing; a recruiter resolves it by merging or keeping the candidates separate.
- **Link/credential validation** — GitHub profiles get a liveness check, a repo pull, and an LLM-written developer summary (key projects, skills, assessment); LinkedIn/Scholar/ResearchGate/other links get name-match verification against the page. The GitHub summary can be routed to a cloud **NVIDIA NIM** model instead of the local one (opt-in via `LLM_USE_NVIDIA` + an API key), and automatically falls back to the local model if the cloud call fails.

### Review & hiring pipeline
- Applications move through a tracked status pipeline — `reviewable → screening → interviewing → hired/rejected → archived` — with full state history.
- A **Kanban board** view per job supports drag-and-drop status changes as an alternative to the list view.
- **AI-assisted head-to-head comparison** — pick any two applicants for a job to get a structured, category-by-category comparison (experience, skills, etc.) with a per-category "edge," an overall winner, and a summary — plus a grounded follow-up chat to ask questions about the two candidates. Comparisons are cached and invalidated automatically when underlying data changes.
- **Role-history snapshots** — key milestones (screening, hired) capture a snapshot of the candidate, searchable later via semantic similarity against other job openings ("find similar past candidates").

### Dashboards & analytics
- A **triage dashboard** with live counts (new, awaiting review, processing, failed), a "needs attention" callout for stale jobs, per-job tier breakdowns, and a hiring funnel (applied → review → screening → interview → hired) with drop-off percentages, filterable by role.
- An **Analysis** page with funnel trend charts, tier/score distribution histograms, most-frequently-missing job requirements, and AI-override/accuracy tracking.

### Swappable local AI models
Every AI stage — scoring, comparison, chat, profiling, and link/GitHub analysis — calls a configurable, locally-hosted model (Ollama or any OpenAI-compatible endpoint like vLLM/LM Studio), independently selectable per task from **Settings**. This lets you run a cheap/fast model for high-volume scoring and a stronger model for interactive comparisons and chat. GitHub analysis is the one exception that can optionally route to a cloud model (NVIDIA NIM) instead — see below.

### Auth & access control
JWT-based login with access/refresh tokens and role-based access (owner / hiring manager / recruiter).

## 🏗️ Architecture & Tech Stack

- **Frontend (`apps/web`)**: Vite, React 19, TanStack Router, TypeScript, TailwindCSS, shadcn/Radix UI components.
- **Backend API (`apps/api`)**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL 16 with `pgvector` (embeddings/similarity search) and `pg_trgm`.
- **Queue & Caching**: Redis + BullMQ for asynchronous background processing jobs.
- **AI Worker (`workers/resume_worker`)**: Python worker consuming BullMQ jobs for PDF extraction, profiling, embedding generation, and AI scoring.
- **LLM Engine**: [Ollama](https://ollama.com) running locally on the host (`llama3.2:3b` by default) for fast, private, on-device AI inference, accessed via its OpenAI-compatible endpoint. Any OpenAI-compatible server (vLLM, LM Studio, a hosted API) works by changing `VLLM_BASE_URL`/`VLLM_MODEL` in `.env`. Separate model overrides are available for comparison (`VLLM_COMPARE_MODEL`) and profile extraction (`VLLM_PROFILE_MODEL`), so cheaper models can handle high-volume steps and a stronger one handles judgment calls.

> **Note:** `apps/web` is mid-migration from an older Next.js app to the current Vite/TanStack Router UI. Some views may still use local mock data rather than being fully wired to the live API — see [`TODO.md`](TODO.md) for the remaining wiring work.

## 🚀 Prerequisites

Before you begin, ensure you have the following installed on your host machine:
- **Docker** and **Docker Compose**
- **Node.js** (v20+) and **npm**
- **[Ollama](https://ollama.com)** running on the host machine (a GPU speeds this up but isn't required for a 3B-class model)

## 🛠️ Setup & Installation

**1. Clone the repository and configure environments**
```bash
cp .env.example .env
```
Open `.env` and fill in any necessary configurations (the defaults work out of the box for local development).

**2. Pull the LLM model (Required for AI Processing)**
```bash
ollama pull llama3.2:3b
```
The worker connects to Ollama on the host via `VLLM_BASE_URL=http://host.docker.internal:11434` (already set in `.env.example`). To use a bigger/more capable model, pull it and update `VLLM_MODEL` — note that larger models are much slower on local hardware and may need `VLLM_MAX_CONCURRENT_REQUESTS=1` and a higher `VLLM_TIMEOUT_SECONDS` to avoid scoring timeouts under concurrent load.

**3. Start the Docker Stack**
The entire infrastructure (PostgreSQL, Redis, Node API, Vite Web, Python Worker) is containerized.
```bash
docker compose up -d --build
```

## 📁 Project Structure

OpenATS uses a monorepo structure:

```text
openats/
├── apps/
│   ├── api/                # Express backend (JWT Auth, REST endpoints, SSE)
│   └── web/                # Vite/TanStack Router frontend (Dashboards, Job Boards)
├── workers/
│   └── resume_worker/      # Python worker (BullMQ, PDF Parsing, LLM calls)
├── infra/
│   └── postgres/           # Database initialization scripts
├── docker-compose.yml      # Orchestrates all microservices
└── package.json            # Root workspace configuration
```

## 🌐 Accessing the Application

- **Web UI**: `http://localhost:3000`
- **API Server**: `http://localhost:3001`
- **Database**: `localhost:5432`

Navigate to `http://localhost:3000` — the app auto-authenticates as the default seeded admin account (single-tenant, local-only, no login form):
- **Email:** `admin@local.host`
- **Password:** `admin`

## 📜 Database Migrations / Init

The database schema is defined in numbered SQL files located in `infra/postgres/`. These scripts run automatically in numerical order when the `openats-postgres` container initializes an empty volume for the first time.
If you need to completely reset the database, simply wipe the docker volumes:
```bash
docker compose down -v
docker compose up -d --build
```

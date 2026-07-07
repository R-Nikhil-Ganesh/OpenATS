# OpenATS — AI-Powered Applicant Tracking System

OpenATS is a modern, highly scalable Applicant Tracking System (ATS) powered by generative AI. It automates resume screening, skills extraction, and candidate matching using local LLM inference and vector search. 

OpenATS is designed as a single-tenant, locally hosted on-premises application. The system can be run entirely locally using local LLMs (Ollama/vLLM) and a local PostgreSQL/pgvector database.

## 🏗️ Architecture & Tech Stack

- **Frontend (`apps/web`)**: Next.js (React), TypeScript, TailwindCSS.
- **Backend API (`apps/api`)**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL 16 with `pgvector` for embedding storage and similarity search.
- **Queue & Caching**: Redis + BullMQ for handling asynchronous background processing jobs.
- **AI Worker (`workers/resume_worker`)**: Python-based worker consuming BullMQ jobs for PDF extraction, embedding generation, and AI scoring.
- **LLM Engine**: [Ollama](https://ollama.com) running locally on the host (`llama3.2:3b` by default) for fast, private, on-device AI inference, accessed via its OpenAI-compatible endpoint. Any OpenAI-compatible server (vLLM, LM Studio, a hosted API) works by changing `VLLM_BASE_URL`/`VLLM_MODEL` in `.env`.

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
The entire infrastructure (PostgreSQL, Redis, Node API, Next.js Web, Python Worker) is containerized.
```bash
docker compose up -d --build
```

## 📁 Project Structure

OpenATS uses a monorepo structure managed by `pnpm-workspace.yaml`:

```text
openats/
├── apps/
│   ├── api/                # Express backend (JWT Auth, REST endpoints)
│   └── web/                # Next.js frontend (Dashboards, Job Boards)
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

To get started, navigate to `http://localhost:3000/login` and sign in using the default seeded admin account:
- **Email:** `admin@local.com`
- **Password:** `admin`

## 📜 Database Migrations / Init

The database schema is defined in numbered SQL files located in `infra/postgres/`. These scripts run automatically in numerical order when the `openats-postgres` container initializes an empty volume for the first time. 
If you need to completely reset the database, simply wipe the docker volumes:
```bash
docker compose down -v
docker compose up -d --build
```

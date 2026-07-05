# OpenATS — AI-Powered Applicant Tracking System

OpenATS is a modern, highly scalable, multi-tenant Applicant Tracking System (ATS) powered by generative AI. It automates resume screening, skills extraction, and candidate matching using local LLM inference and vector search. 

OpenATS is designed with multi-tenancy from day one, employing strict PostgreSQL Row-Level Security (RLS) to ensure absolute data isolation across different tenants.

## 🏗️ Architecture & Tech Stack

- **Frontend (`apps/web`)**: Next.js (React), TypeScript, TailwindCSS.
- **Backend API (`apps/api`)**: Node.js, Express, TypeScript.
- **Database**: PostgreSQL 16 with `pgvector` for embedding storage and similarity search.
- **Queue & Caching**: Redis + BullMQ for handling asynchronous background processing jobs.
- **AI Worker (`workers/resume_worker`)**: Python-based worker consuming BullMQ jobs for PDF extraction, embedding generation, and AI scoring.
- **LLM Engine**: vLLM running a quantized local model (`Qwen3-8B`) for fast, private, on-device AI inference.

## 🔒 Multi-Tenancy & Security

Security and data isolation are baked into the core database layer rather than relying purely on application-level logic:
- **Row-Level Security (RLS)**: Every tenant-scoped table in PostgreSQL is protected by strict RLS policies.
- **Restricted Connection Roles**: The application API and AI workers do not execute queries as a superuser. They connect via a restricted role to impersonate a specific tenant context, preventing any cross-tenant data leaks.

## 🚀 Prerequisites

Before you begin, ensure you have the following installed on your host machine:
- **Docker** and **Docker Compose**
- **Node.js** (v20+) and **npm**
- A CUDA-capable GPU (Recommended for running the vLLM container)

## 🛠️ Setup & Installation

**1. Clone the repository and configure environments**
```bash
cp .env.example .env
```
Open `.env` and fill in any necessary configurations (the defaults work out of the box for local development).

**2. Start the Docker Stack**
The entire infrastructure (PostgreSQL, Redis, Node API, Next.js Web, Python Worker) is containerized.
```bash
docker-compose up -d --build
```

**3. Download the LLM Model (Required for AI Processing)**
Because the vLLM container requires the model to be downloaded to its huggingface cache, you must trigger the download manually on the first run:
```bash
docker exec openats-vllm huggingface-cli download Qwen/Qwen3-8B
```
*(Note: If you do not have a dedicated GPU, you may need to adjust the vLLM container settings in `docker-compose.yml` or rely on an external inference API by changing `VLLM_BASE_URL` in `.env`).*

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
│   └── postgres/           # Database initialization scripts and RLS definitions
├── docker-compose.yml      # Orchestrates all microservices
└── package.json            # Root workspace configuration
```

## 🌐 Accessing the Application

- **Web UI**: `http://localhost:3000`
- **API Server**: `http://localhost:3001`
- **Database**: `localhost:5432`

To get started, navigate to `http://localhost:3000/register` to create your first tenant organization and user account.

## 📜 Database Migrations / Init

The database schema is defined in numbered SQL files located in `infra/postgres/`. These scripts run automatically in numerical order when the `openats-postgres` container initializes an empty volume for the first time. 
If you need to completely reset the database, simply wipe the docker volumes:
```bash
docker-compose down -v
docker-compose up -d --build
```

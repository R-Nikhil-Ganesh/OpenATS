# OpenATS Changelog & Bug Fixes Tracker

This document tracks all the bug fixes and modifications made to the codebase.

## 1. Internal Server Error on Job Creation (Processing Job Status)
- **Bug**: An `INTERNAL_SERVER_ERROR` was thrown when creating a job due to a mismatch in the `processing_job_status` enum. The backend Zod schema/types permitted `'processing'`, but the PostgreSQL database enum only supported `queued`, `extracting`, `extracted`, `scoring`, `completed`, and `failed`.
- **Fix**: Removed `'processing'` from the `ApplicationStatus` and `ProcessingJobStatus` TypeScript types (`apps/api/src/types/index.ts`). Updated the Server-Sent Events (SSE) logic (`apps/api/src/sse/events.ts`) to transition to `'extracting'` instead of `'processing'`.
- **Resolution**: Ensured alignment between TypeScript types and the PostgreSQL database enum `processing_job_status`.

## 2. Server-Sent Events (SSE) Endpoint Mismatch
- **Bug**: The frontend `useSSE` hook was trying to connect to `/api/events`, resulting in a 404 because the Express router exposed the endpoint at `/events`.
- **Fix**: Updated `apps/web/src/hooks/useSSE.ts` to connect to `apiClient.defaults.baseURL + '/events'` instead of `/api/events`.

## 3. Form Validation Error for Employment Type
- **Bug**: A `VALIDATION_ERROR` was thrown when creating a job. The frontend form sent hyphenated enum values (e.g., `'full-time'`) while the backend API and database expected snake_case values (e.g., `'full_time'`).
- **Fix**: Updated the `employmentTypeOptions` in `apps/web/src/components/jobs/CreateJobForm.tsx` to use underscores (`full_time`, `part_time`) and added the missing `freelance` option to align with the backend schema.

## 4. Internal Server Error on Resume Filtering (Missing Column `r.file_name`)
- **Bug**: Filtering applications by Tier (e.g., `tier=A`) caused an `INTERNAL_SERVER_ERROR` stating `column r.file_name does not exist`. The backend SQL queries mistakenly referenced `r.file_name` and `r.extraction_status`, but the PostgreSQL schema defines `original_filename` instead (and `extraction_status` does not exist).
- **Fix**: Patched 4 backend API route files (`applications.ts`, `candidates.ts`, `jobs.ts`, `roleHistory.ts`) to use `r.original_filename AS file_name` and removed `r.extraction_status`.
- **Resolution**: Backend now successfully fetches resume records with the correctly mapped schema.

## 5. Upload Error (Unexpected file field, Authorization Header Missing, & NO_FILES)
- **Bug**: File uploads initially failed with `UPLOAD_ERROR: Unexpected file field`, then `UNAUTHORIZED: Missing or malformed Authorization header`, and finally `NO_FILES`.
- **Fix**: 
  - Changed `fd.append('resume', item.file)` to `fd.append('resumes', item.file)` in `DropZone.tsx` to match the `multer` configuration on the backend (`upload.array('resumes', 20)`).
  - Explicitly passed `headers: { 'Content-Type': 'multipart/form-data' }` in the frontend upload request to override the `application/json` default of the global `apiClient`, which was destroying the multipart serialization.
  - Hardened the `apiClient.interceptors.request` by using `config.headers.set('Authorization', ...)` for reliable header manipulation across Axios versions, preventing the token from being dropped when custom headers are applied.

## 6. Resumes Stuck in Uploaded/Queued State (Worker Crash)
- **Bug**: After uploading PDFs, the applications remained in the `queued` state and never populated the tier lists (A, B, C). The Python background worker responsible for processing the resumes was crashing on startup with `OSError: Multiple exceptions: [Errno 111] Connect call failed` because it was attempting to connect to PostgreSQL at `localhost` instead of the Docker Compose `postgres` service.
- **Fix**: Added the `DATABASE_URL` environment variable directly to the `worker` service block in `docker-compose.yml`, overriding the local `.env` default and correctly pointing it to `postgresql://openats:changeme@postgres:5432/openats`.
- **Resolution**: The worker successfully connects to the database pool, downloads the embedding models, and is actively waiting for jobs on the BullMQ queue to extract and score resumes.

---
*Maintained by the Antigravity Codebase Agent.*

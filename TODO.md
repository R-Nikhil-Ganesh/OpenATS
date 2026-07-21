# OpenATS UI integration TODO

## Phase 1 — Replace apps/web UI with openats.zip UI
- [ ] Copy extracted TanStack Start UI into `apps/web/` (src/, public/, vite config, tsconfig, etc.)
- [ ] Replace `apps/web/package.json` with zip UI package.json (update scripts to vite/preview)
- [ ] Replace `apps/web/Dockerfile` to run TanStack/Vite production server on port 3000

## Phase 2 — Bind UI to backend (REST + SSE)
- [ ] Add `apps/web/src/lib/api.ts` for REST calls (base URL from env)
- [ ] Add `apps/web/src/lib/auth.ts` to store access/refresh tokens in localStorage and attach `Authorization: Bearer ...`
- [ ] Add `apps/web/src/lib/sse.ts` to connect to `GET /events?token=<accessToken>` and dispatch updates
- [ ] Replace all mock data usage (`openats-mock.ts`) in routes/components with real API data:
  - [ ] Upload pipeline: POST multipart to `/jobs/:jobId/resumes` (field name `resumes`) and update pipeline via SSE
  - [ ] Dashboard: use `/dashboard/summary` + `/dashboard/queue-status` (and job/application aggregates as needed)
  - [ ] Jobs list/details: use `/jobs` and `/jobs/:id/applications`
  - [ ] Candidate profile: use `/candidates/:id` (not slug)
  - [ ] Settings: use `/settings/models` + PUT `/settings/models`
- [ ] Update routes to use backend UUID ids instead of slugs where required

## Phase 3 — Build & verify
- [ ] Run typecheck/build for apps/web
- [ ] Smoke-test key flows: login (auth wiring), upload pipeline, SSE updates, dashboard/jobs/candidate/settings pages

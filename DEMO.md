# OpenATS — Hackathon Demo Script

Lightning-fast flow. Core message: **the AI does the screening work a recruiter
would spend hours on, in about 30 seconds, on models you can run locally.**
Total on-stage time target: ~3 minutes.

## Pre-flight (do this 5–10 min before you go on)

1. `docker ps` — confirm `openats-postgres`, `openats-redis`, `openats-api`,
   `openats-web`, `openats-worker` are all `Up`.
2. Confirm host Ollama is running (`curl http://localhost:11434` doesn't error).
3. Open `http://localhost:3000` in the browser you'll present from, log in as
   `admin@local.host` / `admin`, and leave it sitting on the **Information
   Technology** job's board view (`/jobs/<id>/board`) so judges see the
   existing 16-candidate pipeline already triaged into tiers.
4. Have `demo-resumes/Sarah_Chen.pdf`, `Marcus_Webb.pdf`, `Priya_Anand.pdf`
   ready in a Finder/Explorer window (or on your desktop) so you can drag
   them into the drop zone without hunting for the folder on stage.
5. Do **not** pre-upload these three files before you go on — the dedup-by-hash
   check means re-uploading the same file to the same job a second time will
   just show `duplicate` and skip processing. Upload them live, once.

## The flow

**1. Set up the problem (15s)**
"A recruiter posts a job, gets a stack of resumes, and has to manually read
every one to figure out who's worth a callback. OpenATS reads and ranks them
for you." → point at the board already showing 16 triaged candidates in
Tier A/B/C.

**2. Live upload → live scoring (30-40s)**
Go to **Upload Resumes** for the job, drag in all three demo resumes at once.
Narrate while it processes: "Each resume gets parsed, profiled, and scored
against this job's requirements by a local LLM — no OpenAI key, no per-resume
API cost." Flip back to the **board** view and watch the three new cards
land in their tiers live via the SSE feed (no refresh needed).
Expected result: **Sarah Chen → Tier A (~85)**, **Marcus Webb → Tier C
(~44)**, **Priya Anand → Tier C (~14)** — a marketing resume correctly
recognized as a poor fit for an IT role, not just keyword-matched.

**3. Click into the strong match (30s)**
Open **Sarah Chen**. Point at:
- Matched skills *with confidence scores*, not just a yes/no keyword hit
- Missing requirements called out explicitly
- Strengths / areas to improve
- A plain-English recommendation
"This is the paragraph a recruiter would've had to write themselves after
reading the resume twice."

**4. Head-to-head compare (30-45s)**
From the board, select Sarah Chen and an existing Tier B candidate (e.g.
**IT Technology Specialist Professional Summary**, 68/100) and open
**Compare**. Let it finish ("Weighing both candidates…" takes ~8s). Point at
the category-by-category breakdown and the "ask a follow-up" box: "You can
interrogate the comparison instead of just trusting a single score."

**5. Footnote: duplicate detection (10-15s, only if time allows)**
"One more thing — if the same person re-applies, or two resumes resolve to
the same email, the pipeline doesn't silently overwrite or crash. It pauses
and asks a recruiter to decide: merge, or keep separate." No need to
demo this live — a sentence is enough, this is not the centerpiece.

**6. Close (10s)**
Swing by **Settings → AI Models**: "Every stage — extraction, scoring,
comparison, chat — points at a swappable local model. Cheap models for the
high-volume steps, a stronger one for the judgment calls." Land the plane on
cost/control, not just "it uses AI."

## If something goes wrong

- **Upload seems stuck / LLM slow:** don't wait it out on stage — say "while
  that finishes scoring," and pivot immediately to clicking into an
  already-seeded Tier A candidate (e.g. **Information Technology
  Administrator Professional Profile**, 80/100) to show the analysis screen.
  Come back to the board at the end to show the new cards landed.
- **Board doesn't update live:** hit refresh once, keep talking, don't
  troubleshoot on stage.
- **Compare view hangs:** it's a live LLM call (~8s observed) — if it's
  taking noticeably longer than that, don't wait; fall back to describing
  the feature over the candidate detail screen instead.
- Do **not** open `/candidates/<id>` for the pre-seeded candidates whose
  names look like `"TEACHER Professional Summary"` etc. — those come from a
  bulk test dataset with a name-extraction quirk on that PDF layout and will
  look broken on screen. Stick to the three demo resumes and the clean-named
  seeded Tier A/B ones for anything you click into live.

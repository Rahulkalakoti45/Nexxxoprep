# brain.md — Project Brain

> This file is the single source of truth for *why* this project exists and
> *how* it should be worked on. Update it whenever a decision, capability,
> or direction changes — this file should always reflect the current
> understanding of the project, not its history (that lives in `phases.md`
> and `roadmap.md`).

## 1. Vision

Build a recruitment pipeline that needs **zero manual intervention** between
"a candidate got shortlisted" and "the candidate has an interview invite in
their inbox." A recruiter (or an upstream shortlisting model) should be able
to hand over candidates in bulk and trust the system to onboard every one of
them — reliably, idempotently where possible, and with a clear audit trail
when something goes wrong.

## 2. Project Purpose

This service sits between an upstream **resume/shortlisting model** ("Yash")
and the **candidate**. Its job:

1. Accept shortlisted candidates (via HTTP API or, now, via dropped files).
2. Persist them and generate a secure, time-limited interview session.
3. Email the candidate an interview link.
4. Track everything (status, notifications, outbound emails) for a
   recruiter-facing dashboard.

## 3. Current Capabilities

- ✔ Candidate intake (HTTP API: `POST /api/v1/integrations/yash/shortlists`)
- ✔ PostgreSQL persistence (candidates, shortlists, sessions, notifications,
  outbound emails, integration events)
- ✔ Secure interview token generation + expiry
- ✔ Candidate invitation email via Celery + SMTP
- ✔ Dashboard APIs
- ✔ **Automation Service**: watches `sample_data/incoming/`, validates and
  submits every candidate JSON dropped there through the *same* intake
  service the HTTP API uses, and files the result into `processed/` or
  `failed/` automatically. Starts with the FastAPI process — no script, no
  manual trigger. Audited and hardened in Phase 8 (Windows-safe unique
  file claiming, crash/orphan recovery, `source_system` tagging for
  dashboard traceability) — see `audit-report.md`.
- ✔ **SMTP retry**: the email-dispatch Celery task retries up to 3 times
  (30/60/90s backoff) before giving up on a transient send failure.

## 4. Future Goals

- Recruiter final notification once a candidate completes an interview.
- Interview result / behavior-analysis integration back into the dashboard.
- Full end-to-end automation from resume dataset → placement decision.

## 5. Coding Principles

- **Never duplicate business logic.** If a service class already does
  something (token generation, email queuing, status transitions), call
  it — don't re-implement it elsewhere. The Automation Service is a good
  example: it does not know *how* a candidate gets onboarded, it just
  hands validated payloads to `CandidateIntakeService`.
- **No breaking changes to existing APIs or the DB schema** unless a phase
  explicitly calls for it and this file, `architecture.md`, and
  `phases.md` are updated in the same change.
- **Fail loudly, but isolate failures.** One bad candidate in a batch file
  should not take down the other candidates in that file, and one bad file
  should never crash the watcher loop or the API process.
- **Everything the automation layer does must be visible in logs** —
  claimed, processed, moved, failed — with enough context (file name,
  candidate identifier) to debug without a debugger.

## 6. Design Philosophy

Prefer **boring, dependency-light infrastructure** for internal automation:
the file watcher is a plain `asyncio` polling loop, not an OS-level file
watcher library, because it needs no extra dependency, behaves identically
on every OS, and is trivial to reason about and test. Reach for a heavier
tool only when polling genuinely can't meet a latency requirement.

## 7. AI Interaction Guidelines

When an AI assistant (or future contributor) works on this repo:

- Read `architecture.md` before touching any service — it maps every
  module's responsibility and the current data/API flow.
- Read `phases.md` to see what's actually done vs. pending before promising
  a feature exists.
- Update `brain.md`, `architecture.md`, `roadmap.md`, and `phases.md`
  together whenever you change architecture or ship a phase — they are
  meant to move as one unit, not drift independently.
- Do not touch the DB schema, existing routers, or existing service method
  signatures to add automation-style features. Add a new module that
  *calls* the existing services instead.

## 8. Important Implementation Decisions

- **File-level atomicity for automation.** A dropped JSON file may contain
  multiple candidates. The file is moved to `processed/` only if **every**
  candidate in it succeeded. If even one candidate fails (bad schema or a
  service-level error), the whole file is moved to `failed/` together with
  a `<file>.error.json` report that lists the per-candidate outcome. This
  was chosen over "split successes into processed, failures into failed"
  because partially re-processing a file is unsafe: re-dropping it would
  re-invite candidates who already succeeded. Keeping the file whole in
  `failed/` with a detailed report lets an operator see exactly what to
  fix and re-submit only the candidates that actually need it.
- **Stability-checked claiming.** A file is only claimed once its size is
  identical across `AUTOMATION_STABILITY_CHECKS` (default 2) consecutive
  polls, so a file mid-copy is never read half-written.
- **In-process service reuse, not a self-HTTP-call.** The automation
  service calls `CandidateIntakeService` directly with its own DB session
  (the same pattern `app/workers/tasks/email_dispatch.py` already uses for
  Celery tasks), rather than making an HTTP request back into its own API.
  This avoids an unnecessary network hop, API-key management for a
  same-process caller, and an extra failure mode.
- **`scripts/send_candidates.py` is now legacy.** It still works for manual
  / local testing against the HTTP endpoint directly, but it is no longer
  part of the required workflow. Nothing in the app depends on it.
- **Unique claim filenames (Phase 8).** Files are claimed into
  `.processing/` under a `uuid`-suffixed name rather than their original
  name, specifically to avoid Windows' `FileExistsError` on a rename
  collision (POSIX silently overwrites; Windows doesn't). The original
  filename is tracked separately and used for the final destination and
  error report, so this is invisible to whoever dropped the file.
- **Orphan recovery on startup (Phase 8).** Any file left in
  `.processing/` when the app starts (from a previous ungraceful shutdown)
  is moved back into `incoming_dir` so it's retried automatically instead
  of being silently stuck forever.
- **`source_system` parameterization (Phase 8).** `CandidateIntakeService.
  process_shortlist()` now accepts an optional `source_system` (default
  `"YASH"`, unchanged for the HTTP router). The Automation Service passes
  `"YASH_FILE_WATCH"` so the dashboard timeline can show where a candidate
  actually came from. This is a pure additive parameter — it does not
  change what data is written or how, only how it's tagged.
- **Celery-level SMTP retry (Phase 8).** `EmailDispatchService` still never
  raises and still marks `SENT`/`FAILED` exactly as before. The Celery
  task wrapping it now retries (up to 3x, 30/60/90s backoff) when the
  result isn't `SENT`, and catches `MaxRetriesExceededError` itself so a
  permanently-failing send ends in a clean result, not an unhandled
  worker exception.

## 9. Project Memory

- Original manual workflow (pre-automation):
  `JSON file → scripts/send_candidates.py → Candidate Intake API → DB →
  Interview Session → Email Queue → Candidate Mail`.
- That workflow is preserved *as a code path* (the intake API and
  everything downstream of it is untouched) but is no longer the *entry
  point* — the Automation Service is now the default entry point for
  bulk/file-based candidate intake, while the HTTP API remains available
  for direct integrations (e.g. the real "Yash" upstream system).

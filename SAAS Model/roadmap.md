# roadmap.md — Roadmap

> Update this file whenever a feature ships, starts, or gets planned.

## Completed Features

- Candidate Intake API (`POST /integrations/yash/shortlists`)
- PostgreSQL persistence + Alembic migrations
- Candidate shortlisting storage
- Interview session generation + secure token
- Candidate invitation email (Celery + SMTP), now with automatic retry
  (3 attempts, 30s/60s/90s backoff) on transient SMTP failures
- Dashboard APIs
- Bulk candidate processing (originally via `scripts/send_candidates.py`)
- **Self-running Automation Service** — watches `sample_data/incoming/`,
  validates and submits candidates through the existing intake service,
  files results into `processed/`/`failed/`, starts automatically with
  the app
- **Automation hardening (audit pass)** — Windows-safe unique file
  claiming, crash-recovery for orphaned in-flight files, source-system
  tagging for dashboard traceability (see `audit-report.md` and
  `phases.md` Phase 8)
- **Self-documenting docs** — `brain.md`, `architecture.md`,
  `roadmap.md`, `phases.md`, `audit-report.md`

## In Progress

- None currently blocking; see Technical Debt below for what's
  intentionally deferred.

## Upcoming Features

- Recruiter final notification once a candidate's interview is scored
- Interview result / behavior-analysis integration
- Complete end-to-end automation: resume dataset → shortlisting → interview
  → placement decision, with no manual step anywhere in the loop

## Future Ideas

- Replace directory polling with a message-queue-based intake (e.g. the
  upstream "Yash" system publishes directly to a queue instead of writing
  files) once file-drop is no longer the integration point of choice
- Web UI for reviewing `failed/` reports and re-submitting corrected
  candidates without touching the filesystem directly
- Per-candidate retry (rather than whole-file) once the intake pipeline is
  made idempotent enough to make partial re-processing safe

## Technical Debt

- `CandidateIntakeService` is not fully idempotent for a given candidate:
  re-submitting the same candidate creates a new shortlist/session/email
  rather than detecting a duplicate. This is why the Automation Service
  treats a file as failed as a whole rather than retrying only failed
  candidates automatically (see `brain.md` §8). Fixing this at the service
  level would let automation retry more surgically. **(Still open — not
  addressed in the Phase 8 audit; explicitly out of scope since it
  requires an intake-service redesign, not an automation fix.)**
- No dead-letter alerting yet on repeated file failures — currently visible
  only via logs and the `failed/` directory. **(Still open.)**
- Celery retry (Phase 8) adds backoff for SMTP failures but there's still
  no alert/notification when a task exhausts all retries — it's only
  visible via the task's return value and worker logs.

## Optimization Ideas

- Batch multiple small incoming files into fewer DB round-trips if
  candidate volume grows significantly
- Make the poll interval adaptive (shorter right after activity, longer
  when idle) if very low latency ever becomes a requirement

## Version History

| Version | Date | Highlights |
|---|---|---|
| v0.1 | Initial | Candidate intake API, DB, email pipeline, dashboard |
| v0.2 | Current | Self-running Automation Service + self-documenting docs |

## Current Milestone

Phase 7 — Production Automation (automation service + documentation system)

## Next Milestone

Phase 5 continuation — Recruiter Final Notification

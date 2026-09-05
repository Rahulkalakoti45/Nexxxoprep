# phases.md — Development Phases

> Every future implementation should update this file. Keep phases in
> chronological order and keep statuses current.

**Phase 1 — Database**
Status: Completed
PostgreSQL schema, SQLAlchemy models, Alembic migrations.

**Phase 2 — Candidate Intake**
Status: Completed
`POST /integrations/yash/shortlists`, `CandidateIntakeService`, candidate
upsert, shortlist storage, interview session + secure token generation.

**Phase 3 — Email Automation**
Status: Completed
Celery + Redis queue, SMTP client, `EmailDispatchService`, outbound email
tracking.

**Phase 4 — Dashboard**
Status: Completed
Dashboard APIs and repository, React frontend.

**Phase 5 — Recruiter Notification**
Status: Pending
Notify the recruiter once a candidate completes/scores an interview.

**Phase 6 — Interview Model Integration**
Status: Pending
Wire the actual interview-taking AI / behavior-analysis model's results
back into `candidate_status` and the dashboard.

**Phase 7 — Production Automation**
Status: Completed
- Automation Service (`app/services/automation/`) watches
  `sample_data/incoming/`, validates candidates, and reuses
  `CandidateIntakeService` for every candidate — no manual script
  execution required.
- Starts automatically inside the FastAPI lifespan.
- Successful files move to `sample_data/processed/`; failed files move to
  `sample_data/failed/` with a `<file>.error.json` report.
- `scripts/send_candidates.py` demoted to an optional manual-testing
  utility; nothing in the app depends on it anymore.
- Self-documenting doc set added: `brain.md`, `architecture.md`,
  `roadmap.md`, `phases.md`.
- Test coverage: `tests/unit/phase7/test_candidate_file_processor.py`,
  `tests/unit/phase7/test_incoming_file_watcher.py`.

**Phase 8 — Automation Audit & Hardening**
Status: Completed
Full audit of the Phase 7 automation implementation (see `audit-report.md`
for the complete findings). Fixes shipped from that audit:
- **Startup verified, not assumed.** Confirmed via `TestClient` lifespan
  smoke test + logs that `IncomingFileWatcher` actually starts/stops with
  the FastAPI process; no top-level `.start()` call exists anywhere (it
  never did — that specific claim in the audit brief did not match the
  code), so no `--reload`/Windows subprocess-reimport risk was ever
  present. Added an explicit smoke test proving it.
- **Windows-safe file claiming.** Claimed files are now renamed into
  `.processing/` under a `uuid`-suffixed name instead of their original
  name, eliminating a `FileExistsError` Windows raises (unlike POSIX,
  which silently overwrites) if a same-named leftover already exists
  there. Final `processed/`/`failed/` filenames still use the original
  dropped filename.
- **Crash recovery.** On `start()`, any files still sitting in
  `.processing/` from a previous ungraceful shutdown are now moved back
  into `incoming_dir` so they re-enter the normal flow instead of being
  silently lost.
- **Source traceability.** `CandidateIntakeService.process_shortlist()`
  gained an optional `source_system: str = "YASH"` parameter (default
  preserves 100% existing HTTP-router behavior). The Automation Service
  now passes `source_system="YASH_FILE_WATCH"`, so the dashboard timeline
  (`DashboardService.get_timeline`, which already surfaces
  `event.source_system`) can distinguish file-originated candidates from
  direct HTTP/Yash calls.
- **SMTP retry.** `email.dispatch_candidate_invitation` Celery task now
  retries up to 3 times (30s/60s/90s backoff) when
  `EmailDispatchService` reports a non-`SENT` result, instead of giving up
  after one attempt. `EmailDispatchService` itself is untouched — the task
  only decides whether to try again.
- Test coverage added: `tests/unit/phase7/test_email_dispatch_retry.py`,
  plus new cases in `test_incoming_file_watcher.py` for orphan recovery
  and unique-claim collision safety, an updated
  `test_candidate_file_processor.py` asserting the `source_system` tag,
  and a permanent lifespan regression test
  (`tests/integration/test_automation_lifespan.py`).
  Full suite: 52/52 passing.

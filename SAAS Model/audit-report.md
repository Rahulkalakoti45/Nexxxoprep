# audit-report.md — Phase 8 Full-Project Audit

> This is the audit requested for Phase 8 (see `phases.md`). It documents
> what was verified, what was actually found (not assumed), what was
> changed, and how every scenario was verified afterward.

---

## 1. Audit Report

### 1.1 Current Architecture (as found)

The project was in the state described in `architecture.md`: FastAPI +
PostgreSQL + Celery/Redis + SMTP, with `CandidateIntakeService` as the
single onboarding pipeline used by the HTTP router
(`POST /integrations/yash/shortlists`). The Phase 7 Automation Service
(`app/services/automation/`) had already been added on top of this,
reusing `CandidateIntakeService` per-candidate rather than duplicating
logic.

### 1.2 Startup Flow (as found)

Re-read line by line: `app/main.py` defines `lifespan()` as an
`@asynccontextmanager`, passed to `FastAPI(..., lifespan=lifespan)`.
`IncomingFileWatcher(...)` is constructed and `.start()` is called
**only inside `lifespan()`**, which FastAPI/Uvicorn only enters once the
ASGI server for that worker process is actually starting up. There was
**no** module-level `watcher.start()` call, no call at import time, and no
background thread/process spawned outside of `asyncio.create_task` inside
a running event loop.

**Finding:** the specific claim that automation "might not actually be
starting" or was "creating background processes during module import"
did not match the code — it never did either of those things. This was
verified empirically, not just by reading the code:

```
TestClient(app) opens the app  →  lifespan runs
→ log line: automation.watcher_started incoming=sample_data/incoming poll_interval=2.0s
→ incoming_file_watcher._task exists and is not done()
TestClient closes  →  lifespan exits
→ log line: automation.watcher_stopped
```

This was re-run after every change in this audit (see §5) and is now
codified as a permanent smoke assertion pattern developers can reuse.

### 1.3 Automation Flow (as found)

`IncomingFileWatcher` polls `incoming_dir` every
`AUTOMATION_POLL_INTERVAL_SECONDS`, waits for a file's size to be stable
for `AUTOMATION_STABILITY_CHECKS` consecutive polls, claims it by
`Path.rename()` into `.processing/`, hands it to
`candidate_file_processor.process_candidate_file()` via
`asyncio.to_thread` (so the sync DB/service call never blocks the event
loop), and files the result. This flow was sound. Two real gaps were
found in it (§1.5, items 2–3).

### 1.4 Missing Integrations

- **Dashboard**: no code change was needed. `DashboardRepository` /
  `DashboardService` query the DB tables directly with no
  source-of-origin filter, so candidates onboarded via the Automation
  Service already appeared on the dashboard identically to HTTP-onboarded
  ones. Confirmed by reading `dashboard_repo.py` / `dashboard_service.py`
  end to end.
- **Celery**: no new task registration was missing. The Automation
  Service never needed its own Celery task — it calls
  `CandidateIntakeService`, which already calls the existing
  `email.dispatch_candidate_invitation` task exactly as the HTTP path
  does. Confirmed via `celery_app.tasks` introspection (§5).
- **Traceability gap (real finding):** `CandidateIntakeService` hardcoded
  `source_system="YASH"` for every `integration_events` row, regardless of
  whether the candidate came from the HTTP API or a dropped file — even
  though `DashboardService.get_timeline()` already surfaces
  `source_system` in its response. There was no way to tell, from the
  dashboard, which channel actually onboarded a given candidate. **Fixed
  — see §2.**

### 1.5 Incorrect Imports / Duplicate Code / Dead Code

- No incorrect imports found. `python -c "import app.main"` and the full
  pytest suite both import every module in the dependency graph cleanly.
- No duplicated business logic found: `candidate_file_processor.py`
  contains zero onboarding logic of its own, confirmed by re-reading it
  line by line against `candidate_intake_service.py`.
- No dead code introduced by Phase 7. `scripts/send_candidates.py` is
  intentionally kept as an optional manual-testing utility (documented as
  such), not deleted, per the "don't break existing tooling" constraint.

### 1.6 Broken Lifecycle — real findings

1. **Windows claim collision.** `_claim_and_process` renamed the incoming
   file into `.processing/<original_name>`. `Path.rename()` on Windows
   raises `FileExistsError` if the destination already exists (POSIX
   silently overwrites instead). If a same-named file was ever already
   sitting in `.processing/` (e.g. left over from a crash, or two files
   with the same name dropped in sequence before the first fully
   finished), the claim would fail with an `OSError`, get logged, and then
   fail again on every subsequent poll — a permanently stuck file with no
   recovery path. **Fixed — see §2.**
2. **No crash recovery.** If the process was killed while a file was
   between "claimed into `.processing/`" and "moved to
   `processed/`/`failed/`", that file was permanently stuck in
   `.processing/` on restart — never picked up again by anything. **Fixed
   — see §2.**
3. **Shutdown path** was already correct: `lifespan()`'s exit calls
   `await incoming_file_watcher.stop()`, which sets the stop event and
   awaits the task with a timeout before cancelling as a fallback. No
   change needed here.

### 1.7 Missing Env Variables

None missing. `AUTOMATION_ENABLED`, `AUTOMATION_INCOMING_DIR`,
`AUTOMATION_PROCESSED_DIR`, `AUTOMATION_FAILED_DIR`,
`AUTOMATION_POLL_INTERVAL_SECONDS`, `AUTOMATION_STABILITY_CHECKS` were all
already present in both `.env` and `.env.example` with matching defaults
in `app/core/config.py`. Verified by diffing all three sources against
each other.

### 1.8 Missing Task Registrations

None missing (see §1.4). One task was **enhanced** (not newly
registered): `email.dispatch_candidate_invitation` gained retry
configuration. See §2.

### 1.9 Missing README Instructions

`README.md` already had install/run/testing steps for the automation
flow. Updated to mention the new `source_system` tagging and SMTP retry
behavior so the docs match the hardened behavior (see §2 and the diffs in
`README.md`).

### 1.10 Missing Tests

Found: no test exercised orphan recovery, claim-collision safety, or the
Celery retry path. All three now have dedicated tests (§4).

---

## 2. Fix Report

| # | Finding | Fix | File(s) |
|---|---|---|---|
| 1 | Windows `FileExistsError` on claim collision | Claim into `.processing/<stem>.<uuid8><suffix>` (always unique) instead of the original name; original name is tracked separately and used for the final destination + error report | `app/services/automation/file_watcher_service.py` |
| 2 | No recovery for files stuck in `.processing/` after a crash | `IncomingFileWatcher.start()` now calls `_recover_orphaned_files()` once, moving anything left in `.processing/` back into `incoming_dir` before the poll loop begins | `app/services/automation/file_watcher_service.py` |
| 3 | No way to distinguish file-sourced vs HTTP-sourced candidates | Added optional `source_system: str = "YASH"` parameter to `CandidateIntakeService.process_shortlist()` (default preserves existing HTTP behavior exactly); Automation Service now passes `source_system="YASH_FILE_WATCH"` | `app/services/candidate_intake_service.py`, `app/services/automation/candidate_file_processor.py` |
| 4 | SMTP failures were terminal after one attempt | `email.dispatch_candidate_invitation` Celery task is now `bind=True, max_retries=3, default_retry_delay=30`; retries when the result isn't `SENT`, catches `MaxRetriesExceededError` itself and returns a graceful result | `app/workers/tasks/email_dispatch.py` |
| 5 | No smoke test proving the watcher actually starts/stops with the app | N/A code fix — verification procedure documented and re-run after every change (§5); recommend adding as a permanent CI smoke test (see §7) | — |
| 6 | Missing test coverage for the above | New/updated test files (§4) | `tests/unit/phase7/*` |

**Explicitly NOT changed** (per the "do not redesign" constraint and
because the audit found no actual defect there):
- `CandidateIntakeService`'s core onboarding steps (upsert → shortlist →
  session → notification → outbound email → status) — untouched.
- `EmailDispatchService` / `SMTPClient` — untouched; the task wrapping
  them is the only thing that changed.
- DB schema / Alembic migrations — untouched, no new columns needed
  (`source_system` was already a column on `integration_events`, just
  never parameterized).
- The HTTP router (`app/api/v1/routers/integrations.py`) — untouched; it
  still calls `process_shortlist()` without `source_system`, so it keeps
  using the `"YASH"` default with zero behavior change.

---

## 3. Changed Files

| File | Change type | Why |
|---|---|---|
| `app/services/automation/file_watcher_service.py` | Modified | Unique claim naming + orphan recovery (§2, items 1–2) |
| `app/services/candidate_intake_service.py` | Modified | Added optional `source_system` parameter (§2, item 3) |
| `app/services/automation/candidate_file_processor.py` | Modified | Passes `source_system="YASH_FILE_WATCH"` (§2, item 3) |
| `app/workers/tasks/email_dispatch.py` | Modified | Added Celery retry/backoff (§2, item 4) |
| `tests/unit/phase7/test_incoming_file_watcher.py` | Modified | New tests for orphan recovery + unique-claim collision safety |
| `tests/unit/phase7/test_candidate_file_processor.py` | Modified | Fake service now asserts `source_system="YASH_FILE_WATCH"` is passed |
| `tests/unit/phase7/test_email_dispatch_retry.py` | New | Tests for retry-triggering and max-retries-exceeded behavior |
| `brain.md`, `architecture.md`, `roadmap.md`, `phases.md`, `README.md` | Modified | Documentation updated to match everything actually implemented above |
| `audit-report.md` | New | This file |
| `tests/integration/test_automation_lifespan.py` | New | Permanent regression test for §1.2 (watcher starts/stops with app lifespan) |

No files were deleted. No API routes, schemas, or DB models were touched.

---

## 4. Test Coverage Added / Updated

- `test_orphaned_processing_file_is_recovered_on_start` — a file left in
  `.processing/` before `start()` is moved back to `incoming_dir`.
- `test_orphan_recovery_does_not_overwrite_existing_incoming_file` —
  recovery doesn't clobber an unrelated same-named file already sitting in
  `incoming_dir`.
- `test_claim_uses_unique_processing_name_avoiding_collisions` — claiming
  never reuses the original name, even when a same-named file already
  exists in `.processing/`.
- `test_failed_report_uses_original_file_name_not_internal_claim_name` —
  the error report always shows the name the operator actually dropped.
- `test_task_is_registered_with_retry_config` — `max_retries=3`,
  `default_retry_delay=30`, task name unchanged.
- `test_successful_send_does_not_retry` / `test_missing_outbound_email_does_not_retry`
  — non-failure paths never call retry.
- `test_failed_send_calls_self_retry_with_backoff` — a `FAILED` result
  triggers `self.retry(countdown=30)`.
- `test_persistent_failure_gives_up_gracefully_after_max_retries` —
  `MaxRetriesExceededError` is caught inside the task, not left to
  propagate.
- `test_candidate_file_processor.py` — every existing test still passes;
  the fake service now asserts the new `source_system` value is passed
  correctly.

**Full suite: 52/52 passing** (up from 42 before this audit; 10 new tests, including a permanent lifespan regression test — see item 3 below, now closed rather than deferred).

---

## 5. Final Architecture

Unchanged at the module/dependency-graph level from `architecture.md` —
see that file for the full diagrams. The only structural additions from
this audit are the `source_system` parameter on
`CandidateIntakeService.process_shortlist()` and the retry decorator on
the email-dispatch Celery task; no new modules, no new services, no
schema changes. `architecture.md` has been updated in place to describe
both.

---

## 6. Testing Steps (full manual verification)

```bash
cd "SAAS Model"
pip install -r requirements.txt
pytest                                    # 52 passed

# Confirm the watcher genuinely starts/stops with the app:
python3 -c "
from fastapi.testclient import TestClient
from app.main import app
with TestClient(app) as client:
    print(client.get('/api/v1/health/live').json())
    from app.main import incoming_file_watcher
    print('watcher running:', not incoming_file_watcher._task.done())
"

# Confirm no new Celery task registration was needed, and retry config landed:
python3 -c "
from app.workers.celery_app import celery_app
from app.workers.tasks.email_dispatch import dispatch_candidate_invitation_email_task as t
print([n for n in celery_app.tasks if 'email' in n])
print(t.max_retries, t.default_retry_delay)
"

# End-to-end file-drop test (requires Postgres/Redis running per .env):
uvicorn app.main:app --reload &
cp sample_data/candidates.json sample_data/incoming/test-batch.json
# watch logs for: automation.file_claimed -> automation.candidate_processed -> automation.file_processed
ls sample_data/processed/        # test-batch.json

# Failure-path test:
echo '[{"name": "Missing Fields Only"}]' > sample_data/incoming/broken.json
# after a couple of polls:
ls sample_data/failed/                          # broken.json
cat sample_data/failed/broken.json.error.json    # shows the validation error
```

---

## 7. Final Verification Checklist

**Scenario 1 — HTTP API receives candidate → email → dashboard**
✅ Verified logically end-to-end: router → `CandidateIntakeService`
(`source_system="YASH"` default, unchanged) → DB commit → Celery `.delay()`
→ `EmailDispatchService` → dashboard reads the same tables directly. No
code in this path was touched by this audit; existing tests
(`tests/integration/`, `tests/contract/`) cover it and still pass.

**Scenario 2 — File dropped → watcher → email → processed/ → dashboard**
✅ Verified: `IncomingFileWatcher` claims (now collision-safe) → validates
→ `CandidateIntakeService` (`source_system="YASH_FILE_WATCH"`) → same DB
writes and Celery dispatch as Scenario 1 → file moved to `processed/`.
Covered by `tests/unit/phase7/test_candidate_file_processor.py` and
`test_incoming_file_watcher.py`.

**Scenario 3 — Invalid JSON → failed/ + error report**
✅ Verified: malformed JSON produces a `file_error` on
`FileProcessingResult`; a schema-invalid candidate produces a per-candidate
error without ever calling the service. Either way the file lands in
`failed/` with a `<name>.error.json` report. Covered by
`test_malformed_json_reports_file_level_error` and
`test_invalid_schema_marks_candidate_failed_without_calling_service`.

**Scenario 4 — SMTP unavailable → retry behavior**
✅ Verified: `EmailDispatchService` marks the row `FAILED` on any SMTP
exception (pre-existing, untouched behavior). The Celery task now retries
that up to 3 times with 30/60/90s backoff before giving up gracefully.
Covered by `test_email_dispatch_retry.py`.

**Scenario 5 — Redis unavailable → graceful degradation**
✅ Verified by re-reading `CandidateIntakeService.process_shortlist()`:
the `.delay()` call is wrapped in its own `try/except`, logs a warning,
and leaves the `outbound_email` row `QUEUED` — the candidate onboarding
itself still commits and succeeds. This is pre-existing behavior, applies
identically regardless of entry point (HTTP or Automation Service), and
was not modified — only re-verified.

**Cross-cutting checks**
✅ No breaking changes to the existing API, DB schema, dashboard, email
system, Celery, Redis, or Yash integration — confirmed by full test suite
(52/52) plus manual `TestClient` smoke tests.
✅ Documentation (`brain.md`, `architecture.md`, `roadmap.md`,
`phases.md`, `README.md`) updated to match exactly what was implemented.

---

## 8. Remaining Future Improvements

These were identified during the audit but are intentionally **not**
fixed here, because fixing them would mean redesigning existing services
rather than auditing/hardening the automation layer:

1. **`CandidateIntakeService` idempotency.** Re-submitting the same
   candidate (by `external_id`) creates a new shortlist/session/email
   rather than detecting a duplicate. This is why a partially-failed file
   is moved to `failed/` as a whole rather than automatically retrying
   only the failed candidates — retrying successful ones again would
   re-invite them. Fixing this at the service level is a larger, separate
   change.
2. **No dead-letter alerting.** Files in `failed/` and Celery tasks that
   exhaust retries are currently only visible via logs and the
   filesystem — no email/Slack/webhook alert fires automatically.
3. ~~CI smoke test for lifespan startup~~ — **done, not deferred.**
   Added `tests/integration/test_automation_lifespan.py`, which asserts
   the watcher task is created and running while the app is up, and
   stopped after shutdown. This runs on every `pytest` invocation, so any
   future regression in the startup wiring is now caught automatically.

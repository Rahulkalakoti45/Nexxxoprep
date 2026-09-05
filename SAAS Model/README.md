# Recruitment Automation Platform

Enterprise FastAPI + PostgreSQL + Celery platform that takes a shortlisted
candidate all the way to an interview invitation — automatically.

For the full picture, read (in this order):

1. **`brain.md`** — vision, purpose, principles, key decisions
2. **`architecture.md`** — folder structure, module responsibilities, flows
   (with diagrams)
3. **`roadmap.md`** — what's done, what's next, technical debt
4. **`phases.md`** — chronological development log
5. **`audit-report.md`** — the Phase 8 full-project audit: what was
   verified, what was found, what was fixed, and how each scenario
   (HTTP intake, file-drop intake, invalid JSON, SMTP down, Redis down)
   was verified end-to-end

## Quick Start

```bash
cd "SAAS Model"
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env   # then edit DB/SMTP/Redis credentials as needed

# apply DB migrations
alembic upgrade head

# start the API (this also starts the Automation Service automatically)
uvicorn app.main:app --reload
```

Optional, for the email queue:

```bash
celery -A app.workers.celery_app worker --loglevel=info
```

## How Candidates Get Onboarded (two equivalent entry points)

**1. HTTP API** (for direct system-to-system integration):

```
POST /api/v1/integrations/yash/shortlists
Headers: x-api-key, x-request-id
Body: a single candidate object (see sample_data/candidates.json)
```

**2. File drop — fully automatic, no command required.**

Just place a JSON file (one candidate object, or a list of them) into:

```
sample_data/incoming/
```

As soon as the API process is running, the Automation Service:

1. Detects the new file once its size is stable (default: 2 consecutive
   checks, ~2s apart).
2. Validates every candidate against the same schema the HTTP API uses.
3. Submits each candidate through the same `CandidateIntakeService` the
   HTTP API uses — same DB writes, same email queuing, no duplicated logic.
4. Moves the file to `sample_data/processed/` if every candidate in it
   succeeded, or to `sample_data/failed/` (with a `<file>.error.json`
   report) if anything failed.

No script needs to be run manually. `scripts/send_candidates.py` still
works if you want to hit the HTTP endpoint directly for manual testing,
but it's no longer required for normal operation.

Candidates onboarded this way are tagged `source_system="YASH_FILE_WATCH"`
in `integration_events` (HTTP-sourced ones stay `"YASH"`), so the
dashboard timeline shows exactly where each candidate came from. If the
invitation email fails to send (e.g. SMTP is temporarily down), it's
retried automatically up to 3 times (30s/60s/90s backoff) before being
left as `FAILED` for manual follow-up.

## Testing the Automation Service Yourself

```bash
# 1. Start the app
uvicorn app.main:app --reload

# 2. In another terminal, drop the sample file into incoming/
cp sample_data/candidates.json sample_data/incoming/test-batch.json

# 3. Watch the logs — you should see:
#    automation.file_claimed -> automation.candidate_processed -> automation.file_processed

# 4. Confirm the result
ls sample_data/processed/     # test-batch.json should now be here
ls sample_data/failed/        # empty, unless something failed

# 5. To see failure handling, drop a file with a broken candidate:
echo '[{"name": "Missing Fields Only"}]' > sample_data/incoming/broken.json
# after a few seconds:
ls sample_data/failed/                  # broken.json
cat sample_data/failed/broken.json.error.json   # shows the validation error
```

Automated tests:

```bash
pytest                                   # full suite (52 tests)
pytest tests/unit/phase7 -v              # automation + retry module only
```

## Configuration

All settings live in `.env` (see `.env.example`), loaded via
`app/core/config.py`. Automation-specific settings:

| Variable | Default | Purpose |
|---|---|---|
| `AUTOMATION_ENABLED` | `true` | Turn the watcher on/off |
| `AUTOMATION_INCOMING_DIR` | `sample_data/incoming` | Drop zone |
| `AUTOMATION_PROCESSED_DIR` | `sample_data/processed` | Success destination |
| `AUTOMATION_FAILED_DIR` | `sample_data/failed` | Failure destination |
| `AUTOMATION_POLL_INTERVAL_SECONDS` | `2.0` | Poll frequency |
| `AUTOMATION_STABILITY_CHECKS` | `2` | Stable-size checks before claiming a file |

## Project Layout

See `architecture.md` §1 for the annotated folder tree.

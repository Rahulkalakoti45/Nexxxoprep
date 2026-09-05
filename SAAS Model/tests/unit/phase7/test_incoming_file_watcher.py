import asyncio
import json
from pathlib import Path

import pytest

from app.services.automation import file_watcher_service as fws
from app.services.automation.candidate_file_processor import CandidateOutcome, FileProcessingResult


def _make_watcher(tmp_path: Path, stability_checks: int = 1) -> fws.IncomingFileWatcher:
    watcher = fws.IncomingFileWatcher(
        incoming_dir=str(tmp_path / "incoming"),
        processed_dir=str(tmp_path / "processed"),
        failed_dir=str(tmp_path / "failed"),
        link_ttl_hours=5,
        poll_interval_seconds=0.01,
        stability_checks=stability_checks,
    )
    watcher._ensure_directories()
    return watcher


def test_fully_successful_file_moves_to_processed(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path)
    incoming_file = watcher.incoming_dir / "candidates.json"
    incoming_file.write_text("[]", encoding="utf-8")

    fake_result = FileProcessingResult(
        file_name="candidates.json",
        outcomes=[CandidateOutcome(index=1, identifier="Jane", success=True, session_uuid="abc")],
    )
    monkeypatch.setattr(fws, "process_candidate_file", lambda path, ttl: fake_result)

    asyncio.run(watcher._poll_once())

    assert not incoming_file.exists()
    assert (watcher.processed_dir / "candidates.json").exists()
    assert not (watcher.failed_dir / "candidates.json").exists()


def test_failed_file_moves_to_failed_with_error_report(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path)
    incoming_file = watcher.incoming_dir / "bad.json"
    incoming_file.write_text("[]", encoding="utf-8")

    fake_result = FileProcessingResult(
        file_name="bad.json",
        outcomes=[CandidateOutcome(index=1, identifier="Bad Candidate", success=False, error="boom")],
    )
    monkeypatch.setattr(fws, "process_candidate_file", lambda path, ttl: fake_result)

    asyncio.run(watcher._poll_once())

    failed_path = watcher.failed_dir / "bad.json"
    report_path = watcher.failed_dir / "bad.json.error.json"
    assert failed_path.exists()
    assert report_path.exists()

    report = json.loads(report_path.read_text(encoding="utf-8"))
    assert report["failed"] == 1
    assert report["candidates"][0]["error"] == "boom"


def test_file_level_error_also_routes_to_failed(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path)
    incoming_file = watcher.incoming_dir / "malformed.json"
    incoming_file.write_text("not json", encoding="utf-8")

    fake_result = FileProcessingResult(file_name="malformed.json", file_error="Invalid candidate file: bad json")
    monkeypatch.setattr(fws, "process_candidate_file", lambda path, ttl: fake_result)

    asyncio.run(watcher._poll_once())

    assert (watcher.failed_dir / "malformed.json").exists()
    report = json.loads((watcher.failed_dir / "malformed.json.error.json").read_text(encoding="utf-8"))
    assert report["file_error"] == "Invalid candidate file: bad json"


def test_growing_file_is_not_claimed_until_size_is_stable(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path, stability_checks=2)
    incoming_file = watcher.incoming_dir / "growing.json"
    incoming_file.write_text("[", encoding="utf-8")

    call_count = {"n": 0}

    def fake_process(path, ttl):
        call_count["n"] += 1
        return FileProcessingResult(file_name=path.name, outcomes=[])

    monkeypatch.setattr(fws, "process_candidate_file", fake_process)

    asyncio.run(watcher._poll_once())
    assert call_count["n"] == 0  # first sighting: not stable yet

    asyncio.run(watcher._poll_once())
    assert call_count["n"] == 1  # same size on second poll: now claimed


def test_multiple_files_are_all_processed(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path)
    (watcher.incoming_dir / "a.json").write_text("[]", encoding="utf-8")
    (watcher.incoming_dir / "b.json").write_text("[]", encoding="utf-8")

    monkeypatch.setattr(
        fws,
        "process_candidate_file",
        lambda path, ttl: FileProcessingResult(
            file_name=path.name,
            outcomes=[CandidateOutcome(index=1, identifier="X", success=True, session_uuid="s")],
        ),
    )

    asyncio.run(watcher._poll_once())

    assert (watcher.processed_dir / "a.json").exists()
    assert (watcher.processed_dir / "b.json").exists()


def test_orphaned_processing_file_is_recovered_on_start(tmp_path):
    watcher = _make_watcher(tmp_path)
    # Simulate a crash mid-claim: a file left behind in .processing/
    orphan = watcher.processing_dir / "orphan.json"
    orphan.write_text("[]", encoding="utf-8")

    async def run() -> None:
        watcher.start()  # asyncio.create_task requires a running loop
        try:
            assert not orphan.exists()
            assert (watcher.incoming_dir / "orphan.json").exists()
        finally:
            await watcher.stop()

    asyncio.run(run())


def test_orphan_recovery_does_not_overwrite_existing_incoming_file(tmp_path):
    watcher = _make_watcher(tmp_path)
    (watcher.incoming_dir / "dup.json").write_text("already here", encoding="utf-8")
    (watcher.processing_dir / "dup.json").write_text("[]", encoding="utf-8")

    watcher._ensure_directories()
    watcher._recover_orphaned_files()

    assert (watcher.incoming_dir / "dup.json").read_text(encoding="utf-8") == "already here"
    assert (watcher.incoming_dir / "dup__1.json").exists()


def test_claim_uses_unique_processing_name_avoiding_collisions(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path)
    watcher._ensure_directories()

    # Pre-create a same-named file already sitting in .processing/ (as if
    # left over from a previous run) to prove the new claim never collides
    # with it.
    (watcher.processing_dir / "candidates.json").write_text("leftover", encoding="utf-8")

    incoming_file = watcher.incoming_dir / "candidates.json"
    incoming_file.write_text("[]", encoding="utf-8")

    captured_paths = []

    def fake_process(path, ttl):
        captured_paths.append(path)
        return FileProcessingResult(file_name=path.name, outcomes=[])

    monkeypatch.setattr(fws, "process_candidate_file", fake_process)

    asyncio.run(watcher._poll_once())

    assert len(captured_paths) == 1
    assert captured_paths[0].name != "candidates.json"  # claimed under a unique name
    assert (watcher.processing_dir / "candidates.json").read_text(encoding="utf-8") == "leftover"
    # final destination still uses the *original* dropped filename
    assert (watcher.failed_dir / "candidates.json").exists() or (watcher.processed_dir / "candidates.json").exists()


def test_failed_report_uses_original_file_name_not_internal_claim_name(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path)
    incoming_file = watcher.incoming_dir / "candidates.json"
    incoming_file.write_text("[]", encoding="utf-8")

    monkeypatch.setattr(
        fws,
        "process_candidate_file",
        lambda path, ttl: FileProcessingResult(
            file_name=path.name,  # internal uuid-suffixed name
            outcomes=[CandidateOutcome(index=1, identifier="X", success=False, error="boom")],
        ),
    )

    asyncio.run(watcher._poll_once())

    report = json.loads((watcher.failed_dir / "candidates.json.error.json").read_text(encoding="utf-8"))
    assert report["file_name"] == "candidates.json"


def test_duplicate_destination_name_is_not_overwritten(tmp_path, monkeypatch):
    watcher = _make_watcher(tmp_path)
    watcher.processed_dir.mkdir(parents=True, exist_ok=True)
    (watcher.processed_dir / "candidates.json").write_text("existing", encoding="utf-8")

    incoming_file = watcher.incoming_dir / "candidates.json"
    incoming_file.write_text("[]", encoding="utf-8")

    monkeypatch.setattr(
        fws,
        "process_candidate_file",
        lambda path, ttl: FileProcessingResult(
            file_name=path.name,
            outcomes=[CandidateOutcome(index=1, identifier="X", success=True, session_uuid="s")],
        ),
    )

    asyncio.run(watcher._poll_once())

    assert (watcher.processed_dir / "candidates.json").read_text(encoding="utf-8") == "existing"
    assert (watcher.processed_dir / "candidates__1.json").exists()

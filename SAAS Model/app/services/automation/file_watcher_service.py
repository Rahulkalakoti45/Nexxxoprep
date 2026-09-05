"""
Incoming Candidate File Watcher
================================

Continuously watches ``sample_data/incoming/`` for new candidate JSON
files, processes them through the existing Candidate Intake Service
(via ``candidate_file_processor``), and moves each file into
``sample_data/processed/`` or ``sample_data/failed/`` depending on the
outcome.

This is started automatically inside the FastAPI process lifespan --
no manual script execution is required. It uses a plain asyncio polling
loop (no OS-level file-watching dependency) so it works identically on
every platform the API already runs on.
"""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.services.automation.candidate_file_processor import (
    FileProcessingResult,
    process_candidate_file,
)

logger = logging.getLogger(__name__)


def _unique_path(path: Path) -> Path:
    """Avoid clobbering an existing file of the same name in the destination."""
    if not path.exists():
        return path
    stem, suffix = path.stem, path.suffix
    counter = 1
    candidate = path
    while candidate.exists():
        candidate = path.with_name(f"{stem}__{counter}{suffix}")
        counter += 1
    return candidate


class IncomingFileWatcher:
    """
    Polls ``incoming_dir`` for ``*.json`` files and drives them through
    ``process_candidate_file``.

    A file is only claimed once its size has been stable across
    ``stability_checks`` consecutive polls, so a file that is still being
    written (e.g. copied over a slow network share) is never read
    half-written.
    """

    def __init__(
        self,
        incoming_dir: str,
        processed_dir: str,
        failed_dir: str,
        link_ttl_hours: int,
        poll_interval_seconds: float = 2.0,
        stability_checks: int = 2,
    ) -> None:
        self.incoming_dir = Path(incoming_dir)
        self.processed_dir = Path(processed_dir)
        self.failed_dir = Path(failed_dir)
        self.processing_dir = self.incoming_dir / ".processing"
        self.link_ttl_hours = link_ttl_hours
        self.poll_interval_seconds = poll_interval_seconds
        self.stability_checks = max(1, stability_checks)

        self._task: asyncio.Task | None = None
        self._stop_event = asyncio.Event()
        # filename -> (last_seen_size, consecutive_stable_polls)
        self._pending_sizes: dict[str, tuple[int, int]] = {}

    def _ensure_directories(self) -> None:
        for directory in (self.incoming_dir, self.processed_dir, self.failed_dir, self.processing_dir):
            directory.mkdir(parents=True, exist_ok=True)

    def _recover_orphaned_files(self) -> None:
        """
        If the process was killed while a file was mid-claim (sitting in
        ``.processing/``), it never finished being processed and never got
        moved to ``processed/`` or ``failed/``. On startup, move anything
        left behind back into ``incoming_dir`` so it re-enters the normal
        detect -> validate -> process flow instead of being lost.
        """
        for orphan in sorted(self.processing_dir.glob("*.json")):
            destination = _unique_path(self.incoming_dir / orphan.name)
            try:
                orphan.rename(destination)
                logger.warning(
                    "automation.orphan_recovered file=%s restored_as=%s",
                    orphan.name,
                    destination.name,
                )
            except OSError as exc:
                logger.error("automation.orphan_recovery_failed file=%s error=%s", orphan.name, exc)

    def start(self) -> None:
        self._ensure_directories()
        self._recover_orphaned_files()
        self._stop_event.clear()
        self._task = asyncio.create_task(self._run_loop(), name="incoming-candidate-file-watcher")
        logger.info(
            "automation.watcher_started incoming=%s poll_interval=%.1fs",
            self.incoming_dir,
            self.poll_interval_seconds,
        )

    async def stop(self) -> None:
        self._stop_event.set()
        if self._task is not None:
            try:
                await asyncio.wait_for(self._task, timeout=self.poll_interval_seconds + 5)
            except asyncio.TimeoutError:
                self._task.cancel()
        logger.info("automation.watcher_stopped")

    async def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                await self._poll_once()
            except Exception:  # noqa: BLE001 - the watcher must never crash the app
                logger.exception("automation.watcher_tick_failed")
            try:
                await asyncio.wait_for(self._stop_event.wait(), timeout=self.poll_interval_seconds)
            except asyncio.TimeoutError:
                pass

    async def _poll_once(self) -> None:
        candidate_files = sorted(p for p in self.incoming_dir.glob("*.json") if p.is_file())
        seen_names = {p.name for p in candidate_files}
        for stale_name in list(self._pending_sizes):
            if stale_name not in seen_names:
                self._pending_sizes.pop(stale_name, None)

        for file_path in candidate_files:
            if self._track_stability(file_path):
                self._pending_sizes.pop(file_path.name, None)
                await self._claim_and_process(file_path)

    def _track_stability(self, file_path: Path) -> bool:
        try:
            size = file_path.stat().st_size
        except FileNotFoundError:
            return False

        last_size, stable_count = self._pending_sizes.get(file_path.name, (-1, 0))
        if size == last_size and size > 0:
            stable_count += 1
        else:
            stable_count = 1 if size > 0 else 0
        self._pending_sizes[file_path.name] = (size, stable_count)
        return stable_count >= self.stability_checks

    async def _claim_and_process(self, file_path: Path) -> None:
        original_name = file_path.name
        # Claim under a uuid-suffixed name: on Windows, Path.rename() raises
        # FileExistsError (unlike POSIX, which silently overwrites) if the
        # destination already exists -- e.g. a same-named leftover from a
        # previous crash. A unique claim name makes that class of collision
        # impossible, regardless of what's already sitting in .processing/.
        claimed_path = self.processing_dir / f"{file_path.stem}.{uuid.uuid4().hex[:8]}{file_path.suffix}"
        try:
            file_path.rename(claimed_path)
        except FileNotFoundError:
            return  # already claimed by a previous tick
        except OSError as exc:
            logger.error("automation.claim_failed file=%s error=%s", original_name, exc)
            return

        logger.info("automation.file_claimed file=%s", original_name)

        result = await asyncio.to_thread(process_candidate_file, claimed_path, self.link_ttl_hours)
        self._finalize(claimed_path, original_name, result)

    def _finalize(self, claimed_path: Path, original_name: str, result: FileProcessingResult) -> None:
        if result.is_fully_successful:
            destination = _unique_path(self.processed_dir / original_name)
            shutil.move(str(claimed_path), str(destination))
            logger.info(
                "automation.file_processed file=%s destination=%s candidates=%s",
                original_name,
                destination.name,
                len(result.outcomes),
            )
            return

        destination = _unique_path(self.failed_dir / original_name)
        shutil.move(str(claimed_path), str(destination))

        report = result.to_report_dict()
        report["file_name"] = original_name  # report the name the operator dropped, not the internal claim name
        report["failed_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        report_path = destination.parent / f"{destination.name}.error.json"
        report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

        logger.error(
            "automation.file_failed file=%s destination=%s reason=%s report=%s",
            original_name,
            destination.name,
            result.file_error or "one or more candidates failed",
            report_path.name,
        )

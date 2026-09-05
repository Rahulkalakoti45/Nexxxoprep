# NexoPrep — Version / Milestone Log

This file tracks integration-level milestones for the Behavior Engine
work (Phase 3). For full feature history see docs/phase-history.md.

--------------------------------

## 3.3.0 — Phase 3C: Headless Engine + React Integration

- Behavior Engine is now headless: no OpenCV window, no keyboard
  controls. The backend is the only lifecycle controller.
- Local-only MJPEG streaming from the Python engine to the browser,
  proxied through the Node backend (GET /:sessionId/behavior/stream).
- New BehaviorCameraCard React component in the interview page.
- All Phase 3A detection/scoring/tracking/report algorithms preserved
  (verified byte-identical, except a session-duration config value —
  see docs/phase-history.md).

## 3.2.1 — Phase 3B.1: Windows Launcher Fix

- Fixed repository-root resolution (was resolving against
  process.cwd(), not the monorepo root, under npm workspaces).
- Fixed Python executable resolution (single hardcoded name ->
  cross-platform candidate list with fallback).
- Validated on Windows: automatic launch, no ENOENT, clean shutdown.

## 3.2.0 — Phase 3B: Backend Lifecycle Integration

- Event-driven BehaviorEngineOrchestrator (SESSION_STARTED /
  SESSION_UPDATED) drives BehaviorEngineService.start()/stop().
- One Python process per interview session; automatic start/stop;
  graceful SIGTERM -> SIGKILL escalation; structured
  [BEHAVIOR_ENGINE_*] logging.
- Behavior Engine failures never affect the interview itself.

## 3.1.0 — Phase 3A: Behavior Engine Modularization

- Monolithic desktop main.py split into behavior-engine/ modules
  (camera, detector, scoring, tracker, reports, ui, lifecycle,
  engine, config, main).
- No detection/scoring/report algorithm changes — verified against
  the original by diffing every extracted function/class.

--------------------------------

## Next planned

- Phase 3D (proposed): ingest report.json into the existing
  BehaviorMetric/EmotionState database tables after each session, and
  wire real values into BehaviorCameraCard's placeholder metrics row.

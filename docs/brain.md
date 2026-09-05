# 🧠 NexoPrep AI Brain

**Version:** 2.1
**Project Status:** Phase 4B Complete → Phase 4C Development
**Last Updated:** July 2026

---

# PURPOSE

This document is the single source of truth for NexoPrep.

Every AI assistant (Claude, ChatGPT, Cursor, Gemini, Copilot, etc.)
**must read this document before making architectural or code changes.**

Core principles:

- Extend, don't rewrite.
- Preserve working systems.
- Respect subsystem boundaries.
- Design for production scalability.
- Every intelligence system owns its own data.
- Unified Intelligence only aggregates existing outputs.

---

# PROJECT OVERVIEW

**Project:** NexoPrep

**Tagline:**
AI Powered Interview Preparation & Behavioral Intelligence Platform

NexoPrep combines multiple independent intelligence systems into one
production-ready interview preparation platform.

Current intelligence systems:

1. Resume Intelligence
2. Interview Intelligence
3. Behavioral Intelligence
4. Conversation Intelligence

These systems remain independent.

No subsystem should directly modify another subsystem.

Only the Unified Intelligence Layer combines them.

---

# LONG TERM VISION

Resume
↓

AI Interview

↓

Behavior Analysis

↓

Interview Intelligence

↓

Conversation Intelligence

↓

Unified Intelligence Layer

↓

AI Mentor

↓

Continuous Candidate Improvement

---

# CORE ARCHITECTURAL PRINCIPLES

## Separation of Concerns

Each intelligence system owns only its own data.

Resume Intelligence owns resume analysis.

Interview Intelligence owns interview evaluation.

Behavior Intelligence owns behavioral analysis.

Conversation Intelligence owns transcript intelligence.

Unified Intelligence owns no primary data.

---

## Single Source of Truth

Every piece of information must have exactly one owner.

No duplicate storage.

No duplicate scoring.

No duplicate reports.

No duplicate summaries.

---

## Read Before Write

Whenever possible:

Reuse existing services.

Reuse existing models.

Reuse existing APIs.

Extend existing architecture instead of introducing new ownership.

---

## Observation Only

Behavior Engine observes.

It never changes:

- Interview flow
- Gemini prompts
- ElevenLabs
- Transcript
- Memory
- Resume
- Feedback report

---

## Interview First

Behavior failures must never interrupt interviews.

Interview completion always has priority.

---

## Safe Failure

Subsystem failures must remain isolated.

Resume failures must not stop interviews.

Behavior failures must not stop reports.

Unified Report failures must not stop interview completion.

---

## Extend, Never Rewrite

Existing production code should be extended.

Avoid architectural rewrites.

Avoid replacing working systems.

---

# CURRENT STATUS

## Phase 1

Core Platform

✅ Complete

---

## Phase 2

Interview Intelligence

✅ Complete

Features:

- Resume-aware interviews
- Gemini reasoning
- ElevenLabs voice
- Memory
- Transcript persistence
- Feedback reports
- Roadmaps
- Score generation

---

## Phase 3

Behavior Engine Integration

✅ Complete

Completed:

- Backend-managed lifecycle
- Automatic launch
- Automatic shutdown
- Graceful STOP workflow
- MJPEG streaming
- MediaPipe pipeline
- Real-time metrics
- Local report generation
- Graph generation
- Session-scoped report storage

Behavior Engine is backend-managed.

It is no longer a standalone application.

---

## Phase 4A

Unified Report Architecture

✅ Complete

Completed:

- Architecture
- Data ownership
- Unified Report design
- Storage strategy
- Read-only aggregation strategy

---

## Phase 4B

Behavior Report Ingestion

✅ Complete

Completed:

- BehaviorReportIngestionService
- Report finalization detection
- Metadata pointer storage
- BEHAVIOR_REPORT_READY event
- Session metadata integration

Behavior reports remain file-based.

Postgres stores only a pointer.

report.json remains the source of truth.

---

## Phase 4C

Unified Report Read Layer

🚧 Current Phase

Objective:

Create a read-only aggregation layer.

Aggregate:

- Resume Intelligence
- Interview Intelligence
- Behavioral Intelligence
- Conversation Intelligence
- Session Metadata

without creating duplicate storage.

---

# CURRENT ARCHITECTURE

Frontend

- React
- TypeScript
- Vite

Backend

- Node.js
- Express
- Prisma

Interview Intelligence

- Gemini 2.5 Flash
- ElevenLabs
- Redis
- Transcript pipeline
- FeedbackReport

Behavior Intelligence

- Python
- MediaPipe
- OpenCV
- NumPy
- Matplotlib
- report.json
- report.txt
- scorecard.txt

Storage

- PostgreSQL
- Redis
- Local Reports

---

# DATA OWNERSHIP

## Resume Intelligence

Owns:

- ATS score
- Resume score
- Missing skills
- Extracted skills
- Resume suggestions

---

## Interview Intelligence

Owns:

- FeedbackReport
- Technical evaluation
- Communication score
- Confidence score
- Roadmap
- Interview summary

---

## Conversation Intelligence

Owns:

- Transcript
- Conversation flow
- Turn history
- Transcript summary

---

## Behavior Intelligence

Owns:

- Eye contact
- Engagement
- Attention
- Posture
- Gesture analysis
- Timeline
- Graphs
- report.json
- report.txt
- scorecard.txt

---

## Unified Intelligence

Owns:

Nothing.

It aggregates existing outputs.

It never becomes the source of truth.

---

# PHASE ROADMAP

Phase 1

Core Platform

✅

Phase 2

Interview Intelligence

✅

Phase 3

Behavior Engine Integration

✅

Phase 4A

Architecture

✅

Phase 4B

Behavior Report Ingestion

✅

Phase 4C

Unified Report Read Layer

🚧

Phase 4D

Unified Report UI

⬜

Phase 5

AI Mentor

⬜

Phase 6

Resume Intelligence Expansion

⬜

Phase 7

Progress Dashboard

⬜

Phase 8

Company Simulation

⬜

Phase 9

Coding Interviews

⬜

Phase 10

Advanced Analytics

⬜

Phase 11

Adaptive AI

⬜

Phase 12

Recruiter Portal

⬜

Phase 13

SaaS Platform

⬜

---

# FROZEN SYSTEMS

Do not redesign:

- Interview Engine
- Gemini prompts
- ElevenLabs integration
- Resume parser
- MediaPipe pipeline
- Behavior scoring
- Tracking algorithms
- FeedbackReport
- Transcript pipeline
- Behavior report generation

These systems are considered production-stable.

---

# CODING GUIDELINES

Before writing code:

1. Identify the current phase.
2. Read this document.
3. Reuse existing services.
4. Extend before rewriting.
5. Preserve backwards compatibility.
6. Respect subsystem ownership.
7. Never duplicate existing data.
8. Prefer read-time aggregation over persistence.

---

# FINAL PRINCIPLE

Every architectural decision should make NexoPrep:

- More modular
- More maintainable
- More scalable
- More production-ready

without sacrificing subsystem independence.

END OF FILE
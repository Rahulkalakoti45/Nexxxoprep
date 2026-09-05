# NexoPrep Phase 4
# Unified Intelligence Architecture

**Version:** 2.0

**Status:** Phase 4A ✅ | Phase 4B ✅ | Phase 4C 🚧

---

# Purpose

This document defines the architecture of the Unified Intelligence Layer.

It is the single architectural reference for Phase 4.

It explains:

- Data ownership
- Service boundaries
- Integration strategy
- API design
- Migration order
- Future scalability

This document intentionally avoids implementation details unrelated to the
Unified Report.

---

# Goals

Create a single report combining:

- Resume Intelligence
- Interview Intelligence
- Behavioral Intelligence
- Conversation Intelligence
- Session Metadata

without changing ownership of any existing subsystem.

The Unified Report is an aggregation layer.

It is **not** another report engine.

---

# Current Project Status

## Completed

Phase 4A

- Architecture
- Ownership rules
- Data flow
- Migration strategy

✅

---

Phase 4B

- BehaviorReportIngestionService
- Metadata pointer storage
- BEHAVIOR_REPORT_READY
- report.json discovery
- Session linkage

✅

---

Current Phase

Phase 4C

Unified Report Read Layer

🚧

---

# Core Design Principles

## Separation of Concerns

Resume Intelligence

↓

Interview Intelligence

↓

Behavior Intelligence

↓

Conversation Intelligence

remain completely independent.

None may directly modify another.

Only the Unified Report consumes them.

---

## Single Source of Truth

Every field has exactly one owner.

Examples:

Resume score

→ ResumeAnalysis

Interview score

→ FeedbackReport

Behavior score

→ report.json

Transcript

→ Transcript

Session metadata

→ InterviewSession

The Unified Report owns none of these.

---

## Read-Time Aggregation

The Unified Report is assembled on demand.

No duplicate report is created.

No report copy is stored.

No second scoring system exists.

---

# Data Flow

Resume Upload

↓

ResumeAnalysis

↓

Interview

↓

Transcript

↓

FeedbackReport

│

│

Behavior Engine

↓

report.json

↓

BehaviorReportIngestionService

↓

InterviewSession.metadata.behaviorReport

↓

UnifiedReportService

↓

GET /api/unified-report/:sessionId

↓

Frontend

---

# Data Ownership

## Resume Intelligence

Source:

ResumeAnalysis

Owns:

- ATS Score
- Resume Score
- Skills
- Missing Skills
- Suggestions

---

## Interview Intelligence

Source:

FeedbackReport

Owns:

- Technical Score
- Communication Score
- Confidence
- Hesitation
- Summary
- AI Feedback
- Roadmap

---

## Behavior Intelligence

Source:

report.json

Owns:

- Behavior Score
- Engagement
- Attention
- Posture
- Eye Contact
- Gesture Analysis
- Timeline
- Graphs

InterviewSession.metadata only stores a pointer.

The report itself remains authoritative.

---

## Conversation Intelligence

Source:

Transcript

Owns:

- Transcript
- Turn count
- Transcript summary

---

## Unified Intelligence

Owns nothing.

Reads existing sources.

Aggregates them.

---

# Phase 4B Architecture

Behavior Engine

↓

Generate report.json

↓

stdout

↓

BEHAVIOR_ENGINE_REPORT_FINALIZED

↓

BehaviorReportIngestionService

↓

InterviewSession.metadata.behaviorReport

↓

BEHAVIOR_REPORT_READY

No additional report is generated.

No report is copied into Postgres.

---

# Phase 4C Architecture

Create

UnifiedReportService

Responsibilities:

Read

ResumeAnalysis

Read

FeedbackReport

Read

InterviewSession

Read

Transcript summary

Read

behaviorReport pointer

Open

report.json

Assemble one response.

Return.

Nothing is persisted.

---

# API

GET

/api/unified-report/:sessionId

Returns

```json
{
  "status": {
    "resume": "...",
    "interview": "...",
    "behavior": "...",
    "conversation": "..."
  },
  "sessionMetadata": {},
  "resumeIntelligence": {},
  "interviewIntelligence": {},
  "behaviorIntelligence": {},
  "conversationIntelligence": {},
  "compositeScore": {}
}
```

---

# Readiness Rules

Each subsystem reports independently.

Possible values:

ready

pending

unavailable

Behavior pending must not fail the API.

Interview pending must not fail the API.

Resume unavailable must not fail the API.

Return whatever is available.

---

# Service Responsibilities

## UnifiedReportService

Reads

ResumeAnalysis

Reads

FeedbackReport

Reads

InterviewSession

Reads

Transcript summary

Reads

Behavior report

Assembles response.

Owns no data.

---

## BehaviorReportIngestionService

Already complete.

Responsibilities:

Observe

BEHAVIOR_ENGINE_REPORT_FINALIZED

Store pointer

Emit

BEHAVIOR_REPORT_READY

Nothing else.

---

# Files Expected During Phase 4C

New

services/

unified-report-service/

apps/server/routes/

unified-report.routes.ts

src/hooks/

useUnifiedReport.js

services/backend/

unifiedReportApi.js

Shared Types

packages/types/

unified-report.ts

Existing services should be reused whenever possible.

---

# Future Phases

Phase 4D

Unified Report UI

Adds:

- Executive Summary
- Resume Panel
- Interview Panel
- Behavior Panel
- Conversation Panel

No backend ownership changes.

---

Phase 5

AI Mentor

Consumes Unified Report.

Does not bypass subsystem boundaries.

---

Future Features

- Recruiter Dashboard
- Progress Tracking
- Adaptive Intelligence
- Company Simulation
- Cloud Reports

All consume UnifiedReportService.

None should access subsystem internals directly.

---

# Non-Goals

This phase does NOT:

❌ Modify Gemini

❌ Modify ElevenLabs

❌ Modify Resume Parser

❌ Modify MediaPipe

❌ Modify report.json generation

❌ Modify FeedbackReport

❌ Modify interview scoring

❌ Duplicate reports

❌ Duplicate storage

---

# Final Principle

Every subsystem owns exactly one responsibility.

The Unified Intelligence Layer exists only to present those systems together.

It should always remain a read-only aggregation layer.

END OF FILE
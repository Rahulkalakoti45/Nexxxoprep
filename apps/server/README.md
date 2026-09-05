# NexoPrep Backend

Production-grade backend foundation for the NexoPrep emotionally adaptive AI interview platform.

## Architecture

The backend is a workspace-based Node.js monorepo:

- `apps/server` - Fastify HTTP and websocket API.
- `packages/config` - environment loading and validation.
- `packages/database` - Prisma schema, client factory, and repository helpers.
- `packages/events` - typed realtime event bus backed by Redis pub/sub and streams.
- `packages/shared` - errors, ids, and Zod validation schemas.
- `packages/types` - cross-service domain, event, and report interfaces.
- `services/session-service` - session lifecycle, restoration, transcript persistence, event persistence.
- `services/report-service` - report generation, score aggregation, roadmap persistence.
- `services/memory-service` - Redis active session state, speaker state, websocket state, transcript buffers.
- `services/analytics-service` - performance, weak-area, emotion, and communication analytics.

## Runtime Dependencies

- Node.js 20+
- PostgreSQL 14+
- Redis 7+

## Setup

```bash
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev:server
```

The server defaults to `http://localhost:4000`.

Protected REST endpoints require:

```http
x-api-key: SECRET_KEY
```

Use a real auth gateway or JWT verifier before exposing this service publicly.

## Endpoints

- `GET /health`
- `GET /ready`
- `POST /api/users`
- `GET /api/users/:userId/history`
- `POST /api/sessions`
- `GET /api/sessions/:sessionId`
- `GET /api/sessions/:sessionId/state`
- `PATCH /api/sessions/:sessionId/state`
- `POST /api/sessions/:sessionId/transcripts`
- `POST /api/reports/sessions/:sessionId`
- `GET /api/reports/users/:userId`
- `GET /api/analytics/users/:userId`
- `POST /api/analytics/sessions/:sessionId/behavior-metrics`
- `POST /api/analytics/sessions/:sessionId/emotion-states`
- `WS /ws/realtime?userId=<user-id>`

## Realtime Events

The websocket and event bus support:

- `SESSION_STARTED`
- `SESSION_UPDATED`
- `TRANSCRIPT_UPDATED`
- `REPORT_UPDATED`
- `USER_CONNECTED`

Events are published through Redis pub/sub and also appended to a Redis stream for replay or downstream processing.

## Persistence

Prisma models map to:

- `users`
- `interview_sessions`
- `interview_rounds`
- `transcripts`
- `behavior_metrics`
- `emotion_states`
- `scores`
- `feedback_reports`
- `roadmaps`
- `resume_analysis`
- `event_logs`

The schema is intentionally ready for future voice streaming and behavioral CV modules without coupling those systems to current routes.

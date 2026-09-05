CREATE TYPE "InterviewMode" AS ENUM ('standard', 'ai_simulated', 'voice_realtime');
CREATE TYPE "SessionStatus" AS ENUM ('created', 'active', 'paused', 'completed', 'abandoned', 'failed');
CREATE TYPE "RoundStatus" AS ENUM ('pending', 'active', 'completed', 'skipped');
CREATE TYPE "TranscriptSpeaker" AS ENUM ('candidate', 'interviewer', 'system', 'ai');
CREATE TYPE "EventSeverity" AS ENUM ('debug', 'info', 'warning', 'error', 'critical');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "college" TEXT,
  "branch" TEXT,
  "graduationYear" INTEGER,
  "targetRole" TEXT,
  "experienceLevel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mode" "InterviewMode" NOT NULL DEFAULT 'standard',
  "status" "SessionStatus" NOT NULL DEFAULT 'created',
  "role" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "difficulty" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "interview_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "interview_rounds" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "status" "RoundStatus" NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "interview_rounds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transcripts" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "roundId" TEXT,
  "speaker" "TranscriptSpeaker" NOT NULL,
  "content" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "confidence" DOUBLE PRECISION,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "behavior_metrics" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "metricType" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION,
  "source" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "behavior_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "emotion_states" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "emotion" TEXT NOT NULL,
  "intensity" DOUBLE PRECISION NOT NULL,
  "confidence" DOUBLE PRECISION,
  "source" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "emotion_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scores" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "scoreType" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "feedback_reports" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "overallScore" DOUBLE PRECISION NOT NULL,
  "technicalScore" DOUBLE PRECISION NOT NULL,
  "communicationScore" DOUBLE PRECISION NOT NULL,
  "confidenceScore" DOUBLE PRECISION NOT NULL,
  "hesitationScore" DOUBLE PRECISION NOT NULL,
  "behavioralScore" DOUBLE PRECISION NOT NULL,
  "summary" TEXT NOT NULL,
  "aiFeedback" JSONB NOT NULL DEFAULT '{}',
  "behavioralSummary" JSONB NOT NULL DEFAULT '{}',
  "transcriptSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "feedback_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roadmaps" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actions" JSONB NOT NULL DEFAULT '[]',
  "dueAfterDays" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resume_analysis" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT NOT NULL,
  "resumeTextHash" TEXT NOT NULL,
  "extractedSkills" JSONB NOT NULL DEFAULT '[]',
  "missingSkills" JSONB NOT NULL DEFAULT '[]',
  "atsScore" DOUBLE PRECISION,
  "resumeScore" DOUBLE PRECISION,
  "suggestions" JSONB NOT NULL DEFAULT '[]',
  "rawAnalysis" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "resume_analysis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_logs" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT,
  "type" TEXT NOT NULL,
  "severity" "EventSeverity" NOT NULL DEFAULT 'info',
  "correlationId" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "interview_sessions_userId_createdAt_idx" ON "interview_sessions"("userId", "createdAt");
CREATE INDEX "interview_sessions_status_updatedAt_idx" ON "interview_sessions"("status", "updatedAt");
CREATE UNIQUE INDEX "interview_rounds_sessionId_sequence_key" ON "interview_rounds"("sessionId", "sequence");
CREATE INDEX "interview_rounds_sessionId_status_idx" ON "interview_rounds"("sessionId", "status");
CREATE UNIQUE INDEX "transcripts_sessionId_sequence_key" ON "transcripts"("sessionId", "sequence");
CREATE INDEX "transcripts_sessionId_createdAt_idx" ON "transcripts"("sessionId", "createdAt");
CREATE INDEX "behavior_metrics_sessionId_metricType_capturedAt_idx" ON "behavior_metrics"("sessionId", "metricType", "capturedAt");
CREATE INDEX "emotion_states_sessionId_emotion_capturedAt_idx" ON "emotion_states"("sessionId", "emotion", "capturedAt");
CREATE INDEX "scores_sessionId_domain_idx" ON "scores"("sessionId", "domain");
CREATE INDEX "scores_scoreType_idx" ON "scores"("scoreType");
CREATE UNIQUE INDEX "feedback_reports_sessionId_key" ON "feedback_reports"("sessionId");
CREATE INDEX "feedback_reports_userId_createdAt_idx" ON "feedback_reports"("userId", "createdAt");
CREATE INDEX "roadmaps_userId_priority_idx" ON "roadmaps"("userId", "priority");
CREATE UNIQUE INDEX "resume_analysis_sessionId_key" ON "resume_analysis"("sessionId");
CREATE INDEX "resume_analysis_userId_createdAt_idx" ON "resume_analysis"("userId", "createdAt");
CREATE INDEX "event_logs_sessionId_occurredAt_idx" ON "event_logs"("sessionId", "occurredAt");
CREATE INDEX "event_logs_userId_occurredAt_idx" ON "event_logs"("userId", "occurredAt");
CREATE INDEX "event_logs_type_occurredAt_idx" ON "event_logs"("type", "occurredAt");

ALTER TABLE "interview_sessions" ADD CONSTRAINT "interview_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interview_rounds" ADD CONSTRAINT "interview_rounds_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "interview_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "behavior_metrics" ADD CONSTRAINT "behavior_metrics_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "emotion_states" ADD CONSTRAINT "emotion_states_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scores" ADD CONSTRAINT "scores_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_reports" ADD CONSTRAINT "feedback_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resume_analysis" ADD CONSTRAINT "resume_analysis_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "resume_analysis" ADD CONSTRAINT "resume_analysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

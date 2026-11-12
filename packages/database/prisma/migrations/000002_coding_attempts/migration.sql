-- CreateTable
CREATE TABLE "coding_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientAttemptId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "problemTitle" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "finalRun" JSONB NOT NULL,
    "evaluation" JSONB NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "testsPassed" INTEGER NOT NULL,
    "testsTotal" INTEGER NOT NULL,
    "hintsUsed" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coding_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coding_attempts_userId_finishedAt_idx" ON "coding_attempts"("userId", "finishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "coding_attempts_userId_clientAttemptId_key" ON "coding_attempts"("userId", "clientAttemptId");

-- AddForeignKey
ALTER TABLE "coding_attempts" ADD CONSTRAINT "coding_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


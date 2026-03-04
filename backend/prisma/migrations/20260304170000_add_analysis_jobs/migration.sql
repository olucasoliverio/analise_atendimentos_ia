CREATE TABLE IF NOT EXISTS "analysis_jobs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "conversation_ids" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "message" TEXT NOT NULL,
  "analysis_id" TEXT,
  "conversation_id" TEXT,
  "cached" BOOLEAN NOT NULL DEFAULT false,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3),
  "finished_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analysis_jobs_user_id_idx" ON "analysis_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "analysis_jobs_status_idx" ON "analysis_jobs"("status");
CREATE INDEX IF NOT EXISTS "analysis_jobs_updated_at_idx" ON "analysis_jobs"("updated_at" DESC);

ALTER TABLE "analysis_jobs"
  ADD CONSTRAINT "analysis_jobs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "analysis_jobs"
  ADD CONSTRAINT "analysis_jobs_analysis_id_fkey"
  FOREIGN KEY ("analysis_id") REFERENCES "analyses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

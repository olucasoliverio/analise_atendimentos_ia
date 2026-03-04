import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export type AnalysisJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface AnalysisJobRecord {
  id: string;
  userId: string;
  conversationIds: string[];
  status: AnalysisJobStatus;
  progress: number;
  message: string;
  analysisId?: string;
  conversationId?: string;
  cached?: boolean;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  updatedAt: Date;
}

type AnalysisJobRow = {
  id: string;
  user_id: string;
  conversation_ids: Prisma.JsonValue;
  status: string;
  progress: number;
  message: string;
  analysis_id: string | null;
  conversation_id: string | null;
  cached: boolean | null;
  error: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  updated_at: Date;
};

export class AnalysisJobService {
  private readonly staleRunningThresholdMs = 1000 * 60 * 15;

  async ensureTable() {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS analysis_jobs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_ids JSONB NOT NULL,
        status TEXT NOT NULL,
        progress INTEGER NOT NULL DEFAULT 0,
        message TEXT NOT NULL,
        analysis_id TEXT NULL REFERENCES analyses(id) ON DELETE SET NULL,
        conversation_id TEXT NULL,
        cached BOOLEAN NOT NULL DEFAULT FALSE,
        error TEXT NULL,
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP(3) NULL,
        finished_at TIMESTAMP(3) NULL,
        updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS analysis_jobs_user_id_idx ON analysis_jobs(user_id);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS analysis_jobs_status_idx ON analysis_jobs(status);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS analysis_jobs_updated_at_idx ON analysis_jobs(updated_at DESC);
    `);
  }

  async createJob(input: {
    id: string;
    userId: string;
    conversationIds: string[];
    status: AnalysisJobStatus;
    progress: number;
    message: string;
  }): Promise<AnalysisJobRecord> {
    const rows = await prisma.$queryRaw<AnalysisJobRow[]>(Prisma.sql`
      INSERT INTO analysis_jobs (
        id,
        user_id,
        conversation_ids,
        status,
        progress,
        message
      ) VALUES (
        ${input.id},
        ${input.userId},
        CAST(${JSON.stringify(input.conversationIds)} AS jsonb),
        ${input.status},
        ${input.progress},
        ${input.message}
      )
      RETURNING
        id,
        user_id,
        conversation_ids,
        status,
        progress,
        message,
        analysis_id,
        conversation_id,
        cached,
        error,
        created_at,
        started_at,
        finished_at,
        updated_at
    `);

    return this.mapRow(rows[0]);
  }

  async claimQueuedJob(jobId: string): Promise<AnalysisJobRecord | null> {
    const rows = await prisma.$queryRaw<AnalysisJobRow[]>(Prisma.sql`
      UPDATE analysis_jobs
      SET
        status = 'RUNNING',
        progress = CASE WHEN progress = 0 THEN 5 ELSE progress END,
        message = CASE WHEN status = 'QUEUED' THEN 'Iniciando analise...' ELSE message END,
        started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId}
        AND status = 'QUEUED'
      RETURNING
        id,
        user_id,
        conversation_ids,
        status,
        progress,
        message,
        analysis_id,
        conversation_id,
        cached,
        error,
        created_at,
        started_at,
        finished_at,
        updated_at
    `);

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async updateJob(jobId: string, updates: Partial<Omit<AnalysisJobRecord, 'id' | 'userId' | 'conversationIds' | 'createdAt'>>): Promise<void> {
    const assignments: Prisma.Sql[] = [];

    if (updates.status !== undefined) assignments.push(Prisma.sql`status = ${updates.status}`);
    if (updates.progress !== undefined) assignments.push(Prisma.sql`progress = ${updates.progress}`);
    if (updates.message !== undefined) assignments.push(Prisma.sql`message = ${updates.message}`);
    if (updates.analysisId !== undefined) assignments.push(Prisma.sql`analysis_id = ${updates.analysisId}`);
    if (updates.conversationId !== undefined) assignments.push(Prisma.sql`conversation_id = ${updates.conversationId}`);
    if (updates.cached !== undefined) assignments.push(Prisma.sql`cached = ${updates.cached}`);
    if (updates.error !== undefined) assignments.push(Prisma.sql`error = ${updates.error}`);
    if (updates.startedAt !== undefined) assignments.push(Prisma.sql`started_at = ${updates.startedAt}`);
    if (updates.finishedAt !== undefined) assignments.push(Prisma.sql`finished_at = ${updates.finishedAt}`);

    assignments.push(Prisma.sql`updated_at = CURRENT_TIMESTAMP`);

    await prisma.$executeRaw(
      Prisma.sql`UPDATE analysis_jobs SET ${Prisma.join(assignments, ', ')} WHERE id = ${jobId}`
    );
  }

  async getJobForUser(jobId: string, userId: string): Promise<AnalysisJobRecord | null> {
    const rows = await prisma.$queryRaw<AnalysisJobRow[]>(Prisma.sql`
      SELECT
        id,
        user_id,
        conversation_ids,
        status,
        progress,
        message,
        analysis_id,
        conversation_id,
        cached,
        error,
        created_at,
        started_at,
        finished_at,
        updated_at
      FROM analysis_jobs
      WHERE id = ${jobId}
        AND user_id = ${userId}
      LIMIT 1
    `);

    return rows[0] ? this.mapRow(rows[0]) : null;
  }

  async countActiveJobsForUser(userId: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM analysis_jobs
      WHERE user_id = ${userId}
        AND status IN ('QUEUED', 'RUNNING')
    `);

    return Number(rows[0]?.count ?? 0);
  }

  async countActiveJobs(): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM analysis_jobs
      WHERE status IN ('QUEUED', 'RUNNING')
    `);

    return Number(rows[0]?.count ?? 0);
  }

  async requeueStaleRunningJobs(): Promise<void> {
    const staleBefore = new Date(Date.now() - this.staleRunningThresholdMs);

    await prisma.$executeRaw(Prisma.sql`
      UPDATE analysis_jobs
      SET
        status = 'QUEUED',
        message = 'Analise retomada apos reinicio do servico',
        error = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE status = 'RUNNING'
        AND updated_at < ${staleBefore}
    `);
  }

  async listQueuedJobIds(limit = 20): Promise<string[]> {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM analysis_jobs
      WHERE status = 'QUEUED'
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);

    return rows.map((row) => row.id);
  }

  async cleanupOldJobs(ttlMs: number): Promise<void> {
    const threshold = new Date(Date.now() - ttlMs);

    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM analysis_jobs
      WHERE updated_at < ${threshold}
        AND status IN ('COMPLETED', 'FAILED')
    `);
  }

  private mapRow(row: AnalysisJobRow): AnalysisJobRecord {
    return {
      id: row.id,
      userId: row.user_id,
      conversationIds: Array.isArray(row.conversation_ids)
        ? row.conversation_ids.map((value) => String(value))
        : [],
      status: row.status as AnalysisJobStatus,
      progress: row.progress,
      message: row.message,
      analysisId: row.analysis_id || undefined,
      conversationId: row.conversation_id || undefined,
      cached: row.cached ?? false,
      error: row.error || undefined,
      createdAt: row.created_at,
      startedAt: row.started_at || undefined,
      finishedAt: row.finished_at || undefined,
      updatedAt: row.updated_at
    };
  }
}

/**
 * Admin Routes for ZeroToShip API
 *
 * Provides admin-only endpoints for pipeline monitoring, system health,
 * user management, and pipeline control.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../middleware/auth';
import { loadRunStatus } from '../../scheduler/utils/persistence';
import { runPipeline, DEFAULT_PIPELINE_CONFIG } from '../../scheduler';
import { db, ideas, subscriptions, users, pipelineRuns } from '../db/client';
import { eq, count, desc, sql } from 'drizzle-orm';

const DATA_DIR = process.env.PIPELINE_DATA_DIR || path.join(process.cwd(), 'data', 'runs');

/**
 * Get the most recent run ID from the data directory
 */
function getLatestRunId(): string | null {
  try {
    if (!fs.existsSync(DATA_DIR)) return null;
    const dirs = fs.readdirSync(DATA_DIR)
      .filter((d) => d.startsWith('run_'))
      .sort()
      .reverse();
    return dirs[0] || null;
  } catch {
    return null;
  }
}

export const adminRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/admin/pipeline-status
   */
  server.get(
    '/pipeline-status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      // Try DB first
      try {
        const latestRun = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1);
        if (latestRun.length > 0) {
          const run = latestRun[0];
          return reply.send({
            status: 'ok',
            runId: run.runId,
            startedAt: run.startedAt,
            phases: run.phases,
            success: run.success,
            completedAt: run.completedAt,
          });
        }
      } catch {
        // DB query failed, fall through to file-system
      }

      // Fallback to file system (pre-migration runs)
      const latestRunId = getLatestRunId();
      if (!latestRunId) {
        return reply.send({
          status: 'no_runs',
          message: 'No pipeline runs found',
        });
      }

      const runStatus = loadRunStatus(latestRunId);
      if (!runStatus) {
        return reply.send({
          status: 'error',
          message: 'Failed to load run status',
          runId: latestRunId,
        });
      }

      return reply.send({
        status: 'ok',
        runId: runStatus.runId,
        startedAt: runStatus.startedAt,
        phases: runStatus.phases,
        lastCompletedPhase: runStatus.lastCompletedPhase,
        updatedAt: runStatus.updatedAt,
      });
    }
  );

  /**
   * GET /api/v1/admin/system-health
   */
  server.get(
    '/system-health',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const latestRunId = getLatestRunId();
      const runStatus = latestRunId ? loadRunStatus(latestRunId) : null;

      // Get counts from database
      let subscriberCount = 0;
      let ideaCount = 0;

      try {
        const subResult = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(eq(subscriptions.status, 'active'));
        subscriberCount = subResult[0]?.count || 0;
      } catch {
        // DB query failed
      }

      try {
        const ideaResult = await db
          .select({ count: count() })
          .from(ideas);
        ideaCount = ideaResult[0]?.count || 0;
      } catch {
        // DB query failed
      }

      return reply.send({
        status: 'ok',
        pipeline: {
          lastRunId: runStatus?.runId || null,
          lastRunAt: runStatus?.startedAt || null,
          lastRunPhases: runStatus?.phases || null,
        },
        counts: {
          activeSubscribers: subscriberCount,
          totalIdeas: ideaCount,
        },
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * POST /api/v1/admin/pipeline/run
   * Trigger a pipeline run. Returns immediately; admin polls /pipeline-status.
   */
  server.post(
    '/pipeline/run',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const body = request.body as {
        dryRun?: boolean;
        skipDelivery?: boolean;
        hoursBack?: number;
        maxBriefs?: number;
      } | undefined;

      const pipelineConfig = {
        ...DEFAULT_PIPELINE_CONFIG,
        hoursBack: body?.hoursBack ?? DEFAULT_PIPELINE_CONFIG.hoursBack,
        maxBriefs: body?.maxBriefs ?? DEFAULT_PIPELINE_CONFIG.maxBriefs,
        dryRun: body?.dryRun ?? body?.skipDelivery ?? false,
      };

      // Fire and forget — run pipeline in background
      runPipeline(pipelineConfig).catch((err) => {
        request.log.error({ err }, 'Admin-triggered pipeline run failed');
      });

      return reply.send({
        status: 'started',
        message: 'Pipeline run started',
        config: {
          hoursBack: pipelineConfig.hoursBack,
          maxBriefs: pipelineConfig.maxBriefs,
          dryRun: pipelineConfig.dryRun,
        },
      });
    }
  );

  /**
   * GET /api/v1/admin/users
   * List all users with tier info
   */
  server.get(
    '/users',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      try {
        const userList = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            tier: users.tier,
            createdAt: users.createdAt,
          })
          .from(users)
          .orderBy(users.createdAt);

        return reply.send({ users: userList });
      } catch {
        return reply.status(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch users',
        });
      }
    }
  );

  /**
   * GET /api/v1/admin/stats/overview
   * Overview stats for admin dashboard
   */
  server.get(
    '/stats/overview',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      let totalUsers = 0;
      let activeSubscribers = 0;
      let totalIdeas = 0;
      let ideasToday = 0;

      try {
        const userResult = await db.select({ count: count() }).from(users);
        totalUsers = userResult[0]?.count || 0;
      } catch {
        // DB query failed
      }

      try {
        const subResult = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(eq(subscriptions.status, 'active'));
        activeSubscribers = subResult[0]?.count || 0;
      } catch {
        // DB query failed
      }

      try {
        const ideaResult = await db.select({ count: count() }).from(ideas);
        totalIdeas = ideaResult[0]?.count || 0;
      } catch {
        // DB query failed
      }

      try {
        const todayResult = await db
          .select({ count: count() })
          .from(ideas)
          .where(sql`DATE(${ideas.generatedAt}) = CURRENT_DATE`);
        ideasToday = todayResult[0]?.count || 0;
      } catch {
        // DB query failed
      }

      // Try DB first for pipeline info
      let lastRunId: string | null = null;
      let lastRunAt: Date | null = null;

      try {
        const latestRun = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1);
        if (latestRun.length > 0) {
          lastRunId = latestRun[0].runId;
          lastRunAt = latestRun[0].startedAt;
        }
      } catch {
        // DB query failed, fall through to file-system
      }

      // Fallback to file system if DB had no results
      if (!lastRunId) {
        const latestRunId = getLatestRunId();
        const runStatus = latestRunId ? loadRunStatus(latestRunId) : null;
        lastRunId = runStatus?.runId || null;
        lastRunAt = runStatus?.startedAt ? new Date(runStatus.startedAt) : null;
      }

      return reply.send({
        totalUsers,
        activeSubscribers,
        totalIdeas,
        ideasToday,
        pipeline: {
          lastRunId,
          lastRunAt,
        },
      });
    }
  );

  /**
   * GET /api/v1/admin/runs
   * Paginated run history
   */
  server.get('/runs', { preHandler: [requireAdmin] }, async (request, reply) => {
    const query = request.query as { page?: string; limit?: string; status?: string };
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const offset = (page - 1) * limit;

    const statusFilter = query.status === 'completed'
      ? eq(pipelineRuns.success, true)
      : query.status === 'failed'
        ? eq(pipelineRuns.success, false)
        : undefined;

    const baseQuery = statusFilter
      ? db.select().from(pipelineRuns).where(statusFilter)
      : db.select().from(pipelineRuns);

    const countQuery = statusFilter
      ? db.select({ count: count() }).from(pipelineRuns).where(statusFilter)
      : db.select({ count: count() }).from(pipelineRuns);

    const [runs, totalResult] = await Promise.all([
      baseQuery.orderBy(desc(pipelineRuns.startedAt)).limit(limit).offset(offset),
      countQuery,
    ]);

    return reply.send({
      runs,
      total: totalResult[0]?.count || 0,
      page,
      limit,
    });
  });

  /**
   * GET /api/v1/admin/runs/:runId
   * Single run detail
   */
  server.get('/runs/:runId', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.runId, runId)).limit(1);

    if (result.length === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Run not found' });
    }

    return reply.send({ run: result[0] });
  });
};

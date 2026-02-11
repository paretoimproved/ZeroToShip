/**
 * Admin Routes for ZeroToShip API
 *
 * Provides admin-only endpoints for pipeline monitoring, system health,
 * user management, and pipeline control.
 */

import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../middleware/auth';
import { runPipeline, DEFAULT_PIPELINE_CONFIG, generateRunId } from '../../scheduler';
import { db, ideas, subscriptions, users, pipelineRuns, emailLogs } from '../db/client';
import { eq, count, desc, sql } from 'drizzle-orm';

export const adminRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/admin/pipeline-status
   */
  server.get(
    '/pipeline-status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      try {
        const latestRun = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1);
        if (latestRun.length > 0) {
          const run = latestRun[0];
          return reply.send({
            status: 'ok',
            runId: run.runId,
            startedAt: run.startedAt,
            phases: run.phases,
            phaseStats: run.phaseStats,
            lastCompletedPhase: run.lastCompletedPhase,
            success: run.success,
            completedAt: run.completedAt,
            updatedAt: run.updatedAt,
          });
        }
      } catch {
        // DB query failed, fall through
      }

      return reply.send({
        status: 'no_runs',
        message: 'No pipeline runs found',
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

      // Get latest run info from DB
      let lastRunId: string | null = null;
      let lastRunAt: Date | null = null;
      let lastRunPhases: unknown = null;

      try {
        const latestRun = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1);
        if (latestRun.length > 0) {
          lastRunId = latestRun[0].runId;
          lastRunAt = latestRun[0].startedAt;
          lastRunPhases = latestRun[0].phases;
        }
      } catch {
        // DB query failed
      }

      return reply.send({
        status: 'ok',
        pipeline: {
          lastRunId,
          lastRunAt,
          lastRunPhases,
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
        scrapers?: { reddit?: boolean; hn?: boolean; twitter?: boolean; github?: boolean };
        clusteringThreshold?: number;
        minPriorityScore?: number;
        minFrequencyForGap?: number;
      } | undefined;

      const pipelineConfig = {
        ...DEFAULT_PIPELINE_CONFIG,
        hoursBack: body?.hoursBack ?? DEFAULT_PIPELINE_CONFIG.hoursBack,
        maxBriefs: body?.maxBriefs ?? DEFAULT_PIPELINE_CONFIG.maxBriefs,
        dryRun: body?.dryRun ?? body?.skipDelivery ?? false,
        scrapers: body?.scrapers
          ? { ...DEFAULT_PIPELINE_CONFIG.scrapers, ...body.scrapers }
          : DEFAULT_PIPELINE_CONFIG.scrapers,
        clusteringThreshold: body?.clusteringThreshold ?? DEFAULT_PIPELINE_CONFIG.clusteringThreshold,
        minPriorityScore: body?.minPriorityScore ?? DEFAULT_PIPELINE_CONFIG.minPriorityScore,
        minFrequencyForGap: body?.minFrequencyForGap ?? DEFAULT_PIPELINE_CONFIG.minFrequencyForGap,
      };

      // Pre-generate runId so we can return it immediately
      const runId = generateRunId();

      // Fire and forget — run pipeline in background
      runPipeline(pipelineConfig, runId).catch((err) => {
        request.log.error({ err }, 'Admin-triggered pipeline run failed');
      });

      return reply.send({
        status: 'started',
        message: 'Pipeline run started',
        runId,
        config: {
          hoursBack: pipelineConfig.hoursBack,
          maxBriefs: pipelineConfig.maxBriefs,
          dryRun: pipelineConfig.dryRun,
          scrapers: pipelineConfig.scrapers,
          clusteringThreshold: pipelineConfig.clusteringThreshold,
          minPriorityScore: pipelineConfig.minPriorityScore,
          minFrequencyForGap: pipelineConfig.minFrequencyForGap,
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

      let lastRunId: string | null = null;
      let lastRunAt: Date | null = null;

      try {
        const latestRun = await db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1);
        if (latestRun.length > 0) {
          lastRunId = latestRun[0].runId;
          lastRunAt = latestRun[0].startedAt;
        }
      } catch {
        // DB query failed
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

  /**
   * GET /api/v1/admin/email-logs
   * Paginated email delivery logs
   */
  server.get('/email-logs', { preHandler: [requireAdmin] }, async (request, reply) => {
    const query = request.query as { page?: string; limit?: string; status?: string };
    const page = Math.max(1, parseInt(query.page || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20')));
    const offset = (page - 1) * limit;

    const statusFilter = query.status && query.status !== 'all'
      ? eq(emailLogs.status, query.status)
      : undefined;

    const baseQuery = statusFilter
      ? db.select().from(emailLogs).where(statusFilter)
      : db.select().from(emailLogs);

    const countQuery = statusFilter
      ? db.select({ count: count() }).from(emailLogs).where(statusFilter)
      : db.select({ count: count() }).from(emailLogs);

    const [logs, totalResult] = await Promise.all([
      baseQuery.orderBy(desc(emailLogs.sentAt)).limit(limit).offset(offset),
      countQuery,
    ]);

    return reply.send({
      logs,
      total: totalResult[0]?.count || 0,
      page,
      limit,
    });
  });
};

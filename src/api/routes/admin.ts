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
import { eq, count, desc, sql, inArray } from 'drizzle-orm';
import { runDeliverPhase } from '../../scheduler/phases/deliver';

export const adminRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/v1/admin/pipeline-status
   */
  server.get(
    '/pipeline-status',
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      try {
        const latestRun = await db
          .select({
            runId: pipelineRuns.runId,
            startedAt: pipelineRuns.startedAt,
            phases: pipelineRuns.phases,
            phaseStats: pipelineRuns.phaseStats,
            generationMode: pipelineRuns.generationMode,
            generationDiagnostics: pipelineRuns.generationDiagnostics,
            lastCompletedPhase: pipelineRuns.lastCompletedPhase,
            success: pipelineRuns.success,
            completedAt: pipelineRuns.completedAt,
            updatedAt: pipelineRuns.updatedAt,
          })
          .from(pipelineRuns)
          .orderBy(desc(pipelineRuns.startedAt))
          .limit(1);
        if (latestRun.length > 0) {
          return reply.send({
            status: 'ok',
            ...latestRun[0],
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
      const [subsResult, ideasResult, runResult] = await Promise.allSettled([
        db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
        db.select({ count: count() }).from(ideas),
        db.select({
          runId: pipelineRuns.runId,
          startedAt: pipelineRuns.startedAt,
          phases: pipelineRuns.phases,
        }).from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1),
      ]);

      const subscriberCount = subsResult.status === 'fulfilled' ? subsResult.value[0]?.count || 0 : 0;
      const ideaCount = ideasResult.status === 'fulfilled' ? ideasResult.value[0]?.count || 0 : 0;
      const latestRun = runResult.status === 'fulfilled' ? runResult.value[0] : null;

      return reply.send({
        status: 'ok',
        pipeline: {
          lastRunId: latestRun?.runId || null,
          lastRunAt: latestRun?.startedAt || null,
          lastRunPhases: latestRun?.phases || null,
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
        generationMode?: 'legacy' | 'graph';
        scrapers?: { reddit?: boolean; hn?: boolean; twitter?: boolean; github?: boolean };
        clusteringThreshold?: number;
        minPriorityScore?: number;
        minFrequencyForGap?: number;
        publishGateEnabled?: boolean;
        publishGateConfidenceThreshold?: number;
      } | undefined;

      const pipelineConfig = {
        ...DEFAULT_PIPELINE_CONFIG,
        hoursBack: body?.hoursBack ?? DEFAULT_PIPELINE_CONFIG.hoursBack,
        maxBriefs: body?.maxBriefs ?? DEFAULT_PIPELINE_CONFIG.maxBriefs,
        generationMode: body?.generationMode,
        dryRun: body?.dryRun ?? body?.skipDelivery ?? false,
        publishGate: {
          enabled: body?.publishGateEnabled ?? DEFAULT_PIPELINE_CONFIG.publishGate?.enabled ?? false,
          confidenceThreshold:
            body?.publishGateConfidenceThreshold ??
            DEFAULT_PIPELINE_CONFIG.publishGate?.confidenceThreshold ??
            0.85,
        },
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
          publishGateEnabled: pipelineConfig.publishGate?.enabled ?? false,
          publishGateConfidenceThreshold: pipelineConfig.publishGate?.confidenceThreshold ?? null,
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
            tier: subscriptions.plan,
            createdAt: users.createdAt,
          })
          .from(users)
          .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
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
      const [usersResult, subsResult, ideasResult, todayResult, runResult] = await Promise.allSettled([
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, 'active')),
        db.select({ count: count() }).from(ideas),
        db.select({ count: count() }).from(ideas).where(sql`DATE(${ideas.publishedAt}) = CURRENT_DATE`),
        db.select({ runId: pipelineRuns.runId, startedAt: pipelineRuns.startedAt })
          .from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(1),
      ]);

      const totalUsers = usersResult.status === 'fulfilled' ? usersResult.value[0]?.count || 0 : 0;
      const activeSubscribers = subsResult.status === 'fulfilled' ? subsResult.value[0]?.count || 0 : 0;
      const totalIdeas = ideasResult.status === 'fulfilled' ? ideasResult.value[0]?.count || 0 : 0;
      const ideasToday = todayResult.status === 'fulfilled' ? todayResult.value[0]?.count || 0 : 0;
      const latestRun = runResult.status === 'fulfilled' ? runResult.value[0] : null;

      return reply.send({
        totalUsers,
        activeSubscribers,
        totalIdeas,
        ideasToday,
        pipeline: {
          lastRunId: latestRun?.runId || null,
          lastRunAt: latestRun?.startedAt || null,
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

    // Select all columns except phaseResults (large JSONB)
    const runListColumns = {
      id: pipelineRuns.id,
      runId: pipelineRuns.runId,
      status: pipelineRuns.status,
      startedAt: pipelineRuns.startedAt,
      completedAt: pipelineRuns.completedAt,
      config: pipelineRuns.config,
      phases: pipelineRuns.phases,
      stats: pipelineRuns.stats,
      phaseStats: pipelineRuns.phaseStats,
      generationMode: pipelineRuns.generationMode,
      generationDiagnostics: pipelineRuns.generationDiagnostics,
      lastCompletedPhase: pipelineRuns.lastCompletedPhase,
      success: pipelineRuns.success,
      totalDuration: pipelineRuns.totalDuration,
      errors: pipelineRuns.errors,
      apiMetrics: pipelineRuns.apiMetrics,
      briefSummaries: pipelineRuns.briefSummaries,
      updatedAt: pipelineRuns.updatedAt,
    };

    const statusFilter = query.status === 'completed'
      ? eq(pipelineRuns.status, 'completed')
      : query.status === 'failed'
        ? eq(pipelineRuns.status, 'failed')
        : query.status === 'needs_review'
          ? eq(pipelineRuns.status, 'needs_review')
          : undefined;

    const baseQuery = statusFilter
      ? db.select(runListColumns).from(pipelineRuns).where(statusFilter)
      : db.select(runListColumns).from(pipelineRuns);

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
   * POST /api/v1/admin/runs/:runId/publish/approve
   * Approve a publish-gated run: publish selected ideas and execute delivery.
   */
  server.post('/runs/:runId/publish/approve', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const body = request.body as { briefIds?: string[] } | undefined;

    const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.runId, runId)).limit(1);
    if (result.length === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Run not found' });
    }

    const run = result[0] as any;
    const phaseResults = (run.phaseResults ?? {}) as Record<string, any>;
    const generateData = phaseResults.generate as { briefs?: any[] } | undefined;
    const briefs = generateData?.briefs as any[] | undefined;

    if (!Array.isArray(briefs) || briefs.length === 0) {
      return reply.status(400).send({ code: 'NO_BRIEFS', message: 'No generated briefs found for this run' });
    }

    const requestedIds = Array.isArray(body?.briefIds) ? body!.briefIds.filter(Boolean) : [];
    const allowAll = requestedIds.length === 0;

    const deliverBriefs = allowAll
      ? briefs
      : briefs.filter((b) => requestedIds.includes(String(b.id)));

    const publishIds = Array.from(new Set(deliverBriefs.map((b) => String(b.id)).filter(Boolean)));

    if (publishIds.length > 0) {
      await db
        .update(ideas)
        .set({ isPublished: true, publishedAt: new Date() })
        .where(inArray(ideas.id, publishIds));
    }

    const deliverConfig = (run.config ?? {}) as any;
    const deliverResult = await runDeliverPhase(runId, deliverConfig, deliverBriefs);

    const phases = { ...(run.phases ?? {}) } as Record<string, string>;
    phases.deliver = deliverResult.success ? 'completed' : 'failed';

    const phaseStats = { ...(run.phaseStats ?? {}) } as Record<string, any>;
    if (deliverResult.data) {
      phaseStats.deliver = {
        sent: deliverResult.data.sent,
        failed: deliverResult.data.failed,
        subscriberCount: deliverResult.data.subscriberCount,
      };
    }

    const stats = { ...(run.stats ?? {}) } as Record<string, any>;
    if (deliverResult.data) {
      stats.emailsSent = deliverResult.data.sent;
    }

    const history = Array.isArray(phaseResults.publishGateHistory)
      ? phaseResults.publishGateHistory.slice(0, 200)
      : [];
    history.push({
      action: 'approve',
      by: request.userEmail ?? null,
      at: new Date().toISOString(),
      briefIds: publishIds,
      delivered: deliverResult.success,
      deliveredSent: deliverResult.data?.sent ?? 0,
    });

    phaseResults.publishGateHistory = history;
    phaseResults.deliver = deliverResult.data ?? null;

    const now = new Date();
    const startedAt = run.startedAt ? new Date(run.startedAt) : now;

    await db.update(pipelineRuns)
      .set({
        status: deliverResult.success ? 'completed' : 'failed',
        completedAt: now,
        updatedAt: now,
        phases,
        phaseStats,
        stats,
        success: deliverResult.success,
        totalDuration: Math.max(0, Math.round(now.getTime() - startedAt.getTime())),
        phaseResults,
      })
      .where(eq(pipelineRuns.runId, runId));

    return reply.send({
      status: 'ok',
      publishedCount: publishIds.length,
      delivered: deliverResult.data ?? null,
    });
  });

  /**
   * POST /api/v1/admin/runs/:runId/publish/reject
   * Reject a publish-gated run: keep ideas unpublished and finalize run as rejected.
   */
  server.post('/runs/:runId/publish/reject', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { runId } = request.params as { runId: string };
    const body = request.body as { reason?: string } | undefined;

    const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.runId, runId)).limit(1);
    if (result.length === 0) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Run not found' });
    }

    const run = result[0] as any;
    const phaseResults = (run.phaseResults ?? {}) as Record<string, any>;

    const history = Array.isArray(phaseResults.publishGateHistory)
      ? phaseResults.publishGateHistory.slice(0, 200)
      : [];
    history.push({
      action: 'reject',
      by: request.userEmail ?? null,
      at: new Date().toISOString(),
      reason: body?.reason ?? null,
    });
    phaseResults.publishGateHistory = history;

    const now = new Date();
    const startedAt = run.startedAt ? new Date(run.startedAt) : now;

    await db.update(pipelineRuns)
      .set({
        status: 'rejected',
        completedAt: now,
        updatedAt: now,
        success: false,
        totalDuration: Math.max(0, Math.round(now.getTime() - startedAt.getTime())),
        phaseResults,
      })
      .where(eq(pipelineRuns.runId, runId));

    return reply.send({ status: 'ok' });
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

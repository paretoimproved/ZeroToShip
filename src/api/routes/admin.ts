/**
 * Admin Routes for ZeroToShip API
 *
 * Provides admin-only endpoints for pipeline monitoring, system health,
 * user management, and pipeline control.
 */

import type { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAdmin } from '../middleware/auth';
import { runPipeline, DEFAULT_PIPELINE_CONFIG, generateRunId } from '../../scheduler';
import { db, ideas, subscriptions, users, userPreferences, pipelineRuns, emailLogs } from '../db/client';
import { and, eq, count, desc, sql, inArray } from 'drizzle-orm';
import { runDeliverPhase } from '../../scheduler/phases/deliver';
import { sendDailyBriefsBatch, type Subscriber } from '../../delivery/email';
import type { PipelineConfig } from '../../scheduler/types';
import type { IdeaBrief } from '../../generation/brief-generator';

// ─── Shared param schemas ────────────────────────────────────────────────────

const RunIdParamsSchema = z.object({
  runId: z.string().min(1),
});

// ─── Request body schemas ────────────────────────────────────────────────────

const PipelineRunBodySchema = z.object({
  dryRun: z.boolean().optional(),
  skipDelivery: z.boolean().optional(),
  hoursBack: z.number().int().positive().optional(),
  maxBriefs: z.number().int().positive().optional(),
  generationMode: z.enum(['legacy', 'graph']).optional(),
  scrapers: z.object({
    reddit: z.boolean().optional(),
    hn: z.boolean().optional(),
    twitter: z.boolean().optional(),
    github: z.boolean().optional(),
  }).optional(),
  clusteringThreshold: z.number().min(0).max(1).optional(),
  minPriorityScore: z.number().min(0).max(100).optional(),
  minFrequencyForGap: z.number().int().positive().optional(),
  publishGateEnabled: z.boolean().optional(),
  publishGateConfidenceThreshold: z.number().min(0).max(1).optional(),
}).optional();

const PublishApproveBodySchema = z.object({
  briefIds: z.array(z.string()).optional(),
}).optional();

const PublishRejectBodySchema = z.object({
  reason: z.string().optional(),
}).optional();

// ─── Query param schemas ─────────────────────────────────────────────────────

const RunsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['completed', 'failed', 'needs_review']).optional(),
});

const EmailLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  runId: z.string().optional(),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/admin/pipeline-status
   */
  app.get(
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
  app.get(
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
  app.post(
    '/pipeline/run',
    {
      preHandler: [requireAdmin],
      schema: {
        body: PipelineRunBodySchema,
      },
    },
    async (request, reply) => {
      const body = request.body;

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
  app.get(
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
  app.get(
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
  app.get(
    '/runs',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: RunsQuerySchema,
      },
    },
    async (request, reply) => {
      const query = request.query;
      const page = query.page;
      const limit = query.limit;
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
    }
  );

  /**
   * GET /api/v1/admin/runs/:runId
   * Single run detail
   */
  app.get(
    '/runs/:runId',
    {
      preHandler: [requireAdmin],
      schema: {
        params: RunIdParamsSchema,
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.runId, runId)).limit(1);

      if (result.length === 0) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Run not found' });
      }

      return reply.send({ run: result[0] });
    }
  );

  /**
   * POST /api/v1/admin/runs/:runId/publish/approve
   * Approve a publish-gated run: publish selected ideas and execute delivery.
   */
  app.post(
    '/runs/:runId/publish/approve',
    {
      preHandler: [requireAdmin],
      schema: {
        params: RunIdParamsSchema,
        body: PublishApproveBodySchema,
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const body = request.body;

      const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.runId, runId)).limit(1);
      if (result.length === 0) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Run not found' });
      }

      const run = result[0];
      const phaseResults = (run.phaseResults ?? {}) as Record<string, unknown>;
      const generateData = phaseResults.generate as { briefs?: unknown[] } | undefined;
      const briefs = Array.isArray(generateData?.briefs) ? generateData.briefs as Array<Record<string, unknown>> : [];

      if (briefs.length === 0) {
        return reply.status(400).send({ code: 'NO_BRIEFS', message: 'No generated briefs found for this run' });
      }

      const requestedIds = Array.isArray(body?.briefIds) ? body.briefIds.filter(Boolean) : [];
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

      const deliverConfig = (run.config ?? {}) as PipelineConfig;
      const deliverResult = await runDeliverPhase(runId, deliverConfig, deliverBriefs as unknown as IdeaBrief[]);

      const phases = { ...((run.phases ?? {}) as Record<string, string>) };
      phases.deliver = deliverResult.success ? 'completed' : 'failed';

      const phaseStats = { ...((run.phaseStats ?? {}) as Record<string, unknown>) };
      if (deliverResult.data) {
        phaseStats.deliver = {
          sent: deliverResult.data.sent,
          failed: deliverResult.data.failed,
          subscriberCount: deliverResult.data.subscriberCount,
        };
      }

      const stats = { ...((run.stats ?? {}) as Record<string, unknown>) };
      if (deliverResult.data) {
        stats.emailsSent = deliverResult.data.sent;
      }

      const historyArray = Array.isArray(phaseResults.publishGateHistory)
        ? (phaseResults.publishGateHistory as unknown[]).slice(0, 200)
        : [];
      historyArray.push({
        action: 'approve',
        by: request.userEmail ?? null,
        at: new Date().toISOString(),
        briefIds: publishIds,
        delivered: deliverResult.success,
        deliveredSent: deliverResult.data?.sent ?? 0,
      });

      phaseResults.publishGateHistory = historyArray;
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
    }
  );

  /**
   * POST /api/v1/admin/runs/:runId/publish/reject
   * Reject a publish-gated run: keep ideas unpublished and finalize run as rejected.
   */
  app.post(
    '/runs/:runId/publish/reject',
    {
      preHandler: [requireAdmin],
      schema: {
        params: RunIdParamsSchema,
        body: PublishRejectBodySchema,
      },
    },
    async (request, reply) => {
      const { runId } = request.params;
      const body = request.body;

      const result = await db.select().from(pipelineRuns).where(eq(pipelineRuns.runId, runId)).limit(1);
      if (result.length === 0) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Run not found' });
      }

      const run = result[0];
      const phaseResults = (run.phaseResults ?? {}) as Record<string, unknown>;

      const historyArray = Array.isArray(phaseResults.publishGateHistory)
        ? (phaseResults.publishGateHistory as unknown[]).slice(0, 200)
        : [];
      historyArray.push({
        action: 'reject',
        by: request.userEmail ?? null,
        at: new Date().toISOString(),
        reason: body?.reason ?? null,
      });
      phaseResults.publishGateHistory = historyArray;

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
    }
  );

  /**
   * GET /api/v1/admin/email-logs
   * Paginated email delivery logs
   */
  app.get(
    '/email-logs',
    {
      preHandler: [requireAdmin],
      schema: {
        querystring: EmailLogsQuerySchema,
      },
    },
    async (request, reply) => {
      const query = request.query;
      const page = query.page;
      const limit = query.limit;
      const offset = (page - 1) * limit;

      const filters = [];
      if (query.status && query.status !== 'all') {
        filters.push(eq(emailLogs.status, query.status));
      }
      if (query.runId) {
        filters.push(eq(emailLogs.runId, query.runId));
      }

      const whereClause = filters.length > 0 ? and(...filters) : undefined;

      const baseQuery = whereClause
        ? db.select().from(emailLogs).where(whereClause)
        : db.select().from(emailLogs);

      const countQuery = whereClause
        ? db.select({ count: count() }).from(emailLogs).where(whereClause)
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
    }
  );

  /**
   * POST /api/v1/admin/runs/:runId/delivery/resend
   * Resend emails that failed during a specific pipeline run.
   */
  app.post(
    '/runs/:runId/delivery/resend',
    {
      preHandler: [requireAdmin],
      schema: {
        params: RunIdParamsSchema,
      },
    },
    async (request, reply) => {
      const { runId } = request.params;

      // 1. Load the pipeline run
      const runResult = await db.select().from(pipelineRuns).where(eq(pipelineRuns.runId, runId)).limit(1);
      if (runResult.length === 0) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: 'Run not found' });
      }

      const run = runResult[0];
      const phaseResults = (run.phaseResults ?? {}) as Record<string, unknown>;
      const generateData = phaseResults.generate as { briefs?: unknown[] } | undefined;
      const briefs = Array.isArray(generateData?.briefs) ? generateData.briefs as Array<Record<string, unknown>> : [];

      if (briefs.length === 0) {
        return reply.status(400).send({ code: 'NO_BRIEFS', message: 'No generated briefs found for this run' });
      }

      // 2. Get failed email log entries for this run
      const failedLogs = await db
        .select({ recipientEmail: emailLogs.recipientEmail, userId: emailLogs.userId })
        .from(emailLogs)
        .where(and(eq(emailLogs.runId, runId), eq(emailLogs.status, 'failed')));

      if (failedLogs.length === 0) {
        return reply.send({ resent: 0, failed: 0, total: 0 });
      }

      // 3. Cross-reference with active subscribers to get tier info
      const failedEmails = failedLogs.map((l) => l.recipientEmail);
      const failedUserIds = failedLogs.map((l) => l.userId);

      const activeSubscribers = await db
        .select({
          id: users.id,
          email: users.email,
          tier: subscriptions.plan,
          unsubscribeToken: userPreferences.unsubscribeToken,
        })
        .from(users)
        .innerJoin(subscriptions, eq(subscriptions.userId, users.id))
        .leftJoin(userPreferences, eq(userPreferences.userId, users.id))
        .where(
          and(
            eq(subscriptions.status, 'active'),
            inArray(users.id, failedUserIds)
          )
        );

      // Only resend to users whose emails were in the failed set
      const subscribers: Subscriber[] = activeSubscribers
        .filter((s) => failedEmails.includes(s.email))
        .map((s) => ({
          id: s.id,
          email: s.email,
          tier: s.tier as Subscriber['tier'],
          unsubscribeToken: s.unsubscribeToken ?? undefined,
        }));

      if (subscribers.length === 0) {
        return reply.send({ resent: 0, failed: 0, total: 0 });
      }

      // 4. Send emails using safe defaults (concurrency 1, delay 1000ms)
      const batchResult = await sendDailyBriefsBatch(subscribers, briefs as never[], {});

      // 5. Persist new email_logs rows for retry attempts
      try {
        const retryLogRows = batchResult.deliveries
          .filter((d) => d.status === 'sent' || d.status === 'failed')
          .map((delivery) => ({
            runId,
            userId: delivery.subscriberId,
            recipientEmail: delivery.email,
            subject: `Your Daily Startup Ideas — ${new Date().toLocaleDateString()} (retry)`,
            messageId: delivery.messageId,
            status: delivery.status as string,
            error: delivery.error || null,
            sentAt: delivery.sentAt,
          }));

        if (retryLogRows.length > 0) {
          await db.insert(emailLogs).values(retryLogRows);
        }
      } catch (logError) {
        request.log.warn(
          { error: logError instanceof Error ? logError.message : String(logError) },
          'Failed to persist retry email logs (non-fatal)'
        );
      }

      return reply.send({
        resent: batchResult.sent,
        failed: batchResult.failed,
        total: batchResult.total,
      });
    }
  );
};

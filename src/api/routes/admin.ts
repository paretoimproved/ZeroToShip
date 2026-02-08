/**
 * Admin Routes for IdeaForge API
 *
 * Provides admin-only endpoints for pipeline monitoring and system health.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../middleware/auth';
import { loadRunStatus } from '../../scheduler/utils/persistence';
import { db, ideas, subscriptions } from '../db/client';
import { eq, count } from 'drizzle-orm';

const DATA_DIR = path.join(process.cwd(), 'data', 'runs');

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
    { preHandler: [requireAuth] },
    async (request, reply) => {
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
    { preHandler: [requireAuth] },
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
};

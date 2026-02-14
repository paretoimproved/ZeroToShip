/**
 * Pipeline Watchdog
 *
 * Detects stale daily runs by checking when the last successful run completed.
 * When stale, it triggers a missed-run alert.
 */

import { desc, eq } from 'drizzle-orm';
import { db, pipelineRuns } from '../api/db/client';
import { config } from '../config/env';
import { sendPipelineMissedRunAlert } from '../lib/alerts';
import { createLogger } from './utils/logger';

const logger = createLogger({ context: 'pipeline-watchdog' });

const HOURS_TO_MS = 60 * 60 * 1000;

export interface WatchdogOptions {
  maxAgeHours?: number;
  alertOnFailure?: boolean;
  now?: Date;
}

export interface WatchdogResult {
  healthy: boolean;
  reason: string;
  checkedAt: string;
  maxAgeHours: number;
  ageHours: number | null;
  latestSuccessfulRunId: string | null;
  latestSuccessfulCompletedAt: string | null;
  latestRunId: string | null;
  latestRunStatus: string | null;
}

/**
 * Check whether the pipeline has completed a successful run recently enough.
 */
export async function checkPipelineFreshness(
  options: WatchdogOptions = {}
): Promise<WatchdogResult> {
  const maxAgeHours = options.maxAgeHours ?? config.WATCHDOG_MAX_SUCCESS_AGE_HOURS;
  const alertOnFailure = options.alertOnFailure ?? true;
  const now = options.now ?? new Date();

  const [successfulRows, latestRows] = await Promise.all([
    db
      .select({
        runId: pipelineRuns.runId,
        startedAt: pipelineRuns.startedAt,
        completedAt: pipelineRuns.completedAt,
      })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.success, true))
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(1),
    db
      .select({
        runId: pipelineRuns.runId,
        status: pipelineRuns.status,
        startedAt: pipelineRuns.startedAt,
        completedAt: pipelineRuns.completedAt,
      })
      .from(pipelineRuns)
      .orderBy(desc(pipelineRuns.startedAt))
      .limit(1),
  ]);

  const latestSuccessfulRun = successfulRows[0];
  const latestRun = latestRows[0];
  const latestSuccessTime = latestSuccessfulRun?.completedAt || latestSuccessfulRun?.startedAt || null;
  const ageHours = latestSuccessTime
    ? (now.getTime() - latestSuccessTime.getTime()) / HOURS_TO_MS
    : null;
  const healthy = ageHours !== null && ageHours <= maxAgeHours;

  const result: WatchdogResult = {
    healthy,
    reason: healthy
      ? `Latest successful run is within threshold (${ageHours!.toFixed(2)}h <= ${maxAgeHours}h)`
      : latestSuccessfulRun
        ? `Latest successful run is stale (${ageHours!.toFixed(2)}h > ${maxAgeHours}h)`
        : 'No successful pipeline run found',
    checkedAt: now.toISOString(),
    maxAgeHours,
    ageHours: ageHours !== null ? Number(ageHours.toFixed(2)) : null,
    latestSuccessfulRunId: latestSuccessfulRun?.runId ?? null,
    latestSuccessfulCompletedAt: latestSuccessTime?.toISOString() ?? null,
    latestRunId: latestRun?.runId ?? null,
    latestRunStatus: latestRun?.status ?? null,
  };

  if (healthy) {
    logger.info(
      {
        maxAgeHours,
        ageHours: result.ageHours,
        latestSuccessfulRunId: result.latestSuccessfulRunId,
      },
      'Pipeline watchdog check passed'
    );
    return result;
  }

  logger.error(
    {
      maxAgeHours,
      ageHours: result.ageHours,
      latestSuccessfulRunId: result.latestSuccessfulRunId,
      latestRunId: result.latestRunId,
      latestRunStatus: result.latestRunStatus,
    },
    'Pipeline watchdog detected stale or missing successful run'
  );

  if (alertOnFailure) {
    await sendPipelineMissedRunAlert({
      maxAgeHours,
      ageHours: ageHours ?? maxAgeHours + 1,
      latestSuccessfulRunId: result.latestSuccessfulRunId ?? undefined,
      latestSuccessfulCompletedAt: result.latestSuccessfulCompletedAt ?? undefined,
      latestRunId: result.latestRunId ?? undefined,
      latestRunStatus: result.latestRunStatus ?? undefined,
    });
  }

  return result;
}


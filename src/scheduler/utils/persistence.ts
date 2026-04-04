/**
 * Pipeline Run Persistence
 *
 * Persists phase results to the database so a failed pipeline can resume
 * from the last completed phase instead of starting from scratch.
 *
 * Uses the `pipeline_runs` table as the single source of truth.
 */

import { eq, and, lt, sql } from 'drizzle-orm';
import { createLogger } from './logger';
import { db, pipelineRuns } from '../../api/db/client';
import type { PhaseName, PipelineConfig } from '../types';

const logger = createLogger({ context: 'persistence' });

/**
 * Summary stats for each pipeline phase, persisted alongside status
 */
export interface PhaseStats {
  scrape?: { totalPosts: number; reddit: number; hn: number; twitter: number; github: number };
  analyze?: { clusterCount: number; scoredCount: number; gapAnalysisCount: number };
  generate?: { briefCount: number };
  deliver?: { sent: number; failed: number; subscriberCount: number };
}

/**
 * Status of each phase within a persisted run
 */
export interface RunStatus {
  runId: string;
  config: PipelineConfig;
  startedAt: string;
  phases: Record<PhaseName, 'pending' | 'completed' | 'failed' | 'blocked'>;
  phaseStats?: PhaseStats;
  lastCompletedPhase: PhaseName | null;
  updatedAt: string;
}

/**
 * Custom JSON replacer that handles Map instances.
 * Converts Map to a serializable format: { __type: 'Map', entries: [...] }
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      entries: Array.from(value.entries()),
    };
  }
  return value;
}

/**
 * Custom JSON reviver that restores Map instances.
 */
function jsonReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === 'object' &&
    (value as Record<string, unknown>).__type === 'Map' &&
    Array.isArray((value as Record<string, unknown>).entries)
  ) {
    return new Map((value as { entries: [string, unknown][] }).entries);
  }
  return value;
}

/**
 * Serialize data for JSONB storage, handling Map instances.
 */
function serializeForJsonb(data: unknown): unknown {
  return JSON.parse(JSON.stringify(data, jsonReplacer));
}

/**
 * Deserialize data from JSONB storage, restoring Map instances.
 */
function deserializeFromJsonb<T>(data: unknown): T {
  return JSON.parse(JSON.stringify(data), jsonReviver) as T;
}

/**
 * Initialize a new run status in the database
 */
export async function initRunStatus(runId: string, config: PipelineConfig): Promise<void> {
  const phases = {
    scrape: 'pending',
    analyze: 'pending',
    generate: 'pending',
    deliver: 'pending',
  };

  await db.insert(pipelineRuns).values({
    runId,
    status: 'running',
    generationMode: 'legacy',
    startedAt: new Date(),
    config,
    phases,
    stats: { postsScraped: 0, clustersCreated: 0, ideasGenerated: 0, emailsSent: 0 },
    phaseResults: {},
    phaseStats: {},
    generationDiagnostics: null,
    lastCompletedPhase: null,
    success: false,
    updatedAt: new Date(),
  });

  logger.debug({ runId }, 'Initialized run status in database');
}

/**
 * Persist phase output data to the database
 */
export async function savePhaseResult(
  runId: string,
  phase: PhaseName,
  data: unknown
): Promise<void> {
  const row = await db.select({ phaseResults: pipelineRuns.phaseResults })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.runId, runId))
    .limit(1);

  if (row.length === 0) {
    logger.warn({ runId }, 'Cannot save phase result: run not found in database');
    return;
  }

  const existing = (row[0].phaseResults as Record<string, unknown>) || {};
  existing[phase] = serializeForJsonb(data);

  await db.update(pipelineRuns)
    .set({ phaseResults: existing, updatedAt: new Date() })
    .where(eq(pipelineRuns.runId, runId));

  logger.debug({ runId, phase }, 'Saved phase result to database');
}

/**
 * Update the run status after a phase completes or fails
 */
export async function updatePhaseStatus(
  runId: string,
  phase: PhaseName,
  outcome: 'completed' | 'failed' | 'blocked'
): Promise<void> {
  const row = await db.select({
    phases: pipelineRuns.phases,
    lastCompletedPhase: pipelineRuns.lastCompletedPhase,
  })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.runId, runId))
    .limit(1);

  if (row.length === 0) {
    logger.warn({ runId }, 'Cannot update status: run not found in database');
    return;
  }

  const phases = row[0].phases as Record<PhaseName, 'pending' | 'completed' | 'failed' | 'blocked'>;
  phases[phase] = outcome;

  const updates: Record<string, unknown> = {
    phases,
    updatedAt: new Date(),
  };

  if (outcome === 'completed') {
    updates.lastCompletedPhase = phase;
  }

  await db.update(pipelineRuns)
    .set(updates)
    .where(eq(pipelineRuns.runId, runId));

  logger.debug({ runId, phase, outcome }, 'Updated phase status in database');
}

/**
 * Update phase stats in the database
 */
export async function updatePhaseStats(
  runId: string,
  phase: PhaseName,
  stats: PhaseStats[keyof PhaseStats]
): Promise<void> {
  const row = await db.select({ phaseStats: pipelineRuns.phaseStats })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.runId, runId))
    .limit(1);

  if (row.length === 0) {
    logger.warn({ runId }, 'Cannot update phase stats: run not found in database');
    return;
  }

  const existing = (row[0].phaseStats as Record<string, unknown>) || {};
  existing[phase] = stats;

  await db.update(pipelineRuns)
    .set({ phaseStats: existing, updatedAt: new Date() })
    .where(eq(pipelineRuns.runId, runId));

  logger.debug({ runId, phase }, 'Updated phase stats in database');
}

/**
 * Load the run status from the database. Returns null if not found.
 */
export async function loadRunStatus(runId: string): Promise<RunStatus | null> {
  try {
    const row = await db.select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.runId, runId))
      .limit(1);

    if (row.length === 0) {
      return null;
    }

    const run = row[0];
    return {
      runId: run.runId,
      config: run.config as PipelineConfig,
      startedAt: run.startedAt.toISOString(),
      phases: run.phases as Record<PhaseName, 'pending' | 'completed' | 'failed'>,
      phaseStats: (run.phaseStats as PhaseStats) || undefined,
      lastCompletedPhase: (run.lastCompletedPhase as PhaseName) || null,
      updatedAt: run.updatedAt.toISOString(),
    };
  } catch (err) {
    logger.warn(
      { runId, error: err instanceof Error ? err.message : String(err) },
      'Failed to load run status from database'
    );
    return null;
  }
}

/**
 * Load persisted phase output from the database. Returns null if not found.
 */
export async function loadPhaseResult<T>(runId: string, phase: PhaseName): Promise<T | null> {
  try {
    const row = await db.select({ phaseResults: pipelineRuns.phaseResults })
      .from(pipelineRuns)
      .where(eq(pipelineRuns.runId, runId))
      .limit(1);

    if (row.length === 0) {
      return null;
    }

    const phaseResults = row[0].phaseResults as Record<string, unknown> | null;
    if (!phaseResults || !(phase in phaseResults)) {
      return null;
    }

    return deserializeFromJsonb<T>(phaseResults[phase]);
  } catch (err) {
    logger.warn(
      { runId, phase, error: err instanceof Error ? err.message : String(err) },
      'Failed to load phase result from database'
    );
    return null;
  }
}

/**
 * Determine which phase to resume from, given a run's status.
 * Returns the first phase that is not 'completed', or null if all are done.
 */
export function getResumePhase(status: RunStatus): PhaseName | null {
  const phaseOrder: PhaseName[] = ['scrape', 'analyze', 'generate', 'deliver'];

  for (const phase of phaseOrder) {
    if (status.phases[phase] !== 'completed') {
      return phase;
    }
  }

  return null;
}

/** Max age (in hours) before a `running` row is considered stale and marked `failed`. */
const STALE_RUN_THRESHOLD_HOURS = 4;

/**
 * Mark stale `running` rows as `failed`.
 *
 * A run is considered stale if its `startedAt` is older than the threshold
 * and it still has status `running`. This is a safety net — if the process
 * crashed and never finalized the row, this prevents it from blocking future
 * runs or confusing the dashboard.
 *
 * Call at the start of `runPipeline()` before acquiring the lock.
 */
export async function cleanupStaleRuns(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - STALE_RUN_THRESHOLD_HOURS * 60 * 60 * 1000);
    const result = await db.update(pipelineRuns)
      .set({
        status: 'failed',
        success: false,
        errors: sql`COALESCE(${pipelineRuns.errors}, '[]'::jsonb) || ${JSON.stringify([{
          phase: 'scrape',
          message: `Marked as failed by stale-run cleanup (running for >${STALE_RUN_THRESHOLD_HOURS}h)`,
          timestamp: new Date().toISOString(),
          recoverable: false,
          severity: 'fatal',
        }])}::jsonb`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pipelineRuns.status, 'running'),
          lt(pipelineRuns.startedAt, cutoff),
        )
      )
      .returning({ runId: pipelineRuns.runId });

    if (result.length > 0) {
      logger.warn(
        { count: result.length, runIds: result.map(r => r.runId) },
        'Cleaned up stale running pipeline rows'
      );
    }

    return result.length;
  } catch (err) {
    logger.warn(
      { error: err instanceof Error ? err.message : String(err) },
      'Failed to clean up stale runs (non-fatal)'
    );
    return 0;
  }
}

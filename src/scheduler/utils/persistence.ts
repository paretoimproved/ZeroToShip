/**
 * Pipeline Run Persistence
 *
 * Persists phase results to disk so a failed pipeline can resume
 * from the last completed phase instead of starting from scratch.
 *
 * Data is stored as JSON files under data/runs/{runId}/.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from './logger';
import type { PhaseName, PipelineConfig } from '../types';

const logger = createLogger({ context: 'persistence' });

/** Base directory for all run data, relative to project root */
const DATA_DIR = path.join(process.cwd(), 'data', 'runs');

/**
 * Status of each phase within a persisted run
 */
export interface RunStatus {
  runId: string;
  config: PipelineConfig;
  startedAt: string;
  phases: Record<PhaseName, 'pending' | 'completed' | 'failed'>;
  lastCompletedPhase: PhaseName | null;
  updatedAt: string;
}

/**
 * Get the directory path for a specific run
 */
function getRunDir(runId: string): string {
  return path.join(DATA_DIR, runId);
}

/**
 * Get the file path for a phase's persisted data
 */
function getPhaseFilePath(runId: string, phase: PhaseName): string {
  return path.join(getRunDir(runId), `${phase}.json`);
}

/**
 * Get the file path for the run status file
 */
function getStatusFilePath(runId: string): string {
  return path.join(getRunDir(runId), 'status.json');
}

/**
 * Ensure the run directory exists
 */
function ensureRunDir(runId: string): void {
  const dir = getRunDir(runId);
  fs.mkdirSync(dir, { recursive: true });
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
 * Initialize a new run status file
 */
export function initRunStatus(runId: string, config: PipelineConfig): void {
  ensureRunDir(runId);

  const status: RunStatus = {
    runId,
    config,
    startedAt: new Date().toISOString(),
    phases: {
      scrape: 'pending',
      analyze: 'pending',
      generate: 'pending',
      deliver: 'pending',
    },
    lastCompletedPhase: null,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getStatusFilePath(runId);
  fs.writeFileSync(filePath, JSON.stringify(status, null, 2), 'utf-8');
  logger.debug({ runId, filePath }, 'Initialized run status');
}

/**
 * Persist phase output data to disk
 */
export function savePhaseResult(
  runId: string,
  phase: PhaseName,
  data: unknown
): void {
  ensureRunDir(runId);

  const filePath = getPhaseFilePath(runId, phase);
  fs.writeFileSync(filePath, JSON.stringify(data, jsonReplacer, 2), 'utf-8');
  logger.debug({ runId, phase, filePath }, 'Saved phase result');
}

/**
 * Update the run status after a phase completes or fails
 */
export function updatePhaseStatus(
  runId: string,
  phase: PhaseName,
  outcome: 'completed' | 'failed'
): void {
  const status = loadRunStatus(runId);
  if (!status) {
    logger.warn({ runId }, 'Cannot update status: run status file not found');
    return;
  }

  status.phases[phase] = outcome;
  if (outcome === 'completed') {
    status.lastCompletedPhase = phase;
  }
  status.updatedAt = new Date().toISOString();

  const filePath = getStatusFilePath(runId);
  fs.writeFileSync(filePath, JSON.stringify(status, null, 2), 'utf-8');
  logger.debug({ runId, phase, outcome }, 'Updated phase status');
}

/**
 * Load the run status from disk. Returns null if not found or corrupted.
 */
export function loadRunStatus(runId: string): RunStatus | null {
  const filePath = getStatusFilePath(runId);

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as RunStatus;
  } catch (err) {
    logger.warn(
      { runId, error: err instanceof Error ? err.message : String(err) },
      'Failed to load run status (file may be corrupted)'
    );
    return null;
  }
}

/**
 * Load persisted phase output from disk. Returns null if not found or corrupted.
 */
export function loadPhaseResult<T>(runId: string, phase: PhaseName): T | null {
  const filePath = getPhaseFilePath(runId, phase);

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw, jsonReviver) as T;
  } catch (err) {
    logger.warn(
      {
        runId,
        phase,
        error: err instanceof Error ? err.message : String(err),
      },
      'Failed to load phase result (file may be corrupted)'
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

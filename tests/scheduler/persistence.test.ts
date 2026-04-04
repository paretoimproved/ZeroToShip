/**
 * Tests for pipeline run persistence utilities (DB-backed)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initRunStatus,
  savePhaseResult,
  updatePhaseStatus,
  updatePhaseStats,
  loadRunStatus,
  loadPhaseResult,
  getResumePhase,
  type RunStatus,
} from '../../src/scheduler/utils/persistence';
import type { PipelineConfig } from '../../src/scheduler/types';

// Mock database client
const mockInsert = vi.fn();
const mockSelectResult: Record<string, unknown>[] = [];
const mockUpdate = vi.fn();

vi.mock('../../src/api/db/client', () => ({
  db: {
    insert: () => ({
      values: mockInsert,
    }),
    select: (...args: unknown[]) => {
      const selectArgs = args;
      return {
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(mockSelectResult),
          }),
        }),
      };
    },
    update: () => ({
      set: (data: Record<string, unknown>) => ({
        where: () => {
          mockUpdate(data);
          return Promise.resolve();
        },
      }),
    }),
  },
  pipelineRuns: {
    runId: 'run_id',
    phases: 'phases',
    lastCompletedPhase: 'last_completed_phase',
    phaseResults: 'phase_results',
    phaseStats: 'phase_stats',
  },
}));

const TEST_RUN_ID = 'test_run_persistence';

const mockConfig: PipelineConfig = {
  hoursBack: 24,
  scrapers: { reddit: true, hn: true, twitter: true, github: true },
  clusteringThreshold: 0.85,
  minFrequencyForGap: 2,
  maxBriefs: 10,
  minPriorityScore: 0.5,
  dryRun: false,
  verbose: false,
};

describe('Pipeline Persistence (DB-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult.length = 0;
    mockInsert.mockResolvedValue(undefined);
    mockUpdate.mockClear();
  });

  describe('initRunStatus', () => {
    it('should insert initial row with pending phases', async () => {
      await initRunStatus(TEST_RUN_ID, mockConfig);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          runId: TEST_RUN_ID,
          status: 'running',
          phases: {
            scrape: 'pending',
            analyze: 'pending',
            generate: 'pending',
            deliver: 'pending',
          },
          success: false,
        })
      );
    });

    it('should store config in the inserted row', async () => {
      await initRunStatus(TEST_RUN_ID, mockConfig);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          config: mockConfig,
        })
      );
    });
  });

  describe('savePhaseResult / loadPhaseResult', () => {
    it('should persist and load simple phase data', async () => {
      const scrapeData = {
        reddit: { count: 10, success: true },
        hn: { count: 5, success: true },
        twitter: { count: 0, success: false, error: 'rate limited' },
        github: { count: 3, success: true },
        totalPosts: 18,
        posts: [{ id: 'p1', title: 'Test post' }],
      };

      // Set up mock: first select returns existing row with empty phaseResults
      mockSelectResult.push({ phaseResults: {} });

      await savePhaseResult(TEST_RUN_ID, 'scrape', scrapeData);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          phaseResults: expect.objectContaining({
            scrape: expect.objectContaining({
              totalPosts: 18,
            }),
          }),
        })
      );
    });

    it('should handle Map serialization for analyze phase', async () => {
      const gapMap = new Map<string, { gaps: string[] }>();
      gapMap.set('cluster_1', { gaps: ['No mobile app'] });
      gapMap.set('cluster_2', { gaps: ['Missing integration'] });

      const analyzeData = {
        clusterCount: 2,
        scoredCount: 2,
        gapAnalysisCount: 2,
        clusters: [],
        scoredProblems: [],
        gapAnalyses: gapMap,
      };

      // Set up mock: select returns existing row
      mockSelectResult.push({ phaseResults: {} });

      await savePhaseResult(TEST_RUN_ID, 'analyze', analyzeData);

      // Verify the update was called with serialized Map
      expect(mockUpdate).toHaveBeenCalled();
      const updateArg = mockUpdate.mock.calls[0][0];
      const analyzeSerialized = updateArg.phaseResults.analyze;
      expect(analyzeSerialized.gapAnalyses).toEqual({
        __type: 'Map',
        entries: [
          ['cluster_1', { gaps: ['No mobile app'] }],
          ['cluster_2', { gaps: ['Missing integration'] }],
        ],
      });
    });

    it('should restore Map when loading analyze phase result', async () => {
      // Set up mock: row with serialized Map in phaseResults
      mockSelectResult.push({
        phaseResults: {
          analyze: {
            clusterCount: 2,
            gapAnalyses: {
              __type: 'Map',
              entries: [
                ['cluster_1', { gaps: ['No mobile app'] }],
              ],
            },
          },
        },
      });

      const loaded = await loadPhaseResult<{
        clusterCount: number;
        gapAnalyses: Map<string, { gaps: string[] }>;
      }>(TEST_RUN_ID, 'analyze');

      expect(loaded).not.toBeNull();
      expect(loaded!.gapAnalyses).toBeInstanceOf(Map);
      expect(loaded!.gapAnalyses.size).toBe(1);
      expect(loaded!.gapAnalyses.get('cluster_1')).toEqual({ gaps: ['No mobile app'] });
    });

    it('should return null for non-existent run', async () => {
      // Empty result
      const loaded = await loadPhaseResult(TEST_RUN_ID, 'scrape');
      expect(loaded).toBeNull();
    });

    it('should return null when phase not in phaseResults', async () => {
      mockSelectResult.push({ phaseResults: {} });

      const loaded = await loadPhaseResult(TEST_RUN_ID, 'scrape');
      expect(loaded).toBeNull();
    });
  });

  describe('updatePhaseStatus', () => {
    it('should mark a phase as completed', async () => {
      mockSelectResult.push({
        phases: {
          scrape: 'pending',
          analyze: 'pending',
          generate: 'pending',
          deliver: 'pending',
        },
        lastCompletedPhase: null,
      });

      await updatePhaseStatus(TEST_RUN_ID, 'scrape', 'completed');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: expect.objectContaining({
            scrape: 'completed',
          }),
          lastCompletedPhase: 'scrape',
        })
      );
    });

    it('should mark a phase as failed without updating lastCompletedPhase', async () => {
      mockSelectResult.push({
        phases: {
          scrape: 'pending',
          analyze: 'pending',
          generate: 'pending',
          deliver: 'pending',
        },
        lastCompletedPhase: null,
      });

      await updatePhaseStatus(TEST_RUN_ID, 'analyze', 'failed');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          phases: expect.objectContaining({
            analyze: 'failed',
          }),
        })
      );

      // lastCompletedPhase should not be set for failures
      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.lastCompletedPhase).toBeUndefined();
    });
  });

  describe('updatePhaseStats', () => {
    it('should update phase stats in the database', async () => {
      mockSelectResult.push({ phaseStats: {} });

      await updatePhaseStats(TEST_RUN_ID, 'scrape', {
        totalPosts: 10,
        reddit: 5,
        hn: 3,
        twitter: 1,
        github: 1,
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          phaseStats: expect.objectContaining({
            scrape: {
              totalPosts: 10,
              reddit: 5,
              hn: 3,
              twitter: 1,
              github: 1,
            },
          }),
        })
      );
    });
  });

  describe('loadRunStatus', () => {
    it('should return null for non-existent run', async () => {
      const status = await loadRunStatus('nonexistent_run_id');
      expect(status).toBeNull();
    });

    it('should return RunStatus from database row', async () => {
      const now = new Date();
      mockSelectResult.push({
        runId: TEST_RUN_ID,
        config: mockConfig,
        startedAt: now,
        phases: {
          scrape: 'completed',
          analyze: 'pending',
          generate: 'pending',
          deliver: 'pending',
        },
        phaseStats: { scrape: { totalPosts: 10, reddit: 5, hn: 3, twitter: 1, github: 1 } },
        lastCompletedPhase: 'scrape',
        updatedAt: now,
      });

      const status = await loadRunStatus(TEST_RUN_ID);
      expect(status).not.toBeNull();
      expect(status!.runId).toBe(TEST_RUN_ID);
      expect(status!.phases.scrape).toBe('completed');
      expect(status!.phases.analyze).toBe('pending');
      expect(status!.lastCompletedPhase).toBe('scrape');
      expect(status!.config.hoursBack).toBe(24);
    });
  });

  describe('getResumePhase', () => {
    it('should return first pending phase', () => {
      const status: RunStatus = {
        runId: TEST_RUN_ID,
        config: mockConfig,
        startedAt: new Date().toISOString(),
        phases: {
          scrape: 'completed',
          analyze: 'completed',
          generate: 'failed',
          deliver: 'pending',
        },
        lastCompletedPhase: 'analyze',
        updatedAt: new Date().toISOString(),
      };

      expect(getResumePhase(status)).toBe('generate');
    });

    it('should return scrape if nothing completed', () => {
      const status: RunStatus = {
        runId: TEST_RUN_ID,
        config: mockConfig,
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

      expect(getResumePhase(status)).toBe('scrape');
    });

    it('should return null if all phases completed', () => {
      const status: RunStatus = {
        runId: TEST_RUN_ID,
        config: mockConfig,
        startedAt: new Date().toISOString(),
        phases: {
          scrape: 'completed',
          analyze: 'completed',
          generate: 'completed',
          deliver: 'completed',
        },
        lastCompletedPhase: 'deliver',
        updatedAt: new Date().toISOString(),
      };

      expect(getResumePhase(status)).toBeNull();
    });

    it('should resume from first failed phase', () => {
      const status: RunStatus = {
        runId: TEST_RUN_ID,
        config: mockConfig,
        startedAt: new Date().toISOString(),
        phases: {
          scrape: 'completed',
          analyze: 'failed',
          generate: 'pending',
          deliver: 'pending',
        },
        lastCompletedPhase: 'scrape',
        updatedAt: new Date().toISOString(),
      };

      expect(getResumePhase(status)).toBe('analyze');
    });
  });
});

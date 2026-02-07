/**
 * Tests for pipeline run persistence utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  initRunStatus,
  savePhaseResult,
  updatePhaseStatus,
  loadRunStatus,
  loadPhaseResult,
  getResumePhase,
  type RunStatus,
} from '../../src/scheduler/utils/persistence';
import type { PipelineConfig } from '../../src/scheduler/types';

const TEST_DATA_DIR = path.join(process.cwd(), 'data', 'runs');
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
  reportMetrics: false,
};

function cleanupTestRun(): void {
  const dir = path.join(TEST_DATA_DIR, TEST_RUN_ID);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

describe('Pipeline Persistence', () => {
  beforeEach(() => {
    cleanupTestRun();
  });

  afterEach(() => {
    cleanupTestRun();
  });

  describe('initRunStatus', () => {
    it('should create run directory and status file', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);

      const statusPath = path.join(TEST_DATA_DIR, TEST_RUN_ID, 'status.json');
      expect(fs.existsSync(statusPath)).toBe(true);

      const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
      expect(status.runId).toBe(TEST_RUN_ID);
      expect(status.phases.scrape).toBe('pending');
      expect(status.phases.analyze).toBe('pending');
      expect(status.phases.generate).toBe('pending');
      expect(status.phases.deliver).toBe('pending');
      expect(status.lastCompletedPhase).toBeNull();
    });

    it('should store config in the status file', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);

      const status = loadRunStatus(TEST_RUN_ID);
      expect(status).not.toBeNull();
      expect(status!.config.hoursBack).toBe(24);
      expect(status!.config.scrapers.reddit).toBe(true);
    });
  });

  describe('savePhaseResult / loadPhaseResult', () => {
    it('should persist and load simple phase data', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);

      const scrapeData = {
        reddit: { count: 10, success: true },
        hn: { count: 5, success: true },
        twitter: { count: 0, success: false, error: 'rate limited' },
        github: { count: 3, success: true },
        totalPosts: 18,
        posts: [{ id: 'p1', title: 'Test post' }],
      };

      savePhaseResult(TEST_RUN_ID, 'scrape', scrapeData);

      const loaded = loadPhaseResult(TEST_RUN_ID, 'scrape');
      expect(loaded).toEqual(scrapeData);
    });

    it('should handle Map serialization for analyze phase', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);

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

      savePhaseResult(TEST_RUN_ID, 'analyze', analyzeData);

      const loaded = loadPhaseResult<typeof analyzeData>(TEST_RUN_ID, 'analyze');
      expect(loaded).not.toBeNull();
      expect(loaded!.gapAnalyses).toBeInstanceOf(Map);
      expect(loaded!.gapAnalyses.size).toBe(2);
      expect(loaded!.gapAnalyses.get('cluster_1')).toEqual({ gaps: ['No mobile app'] });
    });

    it('should return null for non-existent phase data', () => {
      const loaded = loadPhaseResult(TEST_RUN_ID, 'scrape');
      expect(loaded).toBeNull();
    });

    it('should return null for corrupted phase data', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);
      const filePath = path.join(TEST_DATA_DIR, TEST_RUN_ID, 'scrape.json');
      fs.writeFileSync(filePath, 'not valid json{{{', 'utf-8');

      const loaded = loadPhaseResult(TEST_RUN_ID, 'scrape');
      expect(loaded).toBeNull();
    });
  });

  describe('updatePhaseStatus', () => {
    it('should mark a phase as completed', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);

      updatePhaseStatus(TEST_RUN_ID, 'scrape', 'completed');

      const status = loadRunStatus(TEST_RUN_ID);
      expect(status!.phases.scrape).toBe('completed');
      expect(status!.lastCompletedPhase).toBe('scrape');
    });

    it('should mark a phase as failed', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);

      updatePhaseStatus(TEST_RUN_ID, 'analyze', 'failed');

      const status = loadRunStatus(TEST_RUN_ID);
      expect(status!.phases.analyze).toBe('failed');
      expect(status!.lastCompletedPhase).toBeNull();
    });

    it('should track multiple phase completions', () => {
      initRunStatus(TEST_RUN_ID, mockConfig);

      updatePhaseStatus(TEST_RUN_ID, 'scrape', 'completed');
      updatePhaseStatus(TEST_RUN_ID, 'analyze', 'completed');
      updatePhaseStatus(TEST_RUN_ID, 'generate', 'failed');

      const status = loadRunStatus(TEST_RUN_ID);
      expect(status!.phases.scrape).toBe('completed');
      expect(status!.phases.analyze).toBe('completed');
      expect(status!.phases.generate).toBe('failed');
      expect(status!.phases.deliver).toBe('pending');
      expect(status!.lastCompletedPhase).toBe('analyze');
    });
  });

  describe('loadRunStatus', () => {
    it('should return null for non-existent run', () => {
      const status = loadRunStatus('nonexistent_run_id');
      expect(status).toBeNull();
    });

    it('should return null for corrupted status file', () => {
      const dir = path.join(TEST_DATA_DIR, TEST_RUN_ID);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'status.json'), '{invalid', 'utf-8');

      const status = loadRunStatus(TEST_RUN_ID);
      expect(status).toBeNull();
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

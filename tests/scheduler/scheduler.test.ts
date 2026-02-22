/**
 * Tests for startScheduler() config merging and generation mode propagation.
 *
 * Verifies the deep-merge fix: when the CLI passes a partial pipelineConfig
 * override, DEFAULT_SCHEDULER_CONFIG.pipelineConfig values (especially
 * generationMode) survive the merge.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PipelineConfig, PipelineResult } from '../../src/scheduler/types';

// --- Module-level mocks ---

// Mock node-cron to capture and manually trigger the scheduled callback
const mockCronSchedule = vi.fn();
const mockCronValidate = vi.fn().mockReturnValue(true);
vi.mock('node-cron', () => ({
  default: {
    schedule: mockCronSchedule,
    validate: mockCronValidate,
  },
}));

// Mock runPipeline to capture the config it receives
const mockRunPipeline = vi.fn<[Partial<PipelineConfig>?], Promise<PipelineResult>>();
vi.mock('../../src/scheduler/orchestrator', () => ({
  runPipeline: mockRunPipeline,
  DEFAULT_PIPELINE_CONFIG: {
    hoursBack: 48,
    maxBriefs: 10,
    dryRun: false,
    verbose: false,
  },
  generateRunId: vi.fn().mockReturnValue('run_test_123'),
}));

// Mock logger
vi.mock('../../src/scheduler/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(),
  createRunLogger: vi.fn(),
  createPhaseLogger: vi.fn(),
}));

// Mock env config — controls DEFAULT_SCHEDULER_CONFIG values
vi.mock('../../src/config/env', () => ({
  config: {
    SCHEDULER_CRON: '0 6 * * *',
    SCHEDULER_TIMEZONE: 'America/New_York',
    SCHEDULER_ENABLED: true,
    GENERATION_MODE: 'legacy',
    SCHEDULER_GENERATION_MODE: undefined,
  },
}));

// Mock watchdog (re-exported from index)
vi.mock('../../src/scheduler/watchdog', () => ({
  checkPipelineFreshness: vi.fn(),
}));

// Mock persistence (cleanupStaleRuns is called on scheduler startup)
vi.mock('../../src/scheduler/utils/persistence', () => ({
  cleanupStaleRuns: vi.fn().mockResolvedValue(0),
}));

// --- Helpers ---

function makePipelineResult(overrides: Partial<PipelineResult> = {}): PipelineResult {
  return {
    runId: 'run_test_123',
    startedAt: new Date(),
    completedAt: new Date(),
    config: { hoursBack: 48, maxBriefs: 10, dryRun: false, verbose: false } as PipelineConfig,
    phases: {
      scrape: { success: true, data: null, duration: 0, phase: 'scrape', timestamp: new Date() },
      analyze: { success: true, data: null, duration: 0, phase: 'analyze', timestamp: new Date() },
      generate: { success: true, data: null, duration: 0, phase: 'generate', timestamp: new Date() },
      deliver: { success: true, data: null, duration: 0, phase: 'deliver', timestamp: new Date() },
    },
    stats: { postsScraped: 0, clustersCreated: 0, ideasGenerated: 0, emailsSent: 0 },
    success: true,
    totalDuration: 100,
    errors: [],
    ...overrides,
  };
}

/**
 * Trigger the scheduled cron callback and return its result.
 * Assumes startScheduler() has been called and cron.schedule was invoked.
 */
async function triggerCronCallback(): Promise<void> {
  const [, callback] = mockCronSchedule.mock.calls[0];
  await callback();
}

// --- Tests ---

describe('startScheduler config merging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(makePipelineResult());
    mockCronSchedule.mockReturnValue({ stop: vi.fn() });
  });

  it('should preserve generationMode from DEFAULT_SCHEDULER_CONFIG when caller omits it', async () => {
    // Re-import to get fresh module with mocked env config
    // The env mock has GENERATION_MODE: 'legacy' and SCHEDULER_GENERATION_MODE: undefined
    // so DEFAULT_SCHEDULER_CONFIG.pipelineConfig.generationMode = 'legacy'
    const { startScheduler } = await import('../../src/scheduler/index');

    await startScheduler({
      pipelineConfig: {
        dryRun: true,
        hoursBack: 12,
        maxBriefs: 3,
        verbose: false,
      },
    });

    await triggerCronCallback();

    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    const receivedConfig = mockRunPipeline.mock.calls[0][0];
    expect(receivedConfig).toMatchObject({
      dryRun: true,
      hoursBack: 12,
      maxBriefs: 3,
      generationMode: 'legacy',
    });
  });

  it('should allow caller to explicitly override generationMode', async () => {
    const { startScheduler } = await import('../../src/scheduler/index');

    await startScheduler({
      pipelineConfig: {
        dryRun: true,
        generationMode: 'graph',
      },
    });

    await triggerCronCallback();

    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    const receivedConfig = mockRunPipeline.mock.calls[0][0];
    expect(receivedConfig).toMatchObject({
      dryRun: true,
      generationMode: 'graph',
    });
  });

  it('should preserve all caller pipelineConfig fields alongside defaults', async () => {
    const { startScheduler } = await import('../../src/scheduler/index');

    await startScheduler({
      pipelineConfig: {
        dryRun: true,
        hoursBack: 72,
        maxBriefs: 20,
        verbose: true,
      },
    });

    await triggerCronCallback();

    const receivedConfig = mockRunPipeline.mock.calls[0][0];
    expect(receivedConfig).toMatchObject({
      dryRun: true,
      hoursBack: 72,
      maxBriefs: 20,
      verbose: true,
    });
  });

  it('should use DEFAULT_SCHEDULER_CONFIG when no config is provided', async () => {
    const { startScheduler } = await import('../../src/scheduler/index');

    await startScheduler();

    await triggerCronCallback();

    const receivedConfig = mockRunPipeline.mock.calls[0][0];
    expect(receivedConfig).toHaveProperty('generationMode');
  });

  it('should not start when scheduler is disabled', async () => {
    const { startScheduler } = await import('../../src/scheduler/index');

    await startScheduler({ enabled: false });

    expect(mockCronSchedule).not.toHaveBeenCalled();
  });

  it('should throw on invalid cron expression', async () => {
    const { startScheduler } = await import('../../src/scheduler/index');
    mockCronValidate.mockReturnValueOnce(false);

    await expect(startScheduler({ cronExpression: 'bad cron' })).rejects.toThrow(
      'Invalid cron expression'
    );
  });
});

describe('startScheduler e2e: env → config → runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunPipeline.mockResolvedValue(makePipelineResult());
    mockCronSchedule.mockReturnValue({ stop: vi.fn() });
  });

  it('should propagate SCHEDULER_GENERATION_MODE=graph through to runPipeline', async () => {
    // Override the env mock for this test to simulate SCHEDULER_GENERATION_MODE=graph
    vi.doMock('../../src/config/env', () => ({
      config: {
        SCHEDULER_CRON: '0 6 * * *',
        SCHEDULER_TIMEZONE: 'America/New_York',
        SCHEDULER_ENABLED: true,
        GENERATION_MODE: 'legacy',
        SCHEDULER_GENERATION_MODE: 'graph',
      },
    }));

    // Re-import to pick up the new env mock
    vi.resetModules();

    // Re-apply the other mocks after resetModules
    vi.doMock('node-cron', () => ({
      default: {
        schedule: mockCronSchedule,
        validate: mockCronValidate,
      },
    }));
    vi.doMock('../../src/scheduler/orchestrator', () => ({
      runPipeline: mockRunPipeline,
      DEFAULT_PIPELINE_CONFIG: { hoursBack: 48, maxBriefs: 10, dryRun: false, verbose: false },
      generateRunId: vi.fn().mockReturnValue('run_test_123'),
    }));
    vi.doMock('../../src/scheduler/utils/logger', () => ({
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      createLogger: vi.fn(),
      createRunLogger: vi.fn(),
      createPhaseLogger: vi.fn(),
    }));
    vi.doMock('../../src/scheduler/watchdog', () => ({
      checkPipelineFreshness: vi.fn(),
    }));
    vi.doMock('../../src/scheduler/utils/persistence', () => ({
      cleanupStaleRuns: vi.fn().mockResolvedValue(0),
    }));

    const { startScheduler } = await import('../../src/scheduler/index');

    // Call startScheduler with partial config (no generationMode) — like the cron job does
    await startScheduler({
      pipelineConfig: {
        dryRun: true,
        hoursBack: 24,
        maxBriefs: 10,
        verbose: false,
      },
    });

    // Trigger the scheduled callback
    const [, callback] = mockCronSchedule.mock.calls[0];
    await callback();

    expect(mockRunPipeline).toHaveBeenCalledTimes(1);
    const receivedConfig = mockRunPipeline.mock.calls[0][0];
    expect(receivedConfig).toMatchObject({
      generationMode: 'graph',
      dryRun: true,
    });
  });
});

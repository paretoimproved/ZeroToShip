import { beforeEach, describe, expect, it, vi } from 'vitest';

const selectMock = vi.fn();

function createQueryChain<T>(rows: T[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

vi.mock('../../src/api/db/client', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
  pipelineRuns: {
    runId: 'run_id',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    success: 'success',
    status: 'status',
  },
}));

vi.mock('../../src/lib/alerts', () => ({
  sendPipelineMissedRunAlert: vi.fn(),
}));

describe('scheduler watchdog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns healthy when last successful run is within threshold', async () => {
    const now = new Date('2026-02-13T12:00:00.000Z');
    const latestSuccessAt = new Date('2026-02-13T08:00:00.000Z');

    selectMock
      .mockReturnValueOnce(
        createQueryChain([
          {
            runId: 'run_healthy',
            startedAt: latestSuccessAt,
            completedAt: latestSuccessAt,
          },
        ])
      )
      .mockReturnValueOnce(
        createQueryChain([
          {
            runId: 'run_healthy',
            status: 'completed',
            startedAt: latestSuccessAt,
            completedAt: latestSuccessAt,
          },
        ])
      );

    const { checkPipelineFreshness } = await import('../../src/scheduler/watchdog');
    const { sendPipelineMissedRunAlert } = await import('../../src/lib/alerts');

    const result = await checkPipelineFreshness({
      maxAgeHours: 30,
      alertOnFailure: true,
      now,
    });

    expect(result.healthy).toBe(true);
    expect(result.latestSuccessfulRunId).toBe('run_healthy');
    expect(sendPipelineMissedRunAlert).not.toHaveBeenCalled();
  });

  it('returns unhealthy and sends alert when last successful run is stale', async () => {
    const now = new Date('2026-02-13T12:00:00.000Z');
    const latestSuccessAt = new Date('2026-02-11T03:00:00.000Z'); // 57h old

    selectMock
      .mockReturnValueOnce(
        createQueryChain([
          {
            runId: 'run_old',
            startedAt: latestSuccessAt,
            completedAt: latestSuccessAt,
          },
        ])
      )
      .mockReturnValueOnce(
        createQueryChain([
          {
            runId: 'run_latest_failed',
            status: 'failed',
            startedAt: new Date('2026-02-13T06:00:00.000Z'),
            completedAt: new Date('2026-02-13T06:05:00.000Z'),
          },
        ])
      );

    const { checkPipelineFreshness } = await import('../../src/scheduler/watchdog');
    const { sendPipelineMissedRunAlert } = await import('../../src/lib/alerts');

    const result = await checkPipelineFreshness({
      maxAgeHours: 30,
      alertOnFailure: true,
      now,
    });

    expect(result.healthy).toBe(false);
    expect(result.latestSuccessfulRunId).toBe('run_old');
    expect(sendPipelineMissedRunAlert).toHaveBeenCalledOnce();
  });
});


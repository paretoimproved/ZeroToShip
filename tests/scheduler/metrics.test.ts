/**
 * Unit tests for metrics collector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MetricsCollector } from '../../src/scheduler/utils/metrics';

describe('MetricsCollector', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-31T06:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should track run start time', () => {
    const collector = new MetricsCollector('test_run_123');
    const metrics = collector.getMetrics();

    expect(metrics.runId).toBe('test_run_123');
    expect(metrics.startedAt).toEqual(new Date('2026-01-31T06:00:00.000Z'));
  });

  it('should track phase start and completion', () => {
    const collector = new MetricsCollector('test_run');

    collector.startPhase('scrape');

    vi.advanceTimersByTime(5000);

    collector.completePhase('scrape', true, 100);

    const metrics = collector.getMetrics();
    const scrapePhase = metrics.phases.get('scrape');

    expect(scrapePhase).toBeDefined();
    expect(scrapePhase?.success).toBe(true);
    expect(scrapePhase?.itemsProcessed).toBe(100);
    expect(scrapePhase?.duration).toBe(5000);
  });

  it('should track multiple phases', () => {
    const collector = new MetricsCollector('test_run');

    collector.startPhase('scrape');
    vi.advanceTimersByTime(2000);
    collector.completePhase('scrape', true, 50);

    collector.startPhase('analyze');
    vi.advanceTimersByTime(3000);
    collector.completePhase('analyze', true, 10);

    const summary = collector.getSummary();

    expect(summary.phases.scrape.duration).toBe(2000);
    expect(summary.phases.scrape.items).toBe(50);
    expect(summary.phases.analyze.duration).toBe(3000);
    expect(summary.phases.analyze.items).toBe(10);
  });

  it('should track errors', () => {
    const collector = new MetricsCollector('test_run');

    collector.startPhase('scrape');
    collector.addError('scrape', 'Reddit API failed');
    collector.addError('scrape', 'Twitter timeout');
    collector.completePhase('scrape', false, 0);

    const metrics = collector.getMetrics();
    const scrapePhase = metrics.phases.get('scrape');

    expect(scrapePhase?.errors).toHaveLength(2);
    expect(scrapePhase?.errors).toContain('Reddit API failed');
    expect(scrapePhase?.errors).toContain('Twitter timeout');
  });

  it('should calculate overall success correctly', () => {
    const collector = new MetricsCollector('test_run');

    collector.startPhase('scrape');
    collector.completePhase('scrape', true, 50);

    collector.startPhase('analyze');
    collector.completePhase('analyze', false, 0); // One failure

    const summary = collector.getSummary();

    expect(summary.overallSuccess).toBe(false);
  });

  it('should calculate total duration on complete', () => {
    const collector = new MetricsCollector('test_run');

    collector.startPhase('scrape');
    vi.advanceTimersByTime(5000);
    collector.completePhase('scrape', true, 50);

    vi.advanceTimersByTime(2000);

    collector.complete();

    const summary = collector.getSummary();

    expect(summary.totalDuration).toBe(7000);
  });
});

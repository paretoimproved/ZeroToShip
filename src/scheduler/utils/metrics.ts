/**
 * Pipeline Metrics Collection
 *
 * Tracks timing and statistics for pipeline runs.
 */

export interface PhaseMetrics {
  phase: string;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  success: boolean;
  itemsProcessed: number;
  errors: string[];
}

export interface PipelineMetrics {
  runId: string;
  startedAt: Date;
  completedAt?: Date;
  phases: Map<string, PhaseMetrics>;
}

export interface MetricsSummary {
  runId: string;
  totalDuration: number;
  phases: Record<string, { duration: number; success: boolean; items: number }>;
  overallSuccess: boolean;
}

/**
 * Metrics collector for pipeline runs
 */
export class MetricsCollector {
  private metrics: PipelineMetrics;

  constructor(runId: string) {
    this.metrics = {
      runId,
      startedAt: new Date(),
      phases: new Map(),
    };
  }

  /**
   * Mark a phase as started
   */
  startPhase(phase: string): void {
    this.metrics.phases.set(phase, {
      phase,
      startedAt: new Date(),
      success: false,
      itemsProcessed: 0,
      errors: [],
    });
  }

  /**
   * Mark a phase as completed
   */
  completePhase(
    phase: string,
    success: boolean,
    itemsProcessed: number
  ): void {
    const phaseMetrics = this.metrics.phases.get(phase);
    if (phaseMetrics) {
      phaseMetrics.completedAt = new Date();
      phaseMetrics.duration =
        phaseMetrics.completedAt.getTime() - phaseMetrics.startedAt.getTime();
      phaseMetrics.success = success;
      phaseMetrics.itemsProcessed = itemsProcessed;
    }
  }

  /**
   * Add an error to a phase
   */
  addError(phase: string, error: string): void {
    const phaseMetrics = this.metrics.phases.get(phase);
    if (phaseMetrics) {
      phaseMetrics.errors.push(error);
    }
  }

  /**
   * Mark the pipeline as complete
   */
  complete(): PipelineMetrics {
    this.metrics.completedAt = new Date();
    return this.metrics;
  }

  /**
   * Get a summary of the pipeline run
   */
  getSummary(): MetricsSummary {
    const completed = this.metrics.completedAt || new Date();
    const totalDuration =
      completed.getTime() - this.metrics.startedAt.getTime();

    const phases: Record<
      string,
      { duration: number; success: boolean; items: number }
    > = {};
    let overallSuccess = true;

    for (const [name, phaseMetrics] of this.metrics.phases) {
      phases[name] = {
        duration: phaseMetrics.duration || 0,
        success: phaseMetrics.success,
        items: phaseMetrics.itemsProcessed,
      };
      if (!phaseMetrics.success) overallSuccess = false;
    }

    return {
      runId: this.metrics.runId,
      totalDuration,
      phases,
      overallSuccess,
    };
  }

  /**
   * Get raw metrics
   */
  getMetrics(): PipelineMetrics {
    return this.metrics;
  }
}

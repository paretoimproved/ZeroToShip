# Code Review: Scheduler Module

**Date**: 2026-02-01
**Reviewer**: Code Review Agent
**Files Reviewed**: 13 files (~1,200 LOC)

---

## Summary

The Scheduler module orchestrates the ZeroToShip pipeline (scrape → analyze → generate → deliver) with cron-based scheduling. It includes structured logging (Pino), retry logic with exponential backoff, and comprehensive metrics collection.

**Quality Score**: 9/10

---

## TypeScript Quality

- [x] No `any` types
- [x] Comprehensive interface definitions for all pipeline phases
- [x] Proper generics usage (PhaseResult<T>, retryable<TArgs, TResult>)
- [x] Discriminated unions for phase names

### Type Highlights
```typescript
// Excellent phase result typing
export interface PhaseResult<T = unknown> {
  success: boolean;
  data: T | null;
  error?: string;
  duration: number;
  phase: PhaseName;
  timestamp: Date;
}

// Clean pipeline config
export interface PipelineConfig {
  hoursBack: number;
  scrapers: { reddit: boolean; hn: boolean; twitter: boolean; github: boolean };
  clusteringThreshold: number;
  // ...
}
```

---

## Code Style

- [x] Consistent naming conventions
- [x] Excellent JSDoc comments on all exports
- [x] Proper structured logging (Pino)
- [x] Clean barrel exports in `index.ts`

### Logging Best Practice
The scheduler is the **only module** using proper structured logging:
```typescript
logger.info(
  { runId, config },
  'Pipeline started'
);
```

This should be the standard for all modules.

---

## Architecture

- [x] Clean pipeline orchestration pattern
- [x] Proper phase sequencing with early exit on failure
- [x] Correct imports from other modules
- [x] Well-structured utility functions

### Pipeline Flow
```
1. Scrape Phase  → Collect posts from all sources
         ↓
2. Analyze Phase → Cluster, score, gap analysis
         ↓
3. Generate Phase → Create briefs from scored problems
         ↓
4. Deliver Phase → Send emails to subscribers
```

### Failure Handling
- Each phase can abort the pipeline
- Errors are tracked with recoverable/non-recoverable flags
- Partial results are preserved for debugging

---

## Error Handling

- [x] All async functions have try/catch
- [x] Errors properly typed (PipelineError with context)
- [x] Graceful degradation (continues if some scrapers fail)
- [x] Retry logic with exponential backoff

### Retry Implementation
```typescript
// Exponential backoff with jitter
const delay = Math.min(
  opts.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
  opts.maxDelayMs
);
```

---

## Security

- [x] No secrets in code
- [x] Environment variables for configuration
- [x] Cron expression validation
- [x] Safe async operation handling

### Scheduler Configuration
```typescript
const DEFAULT_SCHEDULER_CONFIG = {
  cronExpression: process.env.SCHEDULER_CRON || '0 6 * * *',
  timezone: process.env.SCHEDULER_TIMEZONE || 'America/New_York',
  enabled: process.env.SCHEDULER_ENABLED !== 'false',
};
```

---

## Performance

- [x] Parallel scraper execution
- [x] Post deduplication
- [x] Metrics collection for monitoring
- [x] Configurable concurrency

### Parallel Execution
```typescript
// Run all enabled scrapers in parallel
const results = await Promise.all(scraperPromises);
```

### Metrics Collection
- Phase start/complete times
- Success rates per phase
- Item counts (posts, clusters, briefs, emails)
- Total pipeline duration

---

## Issues Found

### Issue 1: Pino Import Style
**Severity**: Low
**Location**: `utils/logger.ts:7-8`
```typescript
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pino = require('pino');
```
**Details**: Uses require() instead of import due to ESM/CJS compatibility. Consider using `import pino from 'pino'` with proper tsconfig settings.

### Issue 2: Logger Interface Type
**Severity**: Low
**Location**: `utils/logger.ts:16-22`
```typescript
export interface Logger {
  info: (objOrMsg: object | string, msg?: string) => void;
  // ...
}
```
**Details**: Custom Logger interface instead of using Pino's built-in types. Could use `pino.Logger` for full type support.

### Issue 3: No Pipeline Result Persistence
**Severity**: Medium
**Location**: `orchestrator.ts`
**Details**: Pipeline results are returned but not persisted. Consider storing results in database for historical analysis and debugging.

### Issue 4: Fixed GitHub Lookback
**Severity**: Low
**Location**: `phases/scrape.ts:105`
```typescript
scrapeGitHub(undefined, Math.max(config.hoursBack, 168))
```
**Details**: GitHub always looks back at least 168 hours (1 week). This is intentional but could be made configurable.

---

## Recommendations

1. **Persist pipeline results** - Store run results in database for:
   - Historical analysis
   - Debugging failed runs
   - Metrics dashboards

2. **Add pipeline monitoring** - Consider integrating with:
   - Application monitoring (DataDog, New Relic)
   - Alerting on pipeline failures
   - Metrics dashboards

3. **Add manual trigger API** - Expose endpoint to trigger pipeline manually:
   ```typescript
   POST /api/v1/admin/pipeline/run
   ```

4. **Consider distributed locking** - For multi-instance deployments, use distributed lock to prevent concurrent pipeline runs

5. **Propagate Pino logging** - Use the scheduler's Pino logger as the standard across all modules

---

## Files Reviewed

| File | LOC | Status |
|------|-----|--------|
| `index.ts` | 112 | Clean scheduler entry point |
| `orchestrator.ts` | 230 | Excellent pipeline orchestration |
| `types.ts` | 144 | Comprehensive type definitions |
| `cli.ts` | ~80 | CLI interface |
| `phases/scrape.ts` | 165 | Parallel scraper execution |
| `phases/analyze.ts` | ~120 | Analysis phase runner |
| `phases/generate.ts` | ~100 | Brief generation phase |
| `phases/deliver.ts` | ~80 | Email delivery phase |
| `utils/logger.ts` | 68 | Pino structured logging |
| `utils/retry.ts` | 85 | Exponential backoff retry |
| `utils/metrics.ts` | ~100 | Metrics collection |

---

## Orchestrator Quality Assessment

### Strengths
1. **Clean phase sequencing** - Each phase passes data to the next
2. **Comprehensive error tracking** - Errors include phase, message, timestamp, recoverability
3. **Good default configuration** - Sensible defaults with override capability
4. **Unique run IDs** - Date + random suffix for tracking

### Example Run ID
```
run_20260201_a3x7k9
```

---

## Retry Logic Quality

| Feature | Implementation |
|---------|---------------|
| Max Attempts | Configurable (default: 3) |
| Base Delay | Configurable (default: 1000ms) |
| Max Delay | Configurable (default: 30000ms) |
| Backoff | Exponential (2^n) |
| Jitter | Random 0-1000ms |
| Callbacks | onRetry hook available |

---

## Conclusion

The Scheduler module is **excellent quality** and demonstrates the best logging practices in the codebase. The pipeline orchestration is clean, with proper phase sequencing, error handling, and metrics collection. The retry logic is well-implemented with exponential backoff and jitter.

**Key Strengths**:
- Structured logging with Pino (should be adopted project-wide)
- Clean pipeline orchestration pattern
- Comprehensive type definitions
- Robust retry logic with exponential backoff

**Recommendation**: Approved for production use. The Pino logging pattern should be propagated to other modules.

---

*Review completed by Code Review Agent*

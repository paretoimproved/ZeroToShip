import { test, expect, type BrowserContext, type Video } from '@playwright/test';
import { annotate, journeyPause } from '../../utils/journey-helpers';
import {
  mockIdeasApi,
  mockIdeaDetailApi,
  mockSavedIdeasApi,
  mockSubscriptionApi,
  mockBillingPricesApi,
  setupAdminApiMocks,
  mockAdminRunsApi,
  mockAdminRunDetailApi,
} from '../../utils/api-mock.utils';

function isoAt(baseMs: number, offsetMs: number): string {
  return new Date(baseMs + offsetMs).toISOString();
}

function buildDemoRun(runId: string) {
  const now = Date.now();
  const startedAt = isoAt(now, -20 * 60_000);
  const completedAt = isoAt(now, -18 * 60_000);

  const briefSummaries = [
    {
      name: 'OpenClaw Validator',
      tagline: 'Turn a brief into a 48-hour validation kit with guardrails',
      priorityScore: 92,
      effortEstimate: 'week',
      generationMeta: {
        isFallback: false,
        providerMode: 'graph',
        graphAttemptCount: 2,
        graphModelsUsed: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'],
        graphFailedSections: [],
        graphRetriedSections: ['market'],
        graphTrace: [
          {
            attempt: 1,
            model: 'claude-haiku-4-5-20251001',
            retrySections: [],
            mergedSections: [],
            passedQuality: false,
            reasons: ['length_too_short'],
            failedSections: ['market'],
            startedAt: isoAt(now, -19 * 60_000),
            finishedAt: isoAt(now, -19 * 60_000 + 2500),
          },
          {
            attempt: 2,
            model: 'claude-sonnet-4-5-20250929',
            retrySections: ['market'],
            mergedSections: ['market'],
            passedQuality: true,
            reasons: [],
            failedSections: [],
            startedAt: isoAt(now, -19 * 60_000 + 3500),
            finishedAt: isoAt(now, -19 * 60_000 + 6500),
          },
        ],
        handoffMeta: {
          provider: 'openclaw',
          status: 'ok',
          durationMs: 412,
          addedCompetitors: 2,
          addedGaps: 1,
          addedDifferentiators: 1,
        },
      },
    },
    {
      name: 'Evidence Brief Builder',
      tagline: 'Enrich gaps via agent handoff; generate with section-aware retries',
      priorityScore: 85,
      effortEstimate: 'month',
      generationMeta: {
        isFallback: false,
        providerMode: 'graph',
        graphAttemptCount: 1,
        graphModelsUsed: ['claude-haiku-4-5-20251001'],
        graphFailedSections: [],
        graphRetriedSections: [],
        graphTrace: [
          {
            attempt: 1,
            model: 'claude-haiku-4-5-20251001',
            retrySections: [],
            mergedSections: [],
            passedQuality: true,
            reasons: [],
            failedSections: [],
            startedAt: isoAt(now, -19 * 60_000 + 8000),
            finishedAt: isoAt(now, -19 * 60_000 + 10_500),
          },
        ],
        handoffMeta: {
          provider: 'openclaw',
          status: 'skipped',
          reason: 'handoff_not_needed',
        },
      },
    },
    {
      name: 'Legacy Safety Net',
      tagline: 'Graph is optional; legacy provider is always available',
      priorityScore: 72,
      effortEstimate: 'weekend',
      generationMeta: {
        isFallback: true,
        fallbackReason: 'single_call_failed',
        providerMode: 'legacy',
        handoffMeta: {
          provider: 'openclaw',
          status: 'skipped',
          reason: 'provider_mode_legacy',
        },
      },
    },
  ];

  return {
    id: 1,
    runId,
    status: 'completed',
    startedAt,
    completedAt,
    config: {
      generationMode: 'graph',
      graphMaxAttempts: 2,
      graphMaxSectionRetries: 1,
      handoffProvider: 'openclaw',
      handoffMaxFailures: 2,
    },
    phases: {
      scrape: 'completed',
      analyze: 'completed',
      generate: 'completed',
      deliver: 'completed',
    },
    stats: {
      postsScraped: 214,
      clustersCreated: 31,
      ideasGenerated: 10,
      emailsSent: 7,
    },
    success: true,
    totalDuration: 2 * 60_000,
    errors: [],
    apiMetrics: {
      totalCalls: 18,
      totalInputTokens: 15422,
      totalOutputTokens: 22111,
      estimatedCost: 1.42,
      callsByModel: {
        'claude-haiku-4-5-20251001': 12,
        'claude-sonnet-4-5-20250929': 6,
      },
    },
    generationMode: 'graph',
    generationDiagnostics: {
      taxonomyVersion: 'v1',
      generatedBriefCount: 10,
      qualityPassCount: 9,
      qualityFailCount: 1,
      qualityPassRate: 0.9,
      fallbackCount: 1,
      fallbackRate: 0.1,
      fallbackReasonCounts: {
        missing_gap_analysis: 0,
        missing_api_key: 0,
        single_call_failed: 1,
        batch_call_failed: 0,
        unknown: 0,
      },
      qualityFailureReasonCounts: {
        placeholder_content: 0,
        length_too_short: 1,
        list_minimum_not_met: 0,
        nested_content_incomplete: 0,
        unknown: 0,
      },
      costPerBriefUsd: 0.142,
    },
    briefSummaries,
  };
}

async function setAuthToken(context: BrowserContext, tier: string) {
  await context.addInitScript((t: string) => {
    localStorage.setItem('zerotoship_token', `fake-${t}-token`);
  }, tier);
}

test('Loom demo driver: ZeroToShip engine + graph trace + agent handoff seam', async ({ browser }) => {
  const timeoutMs = parseInt(process.env.DEMO_TEST_TIMEOUT_MS || '240000', 10);
  test.setTimeout(Number.isFinite(timeoutMs) ? timeoutMs : 240_000);

  const logTimeline = process.env.DEMO_LOG_TIMELINE === '1';
  const t0 = Date.now();
  const marks: Array<{ label: string; offsetMs: number }> = [];
  const mark = (label: string) => {
    if (!logTimeline) return;
    marks.push({ label, offsetMs: Date.now() - t0 });
  };

  const startHoldMs = parseInt(process.env.DEMO_START_HOLD_MS || '0', 10);
  const endHoldMs = parseInt(process.env.DEMO_END_HOLD_MS || '15000', 10);
  const holdDashboardMs = parseInt(process.env.DEMO_HOLD_DASHBOARD_MS || '6000', 10);
  // Brief timing: keep the idea-detail section long enough to match the voiceover.
  const holdBriefIntroMs = parseInt(process.env.DEMO_HOLD_BRIEF_INTRO_MS || '6000', 10);
  const holdBriefProblemMs = parseInt(process.env.DEMO_HOLD_BRIEF_PROBLEM_MS || '14000', 10);
  const holdBriefSolutionMs = parseInt(process.env.DEMO_HOLD_BRIEF_SOLUTION_MS || '14000', 10);
  const holdBriefTechMs = parseInt(process.env.DEMO_HOLD_BRIEF_TECH_MS || '14000', 10);
  // Tune this to make brief->admin timing land near ~60s in the narration.
  const holdBriefSourcesMs = parseInt(process.env.DEMO_HOLD_BRIEF_SOURCES_MS || '8000', 10);
  const holdBriefTabSwitchMs = parseInt(process.env.DEMO_HOLD_BRIEF_TAB_SWITCH_MS || '900', 10);
  const holdPipelineMs = parseInt(process.env.DEMO_HOLD_PIPELINE_MS || '5000', 10);
  const holdRunsMs = parseInt(process.env.DEMO_HOLD_RUNS_MS || '4500', 10);
  const holdRunDetailMs = parseInt(process.env.DEMO_HOLD_RUN_DETAIL_MS || '4500', 10);
  const holdTraceMs = parseInt(process.env.DEMO_HOLD_TRACE_MS || '9000', 10);
  const holdPitchMs = parseInt(process.env.DEMO_HOLD_PITCH_MS || '12000', 10);

  const recordVideoDir = process.env.DEMO_RECORD_VIDEO_DIR || '';
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: recordVideoDir
      ? {
        dir: recordVideoDir,
        size: { width: 1280, height: 720 },
      }
      : undefined,
  });
  await setAuthToken(context, 'enterprise');

  const page = await context.newPage();
  const video: Video | null = page.video();

  // Unified mocks: treat this context as an admin user who can also view the dashboard.
  await setupAdminApiMocks(page);
  await mockIdeasApi(page, 'enterprise');
  await mockIdeaDetailApi(page);
  await mockSavedIdeasApi(page);
  await mockSubscriptionApi(page, 'enterprise');
  await mockBillingPricesApi(page);

  const runId = process.env.DEMO_RUN_ID || 'run_20260214_openclaw_demo';
  const run = buildDemoRun(runId);
  await mockAdminRunsApi(page, [run]);
  await mockAdminRunDetailApi(page, runId, run);

  if (startHoldMs > 0) {
    await annotate(page, 'Starting Loom demo in a moment...', { durationMs: Math.min(2500, startHoldMs) });
    await page.waitForTimeout(startHoldMs);
  }

  await annotate(page, '1) Daily briefs (cron output)', { color: '#0ea5e9' });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: "Today's Top Ideas" })).toBeVisible();
  mark('dashboard_visible');
  await page.waitForTimeout(Math.max(0, holdDashboardMs));

  // Show an idea detail quickly (proves brief content + sources can exist; auth gate is satisfied).
  await annotate(page, '2) Open a brief (structured input)', { color: '#22c55e' });
  await page.goto('/idea/mock-1');
  await expect(page.getByRole('link', { name: /Back to Today/i })).toBeVisible();
  mark('brief_visible');
  await page.waitForTimeout(Math.max(0, holdBriefIntroMs));

  // Click through the brief tabs and hold each one for a dedicated window.
  const setTab = async (label: string) => {
    const tab = page.getByRole('tab', { name: label });
    await expect(tab).toBeVisible();
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await page.waitForTimeout(Math.max(0, holdBriefTabSwitchMs));
  };

  // Problem (default tab)
  await annotate(page, 'Problem: pain, audience, gaps', { color: '#22c55e', durationMs: 1200 });
  mark('brief_problem_start');
  await page.waitForTimeout(Math.max(0, holdBriefProblemMs));

  // Solution
  await setTab('Solution');
  await annotate(page, 'Solution: features + MVP scope (prompt substrate)', { color: '#22c55e', durationMs: 1400 });
  mark('brief_solution_start');
  await page.waitForTimeout(Math.max(0, holdBriefSolutionMs));

  // Tech spec
  await setTab('Tech Spec');
  await annotate(page, 'Tech Spec: stack + architecture', { color: '#22c55e', durationMs: 1200 });
  mark('brief_tech_start');
  await page.waitForTimeout(Math.max(0, holdBriefTechMs));

  // Sources
  await setTab('Sources');
  await annotate(page, 'Sources: evidence links you can verify', { color: '#22c55e', durationMs: 1200 });
  mark('brief_sources_start');
  await page.waitForTimeout(Math.max(0, holdBriefSourcesMs));

  await annotate(page, '3) Admin: cron + pipeline control', { color: '#06b6d4' });
  await page.goto('/admin/pipeline');
  await expect(page.getByRole('heading', { name: /Pipeline Control/i })).toBeVisible();
  mark('admin_pipeline_visible');
  await page.waitForTimeout(Math.max(0, holdPipelineMs));

  await annotate(page, '4) Workflow trace: LangGraph + OpenClaw handoffs', { color: '#f59e0b' });
  await page.goto('/admin/runs');
  await expect(page.getByRole('heading', { name: /Pipeline Run History/i })).toBeVisible();
  mark('admin_runs_visible');
  await page.waitForTimeout(Math.max(0, holdRunsMs));

  // Click into the run detail.
  const runLink = page.locator(`a[href="/admin/runs/${runId}"]`).first();
  await expect(runLink).toBeVisible();
  await Promise.all([
    page.waitForURL(new RegExp(`/admin/runs/${runId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`)),
    runLink.click(),
  ]);
  await expect(page.getByRole('heading', { name: new RegExp(runId) })).toBeVisible();
  mark('admin_run_detail_visible');
  await page.waitForTimeout(Math.max(0, holdRunDetailMs));

  // Scroll to Run Trace and expand the first brief trace details.
  await page.getByRole('heading', { name: /Run Trace/i }).scrollIntoViewIfNeeded();
  await journeyPause(page, 700);

  const firstSummary = page.locator('details').filter({ hasText: 'OpenClaw Validator' }).first();
  await expect(firstSummary).toBeVisible();
  await firstSummary.locator('summary').click();
  mark('admin_trace_expanded');
  await page.waitForTimeout(Math.max(0, holdTraceMs));

  await annotate(page, '5) Product: daily briefs -> daily execution', { color: '#a855f7' });
  await page.goto('/admin/demo/openclaw');
  await expect(page.getByRole('heading', { name: /OpenClaw: Daily Briefs to Daily Execution/i })).toBeVisible();
  mark('pitch_visible');
  await page.waitForTimeout(Math.max(0, holdPitchMs));

  await annotate(page, 'Closing: ship validated artifacts daily', { color: '#a855f7', durationMs: 1600 });
  await page.waitForTimeout(endHoldMs);

  await context.close();

  // If video recording is enabled, print the path so scripts can pick it up.
  if (video) {
    try {
      // path() is only valid after the context is closed.
      // eslint-disable-next-line no-console
      console.log(`DEMO_VIDEO_PATH=${await video.path()}`);
    } catch {
      // Ignore (video may be disabled or unavailable depending on runner settings).
    }
  }

  if (logTimeline) {
    // eslint-disable-next-line no-console
    console.log('DEMO_TIMELINE_MS=' + JSON.stringify(marks));
  }
});

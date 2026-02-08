/**
 * Journey test helpers for visual annotation and pacing.
 *
 * These utilities make persona journeys watchable in headed/slowMo mode
 * by adding visual annotations, pacing delays, and step narration.
 *
 * Controlled by environment variables:
 *   JOURNEY_HEADED=true  — enables visual features
 *   JOURNEY_PAUSE_MS=1500 — pause duration between steps (ms)
 */

import { Page } from '@playwright/test';

const STEP_PAUSE_MS = parseInt(process.env.JOURNEY_PAUSE_MS || '0', 10);
const IS_HEADED = process.env.JOURNEY_HEADED === 'true';

/**
 * Pause briefly between journey steps so a human viewer can follow along.
 * No-op in headless CI mode.
 */
export async function journeyPause(page: Page, ms?: number): Promise<void> {
  if (IS_HEADED) {
    await page.waitForTimeout(ms ?? STEP_PAUSE_MS);
  }
}

/**
 * Inject a visual annotation banner at the top of the page.
 * Shows the current step name so viewers can track progress.
 * No-op in headless CI mode.
 */
export async function annotate(
  page: Page,
  stepName: string,
  options: { durationMs?: number; color?: string } = {},
): Promise<void> {
  const { durationMs = 2500, color = '#6366f1' } = options;

  if (!IS_HEADED) return;

  await page.evaluate(
    ({ text, bg, duration }) => {
      const existing = document.getElementById('journey-annotation');
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.id = 'journey-annotation';
      banner.textContent = text;
      Object.assign(banner.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        zIndex: '99999',
        background: bg,
        color: 'white',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: 'bold',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        transition: 'opacity 0.3s',
      });
      document.body.prepend(banner);

      setTimeout(() => {
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
      }, duration);
    },
    { text: stepName, bg: color, duration: durationMs },
  );

  await journeyPause(page, Math.min(durationMs, 1500));
}

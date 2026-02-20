/**
 * Pipeline Failure Alerts for ZeroToShip
 *
 * Sends alert emails via Resend when pipeline phases fail.
 */

import { config } from '../config/env';

/** In-memory cooldown map: alert key → last sent timestamp */
const alertCooldownMap = new Map<string, number>();

/** Reset cooldown state (for tests) */
export function _resetAlertCooldownForTesting(): void {
  alertCooldownMap.clear();
}

/**
 * Escape HTML special characters to prevent injection
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send a pipeline failure alert email
 */
export async function sendPipelineFailureAlert(
  runId: string,
  phase: string,
  error: string,
  severity: string = 'error'
): Promise<void> {
  const apiKey = config.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;

  if (!apiKey) {
    console.warn('[Alerts] RESEND_API_KEY not set - skipping alert');
    return;
  }

  if (!alertEmail) {
    console.warn('[Alerts] ALERT_EMAIL not set - skipping alert');
    return;
  }

  // Dedup: skip if same alert was sent within cooldown window
  const cooldownMinutes = Number(process.env.ALERT_COOLDOWN_MINUTES) || 60;
  const alertKey = `${phase}:${error}`;
  const now = Date.now();
  const lastSent = alertCooldownMap.get(alertKey);
  if (lastSent && now - lastSent < cooldownMinutes * 60_000) {
    return;
  }
  alertCooldownMap.set(alertKey, now);

  const timestamp = new Date().toISOString();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ZeroToShip Alerts <alerts@zerotoship.dev>',
        to: [alertEmail],
        subject: `[ZeroToShip] Pipeline ${severity.toUpperCase()}: ${phase} phase failed`,
        html: `
          <h2>Pipeline Failure Alert</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Run ID</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(runId)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Phase</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(phase)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Severity</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(severity)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Error</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(error)}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Timestamp</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(timestamp)}</td></tr>
          </table>
        `,
        text: `Pipeline Failure Alert\n\nRun ID: ${runId}\nPhase: ${phase}\nSeverity: ${severity}\nError: ${error}\nTimestamp: ${timestamp}`,
      }),
    });

    if (!response.ok) {
      console.error('[Alerts] Failed to send alert email:', response.status);
    }
  } catch (err) {
    console.error('[Alerts] Error sending alert:', err instanceof Error ? err.message : err);
  }

  // Send SMS via Twilio for fatal alerts when configured
  const smsTo = process.env.ALERT_SMS_TO;
  const smsFrom = process.env.ALERT_SMS_FROM;
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;

  if (severity === 'fatal' && smsTo && smsFrom && twilioSid && twilioToken) {
    try {
      const smsBody = `[ZeroToShip] ${phase} phase FATAL: ${error} (run: ${runId})`;
      const smsResponse = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ To: smsTo, From: smsFrom, Body: smsBody }).toString(),
        },
      );
      if (!smsResponse.ok) {
        console.error('[Alerts] Failed to send SMS alert:', smsResponse.status);
      }
    } catch (err) {
      console.error('[Alerts] Error sending SMS:', err instanceof Error ? err.message : err);
    }
  }
}

/**
 * Send an alert when the pipeline has not completed a successful run recently.
 * Used by the scheduler watchdog.
 */
export async function sendPipelineMissedRunAlert(input: {
  maxAgeHours: number;
  ageHours: number;
  latestSuccessfulRunId?: string;
  latestSuccessfulCompletedAt?: string;
  latestRunId?: string;
  latestRunStatus?: string;
}): Promise<void> {
  const apiKey = config.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;

  if (!apiKey) {
    console.warn('[Alerts] RESEND_API_KEY not set - skipping missed-run alert');
    return;
  }

  if (!alertEmail) {
    console.warn('[Alerts] ALERT_EMAIL not set - skipping missed-run alert');
    return;
  }

  const timestamp = new Date().toISOString();
  const subject = `[ZeroToShip] Pipeline WARNING: missed run window (${input.ageHours.toFixed(2)}h > ${input.maxAgeHours}h)`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ZeroToShip Alerts <alerts@zerotoship.dev>',
        to: [alertEmail],
        subject,
        html: `
          <h2>Pipeline Missed Run Alert</h2>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Max Age (hours)</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(String(input.maxAgeHours))}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Age (hours)</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(input.ageHours.toFixed(2))}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Latest Successful Run</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(input.latestSuccessfulRunId || 'N/A')}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Latest Successful Completed</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(input.latestSuccessfulCompletedAt || 'N/A')}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Latest Run</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(input.latestRunId || 'N/A')}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Latest Run Status</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(input.latestRunStatus || 'N/A')}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Timestamp</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(timestamp)}</td></tr>
          </table>
        `,
        text: `Pipeline Missed Run Alert\n\nMax age (hours): ${input.maxAgeHours}\nAge (hours): ${input.ageHours.toFixed(2)}\nLatest successful run: ${input.latestSuccessfulRunId || 'N/A'}\nLatest successful completed: ${input.latestSuccessfulCompletedAt || 'N/A'}\nLatest run: ${input.latestRunId || 'N/A'}\nLatest run status: ${input.latestRunStatus || 'N/A'}\nTimestamp: ${timestamp}`,
      }),
    });

    if (!response.ok) {
      console.error('[Alerts] Failed to send missed-run alert email:', response.status);
    }
  } catch (err) {
    console.error(
      '[Alerts] Error sending missed-run alert:',
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Pipeline Failure Alerts for ZeroToShip
 *
 * Sends alert emails via Resend when pipeline phases fail.
 */

import { config } from '../config/env';

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
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Run ID</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${runId}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Phase</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${phase}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Severity</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${severity}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Error</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${error}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Timestamp</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${timestamp}</td></tr>
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
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetConfigForTesting } from '../../src/config/env';
import { _resetAlertCooldownForTesting, sendPipelineFailureAlert } from '../../src/lib/alerts';

describe('alerts', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: 're_test_key',
      ALERT_EMAIL: 'ops@example.com',
      ALERT_COOLDOWN_MINUTES: '60',
      ALERT_SLACK_WEBHOOK: '',
      ALERT_SMS_TO: '',
      ALERT_SMS_FROM: '',
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
    };
    _resetConfigForTesting();
    _resetAlertCooldownForTesting();

    global.fetch = vi.fn(async () => {
      return {
        ok: true,
        status: 200,
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetConfigForTesting();
    _resetAlertCooldownForTesting();
    global.fetch = originalFetch;
  });

  it('deduplicates identical alerts within cooldown window', async () => {
    await sendPipelineFailureAlert('run_1', 'scrape', 'API timeout', 'fatal');
    await sendPipelineFailureAlert('run_1', 'scrape', 'API timeout', 'fatal');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sends SMS via Twilio for fatal alerts when configured', async () => {
    process.env.ALERT_SMS_TO = '+15417436383';
    process.env.ALERT_SMS_FROM = '+15551234567';
    process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
    process.env.TWILIO_AUTH_TOKEN = 'twilio_token';
    _resetConfigForTesting();
    _resetAlertCooldownForTesting();

    await sendPipelineFailureAlert('run_2', 'generate', 'LLM provider down', 'fatal');

    const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const urls = calls.map((call) => String(call[0]));

    expect(urls.some((url) => url.includes('api.resend.com/emails'))).toBe(true);
    expect(
      urls.some((url) => url.includes('api.twilio.com/2010-04-01/Accounts/AC123456789/Messages.json'))
    ).toBe(true);
  });
});


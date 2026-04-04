import logger from '../../lib/logger';
import { extractJson } from '../../lib/json-parser';
import type { GapEnrichmentRequest, GapEnrichmentResponse } from './contract';
import { isGapEnrichmentResponse } from './contract';

export interface N8nHandoffConfig {
  url: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface N8nHandoffResult {
  ok: boolean;
  durationMs: number;
  response?: GapEnrichmentResponse;
  error?: string;
}

export async function requestGapEnrichmentFromN8n(
  cfg: N8nHandoffConfig,
  req: GapEnrichmentRequest,
): Promise<N8nHandoffResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, cfg.timeoutMs));

  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (cfg.apiKey) headers.authorization = `Bearer ${cfg.apiKey}`;

    const res = await fetch(cfg.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    const durationMs = Date.now() - started;
    const text = await res.text();
    const parsed = extractJson<GapEnrichmentResponse>(text);

    if (!res.ok) {
      const msg = `n8n handoff HTTP ${res.status}`;
      logger.warn({ status: res.status, durationMs, body: text.slice(0, 400) }, msg);
      return { ok: false, durationMs, error: msg };
    }

    if (!isGapEnrichmentResponse(parsed)) {
      return { ok: false, durationMs, error: 'n8n handoff returned invalid JSON shape' };
    }

    return { ok: true, durationMs, response: parsed };
  } catch (err) {
    const durationMs = Date.now() - started;
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, durationMs, error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

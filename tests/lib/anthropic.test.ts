/**
 * Tests for the shared Anthropic API wrapper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callAnthropicApi, AnthropicApiError, resetApiSemaphore } from '../../src/lib/anthropic';
import { resetGlobalMetrics, getGlobalMetrics } from '../../src/scheduler/utils/api-metrics';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  resetGlobalMetrics();
  resetApiSemaphore();
});

/** Helper to create a successful Anthropic-shaped Response */
function makeSuccessResponse(text: string): Partial<Response> {
  return {
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text }],
    }),
  };
}

/** Helper to create a failed Response */
function makeErrorResponse(status: number, body = 'error'): Partial<Response> {
  return {
    ok: false,
    status,
    text: async () => body,
  };
}

/** Base options shared across tests */
const baseOpts = {
  apiKey: 'test-key',
  model: 'claude-3-5-haiku-latest',
  prompt: 'Hello',
  maxTokens: 100,
  module: 'scorer' as const,
  maxRetries: 0,
};

describe('callAnthropicApi', () => {
  describe('successful calls', () => {
    it('returns parsed text and token counts', async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse('The answer is 42'));

      const result = await callAnthropicApi(baseOpts);

      expect(result.text).toBe('The answer is 42');
      expect(result.inputTokens).toBeGreaterThan(0);
      expect(result.outputTokens).toBeGreaterThan(0);
    });

    it('sends correct headers and body', async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse('ok'));

      await callAnthropicApi({
        ...baseOpts,
        system: 'You are a helpful assistant.',
        temperature: 0.5,
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];

      expect(url).toBe('https://api.anthropic.com/v1/messages');
      expect(options.headers['x-api-key']).toBe('test-key');
      expect(options.headers['anthropic-version']).toBe('2023-06-01');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('claude-3-5-haiku-latest');
      expect(body.max_tokens).toBe(100);
      expect(body.system).toBe('You are a helpful assistant.');
      expect(body.temperature).toBe(0.5);
      expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('omits system when not provided', async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse('ok'));

      await callAnthropicApi(baseOpts);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.system).toBeUndefined();
    });

    it('omits temperature when not provided', async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse('ok'));

      await callAnthropicApi(baseOpts);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.temperature).toBeUndefined();
    });

    it('records success metrics', async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse('result text'));

      await callAnthropicApi({ ...baseOpts, module: 'scorer' });

      const calls = getGlobalMetrics().getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].success).toBe(true);
      expect(calls[0].module).toBe('scorer');
      expect(calls[0].model).toBe('claude-3-5-haiku-latest');
      expect(calls[0].inputTokens).toBeGreaterThan(0);
      expect(calls[0].outputTokens).toBeGreaterThan(0);
      expect(calls[0].itemsProcessed).toBe(1);
      expect(calls[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('records batchSize in metrics', async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse('result'));

      await callAnthropicApi({ ...baseOpts, batchSize: 20, module: 'deduplicator' });

      const calls = getGlobalMetrics().getCalls();
      expect(calls[0].batchSize).toBe(20);
      expect(calls[0].itemsProcessed).toBe(20);
    });
  });

  describe('non-200 responses', () => {
    it('throws AnthropicApiError on non-200 status', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(429, 'Rate limited'));

      await expect(callAnthropicApi(baseOpts)).rejects.toThrow(AnthropicApiError);
    });

    it('includes status code in the error', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(500, 'Internal error'));

      try {
        await callAnthropicApi(baseOpts);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AnthropicApiError);
        expect((error as AnthropicApiError).statusCode).toBe(500);
        expect((error as AnthropicApiError).responseBody).toBe('Internal error');
      }
    });

    it('records failure metrics on non-200', async () => {
      mockFetch.mockResolvedValueOnce(makeErrorResponse(503));

      await callAnthropicApi(baseOpts).catch(() => {});

      const calls = getGlobalMetrics().getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].success).toBe(false);
      expect(calls[0].itemsProcessed).toBe(0);
    });
  });

  describe('empty content', () => {
    it('throws when API returns empty content array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '' }],
        }),
      });

      await expect(callAnthropicApi(baseOpts)).rejects.toThrow(
        'Anthropic API returned empty content'
      );
    });

    it('throws when API returns no content items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [],
        }),
      });

      await expect(callAnthropicApi(baseOpts)).rejects.toThrow(
        'Anthropic API returned empty content'
      );
    });

    it('records failure metrics on empty content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [],
        }),
      });

      await callAnthropicApi(baseOpts).catch(() => {});

      const calls = getGlobalMetrics().getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].success).toBe(false);
    });
  });

  describe('network errors', () => {
    it('re-throws network errors', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(callAnthropicApi(baseOpts)).rejects.toThrow('fetch failed');
    });

    it('records failure metrics on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await callAnthropicApi(baseOpts).catch(() => {});

      const calls = getGlobalMetrics().getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].success).toBe(false);
    });
  });

  describe('timeout', () => {
    it('throws on timeout with abort signal', async () => {
      // Simulate a fetch that never resolves within timeout
      mockFetch.mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) => {
          return new Promise((resolve, reject) => {
            // Listen for the abort signal
            if (options.signal) {
              options.signal.addEventListener('abort', () => {
                const abortError = new DOMException('The operation was aborted', 'AbortError');
                reject(abortError);
              });
            }
          });
        }
      );

      await expect(
        callAnthropicApi({ ...baseOpts, timeoutMs: 50 })
      ).rejects.toThrow('timed out');
    });

    it('records failure metrics on timeout', async () => {
      mockFetch.mockImplementationOnce(
        (_url: string, options: { signal?: AbortSignal }) => {
          return new Promise((resolve, reject) => {
            if (options.signal) {
              options.signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted', 'AbortError'));
              });
            }
          });
        }
      );

      await callAnthropicApi({ ...baseOpts, timeoutMs: 50 }).catch(() => {});

      const calls = getGlobalMetrics().getCalls();
      expect(calls).toHaveLength(1);
      expect(calls[0].success).toBe(false);
    });

    it('passes AbortSignal to fetch', async () => {
      mockFetch.mockResolvedValueOnce(makeSuccessResponse('ok'));

      await callAnthropicApi({ ...baseOpts, timeoutMs: 5000 });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.signal).toBeDefined();
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('module recording', () => {
    it('records correct module for each call site', async () => {
      const modules = ['scorer', 'deduplicator', 'competitor', 'brief-generator'] as const;

      for (const mod of modules) {
        mockFetch.mockResolvedValueOnce(makeSuccessResponse('ok'));
        await callAnthropicApi({ ...baseOpts, module: mod });
      }

      const calls = getGlobalMetrics().getCalls();
      expect(calls).toHaveLength(4);
      expect(calls.map(c => c.module)).toEqual([
        'scorer',
        'deduplicator',
        'competitor',
        'brief-generator',
      ]);
    });
  });
});

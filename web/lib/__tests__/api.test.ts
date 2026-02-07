import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally before importing the module
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// We need to re-import for each test group since ApiClient is a singleton export.
// Import the module fresh to get a clean ApiClient instance.
import { api } from '../api';

function jsonResponse(data: unknown, status = 200, statusText = 'OK') {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(data),
  });
}

function failedJsonResponse(
  status: number,
  body: { code: string; message: string },
  statusText = 'Error'
) {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: () => Promise.resolve(body),
  });
}

function failedNonJsonResponse(status: number, statusText = 'Internal Server Error') {
  return Promise.resolve({
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error('Not JSON')),
  });
}

describe('ApiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    api.setToken(null);
  });

  describe('Base URL configuration', () => {
    it('should use default base URL when NEXT_PUBLIC_API_URL is not set', async () => {
      mockFetch.mockReturnValue(jsonResponse([]));

      await api.getTodayIdeas();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3001/api/v1'),
        expect.any(Object)
      );
    });

    it('should append endpoint to base URL', async () => {
      mockFetch.mockReturnValue(jsonResponse([]));

      await api.getTodayIdeas();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/v1/ideas/today',
        expect.any(Object)
      );
    });
  });

  describe('Token handling', () => {
    it('should not include Authorization header when no token is set', async () => {
      mockFetch.mockReturnValue(jsonResponse([]));

      await api.getTodayIdeas();

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });

    it('should include Bearer token in Authorization header when token is set', async () => {
      api.setToken('test-jwt-token');
      mockFetch.mockReturnValue(jsonResponse([]));

      await api.getTodayIdeas();

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['Authorization']).toBe('Bearer test-jwt-token');
    });

    it('should remove Authorization header after setting token to null', async () => {
      api.setToken('test-token');
      api.setToken(null);
      mockFetch.mockReturnValue(jsonResponse([]));

      await api.getTodayIdeas();

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('Request formatting', () => {
    it('should include Content-Type: application/json header', async () => {
      mockFetch.mockReturnValue(jsonResponse({}));

      await api.getCurrentUser();

      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should send POST with JSON body for createCheckoutSession', async () => {
      mockFetch.mockReturnValue(jsonResponse({ url: 'https://checkout.stripe.com/123', sessionId: 's_123' }));

      await api.createCheckoutSession('pro_monthly');

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
      expect(callArgs[1].body).toBe(JSON.stringify({ priceKey: 'pro_monthly' }));
    });

    it('should send PATCH with JSON body for updatePreferences', async () => {
      mockFetch.mockReturnValue(jsonResponse({ id: '1', email: 'test@test.com' }));

      await api.updatePreferences({ emailFrequency: 'weekly' });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe('PATCH');
      expect(callArgs[1].body).toBe(JSON.stringify({ emailFrequency: 'weekly' }));
    });

    it('should send POST without body for createBillingPortalSession', async () => {
      mockFetch.mockReturnValue(jsonResponse({ url: 'https://billing.stripe.com/portal' }));

      await api.createBillingPortalSession();

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[1].method).toBe('POST');
    });
  });

  describe('Error mapping', () => {
    it('should throw with API error message on non-ok response', async () => {
      mockFetch.mockReturnValue(
        failedJsonResponse(400, { code: 'VALIDATION_ERROR', message: 'Invalid email format' })
      );

      await expect(api.getCurrentUser()).rejects.toThrow('Invalid email format');
    });

    it('should throw with statusText when response body is not JSON', async () => {
      mockFetch.mockReturnValue(failedNonJsonResponse(500, 'Internal Server Error'));

      await expect(api.getCurrentUser()).rejects.toThrow('Internal Server Error');
    });

    it('should throw with "Request failed" when error has no message', async () => {
      mockFetch.mockReturnValue(
        failedJsonResponse(400, { code: 'UNKNOWN', message: '' })
      );

      await expect(api.getCurrentUser()).rejects.toThrow('Request failed');
    });

    it('should throw Error instance', async () => {
      mockFetch.mockReturnValue(
        failedJsonResponse(401, { code: 'UNAUTHORIZED', message: 'Not authenticated' })
      );

      await expect(api.getCurrentUser()).rejects.toBeInstanceOf(Error);
    });
  });

  describe('Ideas endpoints', () => {
    it('getTodayIdeas should call /ideas/today', async () => {
      const mockIdeas = [{ id: '1', name: 'Test Idea' }];
      mockFetch.mockReturnValue(jsonResponse(mockIdeas));

      const result = await api.getTodayIdeas();

      expect(result).toEqual(mockIdeas);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ideas/today'),
        expect.any(Object)
      );
    });

    it('getIdea should call /ideas/:id', async () => {
      const mockIdea = { id: 'abc-123', name: 'Specific Idea' };
      mockFetch.mockReturnValue(jsonResponse(mockIdea));

      const result = await api.getIdea('abc-123');

      expect(result).toEqual(mockIdea);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ideas/abc-123'),
        expect.any(Object)
      );
    });

    it('searchIdeas should build query string from params', async () => {
      const mockResponse = { data: [], total: 0, page: 1, pageSize: 10, hasMore: false };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      await api.searchIdeas({
        query: 'saas',
        effort: ['weekend', 'week'],
        minScore: 70,
        page: 2,
        pageSize: 20,
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/ideas/search?');
      expect(url).toContain('q=saas');
      expect(url).toContain('effort=weekend%2Cweek');
      expect(url).toContain('minScore=70');
      expect(url).toContain('page=2');
      expect(url).toContain('pageSize=20');
    });

    it('searchIdeas should omit undefined params from query string', async () => {
      const mockResponse = { data: [], total: 0, page: 1, pageSize: 10, hasMore: false };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      await api.searchIdeas({ query: 'ai' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('q=ai');
      expect(url).not.toContain('effort');
      expect(url).not.toContain('minScore');
      expect(url).not.toContain('page=');
      expect(url).not.toContain('pageSize');
    });

    it('searchIdeas should omit empty effort array', async () => {
      const mockResponse = { data: [], total: 0, page: 1, pageSize: 10, hasMore: false };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      await api.searchIdeas({ effort: [] });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain('effort');
    });

    it('getArchive should build query string from params', async () => {
      const mockResponse = { data: [], total: 0, page: 1, pageSize: 10, hasMore: false };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      await api.getArchive({
        page: 3,
        pageSize: 50,
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/ideas/archive?');
      expect(url).toContain('page=3');
      expect(url).toContain('pageSize=50');
      expect(url).toContain('startDate=2026-01-01');
      expect(url).toContain('endDate=2026-01-31');
    });

    it('getArchive should omit undefined params', async () => {
      const mockResponse = { data: [], total: 0, page: 1, pageSize: 10, hasMore: false };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      await api.getArchive({});

      const url = mockFetch.mock.calls[0][0] as string;
      // With no params set, the query string should be empty
      expect(url).toMatch(/\/ideas\/archive\?$/);
    });
  });

  describe('User endpoints', () => {
    it('getCurrentUser should call /users/me', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test' };
      mockFetch.mockReturnValue(jsonResponse(mockUser));

      const result = await api.getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me'),
        expect.any(Object)
      );
    });

    it('updatePreferences should call /users/me/preferences with PATCH', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      mockFetch.mockReturnValue(jsonResponse(mockUser));

      await api.updatePreferences({ categories: ['devtools'], minPriorityScore: 60 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/users/me/preferences'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ categories: ['devtools'], minPriorityScore: 60 }),
        })
      );
    });
  });

  describe('Subscription endpoint', () => {
    it('getSubscription should call /user/subscription', async () => {
      const mockSub = { id: 's1', plan: 'pro', status: 'active' };
      mockFetch.mockReturnValue(jsonResponse(mockSub));

      const result = await api.getSubscription();

      expect(result).toEqual(mockSub);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/user/subscription'),
        expect.any(Object)
      );
    });
  });

  describe('Billing endpoints', () => {
    it('createCheckoutSession should call /billing/checkout with POST', async () => {
      const mockResponse = { url: 'https://checkout.stripe.com/123', sessionId: 's_123' };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      const result = await api.createCheckoutSession('pro_yearly');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/checkout'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ priceKey: 'pro_yearly' }),
        })
      );
    });

    it('createBillingPortalSession should call /billing/portal with POST', async () => {
      const mockResponse = { url: 'https://billing.stripe.com/portal' };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      const result = await api.createBillingPortalSession();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/portal'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('getBillingPrices should call /billing/prices', async () => {
      const mockResponse = { prices: [{ key: 'pro_monthly', amount: 1900 }] };
      mockFetch.mockReturnValue(jsonResponse(mockResponse));

      const result = await api.getBillingPrices();

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/prices'),
        expect.any(Object)
      );
    });
  });
});

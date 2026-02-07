import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock window.location
const mockLocation = { href: '' };
vi.stubGlobal('window', { location: mockLocation });

import { api } from '../api';
import {
  formatPrice,
  createCheckoutSession,
  openBillingPortal,
  getBillingPrices,
  PRICE_DISPLAY,
} from '../billing';

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(data),
  });
}

describe('Billing utilities', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockLocation.href = '';
    api.setToken(null);
  });

  describe('formatPrice', () => {
    it('should format USD cents to dollar string', () => {
      expect(formatPrice(1900)).toBe('$19.00');
    });

    it('should format zero cents', () => {
      expect(formatPrice(0)).toBe('$0.00');
    });

    it('should format large amounts', () => {
      expect(formatPrice(99000)).toBe('$990.00');
    });

    it('should format fractional cents correctly', () => {
      expect(formatPrice(999)).toBe('$9.99');
    });

    it('should default to USD when no currency specified', () => {
      const result = formatPrice(1900);
      expect(result).toContain('$');
    });

    it('should handle different currencies', () => {
      const result = formatPrice(1900, 'eur');
      // Intl.NumberFormat with EUR should produce a Euro sign
      expect(result).toContain('€');
    });

    it('should handle uppercase currency codes', () => {
      const result = formatPrice(1900, 'USD');
      expect(result).toBe('$19.00');
    });
  });

  describe('createCheckoutSession', () => {
    it('should call api.createCheckoutSession and redirect to returned URL', async () => {
      mockFetch.mockReturnValue(
        jsonResponse({ url: 'https://checkout.stripe.com/session_123', sessionId: 'cs_123' })
      );

      await createCheckoutSession('pro_monthly');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/checkout'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ priceKey: 'pro_monthly' }),
        })
      );
      expect(mockLocation.href).toBe('https://checkout.stripe.com/session_123');
    });

    it('should pass the correct price key for yearly plans', async () => {
      mockFetch.mockReturnValue(
        jsonResponse({ url: 'https://checkout.stripe.com/yearly', sessionId: 'cs_456' })
      );

      await createCheckoutSession('enterprise_yearly');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.priceKey).toBe('enterprise_yearly');
    });
  });

  describe('openBillingPortal', () => {
    it('should call api.createBillingPortalSession and redirect', async () => {
      mockFetch.mockReturnValue(
        jsonResponse({ url: 'https://billing.stripe.com/portal/abc' })
      );

      await openBillingPortal();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/portal'),
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockLocation.href).toBe('https://billing.stripe.com/portal/abc');
    });
  });

  describe('getBillingPrices', () => {
    it('should return prices array from API response', async () => {
      const mockPrices = [
        { key: 'pro_monthly', priceId: 'price_123', amount: 1900, currency: 'usd', interval: 'month', tier: 'pro' },
        { key: 'pro_yearly', priceId: 'price_456', amount: 19000, currency: 'usd', interval: 'year', tier: 'pro' },
      ];
      mockFetch.mockReturnValue(jsonResponse({ prices: mockPrices }));

      const result = await getBillingPrices();

      expect(result).toEqual(mockPrices);
    });

    it('should call /billing/prices endpoint', async () => {
      mockFetch.mockReturnValue(jsonResponse({ prices: [] }));

      await getBillingPrices();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/billing/prices'),
        expect.any(Object)
      );
    });
  });

  describe('PRICE_DISPLAY', () => {
    it('should have all four price keys', () => {
      expect(PRICE_DISPLAY).toHaveProperty('pro_monthly');
      expect(PRICE_DISPLAY).toHaveProperty('pro_yearly');
      expect(PRICE_DISPLAY).toHaveProperty('enterprise_monthly');
      expect(PRICE_DISPLAY).toHaveProperty('enterprise_yearly');
    });

    it('should have correct pro monthly values', () => {
      expect(PRICE_DISPLAY.pro_monthly.amount).toBe(1900);
      expect(PRICE_DISPLAY.pro_monthly.interval).toBe('month');
      expect(PRICE_DISPLAY.pro_monthly.name).toBe('Pro');
    });

    it('should have correct pro yearly values', () => {
      expect(PRICE_DISPLAY.pro_yearly.amount).toBe(19000);
      expect(PRICE_DISPLAY.pro_yearly.interval).toBe('year');
    });

    it('should have correct enterprise monthly values', () => {
      expect(PRICE_DISPLAY.enterprise_monthly.amount).toBe(9900);
      expect(PRICE_DISPLAY.enterprise_monthly.interval).toBe('month');
      expect(PRICE_DISPLAY.enterprise_monthly.name).toBe('Enterprise');
    });

    it('should have correct enterprise yearly values', () => {
      expect(PRICE_DISPLAY.enterprise_yearly.amount).toBe(99000);
      expect(PRICE_DISPLAY.enterprise_yearly.interval).toBe('year');
    });

    it('yearly prices should equal ~10x monthly (2 months free)', () => {
      // Pro: 19*10 = 190 (12-2=10 months)
      expect(PRICE_DISPLAY.pro_yearly.amount).toBe(PRICE_DISPLAY.pro_monthly.amount * 10);
      // Enterprise: 99*10 = 990
      expect(PRICE_DISPLAY.enterprise_yearly.amount).toBe(PRICE_DISPLAY.enterprise_monthly.amount * 10);
    });
  });
});

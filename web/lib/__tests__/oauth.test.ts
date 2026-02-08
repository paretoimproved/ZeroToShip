import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase module (dynamic import target)
const mockSignInWithOAuth = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
    },
  },
}));

// Mock fetch globally (needed by setToken -> api.setToken)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock localStorage
const storage: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(k => delete storage[k]); }),
  length: 0,
  key: vi.fn(),
};
vi.stubGlobal('localStorage', mockLocalStorage);

// Mock window with location, history
const mockReplaceState = vi.fn();
const mockLocation = {
  origin: 'http://localhost:3000',
  hash: '',
  pathname: '/dashboard',
  search: '',
  href: '',
};
vi.stubGlobal('window', {
  location: mockLocation,
  localStorage: mockLocalStorage,
  history: { replaceState: mockReplaceState },
});

import { loginWithOAuth, handleOAuthCallback } from '../auth';

describe('OAuth utilities', () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockReset();
    mockFetch.mockReset();
    mockLocalStorage.setItem.mockClear();
    mockReplaceState.mockClear();
    Object.keys(storage).forEach(k => delete storage[k]);
    mockLocation.origin = 'http://localhost:3000';
    mockLocation.hash = '';
    mockLocation.pathname = '/dashboard';
    mockLocation.search = '';
    mockLocation.href = '';
  });

  describe('loginWithOAuth', () => {
    it('should call supabase signInWithOAuth with google provider', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null });

      await loginWithOAuth('google');

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: expect.stringContaining('/dashboard'),
        },
      });
    });

    it('should call supabase signInWithOAuth with github provider', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null });

      await loginWithOAuth('github');

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: expect.stringContaining('/dashboard'),
        },
      });
    });

    it('should throw when supabase returns an error', async () => {
      mockSignInWithOAuth.mockResolvedValue({
        error: { message: 'OAuth provider not configured' },
      });

      await expect(loginWithOAuth('google')).rejects.toThrow('OAuth provider not configured');
    });
  });

  describe('handleOAuthCallback', () => {
    it('should extract access_token from URL hash and return it', async () => {
      mockLocation.hash = '#access_token=test-oauth-token-123&token_type=bearer';

      const token = await handleOAuthCallback();

      expect(token).toBe('test-oauth-token-123');
    });

    it('should store the extracted token in localStorage', async () => {
      mockLocation.hash = '#access_token=stored-token-456&token_type=bearer';

      await handleOAuthCallback();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('zerotoship_token', 'stored-token-456');
    });

    it('should return null when no access_token is in the hash', async () => {
      mockLocation.hash = '';

      const token = await handleOAuthCallback();

      expect(token).toBeNull();
    });

    it('should return null when hash has other params but no access_token', async () => {
      mockLocation.hash = '#token_type=bearer&expires_in=3600';

      const token = await handleOAuthCallback();

      expect(token).toBeNull();
    });

    it('should clean the URL hash after extracting the token', async () => {
      mockLocation.hash = '#access_token=clean-me&token_type=bearer';
      mockLocation.pathname = '/dashboard';
      mockLocation.search = '?ref=oauth';

      await handleOAuthCallback();

      expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/dashboard?ref=oauth');
    });
  });
});

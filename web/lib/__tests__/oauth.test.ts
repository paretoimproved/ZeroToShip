import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase module (dynamic import target)
const mockSignInWithOAuth = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      exchangeCodeForSession: mockExchangeCodeForSession,
      getSession: mockGetSession,
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

// Mock sessionStorage (needed by api.ts tier override check)
vi.stubGlobal('sessionStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

// Mock window with location, history
const mockReplaceState = vi.fn();
const mockLocation = {
  origin: 'http://localhost:3000',
  hash: '',
  pathname: '/login',
  search: '',
  href: '',
};
vi.stubGlobal('window', {
  location: mockLocation,
  localStorage: mockLocalStorage,
  sessionStorage: { getItem: vi.fn(() => null) },
  history: { replaceState: mockReplaceState },
});

import { loginWithOAuth, handleOAuthCallback } from '../auth';

describe('OAuth utilities', () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockReset();
    mockExchangeCodeForSession.mockReset();
    mockGetSession.mockReset();
    mockFetch.mockReset();
    mockLocalStorage.setItem.mockClear();
    mockReplaceState.mockClear();
    Object.keys(storage).forEach(k => delete storage[k]);
    mockLocation.origin = 'http://localhost:3000';
    mockLocation.hash = '';
    mockLocation.pathname = '/login';
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
          redirectTo: 'http://localhost:3000/login',
        },
      });
    });

    it('should call supabase signInWithOAuth with github provider', async () => {
      mockSignInWithOAuth.mockResolvedValue({ error: null });

      await loginWithOAuth('github');

      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: 'http://localhost:3000/login',
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
    it('should return null when no OAuth params are in the URL', async () => {
      mockLocation.hash = '';
      mockLocation.search = '';

      const token = await handleOAuthCallback();

      expect(token).toBeNull();
    });

    it('should exchange PKCE code for session when code= is present', async () => {
      mockLocation.search = '?code=pkce-auth-code-123';
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'exchanged-token-456' } },
        error: null,
      });

      const token = await handleOAuthCallback();

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-auth-code-123');
      expect(token).toBe('exchanged-token-456');
    });

    it('should store the token from PKCE exchange in localStorage', async () => {
      mockLocation.search = '?code=pkce-code';
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'stored-pkce-token' } },
        error: null,
      });

      await handleOAuthCallback();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('zerotoship_token', 'stored-pkce-token');
    });

    it('should return null when PKCE code exchange fails', async () => {
      mockLocation.search = '?code=bad-code';
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid code' },
      });

      const token = await handleOAuthCallback();

      expect(token).toBeNull();
    });

    it('should use getSession for implicit flow (access_token in hash)', async () => {
      mockLocation.hash = '#access_token=implicit-token-789&token_type=bearer';
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'implicit-token-789' } },
        error: null,
      });

      const token = await handleOAuthCallback();

      expect(mockGetSession).toHaveBeenCalled();
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
      expect(token).toBe('implicit-token-789');
    });

    it('should return null when implicit flow getSession fails', async () => {
      mockLocation.hash = '#access_token=bad-token&token_type=bearer';
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const token = await handleOAuthCallback();

      expect(token).toBeNull();
    });

    it('should clean the URL after successful OAuth callback', async () => {
      mockLocation.search = '?code=clean-me-code';
      mockLocation.pathname = '/login';
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'clean-token' } },
        error: null,
      });

      await handleOAuthCallback();

      expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/login');
    });
  });
});

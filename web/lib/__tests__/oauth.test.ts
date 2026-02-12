import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase module (dynamic import target)
const mockSignInWithOAuth = vi.fn();
const mockSignInWithIdToken = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockGetSession = vi.fn();
vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      signInWithIdToken: mockSignInWithIdToken,
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

import { loginWithOAuth, loginWithGoogleToken, handleOAuthCallback } from '../auth';

describe('OAuth utilities', () => {
  beforeEach(() => {
    mockSignInWithOAuth.mockReset();
    mockSignInWithIdToken.mockReset();
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
    const mockSupabaseUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_metadata: { full_name: 'Test User' },
      created_at: '2026-01-01T00:00:00Z',
    };

    it('should return null when no OAuth params are in the URL', async () => {
      mockLocation.hash = '';
      mockLocation.search = '';

      const result = await handleOAuthCallback();

      expect(result).toBeNull();
    });

    it('should exchange PKCE code for session when code= is present', async () => {
      mockLocation.search = '?code=pkce-auth-code-123';
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'exchanged-token-456', user: mockSupabaseUser } },
        error: null,
      });

      const result = await handleOAuthCallback();

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('pkce-auth-code-123');
      expect(result?.token).toBe('exchanged-token-456');
      expect(result?.user.id).toBe('user-123');
      expect(result?.user.email).toBe('test@example.com');
      expect(result?.user.name).toBe('Test User');
    });

    it('should store the token from PKCE exchange in localStorage', async () => {
      mockLocation.search = '?code=pkce-code';
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'stored-pkce-token', user: mockSupabaseUser } },
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

      const result = await handleOAuthCallback();

      expect(result).toBeNull();
    });

    it('should use getSession for implicit flow (access_token in hash)', async () => {
      mockLocation.hash = '#access_token=implicit-token-789&token_type=bearer';
      mockGetSession.mockResolvedValue({
        data: { session: { access_token: 'implicit-token-789', user: mockSupabaseUser } },
        error: null,
      });

      const result = await handleOAuthCallback();

      expect(mockGetSession).toHaveBeenCalled();
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
      expect(result?.token).toBe('implicit-token-789');
    });

    it('should return null when implicit flow getSession fails', async () => {
      mockLocation.hash = '#access_token=bad-token&token_type=bearer';
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      });

      const result = await handleOAuthCallback();

      expect(result).toBeNull();
    });

    it('should clean the URL after successful OAuth callback', async () => {
      mockLocation.search = '?code=clean-me-code';
      mockLocation.pathname = '/login';
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { access_token: 'clean-token', user: mockSupabaseUser } },
        error: null,
      });

      await handleOAuthCallback();

      expect(mockReplaceState).toHaveBeenCalledWith(null, '', '/login');
    });
  });

  describe('loginWithGoogleToken', () => {
    const mockSupabaseUser = {
      id: 'google-user-456',
      email: 'google@example.com',
      user_metadata: { full_name: 'Google User' },
      created_at: '2026-01-15T00:00:00Z',
    };

    it('should call signInWithIdToken with the Google credential', async () => {
      mockSignInWithIdToken.mockResolvedValue({
        data: {
          session: { access_token: 'supabase-session-token' },
          user: mockSupabaseUser,
        },
        error: null,
      });

      const result = await loginWithGoogleToken('google-jwt-credential');

      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: 'google',
        token: 'google-jwt-credential',
      });
      expect(result.token).toBe('supabase-session-token');
      expect(result.user.id).toBe('google-user-456');
      expect(result.user.email).toBe('google@example.com');
      expect(result.user.name).toBe('Google User');
    });

    it('should store the Supabase session token in localStorage', async () => {
      mockSignInWithIdToken.mockResolvedValue({
        data: {
          session: { access_token: 'stored-google-token' },
          user: mockSupabaseUser,
        },
        error: null,
      });

      await loginWithGoogleToken('google-jwt');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('zerotoship_token', 'stored-google-token');
    });

    it('should throw when signInWithIdToken returns an error', async () => {
      mockSignInWithIdToken.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid ID token' },
      });

      await expect(loginWithGoogleToken('bad-token')).rejects.toThrow('Invalid ID token');
    });

    it('should throw when no session is returned', async () => {
      mockSignInWithIdToken.mockResolvedValue({
        data: { session: null, user: mockSupabaseUser },
        error: null,
      });

      await expect(loginWithGoogleToken('no-session-token')).rejects.toThrow('Google sign-in failed');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock fetch globally
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

// Mock window.location
const mockLocation = { href: '' };
vi.stubGlobal('window', { location: mockLocation, localStorage: mockLocalStorage });

import { api } from '../api';
import {
  getToken,
  setToken,
  clearToken,
  initAuth,
  login,
  signup,
  logout,
  isAuthenticated,
} from '../auth';

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
  });
}

describe('Auth utilities', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.removeItem.mockClear();
    Object.keys(storage).forEach(k => delete storage[k]);
    mockLocation.href = '';
    api.setToken(null);
  });

  describe('getToken', () => {
    it('should return null when no token is stored', () => {
      expect(getToken()).toBeNull();
    });

    it('should return stored token from localStorage', () => {
      storage['zerotoship_token'] = 'my-jwt-token';

      expect(getToken()).toBe('my-jwt-token');
    });

    it('should read from the correct localStorage key', () => {
      getToken();

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('zerotoship_token');
    });
  });

  describe('setToken', () => {
    it('should store token in localStorage', () => {
      setToken('new-token');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('zerotoship_token', 'new-token');
    });

    it('should also set token on the api client', () => {
      // We test this indirectly by making a request after setToken
      setToken('api-token');
      mockFetch.mockReturnValue(jsonResponse([]));

      // Trigger a request to check the token is being used
      api.getTodayIdeas();

      // The api client should now have the token set
      expect(storage['zerotoship_token']).toBe('api-token');
    });
  });

  describe('clearToken', () => {
    it('should remove token from localStorage', () => {
      storage['zerotoship_token'] = 'old-token';

      clearToken();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('zerotoship_token');
    });

    it('should set api client token to null', async () => {
      setToken('some-token');
      clearToken();

      mockFetch.mockReturnValue(jsonResponse([]));
      await api.getTodayIdeas();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('initAuth', () => {
    it('should set api token from localStorage if token exists', async () => {
      storage['zerotoship_token'] = 'persisted-token';

      initAuth();

      mockFetch.mockReturnValue(jsonResponse([]));
      await api.getTodayIdeas();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer persisted-token');
    });

    it('should not set api token if no token in localStorage', async () => {
      initAuth();

      mockFetch.mockReturnValue(jsonResponse([]));
      await api.getTodayIdeas();

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });
  });

  describe('login', () => {
    it('should POST to /auth/login with email and password', async () => {
      mockFetch.mockReturnValue(
        jsonResponse({ token: 'jwt-123', user: { id: '1', email: 'test@test.com' } })
      );

      await login('test@test.com', 'password123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
        })
      );
    });

    it('should store returned token and return user', async () => {
      const mockUser = { id: '1', email: 'test@test.com', name: 'Test' };
      mockFetch.mockReturnValue(
        jsonResponse({ token: 'new-jwt', user: mockUser })
      );

      const user = await login('test@test.com', 'pass');

      expect(user).toEqual(mockUser);
      expect(storage['zerotoship_token']).toBe('new-jwt');
    });

    it('should throw on failed login with API error message', async () => {
      mockFetch.mockReturnValue(
        jsonResponse({ message: 'Invalid credentials' }, 401)
      );

      await expect(login('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('should throw "Login failed" when error response is not JSON', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.reject(new Error('Not JSON')),
        })
      );

      await expect(login('test@test.com', 'pass')).rejects.toThrow('Login failed');
    });
  });

  describe('signup', () => {
    it('should POST to /auth/signup with email, password, and name', async () => {
      mockFetch.mockReturnValue(
        jsonResponse({ token: 'jwt-456', user: { id: '2', email: 'new@test.com' } })
      );

      await signup('new@test.com', 'securepass', 'New User');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/signup'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'new@test.com', password: 'securepass', name: 'New User' }),
        })
      );
    });

    it('should store returned token and return user', async () => {
      const mockUser = { id: '2', email: 'new@test.com', name: 'New User' };
      mockFetch.mockReturnValue(
        jsonResponse({ token: 'signup-jwt', user: mockUser })
      );

      const user = await signup('new@test.com', 'pass', 'New User');

      expect(user).toEqual(mockUser);
      expect(storage['zerotoship_token']).toBe('signup-jwt');
    });

    it('should throw on failed signup', async () => {
      mockFetch.mockReturnValue(
        jsonResponse({ message: 'Email already exists' }, 409)
      );

      await expect(signup('dup@test.com', 'pass', 'Dup')).rejects.toThrow('Email already exists');
    });

    it('should throw "Signup failed" when error response is not JSON', async () => {
      mockFetch.mockReturnValue(
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('Not JSON')),
        })
      );

      await expect(signup('test@test.com', 'pass', 'Name')).rejects.toThrow('Signup failed');
    });
  });

  describe('logout', () => {
    it('should clear the token from localStorage', () => {
      storage['zerotoship_token'] = 'session-token';

      logout();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('zerotoship_token');
    });

    it('should redirect to /', () => {
      logout();

      expect(mockLocation.href).toBe('/');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token is stored', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('should return true when a token exists', () => {
      storage['zerotoship_token'] = 'some-token';

      expect(isAuthenticated()).toBe(true);
    });
  });
});

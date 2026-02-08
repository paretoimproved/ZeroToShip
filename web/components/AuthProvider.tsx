"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as authLogin, signup as authSignup, logout as authLogout, initAuth, getToken } from "@/lib/auth";
import type { User } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (email: string, password: string, name: string) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreAuth() {
      try {
        initAuth();
        const token = getToken();
        if (token) {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
          const response = await fetch(`${apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          }
        }
      } catch {
        // Token invalid or expired, stay logged out
      } finally {
        setIsLoading(false);
      }
    }
    restoreAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const userData = await authLogin(email, password);
    setUser(userData);
    return userData;
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    const userData = await authSignup(email, password, name);
    setUser(userData);
    return userData;
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

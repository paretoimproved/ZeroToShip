"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";

type TierOverride = "anonymous" | "free" | "pro" | "enterprise" | null;

interface AdminContextType {
  isAdmin: boolean;
  tierOverride: TierOverride;
  setTierOverride: (tier: TierOverride) => void;
  effectiveTier: string;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

const STORAGE_KEY = "zerotoship_tier_override";

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = !!user?.isAdmin;

  const [tierOverride, setTierOverrideState] = useState<TierOverride>(null);

  // Restore tier override from sessionStorage on mount
  useEffect(() => {
    if (isAdmin && typeof window !== "undefined") {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        setTierOverrideState(stored as TierOverride);
      }
    }
  }, [isAdmin]);

  const setTierOverride = useCallback(
    (tier: TierOverride) => {
      setTierOverrideState(tier);
      if (typeof window !== "undefined") {
        if (tier) {
          sessionStorage.setItem(STORAGE_KEY, tier);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    },
    []
  );

  // Clear override if user is not admin
  useEffect(() => {
    if (!isAdmin && tierOverride) {
      setTierOverride(null);
    }
  }, [isAdmin, tierOverride, setTierOverride]);

  const effectiveTier = tierOverride || user?.tier || "anonymous";

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        tierOverride,
        setTierOverride,
        effectiveTier,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error("useAdmin must be used within an AdminProvider");
  }
  return context;
}

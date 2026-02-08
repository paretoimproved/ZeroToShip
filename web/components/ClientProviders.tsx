"use client";

import { AuthProvider } from "./AuthProvider";
import { AdminProvider } from "./AdminProvider";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminProvider>{children}</AdminProvider>
    </AuthProvider>
  );
}

"use client";

import { AuthProvider } from "./AuthProvider";
import { AdminProvider } from "./AdminProvider";
import PostHogProvider from "./PostHogProvider";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PostHogProvider>
        <AdminProvider>{children}</AdminProvider>
      </PostHogProvider>
    </AuthProvider>
  );
}

"use client";

import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./AuthProvider";
import { AdminProvider } from "./AdminProvider";
import PostHogProvider from "./PostHogProvider";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system">
      <AuthProvider>
        <PostHogProvider>
          <AdminProvider>{children}</AdminProvider>
        </PostHogProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

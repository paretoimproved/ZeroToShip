"use client";

import { ThemeProvider } from "next-themes";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./AuthProvider";
import { AdminProvider } from "./AdminProvider";
import PostHogProvider from "./PostHogProvider";

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  const inner = (
    <ThemeProvider attribute="class" defaultTheme="system">
      <AuthProvider>
        <PostHogProvider>
          <AdminProvider>{children}</AdminProvider>
        </PostHogProvider>
      </AuthProvider>
    </ThemeProvider>
  );

  if (!googleClientId) return inner;

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {inner}
    </GoogleOAuthProvider>
  );
}

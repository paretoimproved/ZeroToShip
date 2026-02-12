"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { login, loginWithOAuth } from "@/lib/auth";
import { trackLoginCompleted } from "@/lib/analytics";
import AuthForm from "@/components/AuthForm";
import { Spinner } from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, loginWithGoogleToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Detect OAuth callback (URL has ?code= or #access_token after provider redirect)
  const [isOAuthCallback, setIsOAuthCallback] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.search.includes("code=") ||
      window.location.hash.includes("access_token")
    );
  });

  // Redirect to dashboard if already authenticated (e.g. after OAuth callback)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  // If OAuth callback failed (loading done, not authenticated), show the form
  useEffect(() => {
    if (!isLoading && !isAuthenticated && isOAuthCallback) {
      setIsOAuthCallback(false);
    }
  }, [isLoading, isAuthenticated, isOAuthCallback]);

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    trackLoginCompleted(provider);
    await loginWithOAuth(provider);
  };

  const handleGoogleSuccess = async (credential: string) => {
    setError(null);
    trackLoginCompleted("google");
    await loginWithGoogleToken(credential);
    router.push("/dashboard");
  };

  const handleSubmit = async (data: { email: string; password: string }) => {
    setError(null);
    setLoading(true);

    try {
      await login(data.email, data.password);
      trackLoginCompleted("email");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Show transition screen while processing OAuth callback
  if (isOAuthCallback) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
        <Spinner className="h-8 w-8 text-primary-500" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Signing you in...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 text-center mb-8">
          ZeroToShip
        </p>

        <AuthForm
          mode="login"
          onSubmit={handleSubmit}
          onOAuth={handleOAuth}
          onGoogleSuccess={handleGoogleSuccess}
          error={error}
          isLoading={loading}
        />
      </div>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { login, loginWithOAuth } from "@/lib/auth";
import { trackLoginCompleted } from "@/lib/analytics";
import AuthForm from "@/components/AuthForm";
import { Spinner } from "@/components/icons";
import { useToast } from "@/components/ToastProvider";
import { getPostAuthRedirect, sanitizeNextPath } from "@/lib/redirect";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, loginWithGoogleCode } = useAuth();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [subtitle, setSubtitle] = useState<string | undefined>(undefined);
  const [redirectTo, setRedirectTo] = useState<string>(() => {
    if (typeof window === "undefined") return "/dashboard";
    const params = new URLSearchParams(window.location.search);
    const next = sanitizeNextPath(params.get("next"));
    const stored = sanitizeNextPath(sessionStorage.getItem("z2s_next"));
    return getPostAuthRedirect(next || stored);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const next = sanitizeNextPath(params.get("next"));
    const stored = sanitizeNextPath(sessionStorage.getItem("z2s_next"));
    const destination = getPostAuthRedirect(next || stored);

    setRedirectTo(destination);
    if (next) {
      sessionStorage.setItem("z2s_next", next);
    }
  }, []);

  const redirectTo = getPostAuthRedirect(
    searchParams.get("next") || (typeof window !== "undefined" ? sessionStorage.getItem("z2s_next") : null)
  );

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
      sessionStorage.removeItem("z2s_next");
      router.replace(redirectTo);
    }
  }, [isLoading, isAuthenticated, router, redirectTo]);

  // Pull query params for post-signup guidance and email prefill.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const email = params.get("email") || "";
    const fromSignup = params.get("signup") === "1";
    const next = sanitizeNextPath(params.get("next"));

    if (email) setDefaultEmail(email);
    if (fromSignup) {
      setNotice("Account created. Confirm your email, then sign in.");
      setSubtitle("Check your email for the confirmation link.");
    }
    if (next) {
      sessionStorage.setItem("z2s_next", next);
    }
  }, []);

  // If OAuth callback failed (loading done, not authenticated), show the form
  useEffect(() => {
    if (!isLoading && !isAuthenticated && isOAuthCallback) {
      setIsOAuthCallback(false);
    }
  }, [isLoading, isAuthenticated, isOAuthCallback]);

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    trackLoginCompleted(provider);
    // Persist where the user intended to go across the redirect-based flow.
    if (redirectTo && redirectTo !== "/dashboard") {
      sessionStorage.setItem("z2s_next", redirectTo);
    }
    await loginWithOAuth(provider);
  };

  const handleGoogleSuccess = async (code: string) => {
    setError(null);
    trackLoginCompleted("google");
    await loginWithGoogleCode(code);
    toast.success("Signed in", "Welcome back.");
    sessionStorage.removeItem("z2s_next");
    router.push(redirectTo);
  };

  const handleSubmit = async (data: { email: string; password: string }) => {
    setError(null);
    setLoading(true);

    try {
      await login(data.email, data.password);
      trackLoginCompleted("email");
      toast.success("Signed in", "Welcome back.");
      sessionStorage.removeItem("z2s_next");
      router.push(redirectTo);
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
          defaultEmail={defaultEmail}
          notice={notice ?? undefined}
          subtitle={subtitle}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4">
          <Spinner className="h-8 w-8 text-primary-500" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

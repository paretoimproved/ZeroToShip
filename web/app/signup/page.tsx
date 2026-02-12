"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signup, loginWithOAuth } from "@/lib/auth";
import { trackSignupCompleted } from "@/lib/analytics";
import { useAuth } from "@/components/AuthProvider";
import AuthForm from "@/components/AuthForm";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogleToken } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [defaultEmail, setDefaultEmail] = useState("");

  useEffect(() => {
    const prefillEmail = searchParams.get("email");
    if (prefillEmail) {
      setDefaultEmail(prefillEmail);
    }
  }, [searchParams]);

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    trackSignupCompleted(provider);
    await loginWithOAuth(provider);
  };

  const handleGoogleSuccess = async (credential: string) => {
    setError(null);
    trackSignupCompleted("google");
    await loginWithGoogleToken(credential);
    router.push("/dashboard");
  };

  const handleSubmit = async (data: { email: string; password: string; name?: string }) => {
    setError(null);
    setLoading(true);

    try {
      await signup(data.email, data.password, data.name ?? "");
      trackSignupCompleted("email");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      mode="signup"
      onSubmit={handleSubmit}
      onOAuth={handleOAuth}
      onGoogleSuccess={handleGoogleSuccess}
      error={error}
      isLoading={loading}
      defaultEmail={defaultEmail}
    />
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <p className="text-2xl font-bold text-primary-600 dark:text-primary-400 text-center mb-8">
          ZeroToShip
        </p>

        <Suspense fallback={
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
            <div className="animate-pulse space-y-4">
              <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4 mx-auto" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto" />
              <div className="space-y-4 pt-2">
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2" />
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2" />
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20 mb-2" />
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                </div>
                <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
            </div>
          </div>
        }>
          <SignupForm />
        </Suspense>

        <div className="flex items-center justify-center gap-6 mt-6">
          <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            Secure
          </span>
          <span className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <svg className="h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
            </svg>
            No credit card required
          </span>
        </div>
      </div>
    </div>
  );
}

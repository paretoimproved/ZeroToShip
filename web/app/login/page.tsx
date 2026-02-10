"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, loginWithOAuth } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    await loginWithOAuth(provider);
  };

  const handleSubmit = async (data: { email: string; password: string }) => {
    setError(null);
    setLoading(true);

    try {
      await login(data.email, data.password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

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
          error={error}
          isLoading={loading}
        />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { CredentialResponse } from "@react-oauth/google";
import { Spinner, GitHubIcon } from "@/components/icons";

const GoogleLogin = dynamic(
  () => import("@react-oauth/google").then((mod) => mod.GoogleLogin),
  { ssr: false }
);

type OAuthProvider = "google" | "github";

interface AuthFormProps {
  mode: "login" | "signup";
  onSubmit: (data: { email: string; password: string; name?: string }) => Promise<void>;
  onOAuth: (provider: OAuthProvider) => Promise<void>;
  onGoogleSuccess: (credential: string) => Promise<void>;
  error?: string | null;
  isLoading?: boolean;
  defaultEmail?: string;
}

export default function AuthForm({
  mode,
  onSubmit,
  onOAuth,
  onGoogleSuccess,
  error,
  isLoading = false,
  defaultEmail = "",
}: AuthFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (defaultEmail) {
      setEmail(defaultEmail);
    }
  }, [defaultEmail]);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const displayError = error ?? submitError;

  const handleOAuth = async (provider: OAuthProvider) => {
    setSubmitError(null);
    setOauthLoading(provider);
    try {
      await onOAuth(provider);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : `${provider} login failed`
      );
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    try {
      await onSubmit({
        email,
        password,
        ...(mode === "signup" ? { name } : {}),
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : mode === "login"
            ? "Login failed"
            : "Signup failed"
      );
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
      <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white text-center">
        {isLogin ? "Sign In to ZeroToShip" : "Create Your Account"}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-2 mb-6">
        {isLogin ? "Welcome back" : "Start finding your next big idea"}
      </p>

      {displayError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 flex items-start gap-2">
          <svg className="h-5 w-5 text-red-500 dark:text-red-400 shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <p className="text-red-700 dark:text-red-300 text-sm">{displayError}</p>
        </div>
      )}

      <div className="space-y-3">
        {oauthLoading === "google" ? (
          <div className="w-full flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-6 py-3">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          <div className="flex justify-center [&>div]:w-full">
            <GoogleLogin
              onSuccess={(response: CredentialResponse) => {
                if (response.credential) {
                  setOauthLoading("google");
                  setSubmitError(null);
                  onGoogleSuccess(response.credential).catch((err) => {
                    setSubmitError(err instanceof Error ? err.message : "Google login failed");
                    setOauthLoading(null);
                  });
                }
              }}
              onError={() => {
                setSubmitError("Google sign-in was cancelled or failed");
              }}
              text={isLogin ? "signin_with" : "signup_with"}
              shape="rectangular"
              size="large"
              width="400"
              theme="outline"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => handleOAuth("github")}
          disabled={oauthLoading !== null}
          className="w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50"
        >
          {oauthLoading === "github" ? (
            <Spinner className="h-5 w-5" />
          ) : (
            <GitHubIcon />
          )}
          Continue with GitHub
        </button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-gray-700" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white dark:bg-gray-800 px-4 text-gray-500 dark:text-gray-400">or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
              placeholder="Your name"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-3 text-sm shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || oauthLoading !== null}
          className="w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner className="h-4 w-4" />
              {isLogin ? "Signing in..." : "Creating account..."}
            </span>
          ) : (
            isLogin ? "Sign In" : "Create Account"
          )}
        </button>
      </form>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          {isLogin ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                Sign Up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium">
                Sign In
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

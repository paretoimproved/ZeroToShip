"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function HeroSection() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (isAuthenticated) {
      router.push("/dashboard");
      return;
    }

    setEmailError("");

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Please enter your email address.");
      return;
    }

    // Basic email validation beyond the native `required` + `type="email"`
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    router.push("/signup?email=" + encodeURIComponent(trimmed));
  }

  return (
    <section
      id="hero"
      aria-labelledby="hero-heading"
      className="px-4 pb-20 pt-32 sm:px-6"
    >
      <div className="mx-auto max-w-3xl text-center">
        {/* Heading */}
        <h1
          id="hero-heading"
          className="text-balance text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:text-6xl"
        >
          Stop Scrolling.{" "}
          <span className="text-primary-600 dark:text-primary-400">
            Start Building.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg leading-relaxed text-gray-600 dark:text-gray-400 sm:text-xl">
          Every morning, get startup ideas scraped from Reddit, HN, and
          GitHub &mdash; scored by AI, with full business briefs. Free.
        </p>

        {/* Email capture form / Dashboard CTA */}
        {isAuthenticated ? (
          <div className="mx-auto mt-10 max-w-md">
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full sm:w-auto rounded-lg bg-primary-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
            noValidate
          >
            <div className="flex-1">
              <label htmlFor="hero-email" className="sr-only">
                Email address
              </label>
              <input
                id="hero-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                aria-describedby={emailError ? "hero-email-error" : undefined}
                aria-invalid={emailError ? true : undefined}
                className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:ring-offset-gray-900 ${
                  emailError
                    ? "border-red-500 dark:border-red-400"
                    : "border-gray-300 dark:border-gray-600"
                }`}
              />
              {emailError && (
                <p
                  id="hero-email-error"
                  role="alert"
                  className="mt-1.5 text-left text-sm text-red-600 dark:text-red-400"
                >
                  {emailError}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              Get Started Free
            </button>
          </form>
        )}

        {/* Secondary link */}
        <p className="mt-4">
          <a
            href="#sample-brief"
            className="text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            See a sample brief ↓
          </a>
        </p>

        {/* Trust badges */}
        <ul className="mt-12 flex flex-wrap items-center justify-center gap-6">
          <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg
              className="h-5 w-5 shrink-0 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            300+ posts scraped daily
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg
              className="h-5 w-5 shrink-0 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            3 sources monitored
          </li>
          <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg
              className="h-5 w-5 shrink-0 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Full technical specs
          </li>
        </ul>
      </div>
    </section>
  );
}

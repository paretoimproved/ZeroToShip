"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function FinalCTA() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (email.trim()) {
      router.push(`/signup?email=${encodeURIComponent(email.trim())}`);
    }
  }

  return (
    <section
      aria-labelledby="cta-heading"
      className="py-20 px-4 bg-primary-600 dark:bg-primary-900"
    >
      <div className="max-w-xl mx-auto text-center">
        <h2
          id="cta-heading"
          className="text-3xl font-bold text-white mb-4"
        >
          {isAuthenticated ? "Your Problem Library Awaits" : "Your next project starts with a real problem."}
        </h2>
        <p className="text-primary-100 mb-8">
          {isAuthenticated
            ? "Head to your dashboard to browse today's problems."
            : "Sign up in 30 seconds. Browse validated problems and generate your first spec tonight. No credit card required."}
        </p>

        {isAuthenticated ? (
          <button
            onClick={() => router.push("/dashboard")}
            className="px-8 py-3 rounded-lg bg-white text-primary-600 font-semibold text-sm hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600"
          >
            Go to Dashboard
          </button>
        ) : (
          <>
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3 justify-center"
            >
              <label htmlFor="cta-email" className="sr-only">
                Email address
              </label>
              <input
                id="cta-email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-lg bg-white text-primary-600 font-semibold text-sm hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600"
              >
                Start Exploring Free
              </button>
            </form>

            <p className="text-primary-200 text-sm mt-6">
              Full library access free. Upgrade to Pro for agent-ready specs.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

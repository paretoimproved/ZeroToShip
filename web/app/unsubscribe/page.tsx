"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

type Status = "loading" | "success" | "error" | "invalid";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>(token ? "loading" : "invalid");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
    fetch(`${apiUrl}/user/unsubscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        setStatus(res.ok ? "success" : "error");
      })
      .catch(() => {
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              Unsubscribing...
            </h1>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              You&apos;ve been unsubscribed
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You won&apos;t receive any more daily brief emails. You can still access your ideas on the dashboard.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
              Changed your mind? Re-enable emails anytime in{" "}
              <Link href="/settings" className="text-primary-600 dark:text-primary-400 underline">
                Settings
              </Link>.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We couldn&apos;t process your unsubscribe request. You can manage your email preferences from the settings page instead.
            </p>
            <Link
              href="/settings"
              className="inline-block rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              Go to Settings
            </Link>
          </>
        )}

        {status === "invalid" && (
          <>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Invalid unsubscribe link
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This link appears to be invalid or expired. You can manage your email preferences from the settings page.
            </p>
            <Link
              href="/settings"
              className="inline-block rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              Go to Settings
            </Link>
          </>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            Back to ZeroToShip
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 animate-pulse" />
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}

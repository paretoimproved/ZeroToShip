"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/icons";

/**
 * Check if the current URL contains an OAuth callback token in the hash.
 * When present, AuthProvider is still processing the token — don't redirect.
 */
function hasOAuthCallback(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hash.includes("access_token");
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [oauthPending, setOauthPending] = useState(() => hasOAuthCallback());

  // Clear the OAuth pending flag once auth loading completes
  useEffect(() => {
    if (!isLoading) {
      setOauthPending(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && !oauthPending) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, oauthPending, router]);

  if (isLoading || oauthPending) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner className="h-8 w-8 text-primary-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

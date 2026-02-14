"use client";

const MAX_NEXT_LENGTH = 2048;

/**
 * Prevent open-redirects and odd schemes. We only allow app-internal paths.
 * Accepts strings like "/dashboard" or "/idea/123?tab=market".
 */
export function sanitizeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (next.length > MAX_NEXT_LENGTH) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  // Disallow backslash variants that some browsers normalize unexpectedly.
  if (next.startsWith("/\\")) return null;
  return next;
}

export function getPostAuthRedirect(next: string | null | undefined): string {
  return sanitizeNextPath(next) ?? "/dashboard";
}


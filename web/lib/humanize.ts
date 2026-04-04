/**
 * Human-friendly text helpers for UI rendering.
 *
 * We keep these as display-only transforms so stored/generated content can
 * remain unchanged while the product stays understandable to non-technical users.
 */

const REPLACEMENTS: Array<{ re: RegExp; replace: string }> = [
  // Common SaaS shorthand
  { re: /\bMRR\b/g, replace: "per month" },
  // Product shorthand
  { re: /\bHN\b/g, replace: "Hacker News" },
];

export function humanizeText(text: string): string {
  if (!text) return "";
  let out = text;
  for (const { re, replace } of REPLACEMENTS) {
    out = out.replace(re, replace);
  }
  return out;
}


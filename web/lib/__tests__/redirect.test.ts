import { describe, expect, it } from "vitest";
import { getPostAuthRedirect, sanitizeNextPath } from "../redirect";

describe("redirect utils", () => {
  it("allows safe internal paths", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/idea/123?tab=market")).toBe("/idea/123?tab=market");
  });

  it("rejects non-internal or suspicious paths", () => {
    expect(sanitizeNextPath("https://evil.com")).toBeNull();
    expect(sanitizeNextPath("javascript:alert(1)")).toBeNull();
    expect(sanitizeNextPath("//evil.com")).toBeNull();
    expect(sanitizeNextPath("/\\evil")).toBeNull();
  });

  it("falls back to /dashboard when missing", () => {
    expect(getPostAuthRedirect(null)).toBe("/dashboard");
    expect(getPostAuthRedirect(undefined)).toBe("/dashboard");
  });
});


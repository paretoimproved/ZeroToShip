/**
 * Test Helpers for IdeaForge API Tests
 *
 * Provides Zod schema validation utilities for asserting response body shapes.
 */

import { expect } from 'vitest';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Assert that a value conforms to a Zod schema.
 * On failure, prints the specific validation errors for debugging.
 */
export function expectSchemaValid<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`
    );
    expect.fail(
      `Schema validation failed:\n${issues.join('\n')}\n\nReceived: ${JSON.stringify(data, null, 2)}`
    );
  }

  return result.data;
}

/**
 * Assert that a value does NOT conform to a Zod schema.
 * Useful for testing that invalid inputs are correctly rejected.
 */
export function expectSchemaInvalid(schema: ZodSchema, data: unknown): ZodError {
  const result = schema.safeParse(data);

  if (result.success) {
    expect.fail(
      `Expected schema validation to fail, but it succeeded.\n\nInput: ${JSON.stringify(data, null, 2)}`
    );
  }

  return result.error;
}

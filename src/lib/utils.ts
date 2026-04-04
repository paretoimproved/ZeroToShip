/**
 * Shared utility functions for ZeroToShip
 */

/**
 * Sleep for specified milliseconds (rate limiting between requests)
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

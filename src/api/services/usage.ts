/**
 * Usage Tracking Service for ZeroToShip API
 *
 * Tracks API usage and provides rate limit status.
 * On-demand generation limits will be added when that feature is built.
 */

import { db } from '../db/client';
import { usageTracking } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { TIER_USAGE_LIMITS, type UserTier } from '../config/tiers';

/**
 * Usage status response type
 */
export interface UsageStatus {
  requestsPerHour: number;
  resetAt: string;
}

/**
 * Get the date string for today in YYYY-MM-DD format (UTC)
 */
function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get next midnight UTC as ISO string
 */
export function getNextMidnightUTC(): string {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return tomorrow.toISOString();
}

/**
 * Get or create today's usage record for a user
 */
export async function getTodayUsage(
  userId: string
): Promise<typeof usageTracking.$inferSelect> {
  const today = getTodayDateString();

  // Try to insert a new record (will no-op if exists due to unique constraint)
  try {
    const [inserted] = await db
      .insert(usageTracking)
      .values({
        userId,
        date: today,
        freshBriefsUsed: 0,
        validationRequestsUsed: 0,
        overageBriefs: 0,
        overageAmountCents: 0,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      return inserted;
    }
  } catch {
    // Ignore conflict errors, fetch existing record below
  }

  // Record exists, fetch it
  const [existing] = await db
    .select()
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.date, today)
      )
    );

  // If still no record (race condition), create with defaults
  if (!existing) {
    const [created] = await db
      .insert(usageTracking)
      .values({
        userId,
        date: today,
        freshBriefsUsed: 0,
        validationRequestsUsed: 0,
        overageBriefs: 0,
        overageAmountCents: 0,
      })
      .returning();
    return created;
  }

  return existing;
}

/**
 * Get usage status for a user
 */
export async function getUsageStatus(
  userId: string,
  tier: UserTier
): Promise<UsageStatus> {
  const limits = TIER_USAGE_LIMITS[tier] || TIER_USAGE_LIMITS.free;

  return {
    requestsPerHour: limits.requestsPerHour,
    resetAt: getNextMidnightUTC(),
  };
}

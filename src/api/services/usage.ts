/**
 * Usage Tracking Service for ZeroToShip API
 *
 * Tracks daily usage of AI generation features to prevent abuse.
 * Enforces tier-based limits and handles overage billing for Enterprise users.
 */

import { db } from '../db/client';
import { usageTracking } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { TIER_USAGE_LIMITS, type UserTier } from '../config/tiers';

/**
 * Usage status response type
 */
export interface UsageStatus {
  freshBriefsUsed: number;
  freshBriefsLimit: number;
  freshBriefsRemaining: number;
  validationRequestsUsed: number;
  validationRequestsLimit: number;
  validationRequestsRemaining: number;
  overageBriefs: number;
  overageAmountCents: number;
  canRequestFreshBrief: boolean;
  canRequestValidation: boolean;
  wouldIncurOverage: boolean;
  resetAt: string;
}

/**
 * Result of incrementing usage
 */
export interface IncrementResult {
  allowed: boolean;
  isOverage: boolean;
  overageAmountCents: number;
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
  const usage = await getTodayUsage(userId);

  const freshBriefsRemaining = Math.max(0, limits.freshBriefsPerDay - usage.freshBriefsUsed);
  const validationRequestsRemaining = Math.max(
    0,
    limits.validationRequestsPerDay - usage.validationRequestsUsed
  );

  // Can request if within limit OR if overage is allowed
  const canRequestFreshBrief =
    freshBriefsRemaining > 0 || limits.overagePricePerBrief !== null;
  const canRequestValidation = validationRequestsRemaining > 0;

  // Would incur overage if at limit but overage is allowed
  const wouldIncurOverage =
    freshBriefsRemaining === 0 && limits.overagePricePerBrief !== null;

  return {
    freshBriefsUsed: usage.freshBriefsUsed,
    freshBriefsLimit: limits.freshBriefsPerDay,
    freshBriefsRemaining,
    validationRequestsUsed: usage.validationRequestsUsed,
    validationRequestsLimit: limits.validationRequestsPerDay,
    validationRequestsRemaining,
    overageBriefs: usage.overageBriefs,
    overageAmountCents: usage.overageAmountCents,
    canRequestFreshBrief,
    canRequestValidation,
    wouldIncurOverage,
    resetAt: getNextMidnightUTC(),
  };
}

/**
 * Increment fresh brief usage atomically
 *
 * Uses a single UPDATE ... WHERE ... RETURNING to atomically check the limit
 * and increment in one query, eliminating the race condition between concurrent
 * requests that could bypass the limit with a check-then-increment pattern.
 */
export async function incrementBriefUsage(
  userId: string,
  tier: UserTier
): Promise<IncrementResult> {
  const limits = TIER_USAGE_LIMITS[tier] || TIER_USAGE_LIMITS.free;
  const today = getTodayDateString();

  // Ensure today's record exists
  await getTodayUsage(userId);

  // Atomic increment: only succeeds if under the limit
  const updated = await db
    .update(usageTracking)
    .set({
      freshBriefsUsed: sql`${usageTracking.freshBriefsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.date, today),
        sql`${usageTracking.freshBriefsUsed} < ${limits.freshBriefsPerDay}`
      )
    )
    .returning();

  if (updated.length > 0) {
    return { allowed: true, isOverage: false, overageAmountCents: 0 };
  }

  // At limit - check if overage allowed
  if (limits.overagePricePerBrief === null) {
    return { allowed: false, isOverage: false, overageAmountCents: 0 };
  }

  // Allow with overage (always increment, no upper bound)
  const overageCents = Math.round(limits.overagePricePerBrief * 100);

  await db
    .update(usageTracking)
    .set({
      freshBriefsUsed: sql`${usageTracking.freshBriefsUsed} + 1`,
      overageBriefs: sql`${usageTracking.overageBriefs} + 1`,
      overageAmountCents: sql`${usageTracking.overageAmountCents} + ${overageCents}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.date, today)
      )
    );

  return { allowed: true, isOverage: true, overageAmountCents: overageCents };
}

/**
 * Increment validation request usage atomically
 * Validations have a hard limit (no overage option)
 */
export async function incrementValidationUsage(
  userId: string,
  tier: UserTier
): Promise<IncrementResult> {
  const limits = TIER_USAGE_LIMITS[tier] || TIER_USAGE_LIMITS.free;
  const today = getTodayDateString();

  // Ensure today's record exists
  await getTodayUsage(userId);

  // Atomic increment: only succeeds if under the limit
  const updated = await db
    .update(usageTracking)
    .set({
      validationRequestsUsed: sql`${usageTracking.validationRequestsUsed} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(usageTracking.userId, userId),
        eq(usageTracking.date, today),
        sql`${usageTracking.validationRequestsUsed} < ${limits.validationRequestsPerDay}`
      )
    )
    .returning();

  if (updated.length > 0) {
    return { allowed: true, isOverage: false, overageAmountCents: 0 };
  }

  // At limit - validations have no overage option
  return { allowed: false, isOverage: false, overageAmountCents: 0 };
}

/**
 * Get total overage amount for a user in a billing period
 * Useful for end-of-month billing
 */
export async function getOverageForPeriod(
  userId: string,
  startDate: string,
  endDate: string
): Promise<{ totalOverageBriefs: number; totalOverageCents: number }> {
  const result = await db
    .select({
      totalOverageBriefs: sql<number>`COALESCE(SUM(${usageTracking.overageBriefs}), 0)`,
      totalOverageCents: sql<number>`COALESCE(SUM(${usageTracking.overageAmountCents}), 0)`,
    })
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.userId, userId),
        sql`${usageTracking.date} >= ${startDate}`,
        sql`${usageTracking.date} <= ${endDate}`
      )
    );

  return {
    totalOverageBriefs: Number(result[0]?.totalOverageBriefs) || 0,
    totalOverageCents: Number(result[0]?.totalOverageCents) || 0,
  };
}

/**
 * Check if user can make a fresh brief request (without incrementing)
 */
export async function canRequestBrief(
  userId: string,
  tier: UserTier
): Promise<{ allowed: boolean; wouldIncurOverage: boolean }> {
  const status = await getUsageStatus(userId, tier);
  return {
    allowed: status.canRequestFreshBrief,
    wouldIncurOverage: status.wouldIncurOverage,
  };
}

/**
 * Check if user can make a validation request (without incrementing)
 */
export async function canRequestValidation(
  userId: string,
  tier: UserTier
): Promise<boolean> {
  const status = await getUsageStatus(userId, tier);
  return status.canRequestValidation;
}

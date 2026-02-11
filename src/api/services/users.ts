/**
 * Users Service for ZeroToShip API
 *
 * Business logic for user management, preferences, and subscriptions
 */

import { eq, desc, and } from 'drizzle-orm';
import {
  db,
  users,
  userPreferences,
  subscriptions,
  savedIdeas,
  viewedIdeas,
  apiKeys,
} from '../db/client';
import type {
  UserPreferences,
  UpdatePreferencesRequest,
  UserHistoryResponse,
  SubscriptionResponse,
  UserTier,
  EffortLevel,
} from '../schemas';
import { generateApiKey, hashApiKey, invalidateTierCache } from '../middleware/auth';
import { sendOnboardingEmail } from '../../delivery/onboarding';
import logger from '../../lib/logger';

/**
 * Get user by ID
 */
export async function getUserById(
  userId: string
): Promise<{ id: string; email: string; name: string | null; tier: string; isAdmin: boolean } | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * Get or create user from Supabase auth
 */
export async function getOrCreateUser(
  id: string,
  email: string,
  name?: string
): Promise<{ id: string; email: string; name: string | null; tier: string; isAdmin: boolean }> {
  // Try to get existing user
  const existing = await getUserById(id);
  if (existing) {
    return existing;
  }

  // Create new user
  const result = await db
    .insert(users)
    .values({ id, email, name: name || null })
    .returning();

  // Create default preferences
  await db.insert(userPreferences).values({ userId: id });

  // Create default subscription (free tier)
  await db.insert(subscriptions).values({ userId: id, plan: 'free', status: 'active' });

  // Send welcome onboarding email (fire-and-forget, never block signup)
  sendOnboardingEmail(id, 'welcome').catch((err) => {
    logger.error(
      { userId: id, error: err instanceof Error ? err.message : String(err) },
      'Failed to send welcome onboarding email'
    );
  });

  return result[0];
}

/**
 * Get user preferences
 */
export async function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  const rows = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    categories: (row.categories as string[]) || [],
    maxEffort: (row.maxEffort as EffortLevel) || 'quarter',
    emailFrequency: (row.emailFrequency as 'daily' | 'weekly' | 'never') || 'daily',
    minPriorityScore: row.minPriorityScore ? parseFloat(row.minPriorityScore) : undefined,
  };
}

/**
 * Update user preferences
 */
export async function updateUserPreferences(
  userId: string,
  updates: UpdatePreferencesRequest
): Promise<UserPreferences | null> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (updates.categories !== undefined) {
    updateData.categories = updates.categories;
  }
  if (updates.maxEffort !== undefined) {
    updateData.maxEffort = updates.maxEffort;
  }
  if (updates.emailFrequency !== undefined) {
    updateData.emailFrequency = updates.emailFrequency;
  }
  if (updates.minPriorityScore != null) {
    updateData.minPriorityScore = String(updates.minPriorityScore);
  }

  // Upsert preferences
  const existing = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(userPreferences).values({
      userId,
      ...updateData,
    });
  } else {
    await db
      .update(userPreferences)
      .set(updateData)
      .where(eq(userPreferences.userId, userId));
  }

  return getUserPreferences(userId);
}

/**
 * Get user subscription status
 */
export async function getUserSubscription(
  userId: string
): Promise<SubscriptionResponse | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    plan: row.plan as UserTier,
    status: row.status as 'active' | 'canceled' | 'past_due',
    currentPeriodEnd: row.currentPeriodEnd?.toISOString(),
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}

/**
 * Get user history (viewed and saved ideas)
 */
export async function getUserHistory(userId: string): Promise<UserHistoryResponse> {
  // Get viewed ideas
  const viewedRows = await db
    .select({ ideaId: viewedIdeas.ideaId, viewedAt: viewedIdeas.viewedAt })
    .from(viewedIdeas)
    .where(eq(viewedIdeas.userId, userId))
    .orderBy(desc(viewedIdeas.viewedAt))
    .limit(100);

  // Get saved ideas
  const savedRows = await db
    .select({ ideaId: savedIdeas.ideaId, savedAt: savedIdeas.savedAt })
    .from(savedIdeas)
    .where(eq(savedIdeas.userId, userId))
    .orderBy(desc(savedIdeas.savedAt))
    .limit(100);

  return {
    viewed: viewedRows.map((r) => ({
      ideaId: r.ideaId,
      viewedAt: r.viewedAt.toISOString(),
    })),
    saved: savedRows.map((r) => ({
      ideaId: r.ideaId,
      savedAt: r.savedAt.toISOString(),
    })),
  };
}

/**
 * Get user's saved idea IDs
 */
export async function getSavedIdeaIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ ideaId: savedIdeas.ideaId })
    .from(savedIdeas)
    .where(eq(savedIdeas.userId, userId));

  return rows.map((r) => r.ideaId);
}

/**
 * Get user's API keys (Enterprise)
 */
export async function getUserApiKeys(
  userId: string
): Promise<
  Array<{
    id: string;
    name: string;
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    isActive: boolean;
    createdAt: Date;
  }>
> {
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      isActive: apiKeys.isActive,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));

  return rows;
}

/**
 * Create API key for user (Enterprise)
 */
export async function createApiKey(
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ id: string; key: string } | null> {
  try {
    const key = generateApiKey();
    const keyHash = hashApiKey(key);
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await db
      .insert(apiKeys)
      .values({
        userId,
        key,
        keyHash,
        name,
        expiresAt,
      })
      .returning({ id: apiKeys.id });

    return { id: result[0].id, key };
  } catch {
    return null;
  }
}

/**
 * Delete API key
 */
export async function deleteApiKey(userId: string, keyId: string): Promise<boolean> {
  try {
    const result = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning({ id: apiKeys.id });
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Deactivate API key
 */
export async function deactivateApiKey(userId: string, keyId: string): Promise<boolean> {
  try {
    const result = await db
      .update(apiKeys)
      .set({ isActive: false })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .returning({ id: apiKeys.id });
    return result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Update user tier (called from Stripe webhook)
 */
export async function updateUserTier(userId: string, tier: UserTier): Promise<boolean> {
  try {
    await db.update(users).set({ tier, updatedAt: new Date() }).where(eq(users.id, userId));
    // Invalidate the tier cache so the new tier takes effect immediately
    invalidateTierCache(userId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Update subscription from Stripe webhook
 */
export async function updateSubscription(
  userId: string,
  data: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    plan?: string;
    status?: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.stripeCustomerId !== undefined) {
      updateData.stripeCustomerId = data.stripeCustomerId;
    }
    if (data.stripeSubscriptionId !== undefined) {
      updateData.stripeSubscriptionId = data.stripeSubscriptionId;
    }
    if (data.plan !== undefined) {
      updateData.plan = data.plan;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.currentPeriodStart !== undefined) {
      updateData.currentPeriodStart = data.currentPeriodStart;
    }
    if (data.currentPeriodEnd !== undefined) {
      updateData.currentPeriodEnd = data.currentPeriodEnd;
    }
    if (data.cancelAtPeriodEnd !== undefined) {
      updateData.cancelAtPeriodEnd = data.cancelAtPeriodEnd;
    }

    await db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.userId, userId));

    // Also update user tier
    if (data.plan) {
      await updateUserTier(userId, data.plan as UserTier);
    }

    return true;
  } catch {
    return false;
  }
}

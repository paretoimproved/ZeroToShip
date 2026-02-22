/**
 * Ideas Service for ZeroToShip API
 *
 * Business logic for fetching, filtering, and managing ideas
 */

import { eq, desc, asc, gte, lt, lte, and, like, sql, ilike, or } from 'drizzle-orm';
import { db, ideas, savedIdeas, viewedIdeas, validationRequests, specGenerations } from '../db/client';
import { config as envConfig } from '../../config/env';
import { getTodayWindowUtc } from '../../lib/timezone';
import type {
  IdeaBrief,
  IdeaSummary,
  ArchiveQuery,
  SearchQuery,
  ExportQuery,
  EffortLevel,
  UserTier,
  PaginationQuery,
} from '../schemas';
import {
  filterIdeasForTier,
  filterIdeaForTier,
  canAccessFullBrief,
} from '../middleware/tierGate';
import { getMonthlySpecLimit } from '../config/tiers';
import { callSpecGeneration } from '../../generation/agent-spec-generator';

/**
 * Convert database row to IdeaBrief
 */
function rowToIdeaBrief(row: typeof ideas.$inferSelect): IdeaBrief {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    priorityScore: parseFloat(row.priorityScore),
    effortEstimate: row.effortEstimate as EffortLevel,
    revenueEstimate: row.revenueEstimate || undefined,
    category: row.category || undefined,

    problemStatement: row.problemStatement,
    targetAudience: row.targetAudience || undefined,
    marketSize: row.marketSize || undefined,

    existingSolutions: row.existingSolutions || undefined,
    gaps: row.gaps || undefined,

    proposedSolution: row.proposedSolution || undefined,
    keyFeatures: (row.keyFeatures as string[]) || undefined,
    mvpScope: row.mvpScope || undefined,

    technicalSpec: row.technicalSpec as IdeaBrief['technicalSpec'],
    businessModel: row.businessModel as IdeaBrief['businessModel'],
    goToMarket: row.goToMarket as IdeaBrief['goToMarket'],

    risks: (row.risks as string[]) || undefined,
    sources: (row.sources as IdeaBrief['sources']) || [],
    generatedAt: row.generatedAt.toISOString(),
  };
}

/**
 * Get today's published ideas
 */
export async function getTodaysIdeas(): Promise<IdeaBrief[]> {
  // Use scheduler-configured timezone for "today" boundaries so the UI and cron runs
  // agree on what "today" means (and avoid edge caching around UTC midnight).
  const tz = envConfig.SCHEDULER_TIMEZONE || 'UTC';
  const { start, end } = getTodayWindowUtc(tz, new Date());

  const rows = await db
    .select()
    .from(ideas)
    .where(
      and(
        eq(ideas.isPublished, true),
        gte(ideas.publishedAt, start),
        lt(ideas.publishedAt, end)
      )
    )
    .orderBy(desc(ideas.priorityScore))
    .limit(20);

  return rows.map(rowToIdeaBrief);
}

/**
 * Get the most recent published ideas (fallback if no ideas today)
 */
export async function getRecentIdeas(limit: number = 10): Promise<IdeaBrief[]> {
  const rows = await db
    .select()
    .from(ideas)
    .where(eq(ideas.isPublished, true))
    .orderBy(desc(ideas.publishedAt), desc(ideas.priorityScore))
    .limit(limit);

  return rows.map(rowToIdeaBrief);
}

/**
 * List published ideas with limit/offset pagination
 */
export async function listIdeas(
  pagination: PaginationQuery
): Promise<{ data: IdeaBrief[]; total: number }> {
  const whereClause = eq(ideas.isPublished, true);

  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ideas)
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  const rows = await db
    .select()
    .from(ideas)
    .where(whereClause)
    .orderBy(desc(ideas.publishedAt), desc(ideas.priorityScore))
    .limit(pagination.limit)
    .offset(pagination.offset);

  return {
    data: rows.map(rowToIdeaBrief),
    total,
  };
}

/**
 * Get a single idea by ID
 */
export async function getIdeaById(id: string): Promise<IdeaBrief | null> {
  const rows = await db.select().from(ideas).where(eq(ideas.id, id)).limit(1);

  if (rows.length === 0) {
    return null;
  }

  return rowToIdeaBrief(rows[0]);
}

/**
 * Get archived ideas with pagination and filters
 */
export async function getArchivedIdeas(
  query: ArchiveQuery
): Promise<{ ideas: IdeaBrief[]; total: number }> {
  const conditions = [eq(ideas.isPublished, true)];

  // Category filter
  if (query.category) {
    conditions.push(eq(ideas.category, query.category as string));
  }

  // Effort filter
  if (query.effort) {
    conditions.push(eq(ideas.effortEstimate, query.effort as string));
  }

  // Score filter
  if (query.minScore != null) {
    conditions.push(gte(ideas.priorityScore, String(query.minScore)));
  }

  // Date filters
  if (query.from) {
    conditions.push(gte(ideas.publishedAt, new Date(query.from as string)));
  }
  if (query.to) {
    conditions.push(lte(ideas.publishedAt, new Date(query.to as string)));
  }

  const whereClause = and(...conditions);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ideas)
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  // Get paginated results
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;
  // Build dynamic sort order
  function buildOrderBy(sort: string) {
    switch (sort) {
      case 'top-scored':
        return [desc(ideas.priorityScore), desc(ideas.publishedAt)];
      case 'lowest-effort': {
        const effortOrder = sql`CASE ${ideas.effortEstimate}
          WHEN 'weekend' THEN 1 WHEN 'week' THEN 2
          WHEN 'month' THEN 3 WHEN 'quarter' THEN 4 ELSE 5 END`;
        return [asc(effortOrder), desc(ideas.priorityScore)];
      }
      case 'a-z':
        return [asc(ideas.name), desc(ideas.publishedAt)];
      default: // 'newest'
        return [desc(ideas.publishedAt), desc(ideas.priorityScore)];
    }
  }

  const rows = await db
    .select()
    .from(ideas)
    .where(whereClause)
    .orderBy(...buildOrderBy(query.sort))
    .limit(pageSize)
    .offset(offset);

  return {
    ideas: rows.map(rowToIdeaBrief),
    total,
  };
}

/**
 * Full-text search across ideas (Enterprise feature)
 */
export async function searchIdeas(
  query: SearchQuery
): Promise<{ ideas: IdeaBrief[]; total: number }> {
  const searchTerm = `%${query.q}%`;

  const conditions = [
    eq(ideas.isPublished, true),
    or(
      ilike(ideas.name, searchTerm),
      ilike(ideas.tagline, searchTerm),
      ilike(ideas.problemStatement, searchTerm),
      ilike(ideas.proposedSolution, searchTerm)
    ),
  ];

  // Category filter
  if (query.category) {
    conditions.push(eq(ideas.category, query.category as string));
  }

  // Effort filter
  if (query.effort) {
    conditions.push(eq(ideas.effortEstimate, query.effort as string));
  }

  const whereClause = and(...conditions);

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ideas)
    .where(whereClause);

  const total = countResult[0]?.count || 0;

  // Get paginated results
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 10;
  const offset = (page - 1) * pageSize;
  const rows = await db
    .select()
    .from(ideas)
    .where(whereClause)
    .orderBy(desc(ideas.priorityScore))
    .limit(pageSize)
    .offset(offset);

  return {
    ideas: rows.map(rowToIdeaBrief),
    total,
  };
}

/**
 * Export ideas (Enterprise feature)
 */
export async function exportIdeas(query: ExportQuery): Promise<IdeaBrief[]> {
  const conditions = [eq(ideas.isPublished, true)];

  if (query.category) {
    conditions.push(eq(ideas.category, query.category));
  }
  if (query.from) {
    conditions.push(gte(ideas.publishedAt, new Date(query.from)));
  }
  if (query.to) {
    conditions.push(lte(ideas.publishedAt, new Date(query.to)));
  }

  const rows = await db
    .select()
    .from(ideas)
    .where(and(...conditions))
    .orderBy(desc(ideas.publishedAt))
    .limit(query.limit);

  return rows.map(rowToIdeaBrief);
}

/**
 * Convert ideas to CSV format
 */
export function ideasToCsv(ideaList: IdeaBrief[]): string {
  const headers = [
    'id',
    'name',
    'tagline',
    'priorityScore',
    'effortEstimate',
    'category',
    'problemStatement',
    'targetAudience',
    'generatedAt',
  ];

  const rows = ideaList.map((idea) => [
    idea.id,
    `"${idea.name.replace(/"/g, '""')}"`,
    `"${idea.tagline.replace(/"/g, '""')}"`,
    idea.priorityScore.toString(),
    idea.effortEstimate,
    idea.category || '',
    `"${idea.problemStatement.replace(/"/g, '""')}"`,
    `"${(idea.targetAudience || '').replace(/"/g, '""')}"`,
    idea.generatedAt,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Track that a user viewed an idea
 */
export async function trackView(userId: string, ideaId: string): Promise<void> {
  await db.insert(viewedIdeas).values({
    userId,
    ideaId,
    viewedAt: new Date(),
  }).onConflictDoNothing();
}

/**
 * Save an idea for a user
 */
export async function saveIdea(userId: string, ideaId: string): Promise<boolean> {
  try {
    await db.insert(savedIdeas).values({
      userId,
      ideaId,
      savedAt: new Date(),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Unsave an idea for a user
 */
export async function unsaveIdea(userId: string, ideaId: string): Promise<boolean> {
  try {
    await db
      .delete(savedIdeas)
      .where(and(eq(savedIdeas.userId, userId), eq(savedIdeas.ideaId, ideaId)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all saved ideas for a user
 */
export async function getSavedIdeasForUser(userId: string): Promise<IdeaBrief[]> {
  const rows = await db
    .select({ idea: ideas })
    .from(savedIdeas)
    .innerJoin(ideas, eq(savedIdeas.ideaId, ideas.id))
    .where(eq(savedIdeas.userId, userId))
    .orderBy(desc(savedIdeas.savedAt));

  return rows.map((r) => rowToIdeaBrief(r.idea));
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<string[]> {
  const result = await db
    .selectDistinct({ category: ideas.category })
    .from(ideas)
    .where(eq(ideas.isPublished, true));

  return result
    .map((r) => r.category)
    .filter((c): c is string => c !== null)
    .sort();
}

/**
 * Create a validation request (Enterprise feature)
 */
export async function createValidationRequest(
  userId: string,
  ideaId: string,
  depth: 'basic' | 'deep'
): Promise<{ id: string } | null> {
  try {
    const result = await db
      .insert(validationRequests)
      .values({
        userId,
        ideaId,
        status: 'pending',
        result: { depth, requestedDepth: depth },
      })
      .returning({ id: validationRequests.id });

    return { id: result[0].id };
  } catch {
    return null;
  }
}

/**
 * Get validation request status
 */
export async function getValidationStatus(
  requestId: string,
  userId: string
): Promise<{
  id: string;
  status: string;
  result: unknown;
  completedAt: Date | null;
} | null> {
  const rows = await db
    .select()
    .from(validationRequests)
    .where(and(eq(validationRequests.id, requestId), eq(validationRequests.userId, userId)))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    id: row.id,
    status: row.status,
    result: row.result,
    completedAt: row.completedAt,
  };
}

/**
 * Get today's ideas with fallback to recent, filtered by tier.
 * Encapsulates the "today or recent" fallback logic + tier filtering.
 */
export async function getTodaysIdeasForTier(
  tier: UserTier
): Promise<{ ideas: IdeaSummary[]; total: number }> {
  let allIdeas = await getTodaysIdeas();
  if (allIdeas.length === 0) {
    allIdeas = await getRecentIdeas(20);
  }

  allIdeas.sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));

  const { ideas: filtered, total } = filterIdeasForTier(allIdeas, tier);
  return { ideas: filtered, total };
}

/**
 * Get archived ideas filtered by tier, with pagination metadata.
 * All tiers now get the full paginated archive.
 */
export async function getArchivedIdeasForTier(
  query: ArchiveQuery,
  tier: UserTier
): Promise<{ ideas: IdeaSummary[]; total: number; hasMore: boolean; preview: boolean }> {
  const { ideas: allIdeas, total } = await getArchivedIdeas(query);
  const filtered = allIdeas.map((idea) => filterIdeaForTier(idea, tier));
  const hasMore = (Number(query.page) || 1) * (Number(query.pageSize) || 10) < total;

  return { ideas: filtered, total, hasMore, preview: false };
}

/**
 * Get a single idea by ID, filtered by tier.
 * Returns the idea summary and an upgrade prompt if the user can't see the full brief.
 */
export async function getIdeaByIdForTier(
  id: string,
  tier: UserTier,
  userId?: string
): Promise<{
  idea: IdeaSummary;
  upgrade?: { message: string; url: string };
} | null> {
  const idea = await getIdeaById(id);
  if (!idea) {
    return null;
  }

  // Track view if authenticated
  if (userId) {
    trackView(userId, id).catch(() => {});
  }

  const filtered = filterIdeaForTier(idea, tier);

  if (!canAccessFullBrief(tier)) {
    return {
      idea: filtered,
      upgrade: {
        message: 'Upgrade to Pro to see the full business brief',
        url: 'https://zerotoship.dev/pricing',
      },
    };
  }

  return { idea: filtered };
}

/**
 * Save an idea for a user, verifying the idea exists first.
 * Returns null if the idea doesn't exist.
 */
export async function saveIdeaForUser(
  userId: string,
  ideaId: string
): Promise<{ success: boolean; message: string } | null> {
  const idea = await getIdeaById(ideaId);
  if (!idea) {
    return null;
  }

  const success = await saveIdea(userId, ideaId);
  return {
    success,
    message: success ? 'Idea saved' : 'Already saved',
  };
}

/**
 * Count spec generations for a user in the current calendar month
 */
export async function getMonthlySpecCount(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(specGenerations)
    .where(
      and(
        eq(specGenerations.userId, userId),
        gte(specGenerations.createdAt, monthStart)
      )
    );

  return result[0]?.count || 0;
}

/**
 * Generate an agent-ready spec for an idea.
 * Checks tier limits, calls AI, stores result, returns spec.
 */
export async function generateSpecForIdea(
  ideaId: string,
  userId: string,
  tier: UserTier
): Promise<
  | { spec: unknown; generationId: string }
  | { limitReached: true; message: string }
  | null
> {
  // Check idea exists
  const idea = await getIdeaById(ideaId);
  if (!idea) return null;

  // Check monthly limit
  const limit = getMonthlySpecLimit(tier);
  const used = await getMonthlySpecCount(userId);

  if (used >= limit) {
    return {
      limitReached: true,
      message: `You've used ${used}/${limit} spec generations this month. Upgrade to Pro for 30/month.`,
    };
  }

  // Generate the spec using AI
  const spec = await callSpecGeneration(idea);

  // Store the generation
  const [row] = await db
    .insert(specGenerations)
    .values({
      userId,
      ideaId,
      spec,
    })
    .returning({ id: specGenerations.id });

  return { spec, generationId: row.id };
}

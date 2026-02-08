/**
 * Ideas Service for IdeaForge API
 *
 * Business logic for fetching, filtering, and managing ideas
 */

import { eq, desc, gte, lte, and, like, sql, ilike, or } from 'drizzle-orm';
import { db, ideas, savedIdeas, viewedIdeas, validationRequests } from '../db/client';
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
    generatedAt: row.generatedAt.toISOString(),
  };
}

/**
 * Get today's published ideas
 */
export async function getTodaysIdeas(): Promise<IdeaBrief[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const rows = await db
    .select()
    .from(ideas)
    .where(
      and(
        eq(ideas.isPublished, true),
        gte(ideas.publishedAt, today),
        lte(ideas.publishedAt, tomorrow)
      )
    )
    .orderBy(desc(ideas.priorityScore));

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
  const rows = await db
    .select()
    .from(ideas)
    .where(whereClause)
    .orderBy(desc(ideas.publishedAt), desc(ideas.priorityScore))
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
  try {
    await db.insert(viewedIdeas).values({
      userId,
      ideaId,
      viewedAt: new Date(),
    });
  } catch {
    // Ignore duplicates
  }
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
  requestId: string
): Promise<{
  id: string;
  status: string;
  result: unknown;
  completedAt: Date | null;
} | null> {
  const rows = await db
    .select()
    .from(validationRequests)
    .where(eq(validationRequests.id, requestId))
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

  const { ideas: filtered, total } = filterIdeasForTier(allIdeas, tier);
  return { ideas: filtered, total };
}

/**
 * Get archived ideas filtered by tier, with pagination metadata.
 */
export async function getArchivedIdeasForTier(
  query: ArchiveQuery,
  tier: UserTier
): Promise<{ ideas: IdeaSummary[]; total: number; hasMore: boolean }> {
  const { ideas: allIdeas, total } = await getArchivedIdeas(query);
  const { ideas: filtered } = filterIdeasForTier(allIdeas, tier);
  const hasMore = (Number(query.page) || 1) * (Number(query.pageSize) || 10) < total;

  return { ideas: filtered, total, hasMore };
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
        url: 'https://ideaforge.io/pricing',
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

/**
 * Ideas Routes for IdeaForge API
 *
 * Endpoints:
 * - GET /api/v1/ideas/today - Today's ranked ideas
 * - GET /api/v1/ideas/:id - Single idea with full brief
 * - GET /api/v1/ideas/archive - Historical ideas with pagination
 */

import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { optionalAuth, requireAuth } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import {
  filterIdeasForTier,
  filterIdeaForTier,
  createTierGate,
  canAccessFullBrief,
} from '../middleware/tierGate';
import {
  getTodaysIdeas,
  getRecentIdeas,
  getIdeaById,
  getArchivedIdeas,
  trackView,
  saveIdea,
  unsaveIdea,
  getCategories,
} from '../services/ideas';
import {
  IdeaListResponseSchema,
  IdeaSummarySchema,
  ArchiveQuerySchema,
} from '../schemas';

export const ideasRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/ideas/today
   * Get today's ranked ideas (tier-limited)
   */
  app.get(
    '/today',
    {
      preHandler: [optionalAuth, rateLimitMiddleware],
      schema: {
        response: {
          200: IdeaListResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // Get today's ideas, or recent if none today
      let allIdeas = await getTodaysIdeas();
      if (allIdeas.length === 0) {
        allIdeas = await getRecentIdeas(20);
      }

      // Filter based on tier
      const { ideas, total, limited } = filterIdeasForTier(allIdeas, request.userTier);

      return reply.send({
        ideas,
        total,
        page: 1,
        pageSize: ideas.length,
        tier: request.userTier,
      });
    }
  );

  /**
   * GET /api/v1/ideas/categories
   * Get list of available categories
   */
  app.get(
    '/categories',
    {
      preHandler: [optionalAuth, rateLimitMiddleware],
      schema: {
        response: {
          200: z.object({
            categories: z.array(z.string()),
          }),
        },
      },
    },
    async (request, reply) => {
      const categories = await getCategories();
      return reply.send({ categories });
    }
  );

  /**
   * GET /api/v1/ideas/archive
   * Get historical ideas with pagination and filters
   */
  app.get(
    '/archive',
    {
      preHandler: [optionalAuth, rateLimitMiddleware, createTierGate('ideas.archive')],
      schema: {
        querystring: ArchiveQuerySchema,
        response: {
          200: z.object({
            ideas: z.array(IdeaSummarySchema),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
            hasMore: z.boolean(),
            tier: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const query = request.query;
      const { ideas: allIdeas, total } = await getArchivedIdeas(query);

      // Filter based on tier
      const { ideas } = filterIdeasForTier(allIdeas, request.userTier);

      const hasMore = query.page * query.pageSize < total;

      return reply.send({
        ideas,
        total,
        page: query.page,
        pageSize: query.pageSize,
        hasMore,
        tier: request.userTier,
      });
    }
  );

  /**
   * GET /api/v1/ideas/:id
   * Get a single idea with full brief (if authorized)
   */
  app.get(
    '/:id',
    {
      preHandler: [optionalAuth, rateLimitMiddleware],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: IdeaSummarySchema,
          404: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const idea = await getIdeaById(id);

      if (!idea) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Idea not found',
        });
      }

      // Track view if authenticated
      if (request.userId) {
        trackView(request.userId, id).catch(() => {});
      }

      // Filter based on tier
      const filtered = filterIdeaForTier(idea, request.userTier);

      // Add upgrade prompt if user can't see full brief
      if (!canAccessFullBrief(request.userTier)) {
        return reply.send({
          ...filtered,
          _upgrade: {
            message: 'Upgrade to Pro to see the full business brief',
            url: 'https://ideaforge.io/pricing',
          },
        });
      }

      return reply.send(filtered);
    }
  );

  /**
   * POST /api/v1/ideas/:id/save
   * Save (bookmark) an idea
   */
  app.post(
    '/:id/save',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          404: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Verify idea exists
      const idea = await getIdeaById(id);
      if (!idea) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Idea not found',
        });
      }

      const success = await saveIdea(request.userId!, id);

      return reply.send({
        success,
        message: success ? 'Idea saved' : 'Already saved',
      });
    }
  );

  /**
   * DELETE /api/v1/ideas/:id/save
   * Remove a saved idea
   */
  app.delete(
    '/:id/save',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const success = await unsaveIdea(request.userId!, id);

      return reply.send({
        success,
        message: success ? 'Idea removed from saved' : 'Was not saved',
      });
    }
  );
};

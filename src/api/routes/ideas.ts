/**
 * Ideas Routes for ZeroToShip API
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
import { createTierGate } from '../middleware/tierGate';
import {
  listIdeas,
  unsaveIdea,
  getCategories,
  getTodaysIdeasForTier,
  getArchivedIdeasForTier,
  getIdeaById,
  getIdeaByIdForTier,
  saveIdeaForUser,
} from '../services/ideas';
import {
  IdeaBriefSchema,
  IdeaListResponseSchema,
  IdeaSummarySchema,
  ArchiveQuerySchema,
  PaginationQuerySchema,
  PaginatedIdeasResponseSchema,
} from '../schemas';

export const ideasRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/ideas
   * List all published ideas with limit/offset pagination
   */
  app.get(
    '/',
    {
      preHandler: [optionalAuth, rateLimitMiddleware],
      schema: {
        querystring: PaginationQuerySchema,
        response: {
          200: PaginatedIdeasResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { limit, offset } = request.query;
      const { data, total } = await listIdeas({ limit, offset });

      return reply.send({
        data,
        total,
        limit,
        offset,
      });
    }
  );

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
      const { ideas, total } = await getTodaysIdeasForTier(request.userTier);

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
      const { ideas, total, hasMore } = await getArchivedIdeasForTier(query, request.userTier);

      return reply.send({
        ideas,
        total,
        page: Number(query.page) || 1,
        pageSize: Number(query.pageSize) || 10,
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
          200: IdeaBriefSchema,
          404: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Fetch the full idea directly from DB (not the tier-filtered summary)
      const idea = await getIdeaById(id);

      if (!idea) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Idea not found',
        });
      }

      return reply.send(idea);
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
      const result = await saveIdeaForUser(request.userId!, id);

      if (!result) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Idea not found',
        });
      }

      return reply.send(result);
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

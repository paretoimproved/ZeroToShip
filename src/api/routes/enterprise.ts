/**
 * Enterprise Routes for IdeaForge API
 *
 * Endpoints (all require Enterprise tier):
 * - GET /api/v1/ideas/search - Full-text search across all ideas
 * - POST /api/v1/validate - Request deep validation for an idea
 * - GET /api/v1/export - Export ideas as JSON/CSV
 */

import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireEnterprise } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { createTierGate } from '../middleware/tierGate';
import {
  checkValidationLimit,
  trackValidationRequest,
} from '../middleware/usageLimit';
import {
  searchIdeas,
  exportIdeas,
  ideasToCsv,
  createValidationRequest,
  getValidationStatus,
} from '../services/ideas';
import {
  IdeaSummarySchema,
  SearchQuerySchema,
  ExportQuerySchema,
  ValidationRequestSchema,
} from '../schemas';

export const enterpriseRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/ideas/search
   * Full-text search across all ideas (Enterprise only)
   */
  app.get(
    '/ideas/search',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware, createTierGate('ideas.search')],
      schema: {
        querystring: SearchQuerySchema,
        response: {
          200: z.object({
            ideas: z.array(IdeaSummarySchema),
            total: z.number(),
            page: z.number(),
            pageSize: z.number(),
            hasMore: z.boolean(),
            query: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const query = request.query;
      const { ideas, total } = await searchIdeas(query);

      const page = Number(query.page) || 1;
      const pageSize = Number(query.pageSize) || 10;
      const hasMore = page * pageSize < total;

      // Enterprise users get full briefs
      const ideasWithBriefs = ideas.map((idea) => ({
        id: idea.id,
        name: idea.name,
        tagline: idea.tagline,
        priorityScore: idea.priorityScore,
        effortEstimate: idea.effortEstimate,
        category: idea.category,
        generatedAt: idea.generatedAt,
        brief: idea, // Full brief for enterprise
      }));

      return reply.send({
        ideas: ideasWithBriefs,
        total,
        page,
        pageSize,
        hasMore,
        query: String(query.q),
      });
    }
  );

  /**
   * POST /api/v1/validate
   * Request deep validation for an idea (Enterprise only)
   * Subject to daily usage limits (see TIER_USAGE_LIMITS)
   */
  app.post(
    '/validate',
    {
      preHandler: [
        requireEnterprise,
        rateLimitMiddleware,
        createTierGate('validate'),
        checkValidationLimit,
      ],
      onResponse: [trackValidationRequest],
      schema: {
        body: ValidationRequestSchema,
        response: {
          201: z.object({
            requestId: z.string().uuid(),
            ideaId: z.string().uuid(),
            status: z.string(),
            message: z.string(),
            estimatedCompletionTime: z.string(),
          }),
          400: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { ideaId, depth } = request.body;

      const result = await createValidationRequest(request.userId!, ideaId, depth);

      if (!result) {
        return reply.status(400).send({
          code: 'VALIDATION_FAILED',
          message: 'Failed to create validation request',
        });
      }

      // Estimate based on depth
      const estimatedMinutes = depth === 'deep' ? 30 : 5;

      return reply.status(201).send({
        requestId: result.id,
        ideaId,
        status: 'pending',
        message: `Validation request submitted. We'll analyze this idea using ${depth} validation.`,
        estimatedCompletionTime: `${estimatedMinutes} minutes`,
      });
    }
  );

  /**
   * GET /api/v1/validate/:id
   * Get validation request status (Enterprise only)
   */
  app.get(
    '/validate/:id',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware],
      schema: {
        params: z.object({
          id: z.string().uuid(),
        }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            status: z.string(),
            result: z.unknown().nullable(),
            completedAt: z.string().nullable(),
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
      const status = await getValidationStatus(id);

      if (!status) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Validation request not found',
        });
      }

      return reply.send({
        id: status.id,
        status: status.status,
        result: status.result,
        completedAt: status.completedAt?.toISOString() || null,
      });
    }
  );

  /**
   * GET /api/v1/export
   * Export ideas as JSON or CSV (Enterprise only)
   */
  app.get(
    '/export',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware, createTierGate('ideas.export')],
      schema: {
        querystring: ExportQuerySchema,
      },
    },
    async (request, reply) => {
      const query = request.query;
      const ideas = await exportIdeas(query);

      if (query.format === 'csv') {
        const csv = ideasToCsv(ideas);
        return reply
          .header('Content-Type', 'text/csv')
          .header(
            'Content-Disposition',
            `attachment; filename="ideaforge-export-${new Date().toISOString().split('T')[0]}.csv"`
          )
          .send(csv);
      }

      // JSON format (default)
      return reply
        .header('Content-Type', 'application/json')
        .header(
          'Content-Disposition',
          `attachment; filename="ideaforge-export-${new Date().toISOString().split('T')[0]}.json"`
        )
        .send({
          exportedAt: new Date().toISOString(),
          count: ideas.length,
          ideas,
        });
    }
  );

  /**
   * GET /api/v1/stats
   * Get API usage stats (Enterprise only)
   */
  app.get(
    '/stats',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware],
      schema: {
        response: {
          200: z.object({
            tier: z.string(),
            rateLimit: z.object({
              limit: z.number(),
              remaining: z.number(),
              resetAt: z.string(),
            }),
            usage: z.object({
              ideasViewed: z.number(),
              searchQueries: z.number(),
              validationRequests: z.number(),
              exports: z.number(),
            }),
          }),
        },
      },
    },
    async (request, reply) => {
      // Get rate limit info from headers (already set by middleware)
      const limit = parseInt(reply.getHeader('X-RateLimit-Limit') as string) || 10000;
      const remaining = parseInt(reply.getHeader('X-RateLimit-Remaining') as string) || 10000;
      const resetAt = (reply.getHeader('X-RateLimit-Reset') as string) || new Date().toISOString();

      // TODO: Implement actual usage tracking
      return reply.send({
        tier: request.userTier,
        rateLimit: {
          limit,
          remaining,
          resetAt,
        },
        usage: {
          ideasViewed: 0, // Would query from analytics
          searchQueries: 0,
          validationRequests: 0,
          exports: 0,
        },
      });
    }
  );
};

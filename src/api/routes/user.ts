/**
 * User Routes for IdeaForge API
 *
 * Endpoints:
 * - GET /api/v1/user/preferences - Get user preferences
 * - PUT /api/v1/user/preferences - Update user preferences
 * - GET /api/v1/user/subscription - Get subscription status
 * - GET /api/v1/user/history - Get viewed/saved ideas
 * - GET /api/v1/user/api-keys - List API keys (Enterprise)
 * - POST /api/v1/user/api-keys - Create API key (Enterprise)
 * - DELETE /api/v1/user/api-keys/:id - Delete API key (Enterprise)
 */

import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth, requireEnterprise } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import {
  getUserPreferences,
  updateUserPreferences,
  getUserSubscription,
  getUserHistory,
  getUserApiKeys,
  createApiKey,
  deleteApiKey,
  deactivateApiKey,
} from '../services/users';
import { getUsageStatus } from '../services/usage';
import type { UserTier } from '../config/tiers';
import {
  UserPreferencesSchema,
  UpdatePreferencesRequestSchema,
  SubscriptionResponseSchema,
  UserHistoryResponseSchema,
} from '../schemas';

export const userRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /api/v1/user/preferences
   * Get current user preferences
   */
  app.get(
    '/preferences',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        response: {
          200: UserPreferencesSchema,
          404: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const preferences = await getUserPreferences(request.userId!);

      if (!preferences) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Preferences not found',
        });
      }

      return reply.send(preferences);
    }
  );

  /**
   * PUT /api/v1/user/preferences
   * Update user preferences
   */
  app.put(
    '/preferences',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        body: UpdatePreferencesRequestSchema,
        response: {
          200: UserPreferencesSchema,
          400: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const updates = request.body;
      const preferences = await updateUserPreferences(request.userId!, updates);

      if (!preferences) {
        return reply.status(400).send({
          code: 'UPDATE_FAILED',
          message: 'Failed to update preferences',
        });
      }

      return reply.send(preferences);
    }
  );

  /**
   * GET /api/v1/user/subscription
   * Get current subscription status
   */
  app.get(
    '/subscription',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        response: {
          200: SubscriptionResponseSchema,
          404: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const subscription = await getUserSubscription(request.userId!);

      if (!subscription) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'Subscription not found',
        });
      }

      return reply.send(subscription);
    }
  );

  /**
   * GET /api/v1/user/history
   * Get user's viewed and saved ideas
   */
  app.get(
    '/history',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        response: {
          200: UserHistoryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const history = await getUserHistory(request.userId!);
      return reply.send(history);
    }
  );

  /**
   * GET /api/v1/user/usage
   * Get current usage status for AI generation features
   */
  app.get(
    '/usage',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        response: {
          200: z.object({
            freshBriefsUsed: z.number(),
            freshBriefsLimit: z.number(),
            freshBriefsRemaining: z.number(),
            validationRequestsUsed: z.number(),
            validationRequestsLimit: z.number(),
            validationRequestsRemaining: z.number(),
            overageBriefs: z.number(),
            overageAmountCents: z.number(),
            canRequestFreshBrief: z.boolean(),
            canRequestValidation: z.boolean(),
            wouldIncurOverage: z.boolean(),
            resetAt: z.string(),
            tier: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const tier = request.userTier as UserTier;
      const status = await getUsageStatus(request.userId!, tier);
      return reply.send({
        ...status,
        tier,
      });
    }
  );

  /**
   * GET /api/v1/user/api-keys
   * List user's API keys (Enterprise only)
   */
  app.get(
    '/api-keys',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware],
      schema: {
        response: {
          200: z.object({
            keys: z.array(
              z.object({
                id: z.string().uuid(),
                name: z.string(),
                lastUsedAt: z.string().nullable(),
                expiresAt: z.string().nullable(),
                isActive: z.boolean(),
                createdAt: z.string(),
              })
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const keys = await getUserApiKeys(request.userId!);

      return reply.send({
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          lastUsedAt: k.lastUsedAt?.toISOString() || null,
          expiresAt: k.expiresAt?.toISOString() || null,
          isActive: k.isActive,
          createdAt: k.createdAt.toISOString(),
        })),
      });
    }
  );

  /**
   * POST /api/v1/user/api-keys
   * Create a new API key (Enterprise only)
   */
  app.post(
    '/api-keys',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware],
      schema: {
        body: z.object({
          name: z.string().min(1).max(100),
          expiresInDays: z.number().int().min(1).max(365).optional(),
        }),
        response: {
          201: z.object({
            id: z.string().uuid(),
            key: z.string(),
            name: z.string(),
            message: z.string(),
          }),
          400: z.object({
            code: z.string(),
            message: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { name, expiresInDays } = request.body;
      const result = await createApiKey(request.userId!, name, expiresInDays);

      if (!result) {
        return reply.status(400).send({
          code: 'CREATE_FAILED',
          message: 'Failed to create API key',
        });
      }

      return reply.status(201).send({
        ...result,
        name,
        message: 'API key created. Store it securely - it will not be shown again.',
      });
    }
  );

  /**
   * DELETE /api/v1/user/api-keys/:id
   * Delete an API key (Enterprise only)
   */
  app.delete(
    '/api-keys/:id',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware],
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
      const success = await deleteApiKey(request.userId!, id);

      if (!success) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      return reply.send({
        success: true,
        message: 'API key deleted',
      });
    }
  );

  /**
   * POST /api/v1/user/api-keys/:id/deactivate
   * Deactivate an API key without deleting (Enterprise only)
   */
  app.post(
    '/api-keys/:id/deactivate',
    {
      preHandler: [requireEnterprise, rateLimitMiddleware],
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
      const success = await deactivateApiKey(request.userId!, id);

      if (!success) {
        return reply.status(404).send({
          code: 'NOT_FOUND',
          message: 'API key not found',
        });
      }

      return reply.send({
        success: true,
        message: 'API key deactivated',
      });
    }
  );
};

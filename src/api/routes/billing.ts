/**
 * Billing Routes for ZeroToShip API
 *
 * Endpoints:
 * - POST /api/v1/billing/checkout - Create checkout session
 * - POST /api/v1/billing/portal - Create billing portal session
 * - GET /api/v1/billing/prices - Get available prices
 */

import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import {
  initiateCheckout,
  initiateBillingPortal,
  getAvailablePricesWithFallback,
} from '../services/billing';

const CheckoutRequestSchema = z.object({
  priceKey: z.enum(['pro_monthly', 'pro_yearly', 'enterprise_monthly', 'enterprise_yearly']),
});

const CheckoutResponseSchema = z.object({
  url: z.string().url(),
  sessionId: z.string(),
});

const PortalResponseSchema = z.object({
  url: z.string().url(),
});

const PriceSchema = z.object({
  key: z.string(),
  priceId: z.string(),
  amount: z.number(),
  currency: z.string(),
  interval: z.string(),
  tier: z.enum(['pro', 'enterprise']),
});

const PricesResponseSchema = z.object({
  prices: z.array(PriceSchema),
});

const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /api/v1/billing/checkout
   * Create a Stripe checkout session for subscription
   */
  app.post(
    '/checkout',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        body: CheckoutRequestSchema,
        response: {
          200: CheckoutResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { priceKey } = request.body;
      const result = await initiateCheckout(request.userId!, priceKey);

      if ('error' in result) {
        return reply.status(result.error.status).send({
          code: result.error.code,
          message: result.error.message,
        });
      }

      return reply.send(result);
    }
  );

  /**
   * POST /api/v1/billing/portal
   * Create a Stripe billing portal session
   */
  app.post(
    '/portal',
    {
      preHandler: [requireAuth, rateLimitMiddleware],
      schema: {
        response: {
          200: PortalResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await initiateBillingPortal(request.userId!);

      if ('error' in result) {
        return reply.status(result.error.status).send({
          code: result.error.code,
          message: result.error.message,
        });
      }

      return reply.send(result);
    }
  );

  /**
   * GET /api/v1/billing/prices
   * Get available subscription prices
   */
  app.get(
    '/prices',
    {
      schema: {
        response: {
          200: PricesResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const prices = await getAvailablePricesWithFallback();
      return reply.send({ prices });
    }
  );
};

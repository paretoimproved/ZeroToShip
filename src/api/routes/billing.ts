/**
 * Billing Routes for IdeaForge API
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
  createCheckoutSession,
  createBillingPortalSession,
  getAvailablePrices,
} from '../services/billing';
import { getUserById } from '../services/users';
import { STRIPE_PRICES, StripePriceKey, PRICE_INFO } from '../config/stripe';

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

      // Get user email
      const user = await getUserById(request.userId!);
      if (!user) {
        return reply.status(404).send({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      // Validate price key exists
      const priceId = STRIPE_PRICES[priceKey as StripePriceKey];
      if (!priceId) {
        return reply.status(400).send({
          code: 'INVALID_PRICE',
          message: `Price key "${priceKey}" is not configured`,
        });
      }

      try {
        const result = await createCheckoutSession(
          request.userId!,
          user.email,
          priceKey as StripePriceKey
        );

        return reply.send(result);
      } catch (error) {
        console.error('Checkout session error:', error);
        return reply.status(400).send({
          code: 'CHECKOUT_FAILED',
          message: 'Failed to create checkout session',
        });
      }
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
      // Get user email
      const user = await getUserById(request.userId!);
      if (!user) {
        return reply.status(404).send({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      try {
        const result = await createBillingPortalSession(request.userId!, user.email);
        return reply.send(result);
      } catch (error) {
        console.error('Portal session error:', error);
        return reply.status(400).send({
          code: 'PORTAL_FAILED',
          message: 'Failed to create billing portal session',
        });
      }
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
      try {
        const prices = await getAvailablePrices();
        return reply.send({ prices });
      } catch (error) {
        console.error('Get prices error:', error);
        // Return static price info as fallback
        const fallbackPrices = Object.entries(PRICE_INFO).map(([key, info]) => ({
          key,
          priceId: STRIPE_PRICES[key as StripePriceKey] || '',
          amount: info.amount,
          currency: 'usd',
          interval: info.interval,
          tier: info.tier,
        }));
        return reply.send({ prices: fallbackPrices });
      }
    }
  );
};

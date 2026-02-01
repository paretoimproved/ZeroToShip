/**
 * Webhook Routes for IdeaForge API
 *
 * Endpoints:
 * - POST /api/webhooks/stripe - Handle Stripe webhook events
 */

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { constructWebhookEvent, handleWebhookEvent } from '../services/billing';

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Register raw body parser for webhook signature verification
  // This needs to parse the body as a buffer, not JSON
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  /**
   * POST /api/webhooks/stripe
   * Handle Stripe webhook events
   *
   * Events handled:
   * - checkout.session.completed → Create/upgrade subscription
   * - customer.subscription.updated → Sync tier changes
   * - customer.subscription.deleted → Downgrade to free
   * - invoice.payment_failed → Handle failed payment
   */
  fastify.post(
    '/stripe',
    {
      // No auth required - webhooks come from Stripe
      // Signature verification happens in the handler
    },
    async (request: FastifyRequest<{ Body: Buffer }>, reply) => {
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        return reply.status(400).send({
          code: 'MISSING_SIGNATURE',
          message: 'Missing stripe-signature header',
        });
      }

      try {
        // Verify signature and construct event
        const event = constructWebhookEvent(request.body, signature);

        // Process the event
        await handleWebhookEvent(event);

        // Return success - Stripe expects 200 for acknowledged events
        return reply.send({ received: true });
      } catch (error) {
        console.error('Webhook error:', error);

        if (error instanceof Error && error.message.includes('signature')) {
          return reply.status(400).send({
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature',
          });
        }

        return reply.status(400).send({
          code: 'WEBHOOK_ERROR',
          message: 'Webhook processing failed',
        });
      }
    }
  );
};

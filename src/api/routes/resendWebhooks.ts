/**
 * Resend Webhook Routes
 *
 * Handles webhook events from Resend for email delivery tracking.
 * Uses Svix for signature verification.
 */

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { Webhook } from 'svix';
import { config } from '../../config/env';
import { handleResendWebhookEvent, type ResendWebhookEvent } from '../services/resendWebhook';

export const resendWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Register raw body parser for webhook signature verification
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  fastify.post(
    '/',
    async (request: FastifyRequest<{ Body: Buffer }>, reply) => {
      const svixId = request.headers['svix-id'] as string;
      const svixTimestamp = request.headers['svix-timestamp'] as string;
      const svixSignature = request.headers['svix-signature'] as string;

      if (!svixId || !svixTimestamp || !svixSignature) {
        return reply.status(400).send({
          code: 'MISSING_SIGNATURE',
          message: 'Missing webhook signature headers',
        });
      }

      const secret = config.RESEND_WEBHOOK_SECRET;
      if (!secret) {
        request.log.error('RESEND_WEBHOOK_SECRET not configured');
        return reply.status(500).send({
          code: 'CONFIG_ERROR',
          message: 'Webhook secret not configured',
        });
      }

      try {
        const wh = new Webhook(secret);
        const payload = wh.verify(request.body.toString(), {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        }) as ResendWebhookEvent;

        await handleResendWebhookEvent(payload);

        return reply.send({ received: true });
      } catch (error) {
        if (error instanceof Error && (error.message.includes('signature') || error.message.includes('verification'))) {
          return reply.status(400).send({
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature',
          });
        }

        request.log.error({ error }, 'Webhook processing failed');
        return reply.status(400).send({
          code: 'WEBHOOK_ERROR',
          message: 'Webhook processing failed',
        });
      }
    }
  );
};

/**
 * Resend Webhook Event Handler
 *
 * Processes webhook events from Resend (via Svix) to track
 * email delivery status and engagement.
 */

import { db, emailLogs } from '../db/client';
import { eq } from 'drizzle-orm';
import pino from 'pino';

const logger = pino({ name: 'resend-webhook' });

export interface ResendWebhookEvent {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
  };
}

export async function handleResendWebhookEvent(event: ResendWebhookEvent): Promise<void> {
  const messageId = event.data.email_id;

  if (!messageId) {
    logger.warn({ eventType: event.type }, 'Webhook event missing email_id');
    return;
  }

  switch (event.type) {
    case 'email.delivered':
      await db
        .update(emailLogs)
        .set({ status: 'delivered', deliveredAt: new Date() })
        .where(eq(emailLogs.messageId, messageId));
      logger.info({ messageId }, 'Email delivered');
      break;

    case 'email.opened':
      await db
        .update(emailLogs)
        .set({ openedAt: new Date() })
        .where(eq(emailLogs.messageId, messageId));
      logger.info({ messageId }, 'Email opened');
      break;

    case 'email.bounced':
      await db
        .update(emailLogs)
        .set({ status: 'bounced' })
        .where(eq(emailLogs.messageId, messageId));
      logger.warn({ messageId }, 'Email bounced');
      break;

    case 'email.complained':
      await db
        .update(emailLogs)
        .set({ status: 'complained' })
        .where(eq(emailLogs.messageId, messageId));
      logger.warn({ messageId }, 'Email complaint received');
      break;

    default:
      logger.debug({ eventType: event.type, messageId }, 'Unhandled webhook event type');
  }
}

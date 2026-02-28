/**
 * Billing Service for ZeroToShip API
 *
 * Handles Stripe checkout, portal, and subscription management
 */

import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db, subscriptions, users, webhookEvents } from '../db/client';
import logger from '../../lib/logger';
import { config } from '../../config/env';
import { sendEmail } from '../../lib/resend';
import {
  stripe,
  STRIPE_PRICES,
  PRICE_INFO,
  StripePriceKey,
  getTierFromPriceId,
  CHECKOUT_SUCCESS_URL,
  CHECKOUT_CANCEL_URL,
  BILLING_PORTAL_RETURN_URL,
  STRIPE_WEBHOOK_SECRET,
} from '../config/stripe';
import { updateSubscription, getUserById } from './users';
import type { UserTier } from '../schemas';

const PLAN_NAMES: Record<'pro' | 'enterprise', string> = {
  pro: 'Pro',
  enterprise: 'Enterprise',
};

function formatUsdAmount(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function getPriceDescription(priceId?: string): string | null {
  if (!priceId) return null;

  const matchedKey = (Object.entries(STRIPE_PRICES).find(
    ([, id]) => id === priceId
  )?.[0] ?? null) as StripePriceKey | null;

  if (!matchedKey) return null;
  const info = PRICE_INFO[matchedKey];
  if (!info) return null;

  return `${formatUsdAmount(info.amount)}/${info.interval}`;
}

async function sendSubscriptionConfirmationEmail(params: {
  userId: string;
  email?: string | null;
  name?: string | null;
  tier: 'pro' | 'enterprise';
  priceId?: string;
  currentPeriodEnd?: Date;
}): Promise<void> {
  if (config.isTest) return;
  if (!config.RESEND_API_KEY) return;
  if (!params.email) {
    logger.warn({ userId: params.userId }, 'Skipping subscription confirmation email: no recipient email');
    return;
  }

  const planName = PLAN_NAMES[params.tier];
  const priceDescription = getPriceDescription(params.priceId);
  const renewalDate = params.currentPeriodEnd
    ? params.currentPeriodEnd.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;
  const subject = `Your ZeroToShip ${planName} subscription is active`;

  const greeting = params.name ? `Hi ${params.name},` : 'Hi there,';
  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; max-width: 640px; margin: 0 auto;">
  <h1 style="margin: 0 0 12px; font-size: 24px;">Welcome to ${planName}</h1>
  <p style="margin: 0 0 14px;">${greeting}</p>
  <p style="margin: 0 0 14px;">Your subscription is now active.</p>
  <ul style="margin: 0 0 16px; padding-left: 20px;">
    ${priceDescription ? `<li><strong>Plan:</strong> ${planName} (${priceDescription})</li>` : `<li><strong>Plan:</strong> ${planName}</li>`}
    ${renewalDate ? `<li><strong>Renews on:</strong> ${renewalDate}</li>` : ''}
  </ul>
  <p style="margin: 0 0 16px;">Manage billing any time from your account:</p>
  <p style="margin: 0 0 24px;"><a href="${BILLING_PORTAL_RETURN_URL}" style="color: #2563eb;">${BILLING_PORTAL_RETURN_URL}</a></p>
  <p style="margin: 0;">Thanks for subscribing.</p>
  <p style="margin: 12px 0 0;">- ZeroToShip</p>
</div>`;

  const textLines = [
    greeting,
    '',
    `Your ZeroToShip ${planName} subscription is now active.`,
    priceDescription ? `Plan: ${planName} (${priceDescription})` : `Plan: ${planName}`,
    renewalDate ? `Renews on: ${renewalDate}` : null,
    '',
    `Manage billing: ${BILLING_PORTAL_RETURN_URL}`,
    '',
    'Thanks for subscribing.',
    '- ZeroToShip',
  ].filter(Boolean);
  const text = textLines.join('\n');

  const result = await sendEmail({ to: params.email, subject, html, text });

  if (result.success) {
    logger.info(
      {
        userId: params.userId,
        tier: params.tier,
        recipient: params.email,
        messageId: result.messageId,
      },
      'Subscription confirmation email sent'
    );
  } else {
    logger.error(
      {
        userId: params.userId,
        tier: params.tier,
        statusCode: result.statusCode,
        error: result.error,
      },
      'Failed to send subscription confirmation email'
    );
  }
}

/**
 * Get or create a Stripe customer for a user
 */
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const subRows = await db
    .select({ stripeCustomerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  if (subRows.length > 0 && subRows[0].stripeCustomerId) {
    return subRows[0].stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
    },
  });

  // Save customer ID to database
  await db
    .update(subscriptions)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(subscriptions.userId, userId));

  return customer.id;
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  email: string,
  priceKey: StripePriceKey
): Promise<{ url: string; sessionId: string }> {
  const priceId = STRIPE_PRICES[priceKey];

  if (!priceId) {
    throw new Error(`Invalid price key: ${priceKey}`);
  }

  // Get or create Stripe customer
  const customerId = await getOrCreateStripeCustomer(userId, email);

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: CHECKOUT_SUCCESS_URL,
    cancel_url: CHECKOUT_CANCEL_URL,
    metadata: {
      userId,
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
    allow_promotion_codes: true,
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Create a Stripe billing portal session
 */
export async function createBillingPortalSession(
  userId: string,
  email: string
): Promise<{ url: string }> {
  // Get Stripe customer ID
  const customerId = await getOrCreateStripeCustomer(userId, email);

  // Create portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: BILLING_PORTAL_RETURN_URL,
  });

  return { url: session.url };
}

/**
 * Get subscription details from Stripe
 */
export async function getStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return stripe.subscriptions.retrieve(subscriptionId);
}

/**
 * Handle checkout.session.completed webhook event
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const userId = session.metadata?.userId;
  if (!userId) {
    logger.error({ sessionId: session.id }, 'No userId in checkout session metadata');
    return;
  }

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    logger.error({ sessionId: session.id }, 'No subscription in checkout session');
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? getTierFromPriceId(priceId) : null;

  if (!tier) {
    logger.error({ sessionId: session.id, priceId }, 'Could not determine tier from price ID');
    return;
  }

  // Update subscription in database
  const periodStart = (subscription as unknown as { current_period_start: number }).current_period_start;
  const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

  await updateSubscription(userId, {
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: subscriptionId,
    plan: tier,
    status: subscription.status === 'active' ? 'active' : 'past_due',
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  const user = await getUserById(userId);
  const fallbackEmail = session.customer_details?.email ?? null;
  const periodEndDate = new Date(periodEnd * 1000);
  await sendSubscriptionConfirmationEmail({
    userId,
    email: user?.email ?? fallbackEmail,
    name: user?.name,
    tier,
    priceId,
    currentPeriodEnd: periodEndDate,
  });

  logger.info({ userId, tier }, 'Subscription created from checkout');
}

/**
 * Handle customer.subscription.updated webhook event
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Try to find user by Stripe customer ID
    const customerId = subscription.customer as string;
    const rows = await db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);

    if (rows.length === 0) {
      logger.error({ subscriptionId: subscription.id }, 'No user found for subscription');
      return;
    }

    await syncSubscription(rows[0].userId, subscription);
    return;
  }

  await syncSubscription(userId, subscription);
}

/**
 * Sync Stripe subscription to database
 */
async function syncSubscription(
  userId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? getTierFromPriceId(priceId) : 'free';

  // Map Stripe status to our status
  let status: 'active' | 'canceled' | 'past_due' = 'active';
  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    status = 'past_due';
  } else if (
    subscription.status === 'canceled' ||
    subscription.status === 'incomplete_expired'
  ) {
    status = 'canceled';
  }

  const periodStart = (subscription as unknown as { current_period_start: number }).current_period_start;
  const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

  await updateSubscription(userId, {
    stripeSubscriptionId: subscription.id,
    plan: tier || 'free',
    status,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  logger.info({ userId, tier, status }, 'Subscription synced');
}

/**
 * Handle customer.subscription.deleted webhook event
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const customerId = subscription.customer as string;

  // Find user by Stripe customer ID
  const rows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (rows.length === 0) {
    logger.error({ subscriptionId: subscription.id }, 'No user found for deleted subscription');
    return;
  }

  const userId = rows[0].userId;

  // Downgrade to free tier
  await updateSubscription(userId, {
    stripeSubscriptionId: undefined,
    plan: 'free',
    status: 'active',
    currentPeriodStart: undefined,
    currentPeriodEnd: undefined,
    cancelAtPeriodEnd: false,
  });

  logger.info({ userId }, 'Subscription deleted, downgraded to free');
}

/**
 * Handle invoice.payment_failed webhook event
 */
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as unknown as { subscription: string | null }).subscription;

  if (!subscriptionId) {
    return;
  }

  // Find user by Stripe customer ID
  const rows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);

  if (rows.length === 0) {
    logger.error({ customerId }, 'No user found for failed payment');
    return;
  }

  const userId = rows[0].userId;

  // Mark subscription as past_due
  await updateSubscription(userId, {
    status: 'past_due',
  });

  logger.warn({ userId }, 'Payment failed, marked past_due');
}

async function isEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const rows = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(eq(webhookEvents.stripeEventId, eventId))
    .limit(1);
  return rows.length > 0;
}

async function recordProcessedEvent(
  eventId: string,
  eventType: string,
  error?: string
): Promise<void> {
  await db.insert(webhookEvents).values({
    stripeEventId: eventId,
    eventType,
    status: error ? 'error' : 'processed',
    error: error ?? null,
  }).onConflictDoNothing();
}

/**
 * Process Stripe webhook event
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  if (await isEventAlreadyProcessed(event.id)) {
    logger.info({ eventId: event.id, eventType: event.type }, 'Webhook event already processed, skipping');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        logger.info({ eventId: event.id, eventType: event.type }, 'Unhandled webhook event type');
    }
    await recordProcessedEvent(event.id, event.type);
    logger.info({ eventId: event.id, eventType: event.type }, 'Webhook event processed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordProcessedEvent(event.id, event.type, msg);
    logger.error({ eventId: event.id, eventType: event.type, error: msg }, 'Webhook event processing failed');
    throw err;
  }
}

/**
 * Construct and verify Stripe webhook event
 */
export function constructWebhookEvent(
  payload: Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

/**
 * Get available prices for display
 */
export async function getAvailablePrices(): Promise<
  Array<{
    key: StripePriceKey;
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
    tier: 'pro' | 'enterprise';
  }>
> {
  const prices = [];

  for (const [key, priceId] of Object.entries(STRIPE_PRICES)) {
    if (!priceId) continue;

    try {
      const price = await stripe.prices.retrieve(priceId);
      const tier = getTierFromPriceId(priceId);

      if (tier && price.unit_amount && price.recurring) {
        prices.push({
          key: key as StripePriceKey,
          priceId,
          amount: price.unit_amount,
          currency: price.currency,
          interval: price.recurring.interval,
          tier,
        });
      }
    } catch (error) {
      logger.error({ priceId, error: error instanceof Error ? error.message : String(error) }, 'Failed to retrieve price');
    }
  }

  return prices;
}

/**
 * Get available prices with fallback to static price info on error.
 */
export async function getAvailablePricesWithFallback(): Promise<
  Array<{
    key: string;
    priceId: string;
    amount: number;
    currency: string;
    interval: string;
    tier: 'pro' | 'enterprise';
  }>
> {
  try {
    return await getAvailablePrices();
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Get prices error');
    return Object.entries(PRICE_INFO).map(([key, info]) => ({
      key,
      priceId: STRIPE_PRICES[key as StripePriceKey] || '',
      amount: info.amount,
      currency: 'usd',
      interval: info.interval,
      tier: info.tier,
    }));
  }
}

/**
 * Validate a checkout request and create a session.
 * Returns an error object if validation fails, or the checkout result on success.
 */
export async function initiateCheckout(
  userId: string,
  priceKey: string,
  userEmail?: string
): Promise<
  | { url: string; sessionId: string }
  | { error: { code: string; message: string; status: number } }
> {
  const user = await getUserById(userId);
  const email = user?.email ?? userEmail;

  if (!email) {
    return { error: { code: 'USER_NOT_FOUND', message: 'User not found', status: 404 } };
  }

  const priceId = STRIPE_PRICES[priceKey as StripePriceKey];
  if (!priceId) {
    return {
      error: {
        code: 'INVALID_PRICE',
        message: `Price key "${priceKey}" is not configured`,
        status: 400,
      },
    };
  }

  try {
    return await createCheckoutSession(userId, email, priceKey as StripePriceKey);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Checkout session error');
    return {
      error: {
        code: 'CHECKOUT_FAILED',
        message: 'Failed to create checkout session',
        status: 400,
      },
    };
  }
}

/**
 * Validate and create a billing portal session.
 * Returns an error object if the user is not found.
 */
export async function initiateBillingPortal(
  userId: string,
  userEmail?: string
): Promise<
  | { url: string }
  | { error: { code: string; message: string; status: number } }
> {
  const user = await getUserById(userId);
  const email = user?.email ?? userEmail;

  if (!email) {
    return { error: { code: 'USER_NOT_FOUND', message: 'User not found', status: 404 } };
  }

  try {
    return await createBillingPortalSession(userId, email);
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Portal session error');
    return {
      error: {
        code: 'PORTAL_FAILED',
        message: 'Failed to create billing portal session',
        status: 400,
      },
    };
  }
}

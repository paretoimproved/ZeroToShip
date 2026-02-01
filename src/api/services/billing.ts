/**
 * Billing Service for IdeaForge API
 *
 * Handles Stripe checkout, portal, and subscription management
 */

import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { db, subscriptions, users } from '../db/client';
import {
  stripe,
  STRIPE_PRICES,
  StripePriceKey,
  getTierFromPriceId,
  CHECKOUT_SUCCESS_URL,
  CHECKOUT_CANCEL_URL,
  BILLING_PORTAL_RETURN_URL,
  STRIPE_WEBHOOK_SECRET,
} from '../config/stripe';
import { updateSubscription, updateUserTier } from './users';
import type { UserTier } from '../schemas';

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
    console.error('No userId in checkout session metadata');
    return;
  }

  const subscriptionId = session.subscription as string;
  if (!subscriptionId) {
    console.error('No subscription in checkout session');
    return;
  }

  // Get subscription details from Stripe
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = subscription.items.data[0]?.price.id;
  const tier = priceId ? getTierFromPriceId(priceId) : null;

  if (!tier) {
    console.error('Could not determine tier from price ID:', priceId);
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

  console.log(`Subscription created for user ${userId}: ${tier}`);
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
      console.error('No user found for subscription:', subscription.id);
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

  console.log(`Subscription updated for user ${userId}: ${tier}, status: ${status}`);
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
    console.error('No user found for deleted subscription:', subscription.id);
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

  console.log(`Subscription deleted for user ${userId}, downgraded to free`);
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
    console.error('No user found for failed payment, customer:', customerId);
    return;
  }

  const userId = rows[0].userId;

  // Mark subscription as past_due
  await updateSubscription(userId, {
    status: 'past_due',
  });

  console.log(`Payment failed for user ${userId}, marked as past_due`);
}

/**
 * Process Stripe webhook event
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
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
      console.log(`Unhandled webhook event type: ${event.type}`);
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
      console.error(`Failed to retrieve price ${priceId}:`, error);
    }
  }

  return prices;
}

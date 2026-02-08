/**
 * Stripe Setup Script for ZeroToShip
 *
 * Creates products and prices in Stripe Dashboard.
 * Run this script once to set up your Stripe products.
 *
 * Usage:
 *   npx ts-node scripts/stripe-setup.ts
 *
 * Prerequisites:
 *   - STRIPE_SECRET_KEY environment variable must be set
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Error: STRIPE_SECRET_KEY environment variable is required');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

interface ProductConfig {
  name: string;
  description: string;
  prices: {
    nickname: string;
    unit_amount: number;
    interval: 'month' | 'year';
    envKey: string;
  }[];
}

const products: ProductConfig[] = [
  {
    name: 'ZeroToShip Pro',
    description: 'Access to all 10 daily ideas with full business briefs, unlimited archive, and priority support.',
    prices: [
      {
        nickname: 'Pro Monthly',
        unit_amount: 1900, // $19.00
        interval: 'month',
        envKey: 'STRIPE_PRICE_PRO_MONTHLY',
      },
      {
        nickname: 'Pro Yearly',
        unit_amount: 19000, // $190.00 (2 months free)
        interval: 'year',
        envKey: 'STRIPE_PRICE_PRO_YEARLY',
      },
    ],
  },
  {
    name: 'ZeroToShip Enterprise',
    description: 'Everything in Pro plus API access, custom categories, team sharing, and dedicated support.',
    prices: [
      {
        nickname: 'Enterprise Monthly',
        unit_amount: 9900, // $99.00
        interval: 'month',
        envKey: 'STRIPE_PRICE_ENT_MONTHLY',
      },
      {
        nickname: 'Enterprise Yearly',
        unit_amount: 99000, // $990.00 (2 months free)
        interval: 'year',
        envKey: 'STRIPE_PRICE_ENT_YEARLY',
      },
    ],
  },
];

async function createProducts(): Promise<void> {
  console.log('Setting up Stripe products and prices for ZeroToShip...\n');

  const envVars: Record<string, string> = {};

  for (const productConfig of products) {
    console.log(`Creating product: ${productConfig.name}`);

    // Check if product already exists
    const existingProducts = await stripe.products.search({
      query: `name:"${productConfig.name}"`,
    });

    let product: Stripe.Product;

    if (existingProducts.data.length > 0) {
      product = existingProducts.data[0];
      console.log(`  Product already exists: ${product.id}`);
    } else {
      product = await stripe.products.create({
        name: productConfig.name,
        description: productConfig.description,
      });
      console.log(`  Created product: ${product.id}`);
    }

    // Create prices
    for (const priceConfig of productConfig.prices) {
      console.log(`  Creating price: ${priceConfig.nickname}`);

      // Check if price already exists with this nickname
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      const existingPrice = existingPrices.data.find(
        (p) =>
          p.nickname === priceConfig.nickname &&
          p.recurring?.interval === priceConfig.interval
      );

      let price: Stripe.Price;

      if (existingPrice) {
        price = existingPrice;
        console.log(`    Price already exists: ${price.id}`);
      } else {
        price = await stripe.prices.create({
          product: product.id,
          nickname: priceConfig.nickname,
          unit_amount: priceConfig.unit_amount,
          currency: 'usd',
          recurring: {
            interval: priceConfig.interval,
          },
        });
        console.log(`    Created price: ${price.id}`);
      }

      envVars[priceConfig.envKey] = price.id;
    }

    console.log('');
  }

  // Output environment variables
  console.log('='.repeat(60));
  console.log('Add these to your .env file:');
  console.log('='.repeat(60));
  console.log('');

  for (const [key, value] of Object.entries(envVars)) {
    console.log(`${key}=${value}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('Stripe setup complete!');
  console.log('');
  console.log('Next steps:');
  console.log('1. Copy the environment variables above to your .env file');
  console.log('2. Create a webhook endpoint in Stripe Dashboard:');
  console.log('   - URL: https://your-domain.com/api/webhooks/stripe');
  console.log('   - Events: checkout.session.completed, customer.subscription.updated,');
  console.log('             customer.subscription.deleted, invoice.payment_failed');
  console.log('3. Add the webhook signing secret to your .env as STRIPE_WEBHOOK_SECRET');
  console.log('='.repeat(60));
}

async function main(): Promise<void> {
  try {
    await createProducts();
  } catch (error) {
    console.error('Error setting up Stripe:', error);
    process.exit(1);
  }
}

main();

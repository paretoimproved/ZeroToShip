/**
 * Test Email Delivery
 *
 * Sends a test email with the latest briefs from the database.
 * Usage: npx tsx scripts/test-email.ts
 */

import 'dotenv/config';
import postgres from 'postgres';
import { sendDailyBrief, createTestSubscriber } from '../src/delivery/email';
import type { IdeaBrief } from '../src/generation/brief-generator';

async function main() {
  const email = 'user@example.com';
  const sql = postgres(process.env.DATABASE_URL!, { ssl: false, prepare: false });

  console.log('Fetching latest briefs from database...');

  const rows = await sql`
    SELECT * FROM ideas
    WHERE is_published = true
    ORDER BY generated_at DESC
    LIMIT 5
  `;

  if (rows.length === 0) {
    console.error('No published briefs found in database.');
    await sql.end();
    process.exit(1);
  }

  console.log(`Found ${rows.length} briefs. Top: "${rows[0].name}" (score: ${rows[0].priority_score})`);

  // Safely parse JSONB fields that might be strings
  const parseJsonb = <T>(val: unknown, fallback: T): T => {
    if (val == null) return fallback;
    if (typeof val === 'string') {
      try { return JSON.parse(val) as T; } catch { return fallback; }
    }
    return val as T;
  };

  // Map DB rows to IdeaBrief shape
  const briefs: IdeaBrief[] = rows.map((row) => ({
    name: row.name,
    tagline: row.tagline || '',
    priorityScore: Number(row.priority_score) || 0,
    effortEstimate: row.effort_estimate || 'Unknown',
    revenueEstimate: row.revenue_estimate || 'Unknown',
    category: row.category || '',
    problemStatement: row.problem_statement || '',
    targetAudience: row.target_audience || '',
    marketSize: row.market_size || '',
    existingSolutions: parseJsonb<string[]>(row.existing_solutions, []),
    gaps: parseJsonb<string[]>(row.gaps, []),
    proposedSolution: row.proposed_solution || '',
    keyFeatures: parseJsonb<string[]>(row.key_features, []),
    mvpScope: row.mvp_scope || '',
    technicalSpec: row.technical_spec || '',
    businessModel: parseJsonb(row.business_model, { pricing: '', monetization: '' }),
    goToMarket: parseJsonb(row.go_to_market, { launchStrategy: '', firstCustomers: '' }),
    risks: parseJsonb<string[]>(row.risks, []),
    sources: parseJsonb<Array<{ platform: string; title: string; url: string; score: number; commentCount: number; postedAt: string }>>(row.sources, []),
    generatedAt: row.generated_at || new Date(),
  }));

  // Send both pro and free tier emails to compare
  const tiers = ['pro', 'free'] as const;

  for (const tier of tiers) {
    const subscriber = createTestSubscriber(email, tier);
    console.log(`Sending ${tier} tier test email to ${email}...`);

    const result = await sendDailyBrief(subscriber, briefs, {
      fromEmail: 'onboarding@resend.dev',
      fromName: 'ZeroToShip',
    });

    if (result.status === 'sent') {
      console.log(`  [${tier}] Sent! Message ID: ${result.messageId}`);
    } else {
      console.error(`  [${tier}] Failed: ${result.error}`);
    }
  }

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

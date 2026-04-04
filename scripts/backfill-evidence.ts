/**
 * Backfill Evidence Strength for Existing Briefs
 *
 * Computes evidence_strength, source_count, total_engagement, and platform_count
 * from the stored sources JSONB on each idea. Sets brief_type to 'full' for all
 * existing briefs.
 *
 * Usage:
 *   npx tsx scripts/backfill-evidence.ts          # dry-run (read-only)
 *   npx tsx scripts/backfill-evidence.ts --apply   # write changes to DB
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { db, ideas, closeDatabase } from '../src/api/db/client';
import { eq, isNotNull } from 'drizzle-orm';

/**
 * A single source entry as stored in the ideas.sources JSONB column.
 */
interface StoredSource {
  platform: string;
  title: string;
  url: string;
  score: number;
  commentCount: number;
  postedAt: string;
}

/**
 * Evidence tier classification: strong > moderate > weak.
 */
type EvidenceTier = 'strong' | 'moderate' | 'weak';

/**
 * Computed evidence metadata from stored sources.
 */
export interface EvidenceFromSources {
  tier: EvidenceTier;
  sourceCount: number;
  totalEngagement: number;
  platformCount: number;
}

/**
 * Compute evidence metadata from the stored sources array.
 *
 * Approximation rules (sources capped at 5 by extractSources):
 *   sourceCount     = sources.length (proxy for frequency)
 *   platformCount   = count of unique platform strings
 *   totalEngagement = sum of (score + commentCount) per source
 *
 * Tier thresholds (same as computeEvidenceStrength in scorer.ts,
 * using sourceCount in place of frequency):
 *   Strong:   platformCount >= 2 AND (totalEngagement >= 100 OR sourceCount >= 3)
 *   Moderate: sourceCount >= 2 OR totalEngagement >= 50 OR platformCount >= 2
 *   Weak:     everything else
 */
export function computeEvidenceFromSources(sources: StoredSource[]): EvidenceFromSources {
  const sourceCount = sources.length;
  const platforms = new Set(sources.map((s) => s.platform));
  const platformCount = platforms.size;
  const totalEngagement = sources.reduce((sum, s) => sum + s.score + s.commentCount, 0);

  let tier: EvidenceTier;

  if (platformCount >= 2 && (totalEngagement >= 100 || sourceCount >= 3)) {
    tier = 'strong';
  } else if (sourceCount >= 2 || totalEngagement >= 50 || platformCount >= 2) {
    tier = 'moderate';
  } else {
    tier = 'weak';
  }

  return { tier, sourceCount, totalEngagement, platformCount };
}

/**
 * Backfill result stats returned by backfillEvidence.
 */
export interface BackfillStats {
  total: number;
  strong: number;
  moderate: number;
  weak: number;
  skipped: number;
  updated: number;
}

/**
 * Run the backfill across all ideas with non-null sources.
 *
 * @param options.apply - If true, writes updates to the database. Otherwise dry-run.
 * @returns Stats summarising the backfill results.
 */
export async function backfillEvidence(options: { apply: boolean }): Promise<BackfillStats> {
  const { apply } = options;

  console.log(`\nBackfill Evidence Strength — ${apply ? 'APPLY MODE' : 'DRY RUN'}\n`);

  // Fetch all ideas that have sources populated
  const allIdeas = await db
    .select({
      id: ideas.id,
      name: ideas.name,
      sources: ideas.sources,
    })
    .from(ideas)
    .where(isNotNull(ideas.sources));

  const stats: BackfillStats = {
    total: allIdeas.length,
    strong: 0,
    moderate: 0,
    weak: 0,
    skipped: 0,
    updated: 0,
  };

  for (const idea of allIdeas) {
    const sources = idea.sources as StoredSource[] | null;

    // Skip ideas with null or empty sources
    if (!sources || sources.length === 0) {
      stats.skipped++;
      continue;
    }

    const evidence = computeEvidenceFromSources(sources);

    // Count tiers
    if (evidence.tier === 'strong') stats.strong++;
    else if (evidence.tier === 'moderate') stats.moderate++;
    else stats.weak++;

    console.log(
      `  [${evidence.tier.toUpperCase().padEnd(8)}] ${idea.name.substring(0, 50).padEnd(52)} ` +
      `src=${evidence.sourceCount} eng=${evidence.totalEngagement} plat=${evidence.platformCount}`
    );

    if (apply) {
      await db
        .update(ideas)
        .set({
          evidenceStrength: evidence.tier,
          briefType: 'full',
          sourceCount: evidence.sourceCount,
          totalEngagement: evidence.totalEngagement,
          platformCount: evidence.platformCount,
        })
        .where(eq(ideas.id, idea.id));

      stats.updated++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total ideas:  ${stats.total}`);
  console.log(`Strong:       ${stats.strong}`);
  console.log(`Moderate:     ${stats.moderate}`);
  console.log(`Weak:         ${stats.weak}`);
  console.log(`Skipped:      ${stats.skipped}`);

  if (apply) {
    console.log(`Updated:      ${stats.updated}`);
  } else {
    console.log('\nDRY RUN — no changes made. Use --apply to execute.');
  }

  return stats;
}

// --- CLI entry point ---

async function main() {
  const apply = process.argv.includes('--apply');

  try {
    await backfillEvidence({ apply });
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('\nBackfill failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

// Only run when executed directly (not when imported by tests)
const isDirectRun = require.main === module;
if (isDirectRun) {
  main();
}

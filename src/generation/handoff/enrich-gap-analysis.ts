import type { GapAnalysis } from '../../analysis/gap-analyzer';
import type { Competitor } from '../../analysis/competitor';
import type { BriefHandoffMeta, HandoffProvider } from '../brief-generator';
import type { GapEnrichmentPayload } from './contract';

function uniqueByUrl(items: Competitor[]): Competitor[] {
  const seen = new Set<string>();
  const out: Competitor[] = [];
  for (const c of items) {
    const key = (c.url || c.name).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of items) {
    const key = s.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s.trim());
  }
  return out;
}

export function mergeGapEnrichment(
  base: GapAnalysis,
  payload: GapEnrichmentPayload | undefined,
): { merged: GapAnalysis; meta: Pick<BriefHandoffMeta, 'addedCompetitors' | 'addedGaps' | 'addedDifferentiators'> } {
  const extraCompetitors = payload?.competitors ?? [];
  const extraGaps = payload?.gaps ?? [];
  const extraDiffs = payload?.differentiationAngles ?? [];

  const mergedCompetitors = uniqueByUrl([...base.existingSolutions, ...extraCompetitors]);
  const mergedGaps = uniqueStrings([...base.gaps, ...extraGaps]);
  const mergedDiffs = uniqueStrings([...base.differentiationAngles, ...extraDiffs]);

  const addedCompetitors = Math.max(0, mergedCompetitors.length - base.existingSolutions.length);
  const addedGaps = Math.max(0, mergedGaps.length - base.gaps.length);
  const addedDifferentiators = Math.max(0, mergedDiffs.length - base.differentiationAngles.length);

  const merged: GapAnalysis = {
    ...base,
    existingSolutions: mergedCompetitors,
    gaps: mergedGaps,
    differentiationAngles: mergedDiffs,
    analysisNotes: payload?.notes
      ? `${base.analysisNotes}\n\n[handoff] ${payload.notes}`.trim()
      : base.analysisNotes,
  };

  return {
    merged,
    meta: { addedCompetitors, addedGaps, addedDifferentiators },
  };
}

export function buildSkippedHandoffMeta(
  provider: HandoffProvider,
  reason: string,
): BriefHandoffMeta | undefined {
  if (provider === 'off') return undefined;
  return {
    provider,
    status: 'skipped',
    reason,
  };
}


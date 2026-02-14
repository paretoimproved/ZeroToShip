import type { Competitor } from '../../analysis/competitor';

export type HandoffType = 'gap_enrichment_v1';

export interface GapEnrichmentRequest {
  type: HandoffType;
  problemId: string;
  problemStatement: string;
  // Existing gap analyzer output (so the handoff can extend/validate it)
  existingSolutions: Competitor[];
  gaps: string[];
  differentiationAngles: string[];
}

export interface GapEnrichmentPayload {
  competitors?: Competitor[];
  gaps?: string[];
  differentiationAngles?: string[];
  notes?: string;
}

export interface GapEnrichmentResponse {
  ok: boolean;
  payload?: GapEnrichmentPayload;
  error?: string;
}

export function isGapEnrichmentResponse(value: unknown): value is GapEnrichmentResponse {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.ok === 'boolean';
}


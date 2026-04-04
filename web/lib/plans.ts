/**
 * Shared pricing plan data — single source of truth for both
 * the landing page pricing section and the dedicated pricing page.
 */

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface BasePlan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  annualTotal: number;
  annualSavingsPercent: number;
  description: string;
  features: PlanFeature[];
  cta: string;
  highlighted: boolean;
}

export const FREE_FEATURES: PlanFeature[] = [
  { text: "Full archive access — every brief, every section", included: true },
  { text: "Daily email with complete briefs", included: true },
  { text: "Search & filter all ideas", included: true },
  { text: "Save & bookmark ideas", included: true },
  { text: "1 agent-spec generation per month", included: true },
  { text: "Custom problem submission", included: false },
  { text: "Problem watching & re-analysis", included: false },
];

export const PRO_FEATURES: PlanFeature[] = [
  { text: "Everything in Free", included: true },
  { text: "30 agent-spec generations per month", included: true },
  { text: "Custom problem submission", included: true },
  { text: "Problem watching with weekly re-analysis", included: true },
  { text: "Bulk export (Markdown & JSON)", included: true },
  { text: "Priority support", included: true },
];

export const BASE_PLANS: BasePlan[] = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    annualTotal: 0,
    annualSavingsPercent: 0,
    description: "Full archive access — browse every problem",
    features: FREE_FEATURES,
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Pro",
    monthlyPrice: 19,
    annualPrice: 15.83,
    annualTotal: 190,
    annualSavingsPercent: 17,
    description: "30 agent specs/month + custom problems",
    features: PRO_FEATURES,
    cta: "Start 7-Day Free Trial",
    highlighted: true,
  },
];

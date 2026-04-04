import type { IdeaBrief } from "./types";

type IdeaSummaryResponse = IdeaBrief & { brief?: IdeaBrief };

/**
 * Normalizes various API response shapes into a flat IdeaBrief[].
 *
 * Handles:
 *  - raw array of IdeaBrief / IdeaSummaryResponse
 *  - { ideas: [...] }
 *  - { data: [...] }
 *  - nested `brief` field unwrapping on each item
 */
export function normalizeIdeas(data: unknown): IdeaBrief[] {
  const response = data as
    | IdeaSummaryResponse[]
    | { ideas?: IdeaSummaryResponse[]; data?: IdeaSummaryResponse[] };

  const rawItems: IdeaSummaryResponse[] = Array.isArray(response)
    ? response
    : response.ideas ?? response.data ?? [];

  return rawItems.map((d) => {
    const brief = d.brief || d;
    const tagline = d.tagline || brief.tagline || "";
    return {
      ...brief,
      id: d.id || brief.id,
      name: d.name || brief.name,
      tagline,
      priorityScore: d.priorityScore ?? brief.priorityScore,
      effortEstimate: d.effortEstimate || brief.effortEstimate || "week",
      revenueEstimate: brief.revenueEstimate || "",
      generatedAt: d.generatedAt || brief.generatedAt,
      // Defaults for detailed fields stripped by tier gating
      problemStatement: brief.problemStatement || tagline,
      targetAudience: brief.targetAudience || "",
      marketSize: brief.marketSize || "",
      existingSolutions: brief.existingSolutions || "",
      gaps: brief.gaps || "",
      proposedSolution: brief.proposedSolution || tagline,
      keyFeatures: brief.keyFeatures || [],
      mvpScope: brief.mvpScope || "",
      technicalSpec: brief.technicalSpec || { stack: [], architecture: "", estimatedEffort: "" },
      businessModel: brief.businessModel || { pricing: "", revenueProjection: "", monetizationPath: "" },
      goToMarket: brief.goToMarket || { launchStrategy: "", channels: [], firstCustomers: "" },
      risks: brief.risks || [],
      sources: brief.sources || [],
    };
  });
}

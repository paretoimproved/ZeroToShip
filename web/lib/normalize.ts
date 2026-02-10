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
    return {
      ...brief,
      id: d.id || brief.id,
      name: d.name || brief.name,
      tagline: d.tagline || brief.tagline,
      priorityScore: d.priorityScore ?? brief.priorityScore,
      effortEstimate: d.effortEstimate || brief.effortEstimate || "week",
      generatedAt: d.generatedAt || brief.generatedAt,
    };
  });
}

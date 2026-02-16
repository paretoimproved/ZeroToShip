/**
 * API client for ZeroToShip backend
 */

import type {
  IdeaBrief,
  User,
  UserPreferences,
  Subscription,
  PaginatedResponse,
  ApiError,
  EffortLevel,
  AdminStatsOverview,
  AdminUser,
  PipelineRunResponse,
  PipelineStatus,
  PipelineRunRow,
  EmailLogRow,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${this.token}`;
    }

    // Admin tier override from sessionStorage
    if (typeof window !== "undefined") {
      const tierOverride = sessionStorage.getItem("zerotoship_tier_override");
      if (tierOverride) {
        (headers as Record<string, string>)["X-Tier-Override"] = tierOverride;
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        code: "UNKNOWN_ERROR",
        message: response.statusText,
      }));
      throw new Error(error.message || "Request failed");
    }

    return response.json();
  }

  // Ideas endpoints
  async getTodayIdeas(): Promise<IdeaBrief[]> {
    return this.request<IdeaBrief[]>("/ideas/today");
  }

  async getIdea(id: string): Promise<IdeaBrief> {
    const res = await this.request<{ idea: IdeaBrief & { brief?: IdeaBrief } }>(`/ideas/${id}`);
    // Backend returns IdeaSummary for some tiers: { ...summary, brief?: IdeaBrief }
    // Unwrap so pages always get a flat IdeaBrief shape.
    const idea = (res as unknown as { idea: IdeaBrief & { brief?: IdeaBrief } }).idea;
    return idea.brief ?? idea;
  }

  async searchIdeas(params: {
    query?: string;
    effort?: EffortLevel[];
    minScore?: number;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedResponse<IdeaBrief>> {
    const searchParams = new URLSearchParams();
    if (params.query) searchParams.set("q", params.query);
    if (params.effort?.length) searchParams.set("effort", params.effort.join(","));
    if (params.minScore) searchParams.set("minScore", params.minScore.toString());
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());

    return this.request<PaginatedResponse<IdeaBrief>>(
      `/ideas/search?${searchParams.toString()}`
    );
  }

  async getArchive(params: {
    page?: number;
    pageSize?: number;
    from?: string;
    to?: string;
    effort?: EffortLevel;
    minScore?: number;
    sort?: string;
  }): Promise<PaginatedResponse<IdeaBrief>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params.from) searchParams.set("from", params.from);
    if (params.to) searchParams.set("to", params.to);
    if (params.effort) searchParams.set("effort", params.effort);
    if (params.minScore) searchParams.set("minScore", params.minScore.toString());
    if (params.sort) searchParams.set("sort", params.sort);

    return this.request<PaginatedResponse<IdeaBrief>>(
      `/ideas/archive?${searchParams.toString()}`
    );
  }

  // User endpoints
  async getCurrentUser(): Promise<User> {
    return this.request<User>("/auth/me");
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<User> {
    return this.request<User>("/user/preferences", {
      method: "PUT",
      body: JSON.stringify(preferences),
    });
  }

  // Subscription endpoints
  async getSubscription(): Promise<Subscription> {
    return this.request<Subscription>("/user/subscription");
  }

  // Billing endpoints
  async createCheckoutSession(
    priceKey: "pro_monthly" | "pro_yearly" | "enterprise_monthly" | "enterprise_yearly"
  ): Promise<{ url: string; sessionId: string }> {
    return this.request<{ url: string; sessionId: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ priceKey }),
    });
  }

  async createBillingPortalSession(): Promise<{ url: string }> {
    return this.request<{ url: string }>("/billing/portal", {
      method: "POST",
    });
  }

  async getBillingPrices(): Promise<{
    prices: Array<{
      key: string;
      priceId: string;
      amount: number;
      currency: string;
      interval: string;
      tier: "pro" | "enterprise";
    }>;
  }> {
    return this.request("/billing/prices");
  }

  // Admin endpoints
  async getAdminStats(): Promise<AdminStatsOverview> {
    return this.request<AdminStatsOverview>("/admin/stats/overview");
  }

  async getAdminUsers(): Promise<{ users: AdminUser[] }> {
    return this.request<{ users: AdminUser[] }>("/admin/users");
  }

  async getPipelineStatus(): Promise<PipelineStatus> {
    return this.request<PipelineStatus>("/admin/pipeline-status");
  }

  async getSystemHealth(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>("/admin/system-health");
  }

  async triggerPipeline(options?: {
    dryRun?: boolean;
    skipDelivery?: boolean;
    hoursBack?: number;
    maxBriefs?: number;
    generationMode?: "legacy" | "graph";
    scrapers?: { reddit?: boolean; hn?: boolean; github?: boolean };
    clusteringThreshold?: number;
    minPriorityScore?: number;
    minFrequencyForGap?: number;
    publishGateEnabled?: boolean;
    publishGateConfidenceThreshold?: number;
  }): Promise<PipelineRunResponse> {
    return this.request<PipelineRunResponse>("/admin/pipeline/run", {
      method: "POST",
      body: JSON.stringify(options || {}),
    });
  }

  async getRunHistory(params?: { page?: number; limit?: number; status?: string }): Promise<{
    runs: PipelineRunRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    const qs = searchParams.toString();
    return this.request(`/admin/runs${qs ? `?${qs}` : ''}`);
  }

  async getRunDetail(runId: string): Promise<{ run: PipelineRunRow }> {
    return this.request(`/admin/runs/${runId}`);
  }

  async approvePublishGate(runId: string, briefIds?: string[]): Promise<{
    status: string;
    publishedCount: number;
    delivered: unknown;
  }> {
    return this.request(`/admin/runs/${runId}/publish/approve`, {
      method: "POST",
      body: JSON.stringify(briefIds?.length ? { briefIds } : {}),
    });
  }

  async rejectPublishGate(runId: string, reason?: string): Promise<{ status: string }> {
    return this.request(`/admin/runs/${runId}/publish/reject`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    });
  }


  async getEmailLogs(params?: { page?: number; limit?: number; status?: string; runId?: string }): Promise<{
    logs: EmailLogRow[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.status) searchParams.set('status', params.status);
    if (params?.runId) searchParams.set('runId', params.runId);
    const qs = searchParams.toString();
    return this.request(`/admin/email-logs${qs ? `?${qs}` : ''}`);
  }

  // Saved ideas (bookmark) endpoints
  async saveIdea(ideaId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/ideas/${ideaId}/save`, {
      method: "POST",
    });
  }

  async unsaveIdea(ideaId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/ideas/${ideaId}/save`, {
      method: "DELETE",
    });
  }

  async getSavedIdeas(): Promise<IdeaBrief[]> {
    return this.request<IdeaBrief[]>("/ideas/saved");
  }
}

export const api = new ApiClient();
export default api;

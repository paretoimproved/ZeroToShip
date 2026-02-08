/**
 * API client for IdeaForge backend
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
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${this.token}`;
    }

    // Admin tier override from sessionStorage
    if (typeof window !== "undefined") {
      const tierOverride = sessionStorage.getItem("ideaforge_tier_override");
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
    return this.request<IdeaBrief>(`/ideas/${id}`);
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
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedResponse<IdeaBrief>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set("page", params.page.toString());
    if (params.pageSize) searchParams.set("pageSize", params.pageSize.toString());
    if (params.startDate) searchParams.set("startDate", params.startDate);
    if (params.endDate) searchParams.set("endDate", params.endDate);

    return this.request<PaginatedResponse<IdeaBrief>>(
      `/ideas/archive?${searchParams.toString()}`
    );
  }

  // User endpoints
  async getCurrentUser(): Promise<User> {
    return this.request<User>("/users/me");
  }

  async updatePreferences(preferences: Partial<UserPreferences>): Promise<User> {
    return this.request<User>("/users/me/preferences", {
      method: "PATCH",
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
  }): Promise<PipelineRunResponse> {
    return this.request<PipelineRunResponse>("/admin/pipeline/run", {
      method: "POST",
      body: JSON.stringify(options || {}),
    });
  }
}

export const api = new ApiClient();
export default api;

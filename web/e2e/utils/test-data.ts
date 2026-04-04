/**
 * Test data constants for ZeroToShip E2E tests
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
export const APP_URL = 'http://localhost:3000';

export type UserTier = 'anonymous' | 'free' | 'pro' | 'enterprise';

export interface TestUser {
  email: string | null;
  password: string | null;
  tier: UserTier;
}

export const TEST_USERS: Record<UserTier, TestUser> = {
  anonymous: { email: null, password: null, tier: 'anonymous' },
  free: { email: 'free@test.zerotoship.dev', password: 'testpass123', tier: 'free' },
  pro: { email: 'pro@test.zerotoship.dev', password: 'testpass123', tier: 'pro' },
  enterprise: { email: 'enterprise@test.zerotoship.dev', password: 'testpass123', tier: 'enterprise' },
};

export interface SeedIdea {
  name: string;
  score: number;
  effort: 'weekend' | 'week' | 'month' | 'quarter';
}

export const SEED_IDEAS: SeedIdea[] = [
  { name: 'CodeReview AI', score: 92.50, effort: 'month' },
  { name: 'MeetingMind', score: 88.75, effort: 'quarter' },
  { name: 'InvoiceGenie', score: 85.00, effort: 'week' },
  { name: 'DevOnboard', score: 79.25, effort: 'month' },
  { name: 'StatusPage Pro', score: 72.50, effort: 'weekend' },
  { name: 'SupplyChainRadar', score: 68.00, effort: 'quarter' },
];

export interface TierLimits {
  ideasVisible: number;
  rateLimit: number;
}

export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  anonymous: { ideasVisible: 3, rateLimit: 10 },
  free: { ideasVisible: 3, rateLimit: 100 },
  pro: { ideasVisible: 10, rateLimit: 1000 },
  enterprise: { ideasVisible: Infinity, rateLimit: 10000 },
};

/**
 * Storage state file paths for authenticated users
 */
export const AUTH_STATE_PATHS = {
  free: '.auth/free-user.json',
  pro: '.auth/pro-user.json',
  enterprise: '.auth/enterprise-user.json',
} as const;

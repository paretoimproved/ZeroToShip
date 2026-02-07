/**
 * Authentication Middleware for IdeaForge API
 *
 * Supports:
 * - JWT tokens (for web users via Supabase Auth)
 * - API keys (for Enterprise tier programmatic access)
 */

import { randomBytes } from 'crypto';
import { FastifyRequest, FastifyReply, FastifyPluginAsync } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import { eq } from 'drizzle-orm';
import { config } from '../../config/env';
import { db, users, apiKeys, subscriptions } from '../db/client';
import type { UserTier } from '../schemas';

// Supabase client for JWT verification
const supabaseUrl = config.SUPABASE_URL;
const supabaseServiceKey = config.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/**
 * Get user tier from subscription
 */
function getTierFromPlan(plan: string | null): UserTier {
  switch (plan) {
    case 'enterprise':
      return 'enterprise';
    case 'pro':
      return 'pro';
    case 'free':
      return 'free';
    default:
      return 'free';
  }
}

/**
 * Verify JWT token from Supabase Auth
 */
async function verifyJWT(
  token: string
): Promise<{ userId: string; email: string } | null> {
  if (!supabase) {
    console.warn('Supabase not configured - JWT verification disabled');
    return null;
  }

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return {
      userId: user.id,
      email: user.email || '',
    };
  } catch {
    return null;
  }
}

/**
 * Verify API key for Enterprise access
 */
async function verifyApiKey(
  key: string
): Promise<{ userId: string; keyId: string } | null> {
  try {
    const result = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.key, key))
      .limit(1);

    const apiKey = result[0];
    if (!apiKey || !apiKey.isActive) {
      return null;
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp (fire and forget)
    db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, apiKey.id))
      .execute()
      .catch(() => {});

    return {
      userId: apiKey.userId,
      keyId: apiKey.id,
    };
  } catch {
    return null;
  }
}

/**
 * Get user's subscription tier
 */
async function getUserTier(userId: string): Promise<UserTier> {
  try {
    const result = await db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const sub = result[0];
    if (!sub || sub.status !== 'active') {
      return 'free';
    }

    return getTierFromPlan(sub.plan);
  } catch {
    return 'free';
  }
}

/**
 * Optional authentication - sets user info if auth provided, otherwise continues as anonymous
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Default to anonymous
  request.userTier = 'anonymous';

  // Check for API key first (X-API-Key header)
  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    const keyData = await verifyApiKey(apiKey);
    if (keyData) {
      request.userId = keyData.userId;
      request.apiKeyId = keyData.keyId;
      // API key users are always enterprise tier
      request.userTier = 'enterprise';
      return;
    }
  }

  // Check for JWT token (Authorization: Bearer <token>)
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const userData = await verifyJWT(token);
    if (userData) {
      request.userId = userData.userId;
      request.userTier = await getUserTier(userData.userId);
      return;
    }
  }
}

/**
 * Required authentication - returns 401 if not authenticated
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await optionalAuth(request, reply);

  if (!request.userId) {
    reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
}

/**
 * Require enterprise tier - returns 403 if not enterprise
 */
export async function requireEnterprise(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);

  if (reply.sent) return;

  if (request.userTier !== 'enterprise') {
    reply.status(403).send({
      code: 'ENTERPRISE_REQUIRED',
      message: 'This endpoint requires an Enterprise subscription',
    });
  }
}

/**
 * Require pro or higher tier
 */
export async function requirePro(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await requireAuth(request, reply);

  if (reply.sent) return;

  if (request.userTier !== 'pro' && request.userTier !== 'enterprise') {
    reply.status(403).send({
      code: 'PRO_REQUIRED',
      message: 'This endpoint requires a Pro or Enterprise subscription',
    });
  }
}

/**
 * Auth plugin for route registration
 */
export const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Decorate request with auth properties
  fastify.decorateRequest('userId', undefined);
  fastify.decorateRequest('userTier', 'anonymous' as UserTier);
  fastify.decorateRequest('apiKeyId', undefined);
};

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'if_';
  const bytes = randomBytes(48);
  let key = prefix;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(bytes[i] % chars.length);
  }
  return key;
}

/**
 * Create a new API key for a user
 */
export async function createApiKeyForUser(
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ id: string; key: string } | null> {
  try {
    // Verify user is enterprise tier
    const tier = await getUserTier(userId);
    if (tier !== 'enterprise') {
      return null;
    }

    const key = generateApiKey();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const result = await db
      .insert(apiKeys)
      .values({
        userId,
        key,
        name,
        expiresAt,
      })
      .returning({ id: apiKeys.id });

    return { id: result[0].id, key };
  } catch {
    return null;
  }
}

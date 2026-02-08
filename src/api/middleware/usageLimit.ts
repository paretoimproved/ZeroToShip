/**
 * Usage Limit Middleware for ZeroToShip API
 *
 * Enforces daily usage limits on AI generation features:
 * - Fresh brief generation
 * - Validation requests
 *
 * Different from rate limiting (requests/hour):
 * - Rate limiting protects against request floods
 * - Usage limiting protects against AI cost abuse
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import {
  getUsageStatus,
  incrementBriefUsage,
  incrementValidationUsage,
  getNextMidnightUTC,
} from '../services/usage';
import type { UserTier } from '../config/tiers';

/** Overage price per brief in cents (displayed in warning header) */
const OVERAGE_PRICE_CENTS = 15;

/**
 * Middleware to check if user can generate a fresh brief
 * Should be used as preHandler on brief generation endpoints
 */
export async function checkBriefLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.userId;
  const tier = request.userTier as UserTier;

  if (!userId) {
    return reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const status = await getUsageStatus(userId, tier);

  if (!status.canRequestFreshBrief) {
    return reply.status(429).send({
      code: 'DAILY_LIMIT_EXCEEDED',
      message: 'Daily brief generation limit reached',
      details: {
        limit: status.freshBriefsLimit,
        used: status.freshBriefsUsed,
        resetAt: status.resetAt,
        tier,
      },
    });
  }

  // Warn if would incur overage (for Enterprise users)
  if (status.wouldIncurOverage) {
    reply.header('X-Overage-Warning', 'true');
    reply.header('X-Overage-Price-Cents', String(OVERAGE_PRICE_CENTS));
  }

  // Add usage info to headers for transparency
  reply.header('X-Usage-Briefs-Used', status.freshBriefsUsed.toString());
  reply.header('X-Usage-Briefs-Limit', status.freshBriefsLimit.toString());
  reply.header('X-Usage-Briefs-Remaining', status.freshBriefsRemaining.toString());
}

/**
 * Middleware to check if user can make a validation request
 * Should be used as preHandler on validation endpoints
 */
export async function checkValidationLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const userId = request.userId;
  const tier = request.userTier as UserTier;

  if (!userId) {
    return reply.status(401).send({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  const status = await getUsageStatus(userId, tier);

  if (!status.canRequestValidation) {
    return reply.status(429).send({
      code: 'DAILY_LIMIT_EXCEEDED',
      message: 'Daily validation request limit reached',
      details: {
        limit: status.validationRequestsLimit,
        used: status.validationRequestsUsed,
        resetAt: status.resetAt,
        tier,
      },
    });
  }

  // Add usage info to headers
  reply.header('X-Usage-Validations-Used', status.validationRequestsUsed.toString());
  reply.header('X-Usage-Validations-Limit', status.validationRequestsLimit.toString());
  reply.header(
    'X-Usage-Validations-Remaining',
    status.validationRequestsRemaining.toString()
  );
}

/**
 * Post-generation hook to track brief usage
 * Should be used as onResponse hook on brief generation endpoints
 *
 * Note: This increments usage AFTER successful generation.
 * The preHandler check ensures the user has capacity before we start.
 */
export async function trackBriefGeneration(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only track on successful responses
  if (reply.statusCode >= 400) {
    return;
  }

  const userId = request.userId;
  const tier = request.userTier as UserTier;

  if (!userId) {
    return;
  }

  const result = await incrementBriefUsage(userId, tier);

  if (result.isOverage) {
    // Log overage for billing reconciliation
    console.log(
      `[OVERAGE] user=${userId} tier=${tier} amount=${result.overageAmountCents}c`
    );
  }
}

/**
 * Post-validation hook to track validation usage
 * Should be used as onResponse hook on validation endpoints
 */
export async function trackValidationRequest(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Only track on successful responses
  if (reply.statusCode >= 400) {
    return;
  }

  const userId = request.userId;
  const tier = request.userTier as UserTier;

  if (!userId) {
    return;
  }

  await incrementValidationUsage(userId, tier);
}

/**
 * Create a combined check for both brief and validation limits
 * Useful for endpoints that might do both
 */
export function createUsageCheck(
  type: 'brief' | 'validation'
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return type === 'brief' ? checkBriefLimit : checkValidationLimit;
}

/**
 * Create a combined tracker for both brief and validation usage
 */
export function createUsageTracker(
  type: 'brief' | 'validation'
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return type === 'brief' ? trackBriefGeneration : trackValidationRequest;
}

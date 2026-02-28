/**
 * Onboarding Email Drip Service for ZeroToShip
 *
 * Sends welcome + day 1/3/7 onboarding emails to new users.
 * Ensures idempotency via the onboarding_emails tracking table.
 */

import { eq, and, sql, isNull } from 'drizzle-orm';
import { db, users, subscriptions, onboardingEmails } from '../api/db/client';
import type { OnboardingEmailType } from '../api/db/schema';
import logger from '../lib/logger';
import { sendEmail } from '../lib/resend';

/** Subject lines for each onboarding email type */
const SUBJECT_LINES: Record<OnboardingEmailType, string> = {
  welcome: 'Welcome to ZeroToShip - Your first ideas are inside',
  day1: 'Did any ideas spark your interest?',
  day3: 'What you\'re missing in the full briefs',
  day7: 'Your first week with ZeroToShip',
};

/** Drip schedule: each entry defines the email type and the time window (in hours) */
interface DripScheduleEntry {
  emailType: OnboardingEmailType;
  /** Minimum hours since user creation */
  minHours: number;
  /** Maximum hours since user creation */
  maxHours: number;
}

const DRIP_SCHEDULE: DripScheduleEntry[] = [
  { emailType: 'welcome', minHours: 0, maxHours: 1 },
  { emailType: 'day1', minHours: 23, maxHours: 25 },
  { emailType: 'day3', minHours: 71, maxHours: 73 },
  { emailType: 'day7', minHours: 167, maxHours: 169 },
];

/** Result of a single onboarding email send attempt */
export interface OnboardingEmailResult {
  userId: string;
  emailType: OnboardingEmailType;
  sent: boolean;
  skipped: boolean;
  error?: string;
  messageId?: string;
}

/** Summary of a drip processing run */
export interface DripProcessingResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: OnboardingEmailResult[];
}

/**
 * Build a simple HTML email from the onboarding template content.
 *
 * The Markdown templates have complex Handlebars-style variables that
 * require user-specific data we may not have (e.g. topIdea, quickWins).
 * For the initial wiring, we send a clean, personalized HTML version
 * that captures the key messaging from each template.
 */
function buildOnboardingHtml(
  emailType: OnboardingEmailType,
  userName: string,
  userTier: string
): { html: string; text: string } {
  const name = userName || 'there';
  const isPro = userTier === 'pro' || userTier === 'enterprise';
  const ideaCount = isPro ? 10 : 3;
  const baseUrl = 'https://zerotoship.dev';
  const upgradeUrl = `${baseUrl}/pricing`;
  const dashboardUrl = `${baseUrl}/dashboard`;
  const preferencesUrl = `${baseUrl}/settings`;

  const bodies: Record<OnboardingEmailType, { html: string; text: string }> = {
    welcome: {
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Welcome to ZeroToShip!</h1>
  </div>
  <div style="padding: 24px;">
    <p>Hey ${escapeHtml(name)},</p>
    <p>Starting tomorrow morning, you'll get <strong>${ideaCount} startup ideas</strong> delivered to your inbox. Each one scraped from Reddit, Hacker News, and GitHub in the last 24 hours.</p>
    <p><strong>Here's how it works:</strong></p>
    <ol>
      <li><strong>Check your inbox each morning</strong> -- Your daily ideas arrive</li>
      <li><strong>Review the scores</strong> -- Higher priority = bigger opportunity, less effort</li>
      <li><strong>Click through for details</strong> -- See the full brief${isPro ? '' : ''}</li>
      <li><strong>Start building</strong> -- Or wait for tomorrow's batch</li>
    </ol>
    <p><strong>Quick tip:</strong> The best ideas often have high "severity" scores -- those are the painful problems people will actually pay to solve.</p>
    <p style="text-align: center; margin: 24px 0;"><a href="${escapeHtml(dashboardUrl)}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">Explore ZeroToShip</a></p>
    <p>Questions? Just reply to this email.</p>
    <p>-- The ZeroToShip Team</p>
    ${!isPro ? `<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" /><p style="color: #666; font-size: 14px;">P.S. Want more ideas? <a href="${escapeHtml(upgradeUrl)}" style="color: #667eea;">Upgrade to Pro</a> for 10 full briefs daily.</p>` : ''}
  </div>
  <div style="padding: 16px 24px; text-align: center; background: #f5f5f5; color: #888; font-size: 12px;">
    <p>You're receiving this because you signed up for ZeroToShip.</p>
    <p><a href="${escapeHtml(preferencesUrl)}" style="color: #888;">Manage preferences</a></p>
  </div>
</div>`,
      text: `Hey ${name},\n\nWelcome to ZeroToShip!\n\nStarting tomorrow morning, you'll get ${ideaCount} startup ideas delivered to your inbox. Each one scraped from Reddit, Hacker News, and GitHub in the last 24 hours.\n\nHere's how it works:\n1. Check your inbox each morning - Your daily ideas arrive\n2. Review the scores - Higher priority = bigger opportunity\n3. Click through for details\n4. Start building - Or wait for tomorrow's batch\n\nQuick tip: The best ideas often have high "severity" scores.\n\nQuestions? Just reply to this email.\n\n-- The ZeroToShip Team`,
    },
    day1: {
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">ZeroToShip</h1>
  </div>
  <div style="padding: 24px;">
    <p>Hey ${escapeHtml(name)},</p>
    <p>You got your first batch of ideas yesterday.</p>
    <p>Quick question: <strong>Did any stand out?</strong></p>
    <p>If so, here's what to do next:</p>
    <ol>
      <li><strong>Read the full brief</strong> -- See the technical spec and competitor analysis</li>
      <li><strong>Check the market gaps</strong> -- Where can you differentiate?</li>
      <li><strong>Validate fast</strong> -- 5 quick customer conversations beats weeks of building</li>
    </ol>
    <p>If nothing clicked, no worries. Tomorrow's ideas will be completely different -- scraped fresh from overnight discussions.</p>
    <p><strong>Pro tip:</strong> Filter by effort level. Looking for a weekend project? Sort by "weekend" ideas. Have more time? The "month" projects tend to have bigger revenue potential.</p>
    <p><a href="${escapeHtml(dashboardUrl)}" style="color: #667eea; font-weight: 600;">View All Ideas &rarr;</a></p>
    <p>Still exploring? That's fine. The best builders I know evaluated dozens of ideas before committing.</p>
    <p>-- The ZeroToShip Team</p>
  </div>
  <div style="padding: 16px 24px; text-align: center; background: #f5f5f5; color: #888; font-size: 12px;">
    <p>You're receiving this because you signed up for ZeroToShip.</p>
    <p><a href="${escapeHtml(preferencesUrl)}" style="color: #888;">Manage preferences</a></p>
  </div>
</div>`,
      text: `Hey ${name},\n\nYou got your first batch of ideas yesterday.\n\nQuick question: Did any stand out?\n\nIf so, here's what to do next:\n1. Read the full brief - See the technical spec and competitor analysis\n2. Check the market gaps - Where can you differentiate?\n3. Validate fast - 5 quick customer conversations beats weeks of building\n\nIf nothing clicked, no worries. Tomorrow's ideas will be completely different.\n\nPro tip: Filter by effort level. Looking for a weekend project? Sort by "weekend" ideas.\n\nView All Ideas: ${dashboardUrl}\n\n-- The ZeroToShip Team`,
    },
    day3: {
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">ZeroToShip</h1>
  </div>
  <div style="padding: 24px;">
    <p>Hey ${escapeHtml(name)},</p>
    <p>You've seen 3 days of ideas. Here's what you're missing in the full briefs:</p>
    <p><strong>Technical Spec</strong> -- Recommended tech stack, architecture overview, MVP scope, estimated development time</p>
    <p><strong>Competitor Analysis</strong> -- Top 3-5 existing solutions, strengths/weaknesses, pricing models, market gaps</p>
    <p><strong>Business Model</strong> -- Monetization strategy, pricing recommendations, revenue projections</p>
    <p><strong>Go-to-Market</strong> -- Launch channels, first 100 customer strategy, content marketing angles</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p>For $19/mo, you get 30 agent-ready specs per month. Transform any brief into a full technical spec with user stories, database schema, API routes, and CLAUDE.md -- ready to paste into your project.</p>
    <p><a href="${escapeHtml(upgradeUrl)}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Upgrade to Pro &rarr;</a></p>
    <p style="color: #666; font-size: 14px;">Not ready? No problem. Free users get 3 spec generations per month.</p>
    <p>-- The ZeroToShip Team</p>
  </div>
  <div style="padding: 16px 24px; text-align: center; background: #f5f5f5; color: #888; font-size: 12px;">
    <p>You're receiving this because you signed up for ZeroToShip.</p>
    <p><a href="${escapeHtml(preferencesUrl)}" style="color: #888;">Manage preferences</a></p>
  </div>
</div>`,
      text: `Hey ${name},\n\nYou've seen 3 days of ideas. Here's what you're missing in the full briefs:\n\n- Technical Spec: Recommended tech stack, architecture, MVP scope\n- Competitor Analysis: Top solutions, strengths/weaknesses, market gaps\n- Business Model: Monetization, pricing, revenue projections\n- Go-to-Market: Launch channels, first 100 customers\n\nFor $19/mo, you get 30 agent-ready specs per month -- transform any brief into a full technical spec ready for your AI agent.\n\nUpgrade to Pro: ${upgradeUrl}\n\nNot ready? No problem. Free users get 3 spec generations per month.\n\n-- The ZeroToShip Team`,
    },
    day7: {
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">ZeroToShip</h1>
  </div>
  <div style="padding: 24px;">
    <p>Hey ${escapeHtml(name)},</p>
    <p>You've been with ZeroToShip for a week!</p>
    <p><strong>I have a favor to ask.</strong></p>
    <p>What would help me improve ZeroToShip for you?</p>
    <p>Just hit reply and answer any of these:</p>
    <ol>
      <li><strong>What's working well?</strong> (Keep doing this)</li>
      <li><strong>What's missing?</strong> (What would make this 10x better?)</li>
      <li><strong>Would you recommend it to a friend?</strong> (Why or why not?)</li>
    </ol>
    <p>Your feedback directly shapes the product. I read every reply.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    ${isPro ? `
    <p><strong>What's Next?</strong></p>
    <p>You're on Pro -- awesome! Here are some features you might have missed:</p>
    <ul>
      <li><strong>Archive search</strong> -- Find ideas from previous days</li>
      <li><strong>Category filters</strong> -- Focus on your niche</li>
      <li><strong>Export to CSV</strong> -- Take your ideas anywhere</li>
    </ul>
    <p><a href="${escapeHtml(dashboardUrl)}" style="color: #667eea; font-weight: 600;">Explore the Dashboard &rarr;</a></p>
    ` : `
    <p><strong>What's Next?</strong></p>
    <p>You're on the free plan. Here's what Pro unlocks:</p>
    <ul>
      <li>30 agent-ready spec generations/month (vs 3)</li>
      <li>Custom problem submission</li>
      <li>Problem watching with weekly re-analysis</li>
      <li>Bulk export (Markdown/JSON)</li>
    </ul>
    <p><a href="${escapeHtml(upgradeUrl)}" style="color: #667eea; font-weight: 600;">Try Pro for $19/mo &rarr;</a></p>
    `}
    <p>Thanks for being an early user. Seriously.</p>
    <p>-- Brandon, Founder of ZeroToShip</p>
    <p style="color: #666; font-size: 14px;">P.S. Found an idea you're excited about? Reply and tell me -- I'd love to hear what you're building.</p>
  </div>
  <div style="padding: 16px 24px; text-align: center; background: #f5f5f5; color: #888; font-size: 12px;">
    <p>You're receiving this because you signed up for ZeroToShip.</p>
    <p><a href="${escapeHtml(preferencesUrl)}" style="color: #888;">Manage preferences</a></p>
  </div>
</div>`,
      text: `Hey ${name},\n\nYou've been with ZeroToShip for a week!\n\nI have a favor to ask.\n\nWhat would help me improve ZeroToShip for you?\n\nJust hit reply and answer any of these:\n1. What's working well?\n2. What's missing?\n3. Would you recommend it to a friend?\n\nYour feedback directly shapes the product. I read every reply.\n\n${isPro ? `You're on Pro! Features you might have missed:\n- Archive search\n- Category filters\n- Export to CSV\n\nExplore: ${dashboardUrl}` : `You're on the free plan. Pro unlocks:\n- 30 agent-ready spec generations/month\n- Custom problem submission\n- Problem watching with weekly re-analysis\n- Bulk export\n\nTry Pro: ${upgradeUrl}`}\n\nThanks for being an early user.\n\n-- Brandon, Founder of ZeroToShip`,
    },
  };

  return bodies[emailType];
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
}

/**
 * Check if an onboarding email was already sent to a user
 */
async function wasEmailAlreadySent(
  userId: string,
  emailType: OnboardingEmailType
): Promise<boolean> {
  const rows = await db
    .select({ id: onboardingEmails.id })
    .from(onboardingEmails)
    .where(
      and(
        eq(onboardingEmails.userId, userId),
        eq(onboardingEmails.emailType, emailType)
      )
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Record that an onboarding email was sent
 */
async function recordEmailSent(
  userId: string,
  emailType: OnboardingEmailType
): Promise<void> {
  await db.insert(onboardingEmails).values({
    userId,
    emailType,
    sentAt: new Date(),
  });
}

/**
 * Send an onboarding email to a user via Resend.
 *
 * Idempotent: checks the tracking table before sending.
 * If the email was already sent, it returns a skipped result.
 */
export async function sendOnboardingEmail(
  userId: string,
  emailType: OnboardingEmailType
): Promise<OnboardingEmailResult> {
  const result: OnboardingEmailResult = {
    userId,
    emailType,
    sent: false,
    skipped: false,
  };

  // Check if already sent
  const alreadySent = await wasEmailAlreadySent(userId, emailType);
  if (alreadySent) {
    result.skipped = true;
    logger.debug(
      { userId, emailType },
      'Onboarding email already sent, skipping'
    );
    return result;
  }

  // Fetch user data with tier from subscriptions
  const userRows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      tier: subscriptions.plan,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length === 0) {
    result.error = `User not found: ${userId}`;
    logger.warn({ userId, emailType }, 'Onboarding email skipped: user not found');
    return result;
  }

  const user = userRows[0];
  // Build email content
  const subject = SUBJECT_LINES[emailType];
  const { html, text } = buildOnboardingHtml(
    emailType,
    user.name || '',
    user.tier || 'free'
  );

  // Send via centralized Resend client
  const sendResult = await sendEmail({ to: user.email, subject, html, text });

  if (sendResult.success) {
    result.sent = true;
    result.messageId = sendResult.messageId;
    await recordEmailSent(userId, emailType);
    logger.info(
      { userId, emailType, messageId: sendResult.messageId },
      'Onboarding email sent successfully'
    );
  } else {
    result.error = sendResult.error;
    logger.error(
      { userId, emailType, statusCode: sendResult.statusCode, error: sendResult.error },
      'Failed to send onboarding email'
    );
  }

  return result;
}

/**
 * Send an onboarding email with pre-fetched user data.
 * Avoids N+1 queries by accepting user data from the drip query.
 * The LEFT JOIN in processOnboardingDrip already ensures the email hasn't been sent.
 */
async function sendOnboardingEmailDirect(
  user: { id: string; email: string; name: string | null; tier: string | null },
  emailType: OnboardingEmailType
): Promise<OnboardingEmailResult> {
  const result: OnboardingEmailResult = {
    userId: user.id,
    emailType,
    sent: false,
    skipped: false,
  };

  const subject = SUBJECT_LINES[emailType];
  const { html, text } = buildOnboardingHtml(emailType, user.name || '', user.tier || 'free');

  const sendResult = await sendEmail({ to: user.email, subject, html, text });

  if (sendResult.success) {
    result.sent = true;
    result.messageId = sendResult.messageId;
    await recordEmailSent(user.id, emailType);
    logger.info({ userId: user.id, emailType, messageId: sendResult.messageId }, 'Onboarding email sent successfully');
  } else {
    result.error = sendResult.error;
    logger.error({ userId: user.id, emailType, statusCode: sendResult.statusCode, error: sendResult.error }, 'Failed to send onboarding email');
  }

  return result;
}

/**
 * Process the onboarding email drip for all eligible users.
 *
 * Queries users whose createdAt falls within each drip window
 * and who haven't yet received the corresponding email.
 * Uses time windows (not exact times) so the cron job catches
 * everyone even if it runs slightly early or late.
 */
export async function processOnboardingDrip(): Promise<DripProcessingResult> {
  const result: DripProcessingResult = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
  };

  const now = new Date();

  for (const entry of DRIP_SCHEDULE) {
    const minTime = new Date(now.getTime() - entry.maxHours * 60 * 60 * 1000);
    const maxTime = new Date(now.getTime() - entry.minHours * 60 * 60 * 1000);

    // Find users who:
    // 1. Were created within the time window
    // 2. Haven't received this email type yet
    // Includes user data to avoid N+1 queries in sendOnboardingEmail
    const eligibleUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        tier: subscriptions.plan,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .leftJoin(
        onboardingEmails,
        and(
          eq(onboardingEmails.userId, users.id),
          eq(onboardingEmails.emailType, entry.emailType)
        )
      )
      .where(
        and(
          sql`${users.createdAt} >= ${minTime}`,
          sql`${users.createdAt} <= ${maxTime}`,
          isNull(onboardingEmails.id)
        )
      );

    logger.info(
      {
        emailType: entry.emailType,
        eligibleCount: eligibleUsers.length,
        windowStart: minTime.toISOString(),
        windowEnd: maxTime.toISOString(),
      },
      'Processing onboarding drip window'
    );

    for (const user of eligibleUsers) {
      result.processed++;
      const emailResult = await sendOnboardingEmailDirect(user, entry.emailType);
      result.details.push(emailResult);

      if (emailResult.sent) {
        result.sent++;
      } else if (emailResult.skipped) {
        result.skipped++;
      } else {
        result.failed++;
      }
    }
  }

  logger.info(
    {
      processed: result.processed,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
    },
    'Onboarding drip processing complete'
  );

  return result;
}

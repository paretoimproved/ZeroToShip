/**
 * Spec Generation Notification Email for ZeroToShip
 *
 * Sends a notification email when a user's agent-ready spec is generated.
 * Fire-and-forget: errors are logged but don't block the response.
 */

import { eq } from 'drizzle-orm';
import { db, users } from '../api/db/client';
import logger from '../lib/logger';
import { sendEmail } from '../lib/resend';

/** Escape HTML special characters */
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

/** Truncate text to a maximum length with ellipsis */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '...';
}

interface SpecForEmail {
  projectName: string;
  problem: string;
  technicalArchitecture?: {
    stack?: string[];
  };
  mvpScope?: {
    mustHave?: string[];
  };
}

/**
 * Send a notification email when a spec is generated.
 * Fire-and-forget — caller should `.catch()` errors.
 */
export async function sendSpecNotificationEmail(
  userId: string,
  specId: string,
  spec: unknown,
  ideaName: string,
  quotaInfo?: { used: number; limit: number }
): Promise<void> {
  // Fetch user email
  const userRows = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRows.length === 0) {
    logger.warn({ userId }, 'Spec notification email skipped: user not found');
    return;
  }

  const user = userRows[0];
  const typedSpec = spec as SpecForEmail;
  const projectName = typedSpec.projectName || ideaName;
  const problemSummary = truncate(typedSpec.problem || '', 200);
  const stack = typedSpec.technicalArchitecture?.stack || [];
  const mvpCount = typedSpec.mvpScope?.mustHave?.length || 0;
  const viewUrl = `https://zerotoship.dev/specs/${specId}`;

  const subject = `Your agent spec for "${escapeHtml(projectName)}" is ready`;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 32px 24px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">Your spec for ${escapeHtml(projectName)} is ready</h1>
  </div>
  <div style="padding: 24px;">
    <p>Hey ${escapeHtml(user.name || 'there')},</p>
    <p>Your agent-ready spec for <strong>${escapeHtml(ideaName)}</strong> has been generated and is ready to use.</p>

    <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Problem</h3>
      <p style="margin: 0; font-size: 14px; color: #333;">${escapeHtml(problemSummary)}</p>
    </div>

    ${stack.length > 0 ? `
    <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">Tech Stack</h3>
      <p style="margin: 0; font-size: 14px; color: #333;">${stack.map(s => escapeHtml(s)).join(', ')}</p>
    </div>
    ` : ''}

    ${mvpCount > 0 ? `
    <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; color: #666; text-transform: uppercase; letter-spacing: 0.05em;">MVP Scope</h3>
      <p style="margin: 0; font-size: 14px; color: #333;">${mvpCount} must-have features defined</p>
    </div>
    ` : ''}

    <p style="text-align: center; margin: 24px 0;">
      <a href="${escapeHtml(viewUrl)}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600;">View Full Spec</a>
    </p>
    <p style="color: #666; font-size: 14px; text-align: center;">Copy the spec to your clipboard or download it as Markdown from the viewer.</p>
    ${quotaInfo ? `<p style="color: #999; font-size: 13px; text-align: center; margin-top: 12px;">You've used ${quotaInfo.used} of ${quotaInfo.limit} spec generations this month.</p>` : ''}
  </div>
  <div style="padding: 16px 24px; text-align: center; background: #f5f5f5; color: #888; font-size: 12px;">
    <p>You're receiving this because you generated a spec on ZeroToShip.</p>
    <p><a href="https://zerotoship.dev/settings" style="color: #888;">Manage preferences</a></p>
  </div>
</div>`;

  const text = `Hey ${user.name || 'there'},

Your agent-ready spec for "${projectName}" is ready.

Problem: ${problemSummary}
${stack.length > 0 ? `Tech Stack: ${stack.join(', ')}` : ''}
${mvpCount > 0 ? `MVP Scope: ${mvpCount} must-have features` : ''}

View your spec: ${viewUrl}
${quotaInfo ? `\nYou've used ${quotaInfo.used} of ${quotaInfo.limit} spec generations this month.` : ''}
-- The ZeroToShip Team`;

  const result = await sendEmail({ to: user.email, subject, html, text });

  if (result.success) {
    logger.info(
      { userId, specId, messageId: result.messageId },
      'Spec notification email sent successfully'
    );
  } else {
    logger.error(
      { userId, specId, statusCode: result.statusCode, error: result.error },
      'Failed to send spec notification email'
    );
  }
}

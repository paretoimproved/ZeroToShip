/**
 * Email Builder for ZeroToShip
 *
 * Generates HTML emails from daily briefs for different subscriber tiers.
 */

import type { IdeaBrief } from '../generation/brief-generator';
import logger from '../lib/logger';

/**
 * Subscriber tier definitions
 */
export type SubscriberTier = 'free' | 'pro';

export const TIER_LIMITS: Record<SubscriberTier, number> = {
  free: 3,
  pro: 10,
};

/** Max ideas shown in the "other ideas" section of the email */
const MAX_EMAIL_IDEAS = 10;

/** Max hero features shown in the top idea section */
const MAX_HERO_FEATURES = 4;

/** Max tagline length before truncation */
const TAGLINE_TRUNCATE_LENGTH = 60;

/** Max revenue estimate display length */
const REVENUE_DISPLAY_LENGTH = 20;

/**
 * Email content structure
 */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/**
 * Configuration for email building
 */
export interface EmailBuilderConfig {
  baseUrl?: string;
  unsubscribeUrl?: string;
  upgradeUrl?: string;
}

const DEFAULT_CONFIG: Required<EmailBuilderConfig> = {
  baseUrl: 'https://zerotoship.dev',
  unsubscribeUrl: 'https://zerotoship.dev/unsubscribe',
  upgradeUrl: 'https://zerotoship.dev/upgrade',
};

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
  return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Format priority score for display
 */
function formatScore(score: number): string {
  return score.toFixed(1);
}

/**
 * Generate CSS styles for the email
 */
function getEmailStyles(): string {
  return `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f5f5f5;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 32px 24px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header .date {
      margin-top: 8px;
      opacity: 0.9;
      font-size: 14px;
    }
    .hero {
      padding: 32px 24px;
      background-color: #fafafa;
      border-bottom: 1px solid #eee;
    }
    .hero-badge {
      display: inline-block;
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .hero h2 {
      margin: 0 0 8px 0;
      font-size: 28px;
      color: #1a1a1a;
    }
    .hero .tagline {
      color: #666;
      font-size: 16px;
      margin-bottom: 16px;
    }
    .score-bar {
      display: flex;
      gap: 16px;
      margin: 16px 0;
    }
    .score-item {
      background: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .score-label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .score-value {
      font-size: 20px;
      font-weight: 700;
      color: #667eea;
    }
    .brief-section {
      padding: 24px;
      border-bottom: 1px solid #eee;
    }
    .brief-section h3 {
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .brief-section p {
      margin: 0;
      color: #333;
    }
    .features-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .features-list li {
      padding: 8px 0;
      padding-left: 24px;
      position: relative;
    }
    .features-list li:before {
      content: '\\2713';
      position: absolute;
      left: 0;
      color: #22c55e;
      font-weight: bold;
    }
    .other-ideas {
      padding: 24px;
    }
    .other-ideas h3 {
      margin: 0 0 16px 0;
      font-size: 18px;
    }
    .idea-row {
      display: flex;
      align-items: center;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
      margin-bottom: 12px;
    }
    .idea-rank {
      width: 32px;
      height: 32px;
      background: #667eea;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .idea-content {
      flex: 1;
    }
    .idea-name {
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 4px;
    }
    .idea-tagline {
      font-size: 14px;
      color: #666;
    }
    .idea-score {
      font-weight: 600;
      color: #667eea;
      font-size: 18px;
    }
    .locked-idea {
      opacity: 0.5;
      filter: blur(2px);
    }
    .cta-section {
      padding: 32px 24px;
      text-align: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .cta-section h3 {
      color: white;
      margin: 0 0 8px 0;
      font-size: 20px;
    }
    .cta-section p {
      color: rgba(255,255,255,0.9);
      margin: 0 0 16px 0;
    }
    .cta-button {
      display: inline-block;
      background: white;
      color: #667eea;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
    }
    .footer {
      padding: 24px;
      text-align: center;
      background: #1a1a1a;
      color: #888;
      font-size: 12px;
    }
    .footer a {
      color: #888;
      text-decoration: underline;
    }
  `;
}

/**
 * Build the hero section for the top idea
 */
function buildHeroSection(brief: IdeaBrief): string {
  const features = brief.keyFeatures.slice(0, MAX_HERO_FEATURES);

  return `
    <div class="hero">
      <span class="hero-badge">#1 TODAY'S TOP IDEA</span>
      <h2>${escapeHtml(brief.name)}</h2>
      <p class="tagline">${escapeHtml(brief.tagline)}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
        <tr>
          <td width="33%" style="background: #fff; padding: 12px 16px; border-radius: 8px; border: 1px solid #e0e0e0; text-align: center;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Priority</div>
            <div style="font-size: 20px; font-weight: 700; color: #667eea;">${formatScore(brief.priorityScore)}</div>
          </td>
          <td width="4%"></td>
          <td width="33%" style="background: #fff; padding: 12px 16px; border-radius: 8px; border: 1px solid #e0e0e0; text-align: center;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Effort</div>
            <div style="font-size: 20px; font-weight: 700; color: #667eea;">${escapeHtml(brief.effortEstimate)}</div>
          </td>
          <td width="4%"></td>
          <td width="33%" style="background: #fff; padding: 12px 16px; border-radius: 8px; border: 1px solid #e0e0e0; text-align: center;">
            <div style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Revenue</div>
            <div style="font-size: 14px; font-weight: 700; color: #667eea;">${escapeHtml(brief.revenueEstimate.slice(0, REVENUE_DISPLAY_LENGTH))}</div>
          </td>
        </tr>
      </table>
    </div>

    <div class="brief-section">
      <h3>The Problem</h3>
      <p>${escapeHtml(brief.problemStatement)}</p>
    </div>

    <div class="brief-section">
      <h3>Target Audience</h3>
      <p>${escapeHtml(brief.targetAudience)}</p>
    </div>

    <div class="brief-section">
      <h3>Proposed Solution</h3>
      <p>${escapeHtml(brief.proposedSolution)}</p>
    </div>

    <div class="brief-section">
      <h3>Key Features</h3>
      <ul class="features-list">
        ${features.map(f => `<li>${escapeHtml(f)}</li>`).join('\n        ')}
      </ul>
    </div>

    <div class="brief-section">
      <h3>Go-to-Market</h3>
      <p><strong>Strategy:</strong> ${escapeHtml(brief.goToMarket.launchStrategy)}</p>
      <p><strong>First Customers:</strong> ${escapeHtml(brief.goToMarket.firstCustomers)}</p>
    </div>
  `;
}

/**
 * Build a row for secondary ideas
 */
function buildIdeaRow(brief: IdeaBrief, rank: number, locked: boolean = false): string {
  const lockedClass = locked ? 'locked-idea' : '';
  const lockedOverlay = locked ? '<div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.8);"><span style="font-size: 20px;">&#128274;</span></div>' : '';

  return `
    <div class="idea-row ${lockedClass}" style="position: relative;">
      ${lockedOverlay}
      <div class="idea-rank">${rank}</div>
      <div class="idea-content">
        <div class="idea-name">${escapeHtml(brief.name)}</div>
        <div class="idea-tagline">${escapeHtml(brief.tagline.slice(0, TAGLINE_TRUNCATE_LENGTH))}${brief.tagline.length > TAGLINE_TRUNCATE_LENGTH ? '...' : ''}</div>
      </div>
      <div class="idea-score">${formatScore(brief.priorityScore)}</div>
    </div>
  `;
}

/**
 * Build the other ideas section
 */
function buildOtherIdeasSection(
  briefs: IdeaBrief[],
  tier: SubscriberTier,
  config: Required<EmailBuilderConfig>
): string {
  if (briefs.length <= 1) {
    return '';
  }

  const limit = TIER_LIMITS[tier];
  const otherBriefs = briefs.slice(1, MAX_EMAIL_IDEAS);

  const rows = otherBriefs.map((brief, index) => {
    const rank = index + 2;
    const locked = rank > limit;
    return buildIdeaRow(brief, rank, locked);
  }).join('\n');

  const lockedCount = Math.max(0, otherBriefs.length - (limit - 1));

  return `
    <div class="other-ideas">
      <h3>More Ideas Today</h3>
      ${rows}
      ${lockedCount > 0 && tier === 'free' ? `
        <p style="text-align: center; color: #888; margin-top: 16px;">
          ${lockedCount} more idea${lockedCount > 1 ? 's' : ''} available with Pro
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * Build the CTA section for free tier users
 */
function buildCtaSection(tier: SubscriberTier, config: Required<EmailBuilderConfig>): string {
  if (tier === 'pro') {
    return '';
  }

  return `
    <div class="cta-section">
      <h3>Unlock All Ideas</h3>
      <p>Get access to 10 ideas daily, full briefs, and exclusive deep-dives.</p>
      <a href="${escapeHtml(config.upgradeUrl)}" class="cta-button">Upgrade to Pro</a>
    </div>
  `;
}

/**
 * Build the email footer
 */
function buildFooter(config: Required<EmailBuilderConfig>): string {
  return `
    <div class="footer">
      <p>You're receiving this because you subscribed to ZeroToShip daily briefs.</p>
      <p>
        <a href="${escapeHtml(config.unsubscribeUrl)}">Unsubscribe</a> |
        <a href="${escapeHtml(config.baseUrl)}">View in browser</a>
      </p>
      <p>&copy; ${new Date().getFullYear()} ZeroToShip. All rights reserved.</p>
    </div>
  `;
}

/**
 * Build the complete HTML email
 */
export function buildDailyEmail(
  briefs: IdeaBrief[],
  tier: SubscriberTier,
  config: EmailBuilderConfig = {}
): EmailContent {
  const opts = { ...DEFAULT_CONFIG, ...config };

  if (briefs.length === 0) {
    return {
      subject: 'ZeroToShip: No ideas today',
      html: '<p>No startup ideas found today. Check back tomorrow!</p>',
      text: 'No startup ideas found today. Check back tomorrow!',
    };
  }

  const topIdea = briefs[0];
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const subject = `Today's Top Startup Idea: ${topIdea.name}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <style>
    ${getEmailStyles()}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ZeroToShip</h1>
      <p class="date">${escapeHtml(dateStr)}</p>
    </div>

    ${buildHeroSection(topIdea)}
    ${buildOtherIdeasSection(briefs, tier, opts)}
    ${buildCtaSection(tier, opts)}
    ${buildFooter(opts)}
  </div>
</body>
</html>
  `.trim();

  const text = buildPlainTextEmail(briefs, tier, opts);

  return { subject, html, text };
}

/**
 * Build plain text version of the email
 */
function buildPlainTextEmail(
  briefs: IdeaBrief[],
  tier: SubscriberTier,
  config: Required<EmailBuilderConfig>
): string {
  if (briefs.length === 0) {
    return 'No startup ideas found today. Check back tomorrow!';
  }

  const limit = TIER_LIMITS[tier];
  const topIdea = briefs[0];
  const lines: string[] = [];

  lines.push('ZEROTOSHIP DAILY BRIEF');
  lines.push('='.repeat(50));
  lines.push('');

  lines.push(`#1 TODAY'S TOP IDEA`);
  lines.push(`${topIdea.name}`);
  lines.push(`"${topIdea.tagline}"`);
  lines.push('');
  lines.push(`Priority Score: ${formatScore(topIdea.priorityScore)} | Effort: ${topIdea.effortEstimate}`);
  lines.push('');

  lines.push('THE PROBLEM');
  lines.push('-'.repeat(30));
  lines.push(topIdea.problemStatement);
  lines.push('');

  lines.push('TARGET AUDIENCE');
  lines.push('-'.repeat(30));
  lines.push(topIdea.targetAudience);
  lines.push('');

  lines.push('PROPOSED SOLUTION');
  lines.push('-'.repeat(30));
  lines.push(topIdea.proposedSolution);
  lines.push('');

  lines.push('KEY FEATURES');
  lines.push('-'.repeat(30));
  topIdea.keyFeatures.forEach(f => lines.push(`- ${f}`));
  lines.push('');

  if (briefs.length > 1) {
    lines.push('');
    lines.push('MORE IDEAS TODAY');
    lines.push('='.repeat(50));

    briefs.slice(1, MAX_EMAIL_IDEAS).forEach((brief, index) => {
      const rank = index + 2;
      const locked = rank > limit;
      const lockIcon = locked ? ' [LOCKED]' : '';
      lines.push(`#${rank} ${brief.name}${lockIcon} - Score: ${formatScore(brief.priorityScore)}`);
      if (!locked) {
        lines.push(`   ${brief.tagline}`);
      }
    });
  }

  if (tier === 'free') {
    lines.push('');
    lines.push('-'.repeat(50));
    lines.push('Upgrade to Pro for all 10 daily ideas:');
    lines.push(config.upgradeUrl);
  }

  lines.push('');
  lines.push('-'.repeat(50));
  lines.push(`Unsubscribe: ${config.unsubscribeUrl}`);

  return lines.join('\n');
}

/**
 * Preview email in console (for debugging)
 */
export function previewEmail(content: EmailContent): void {
  logger.info({ subject: content.subject }, 'Email preview');
  logger.info(content.text);
}

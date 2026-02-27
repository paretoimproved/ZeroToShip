/**
 * Email Pro for ZeroToShip
 *
 * Generates HTML emails from daily briefs for different subscriber tiers.
 * Strategy: emails are teasers that drive users to the website for full briefs.
 */

import type { IdeaBrief } from '../generation/brief-generator';
import logger from '../lib/logger';

export type SubscriberTier = 'free' | 'pro';

export const TIER_LIMITS: Record<SubscriberTier, number> = {
  free: 3,
  pro: 10,
};

const MAX_EMAIL_IDEAS = 10;
const TAGLINE_TRUNCATE_LENGTH = 80;

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export interface EmailBuilderConfig {
  baseUrl?: string;
  unsubscribeUrl?: string;
  upgradeUrl?: string;
}

const DEFAULT_CONFIG: Required<EmailBuilderConfig> = {
  baseUrl: 'https://zerotoship.dev',
  unsubscribeUrl: 'https://zerotoship.dev/unsubscribe',
  upgradeUrl: 'https://zerotoship.dev/pricing',
};

const FONT_STACK = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

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

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1');
}

function truncateFeatureName(feature: string): string {
  const delimiters = [' — ', ' - ', ': ', ' — '];
  let name = feature;
  for (const d of delimiters) {
    const idx = name.indexOf(d);
    if (idx > 0) {
      name = name.slice(0, idx);
      break;
    }
  }
  return name.length > 60 ? name.slice(0, 57) + '...' : name;
}

const PLATFORM_LABELS: Record<string, string> = {
  reddit: 'Reddit',
  hn: 'Hacker News',
  twitter: 'Twitter/X',
  github: 'GitHub',
};

function formatScore(score: number | string): string {
  return Number(score).toFixed(1);
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 150);
}

function getEffortBadgeStyle(effort: string): { bg: string; text: string } {
  const lower = effort.toLowerCase();
  if (lower === 'weekend') return { bg: '#ecfdf5', text: '#059669' };
  if (lower === 'week') return { bg: '#fef3c7', text: '#d97706' };
  return { bg: '#fee2e2', text: '#dc2626' };
}

function formatEffortLabel(effort: string): string {
  const lower = effort.toLowerCase();
  if (lower === 'weekend') return 'Weekend';
  if (lower === 'week') return '1 Week';
  if (lower === 'month') return '1 Month';
  if (lower === 'quarter') return 'Quarter+';
  return effort;
}

function generateSubjectLine(topIdea: IdeaBrief, ideaCount: number): string {
  const name = topIdea.name.trim();
  const effort = formatEffortLabel(topIdea.effortEstimate).toLowerCase();

  // Specific > generic. Lead with the product name or effort level so
  // the subject conveys value at a glance. Avoid revenue claims and questions.
  const templates = [
    `Today's #1: ${name} (${effort} build)`,
    `${name} — ${effort} build, ${formatScore(topIdea.priorityScore)}/100`,
    `${ideaCount} problems scored — ${name} leads`,
    `${name} tops today's ${ideaCount} problems`,
  ];

  // Deterministic daily selection based on date
  const dateHash = new Date().toISOString().slice(0, 10).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const subject = templates[dateHash % templates.length];

  // Most inboxes truncate around ~50 chars. Target a tighter ceiling.
  return subject.length > 52 ? subject.slice(0, 49) + '...' : subject;
}

function generatePreviewText(topIdea: IdeaBrief, ideaCount: number): string {
  return `${ideaCount} problems scored today. #1 is a ${formatEffortLabel(topIdea.effortEstimate).toLowerCase()} build.`;
}

function buildPreheader(text: string): string {
  const spacer = '&#847;&zwnj;&nbsp;'.repeat(15);
  return `<span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;mso-hide:all;overflow:hidden;">${escapeHtml(text)}${spacer}</span>`;
}

function buildHeader(dateStr: string): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-bottom: 2px solid #6366f1;">
      <tr>
        <td style="padding: 16px 24px; font-family: ${FONT_STACK};">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="font-size: 20px; font-weight: 700; color: #111827;">ZeroToShip</td>
              <td style="text-align: right; font-size: 13px; color: #9ca3af;">${escapeHtml(dateStr)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildStatBar(ideaCount: number, topScore: string, platforms: string[]): string {
  const sourceLabel = platforms.length > 0
    ? `From <strong style="color: #111827;">${platforms.join(', ')}</strong>`
    : 'Curated daily';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f9fafb;">
      <tr>
        <td style="padding: 12px 24px; font-family: ${FONT_STACK}; font-size: 13px; color: #6b7280; text-align: center;">
          <strong style="color: #111827;">${ideaCount}</strong> problems found &nbsp;&middot;&nbsp;
          ${sourceLabel} &nbsp;&middot;&nbsp;
          Top score: <strong style="color: #6366f1;">${topScore}</strong>
        </td>
      </tr>
    </table>`;
}

function buildScoreChips(brief: IdeaBrief): string {
  const effortLabel = formatEffortLabel(brief.effortEstimate);
  return `
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 0 20px 0;">
            <tr>
              <td width="48%" style="background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center;">
                <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Priority</div>
                <div style="font-size: 18px; font-weight: 700; color: #6366f1; margin-top: 2px;">${formatScore(brief.priorityScore)}</div>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background: #ffffff; padding: 10px 12px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: center;">
                <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Build time</div>
                <div style="font-size: 18px; font-weight: 700; color: #111827; margin-top: 2px;">${escapeHtml(effortLabel)}</div>
              </td>
            </tr>
          </table>`;
}

function buildSectionBlock(label: string, content: string): string {
  return `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">${label}</div>
            <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">${content}</p>
          </div>`;
}

function buildHeroSection(brief: IdeaBrief, tier: SubscriberTier, config: Required<EmailBuilderConfig>): string {
  const ideaPath = `/idea/${brief.id || ''}`;
  // Email links are often opened in a logged-out browser session. For free users,
  // route through login with `next` so they land on a fully-unlocked brief after auth.
  const ideaUrl = tier === 'free'
    ? `${config.baseUrl}/login?next=${encodeURIComponent(ideaPath)}`
    : `${config.baseUrl}${ideaPath}`;

  const ctaLabel = tier === 'pro' ? 'View full spec on dashboard' : 'Read the full spec';

  const ctaHtml = `
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 0 20px 0;">
            <tr>
              <td style="background-color: #6366f1; border-radius: 8px; mso-padding-alt: 0;">
                <a href="${escapeHtml(ideaUrl)}" style="display: inline-block; padding: 16px 32px; color: #ffffff; font-family: ${FONT_STACK}; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">${ctaLabel} &#8594;</a>
              </td>
            </tr>
          </table>`;

  let bodyHtml: string;

  if (tier === 'pro') {
    // Pro: full brief sections in the email, CTA at bottom
    const features = brief.keyFeatures.slice(0, 5);
    const featureListHtml = features.length > 0
      ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">Key Features</div>
            ${features.map(f => `<div style="padding: 4px 0 4px 16px; font-size: 15px; color: #374151; line-height: 1.5; position: relative;"><span style="color: #059669; position: absolute; left: 0;">&#10003;</span> ${escapeHtml(stripMarkdown(f))}</div>`).join('\n            ')}
          </div>`
      : '';

    const gtmHtml = brief.goToMarket
      ? buildSectionBlock('Go-to-Market', `${escapeHtml(stripMarkdown(brief.goToMarket.launchStrategy))}`)
      : '';

    bodyHtml = `
          ${buildSectionBlock('The Problem', escapeHtml(stripMarkdown(brief.problemStatement)))}
          ${buildSectionBlock('Target Audience', escapeHtml(stripMarkdown(brief.targetAudience)))}
          ${buildSectionBlock('Proposed Solution', escapeHtml(stripMarkdown(brief.proposedSolution)))}
          ${featureListHtml}
          ${gtmHtml}
          ${ctaHtml}`;
  } else {
    // Free: CTA first (above the fold), then teaser hook below
    const hook = firstSentence(stripMarkdown(brief.problemStatement));
    const featureTeaser = brief.keyFeatures.length > 0
      ? ` The brief covers <strong>${escapeHtml(truncateFeatureName(stripMarkdown(brief.keyFeatures[0].toLowerCase())))}</strong>${brief.keyFeatures.length > 1 ? ` and ${brief.keyFeatures.length - 1} more approaches` : ''}.`
      : '';

    bodyHtml = `
          ${ctaHtml}
          ${buildScoreChips(brief)}
          <p style="margin: 0; font-size: 15px; color: #6b7280; line-height: 1.6;">${escapeHtml(hook)}${featureTeaser}</p>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding: 24px; font-family: ${FONT_STACK}; background: linear-gradient(135deg, #eef2ff 0%, #faf5ff 100%); border-bottom: 1px solid #e5e7eb;">
          <span style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 4px 12px; border-radius: 16px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Today's #1 Problem</span>
          <h2 style="margin: 12px 0 4px 0; font-size: 24px; font-weight: 700; color: #111827; line-height: 1.3;">${escapeHtml(brief.name)}</h2>
          <p style="margin: 0 0 16px 0; font-size: 16px; color: #6b7280; font-style: italic;">${escapeHtml(stripMarkdown(brief.tagline))}</p>
          ${tier === 'pro' ? buildScoreChips(brief) : ''}
          ${bodyHtml}
        </td>
      </tr>
    </table>`;
}

function buildInlineUpgradeBanner(
  briefs: IdeaBrief[],
  config: Required<EmailBuilderConfig>
): string {
  const ideaCount = Math.min(briefs.length, MAX_EMAIL_IDEAS);

  // Rotate copy based on day
  const dateHash = new Date().toISOString().slice(0, 10).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const variants = [
    `You're seeing 1 of today's ${ideaCount} problems. Pro members get full specs for every one.`,
    `Today's lineup has ${ideaCount - 1} more problems just like this one.`,
    briefs.length >= 3
      ? `Today's #3 problem scored ${formatScore(briefs[2].priorityScore)} &#8212; and it's a ${formatEffortLabel(briefs[2].effortEstimate).toLowerCase()} build.`
      : `There are ${ideaCount - 1} more problems waiting for you today.`,
  ];
  const copy = variants[dateHash % variants.length];

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding: 0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f5f3ff; border-left: 3px solid #6366f1; border-radius: 0 8px 8px 0;">
            <tr>
              <td style="padding: 14px 20px; font-family: ${FONT_STACK}; font-size: 14px; color: #374151; line-height: 1.5;">
                ${copy}
                <a href="${escapeHtml(config.upgradeUrl)}" style="color: #6366f1; font-weight: 600; text-decoration: none;"> Unlock all problems &#8594;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildIdeaCard(
  brief: IdeaBrief,
  rank: number,
  locked: boolean,
  tier: SubscriberTier,
  config: Required<EmailBuilderConfig>
): string {
  const effortStyle = getEffortBadgeStyle(brief.effortEstimate);
  const effortLabel = formatEffortLabel(brief.effortEstimate);
  const ideaPath = `/idea/${brief.id || ''}`;
  const ideaUrl = tier === 'free'
    ? `${config.baseUrl}/login?next=${encodeURIComponent(ideaPath)}`
    : `${config.baseUrl}${ideaPath}`;
  const tagline = brief.tagline.length > TAGLINE_TRUNCATE_LENGTH
    ? brief.tagline.slice(0, TAGLINE_TRUNCATE_LENGTH) + '...'
    : brief.tagline;

  if (locked) {
    return `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 8px;">
        <tr>
          <td style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; padding: 14px 16px; font-family: ${FONT_STACK}; opacity: 0.6;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td width="28" style="vertical-align: top; font-size: 14px; font-weight: 700; color: #6366f1;">#${rank}</td>
                <td style="vertical-align: top; padding-left: 12px;">
                  <div style="font-size: 15px; font-weight: 600; color: #111827;">${escapeHtml(brief.name)}</div>
                  <div style="background-color: #d1d5db; border-radius: 4px; height: 12px; width: 70%; margin-top: 6px;"></div>
                </td>
                <td width="48" style="vertical-align: top; text-align: right;">
                  <span style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">PRO</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom: 8px;">
      <tr>
        <td style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; padding: 14px 16px; font-family: ${FONT_STACK};">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td width="28" style="vertical-align: top; font-size: 14px; font-weight: 700; color: #6366f1;">#${rank}</td>
              <td style="vertical-align: top; padding-left: 12px;">
                <div style="font-size: 15px; font-weight: 600; color: #111827; margin-bottom: 2px;">${escapeHtml(brief.name)}</div>
                <div style="font-size: 13px; color: #6b7280; margin-bottom: 6px;">${escapeHtml(tagline)}</div>
                <span style="display: inline-block; background-color: ${effortStyle.bg}; color: ${effortStyle.text}; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${escapeHtml(effortLabel)}</span>
              </td>
              <td width="48" style="vertical-align: top; text-align: right;">
                <div style="font-size: 18px; font-weight: 700; color: #6366f1;">${formatScore(brief.priorityScore)}</div>
              </td>
            </tr>
            <tr>
              <td></td>
              <td colspan="2" style="padding-top: 8px;">
                <a href="${escapeHtml(ideaUrl)}" style="color: #6366f1; font-size: 14px; font-weight: 600; text-decoration: none;">View problem &#8594;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildOtherIdeasSection(
  briefs: IdeaBrief[],
  tier: SubscriberTier,
  config: Required<EmailBuilderConfig>
): string {
  if (briefs.length <= 1) return '';

  const limit = TIER_LIMITS[tier];
  const otherBriefs = briefs.slice(1, MAX_EMAIL_IDEAS);
  const lockedCount = Math.max(0, otherBriefs.length - (limit - 1));
  const maxLockedShown = 3;
  const weekendBuilds = otherBriefs
    .filter((b, i) => i + 2 > limit && b.effortEstimate.toLowerCase() === 'weekend')
    .length;

  // Show unlocked cards + up to 3 locked cards (avoid paywall fatigue)
  const visibleBriefs = tier === 'free'
    ? otherBriefs.slice(0, (limit - 1) + maxLockedShown)
    : otherBriefs;

  const rows = visibleBriefs.map((brief, index) => {
    const rank = index + 2;
    const locked = rank > limit;
    return buildIdeaCard(brief, rank, locked, tier, config);
  }).join('\n');

  const lockedFooter = lockedCount > 0 && tier === 'free'
    ? `
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top: 8px;">
        <tr>
          <td style="text-align: center; padding: 12px 0; font-family: ${FONT_STACK};">
            <span style="font-size: 14px; color: #6b7280;">+${lockedCount} more problem${lockedCount > 1 ? 's' : ''} available with Pro${weekendBuilds > 0 ? ` &#8212; including ${weekendBuilds} weekend build${weekendBuilds > 1 ? 's' : ''}` : ''}</span>
          </td>
        </tr>
      </table>`
    : '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td style="padding: 24px; font-family: ${FONT_STACK};">
          <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">More Problems Today</div>
          ${rows}
          ${lockedFooter}
        </td>
      </tr>
    </table>`;
}

function buildBottomCta(
  tier: SubscriberTier,
  freeCount: number,
  totalCount: number,
  config: Required<EmailBuilderConfig>
): string {
  if (tier === 'pro') return '';

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #111827;">
      <tr>
        <td style="padding: 32px 24px; text-align: center; font-family: ${FONT_STACK};">
          <div style="font-size: 20px; font-weight: 700; color: #ffffff; margin-bottom: 8px;">You browsed ${freeCount} problems today. Pro members get full specs for all of them.</div>
          <div style="font-size: 16px; color: rgba(255,255,255,0.7); margin-bottom: 20px;">Every problem. Every spec. Every day.</div>
          <table cellpadding="0" cellspacing="0" role="presentation" style="margin: 0 auto;">
            <tr>
              <td style="background-color: #ffffff; border-radius: 8px;">
                <a href="${escapeHtml(config.upgradeUrl)}" style="display: inline-block; padding: 14px 32px; color: #111827; font-family: ${FONT_STACK}; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px;">Upgrade to Pro &#8594;</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function buildFooter(config: Required<EmailBuilderConfig>): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f9fafb;">
      <tr>
        <td style="padding: 24px; text-align: center; font-family: ${FONT_STACK};">
          <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af;">You're receiving this because you signed up at zerotoship.dev.</p>
          <p style="margin: 0 0 8px 0; font-size: 13px;">
            <a href="${escapeHtml(config.baseUrl)}/settings" style="color: #6b7280; text-decoration: underline;">Manage preferences</a>
            &nbsp;&middot;&nbsp;
            <a href="${escapeHtml(config.unsubscribeUrl)}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
          </p>
          <p style="margin: 0; font-size: 12px; color: #9ca3af;">ZeroToShip ${new Date().getFullYear()}</p>
        </td>
      </tr>
    </table>`;
}

export function buildDailyEmail(
  briefs: IdeaBrief[],
  tier: SubscriberTier,
  config: EmailBuilderConfig = {}
): EmailContent {
  const opts = { ...DEFAULT_CONFIG, ...config };

  if (briefs.length === 0) {
    return {
      subject: 'ZeroToShip: No problems today',
      html: '<p>No new problems found today. Check back tomorrow!</p>',
      text: 'No new problems found today. Check back tomorrow!',
    };
  }

  // Sort by priority score descending so the best idea is always #1
  briefs = [...briefs].sort((a, b) => Number(b.priorityScore) - Number(a.priorityScore));

  const topIdea = briefs[0];
  const ideaCount = Math.min(briefs.length, MAX_EMAIL_IDEAS);
  const freeCount = Math.min(briefs.length, TIER_LIMITS.free);
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const subject = generateSubjectLine(topIdea, ideaCount);
  const previewText = generatePreviewText(topIdea, ideaCount);

  // Extract unique platform names from all briefs' sources
  const platformSet = new Set<string>();
  for (const b of briefs) {
    if (b.sources) {
      for (const s of b.sources) {
        const label = PLATFORM_LABELS[s.platform];
        if (label) platformSet.add(label);
      }
    }
  }
  const platforms = [...platformSet];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]>
  <style type="text/css">
    table { border-collapse: collapse; }
    td { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: ${FONT_STACK};">
  ${buildPreheader(previewText)}
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 16px 0;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr><td>
            ${buildHeader(dateStr)}
            ${buildStatBar(ideaCount, formatScore(topIdea.priorityScore), platforms)}
            ${buildHeroSection(topIdea, tier, opts)}
            ${tier === 'free' ? buildInlineUpgradeBanner(briefs, opts) : ''}
            ${buildOtherIdeasSection(briefs, tier, opts)}
            ${buildBottomCta(tier, freeCount, ideaCount, opts)}
            ${buildFooter(opts)}
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const text = buildPlainTextEmail(briefs, tier, opts);

  return { subject, html, text };
}

function buildPlainTextEmail(
  briefs: IdeaBrief[],
  tier: SubscriberTier,
  config: Required<EmailBuilderConfig>
): string {
  if (briefs.length === 0) {
    return 'No new problems found today. Check back tomorrow!';
  }

  const limit = TIER_LIMITS[tier];
  const topIdea = briefs[0];
  const ideaCount = Math.min(briefs.length, MAX_EMAIL_IDEAS);
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const lines: string[] = [];

  // Extract unique platform names for stat line
  const platformSet = new Set<string>();
  for (const b of briefs) {
    if (b.sources) {
      for (const s of b.sources) {
        const label = PLATFORM_LABELS[s.platform];
        if (label) platformSet.add(label);
      }
    }
  }
  const sourceLabel = platformSet.size > 0 ? `From ${[...platformSet].join(', ')}` : 'Curated daily';

  lines.push(`ZEROTOSHIP | ${dateStr}`);
  lines.push(`${ideaCount} problems found | ${sourceLabel} | Top score: ${formatScore(topIdea.priorityScore)}`);
  lines.push('='.repeat(60));
  lines.push('');

  lines.push("#1 TODAY'S TOP PROBLEM");
  lines.push('');
  lines.push(topIdea.name);
  lines.push(`"${stripMarkdown(topIdea.tagline)}"`);
  lines.push('');
  lines.push(`Read the full spec: ${config.baseUrl}/idea/${topIdea.id || ''}`);
  lines.push('');
  lines.push(`Score: ${formatScore(topIdea.priorityScore)}/100 | Build time: ${formatEffortLabel(topIdea.effortEstimate)}`);
  lines.push('');

  if (tier === 'pro') {
    lines.push('THE PROBLEM');
    lines.push(stripMarkdown(topIdea.problemStatement));
    lines.push('');
    lines.push('TARGET AUDIENCE');
    lines.push(stripMarkdown(topIdea.targetAudience));
    lines.push('');
    lines.push('PROPOSED SOLUTION');
    lines.push(stripMarkdown(topIdea.proposedSolution));
    lines.push('');
    if (topIdea.keyFeatures.length > 0) {
      lines.push('KEY FEATURES');
      topIdea.keyFeatures.slice(0, 5).forEach(f => lines.push(`  ✓ ${stripMarkdown(f)}`));
      lines.push('');
    }
    if (topIdea.goToMarket) {
      lines.push('GO-TO-MARKET');
      lines.push(stripMarkdown(topIdea.goToMarket.launchStrategy));
      lines.push('');
    }
    lines.push(`View full spec on dashboard: ${config.baseUrl}/idea/${topIdea.id || ''}`);
  } else {
    lines.push(firstSentence(stripMarkdown(topIdea.problemStatement)));
    if (topIdea.keyFeatures.length > 0) {
      lines.push(`The brief covers ${truncateFeatureName(stripMarkdown(topIdea.keyFeatures[0].toLowerCase()))}${topIdea.keyFeatures.length > 1 ? ` and ${topIdea.keyFeatures.length - 1} more approaches` : ''}.`);
    }
    lines.push('');
    lines.push(`Read the full spec: ${config.baseUrl}/idea/${topIdea.id || ''}`);
  }
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('');

  if (briefs.length > 1) {
    lines.push("MORE PROBLEMS TODAY");
    lines.push('');

    briefs.slice(1, MAX_EMAIL_IDEAS).forEach((brief, index) => {
      const rank = index + 2;
      const locked = rank > limit;

      if (locked) {
        lines.push(`#${rank} ${brief.name} [PRO]`);
      } else {
        lines.push(`#${rank} ${brief.name} — Score: ${formatScore(brief.priorityScore)} [${formatEffortLabel(brief.effortEstimate)}]`);
        lines.push(`   "${brief.tagline}"`);
        lines.push(`   View problem: ${config.baseUrl}/idea/${brief.id || ''}`);
      }
      lines.push('');
    });
  }

  if (tier === 'free') {
    const lockedCount = Math.max(0, Math.min(briefs.length, MAX_EMAIL_IDEAS) - TIER_LIMITS.free);
    if (lockedCount > 0) {
      lines.push('-'.repeat(60));
      lines.push(`+${lockedCount} more problems with full specs available on Pro.`);
      lines.push(`Unlock all problems: ${config.upgradeUrl}`);
      lines.push('');
    }

    lines.push('-'.repeat(60));
    lines.push(`You browsed ${Math.min(briefs.length, TIER_LIMITS.free)} problems today. Pro members get full specs for all of them.`);
    lines.push('Every problem. Every spec. Every day.');
    lines.push(`Upgrade to Pro: ${config.upgradeUrl}`);
    lines.push('');
  }

  lines.push('-'.repeat(60));
  lines.push(`Manage preferences: ${config.baseUrl}/settings`);
  lines.push(`Unsubscribe: ${config.unsubscribeUrl}`);
  lines.push(`ZeroToShip ${new Date().getFullYear()}`);

  return lines.join('\n');
}

export function previewEmail(content: EmailContent): void {
  logger.info({ subject: content.subject }, 'Email preview');
  logger.info(content.text);
}

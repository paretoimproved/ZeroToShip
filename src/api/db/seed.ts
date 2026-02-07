/**
 * Database Seed Script for IdeaForge
 *
 * Creates test users for each tier and sample ideas for testing
 */

import { randomBytes } from 'crypto';
import { db } from './client';
import { users, userPreferences, apiKeys, ideas, subscriptions } from './schema';
import { eq } from 'drizzle-orm';

// Test users for each tier
const seedUsers = [
  {
    email: 'free@test.ideaforge.io',
    name: 'Free Test User',
    tier: 'free' as const,
  },
  {
    email: 'pro@test.ideaforge.io',
    name: 'Pro Test User',
    tier: 'pro' as const,
  },
  {
    email: 'enterprise@test.ideaforge.io',
    name: 'Enterprise Test User',
    tier: 'enterprise' as const,
  },
];

// Sample ideas with full briefs
const seedIdeas = [
  {
    name: 'CodeReview AI',
    tagline: 'AI-powered code review assistant that catches bugs before they ship',
    priorityScore: '92.50',
    effortEstimate: 'month',
    revenueEstimate: '$50K-200K ARR in Year 1',
    category: 'Developer Tools',
    problemStatement:
      'Code reviews are slow, inconsistent, and often miss subtle bugs. Senior developers spend 20-30% of their time reviewing code.',
    targetAudience: 'Software development teams at startups and mid-size companies (10-500 engineers)',
    marketSize: '$4.2B developer tools market, 27M developers worldwide',
    existingSolutions: 'GitHub Copilot, SonarQube, CodeClimate, DeepSource',
    gaps: 'Existing tools focus on static analysis, not contextual understanding. No tool learns team-specific patterns.',
    proposedSolution:
      'AI assistant trained on your codebase that reviews PRs like your best engineer, learning team conventions and catching context-specific issues.',
    keyFeatures: [
      'Learns from your merged PRs and coding conventions',
      'Contextual bug detection (not just linting)',
      'Explains suggestions in plain English',
      'Slack/Teams integration for real-time notifications',
      'Security vulnerability scanning',
    ],
    mvpScope:
      'GitHub App that comments on PRs with AI-generated review feedback. Start with JavaScript/TypeScript, expand to Python.',
    technicalSpec: {
      stack: ['TypeScript', 'Node.js', 'OpenAI GPT-4', 'PostgreSQL', 'Redis'],
      architecture: 'Serverless functions triggered by GitHub webhooks, RAG pipeline for codebase context',
      estimatedEffort: '6-8 weeks for MVP',
    },
    businessModel: {
      pricing: '$19/dev/month for teams, $99/month for startups (up to 10 devs)',
      revenueProjection: '500 teams at $99 = $50K MRR by month 12',
      monetizationPath: 'PLG with team-based pricing, upgrade for custom training',
    },
    goToMarket: {
      launchStrategy: 'Launch on Product Hunt, Hacker News, dev Twitter',
      channels: ['Dev Twitter', 'Reddit r/programming', 'Discord communities', 'Tech newsletters'],
      firstCustomers: 'YC startups and indie hackers with active GitHub repos',
    },
    risks: [
      'OpenAI API costs could eat into margins',
      'GitHub may add similar features to Copilot',
      'Training on proprietary code raises IP concerns',
    ],
    isPublished: true,
    publishedAt: new Date(),
  },
  {
    name: 'MeetingMind',
    tagline: 'Turn chaotic meetings into actionable items automatically',
    priorityScore: '88.75',
    effortEstimate: 'quarter',
    revenueEstimate: '$100K-500K ARR in Year 1',
    category: 'Productivity',
    problemStatement:
      'Teams waste 31 hours per month in unproductive meetings. Action items get lost, decisions are forgotten, and the same topics resurface.',
    targetAudience: 'Remote-first teams and hybrid companies with 20-200 employees',
    marketSize: '$13B meeting software market, growing 12% annually',
    existingSolutions: 'Otter.ai, Fireflies.ai, Grain, Fathom',
    gaps: 'Current tools transcribe but dont understand. No integration with project management. No follow-up tracking.',
    proposedSolution:
      'AI meeting assistant that extracts decisions, creates Jira/Linear tickets, and follows up on incomplete items in Slack.',
    keyFeatures: [
      'Real-time transcription with speaker identification',
      'Automatic action item extraction',
      'Direct integration with Jira, Linear, Asana, Notion',
      'Slack bot for follow-ups and reminders',
      'Meeting analytics dashboard',
    ],
    mvpScope:
      'Zoom integration with transcription, action item extraction, and Slack notifications. Manual review before ticket creation.',
    technicalSpec: {
      stack: ['Python', 'FastAPI', 'Whisper', 'GPT-4', 'PostgreSQL', 'Redis'],
      architecture: 'Real-time audio processing pipeline, async task queue for transcription and analysis',
      estimatedEffort: '10-12 weeks for MVP',
    },
    businessModel: {
      pricing: '$15/user/month, minimum 5 users. Enterprise custom pricing.',
      revenueProjection: '200 companies at 20 users = $600K ARR by month 18',
      monetizationPath: 'Free trial with usage limits, team-based subscription',
    },
    goToMarket: {
      launchStrategy: 'Partner with remote-first consultancies, offer free trials to YC companies',
      channels: ['LinkedIn ads targeting ops/product managers', 'Remote work newsletters', 'Slack community partnerships'],
      firstCustomers: 'Consultancies and agencies with heavy meeting loads',
    },
    risks: [
      'Zoom/Google may add native features',
      'Audio processing costs at scale',
      'Privacy concerns with meeting recordings',
      'Integration maintenance burden',
    ],
    isPublished: true,
    publishedAt: new Date(),
  },
  {
    name: 'InvoiceGenie',
    tagline: 'Invoice processing that actually works for small businesses',
    priorityScore: '85.00',
    effortEstimate: 'week',
    revenueEstimate: '$20K-80K ARR in Year 1',
    category: 'FinTech',
    problemStatement:
      'Small business owners spend 5+ hours weekly on invoice management. Manual data entry leads to errors and late payments.',
    targetAudience: 'Freelancers and small businesses with 1-20 employees, processing 20-200 invoices/month',
    marketSize: '$8.5B accounts payable automation market',
    existingSolutions: 'Bill.com, Dext, Hubdoc, QuickBooks',
    gaps: 'Existing tools are expensive and complex. OCR accuracy is poor on non-standard invoices. No mobile-first solution.',
    proposedSolution:
      'Mobile-first invoice scanner with AI extraction that syncs with your accounting software. Snap a photo, done.',
    keyFeatures: [
      'Camera-based invoice capture with AI extraction',
      'Automatic categorization and GL coding',
      'QuickBooks/Xero sync',
      'Approval workflows for teams',
      'Expense tracking integration',
    ],
    mvpScope:
      'iOS app with camera capture, basic extraction (vendor, amount, date), and QuickBooks export. Manual review step.',
    technicalSpec: {
      stack: ['React Native', 'Node.js', 'AWS Textract', 'GPT-4', 'PostgreSQL'],
      architecture: 'Mobile app with cloud processing, async job queue for OCR and extraction',
      estimatedEffort: '4-6 weeks for MVP',
    },
    businessModel: {
      pricing: '$9/month for solo, $29/month for teams (up to 5 users)',
      revenueProjection: '1000 solos + 200 teams = $15K MRR by month 12',
      monetizationPath: 'Freemium with 10 invoices/month free, paid for volume',
    },
    goToMarket: {
      launchStrategy: 'App Store optimization, accounting influencer partnerships',
      channels: ['Accounting Twitter/LinkedIn', 'Small business podcasts', 'Bookkeeper referrals'],
      firstCustomers: 'Freelance designers and consultants via Dribbble, Behance communities',
    },
    risks: [
      'Crowded market with established players',
      'QuickBooks API dependencies',
      'OCR accuracy on varied invoice formats',
    ],
    isPublished: true,
    publishedAt: new Date(),
  },
  {
    name: 'DevOnboard',
    tagline: 'Get new developers productive in days, not months',
    priorityScore: '79.25',
    effortEstimate: 'month',
    revenueEstimate: '$30K-120K ARR in Year 1',
    category: 'Developer Tools',
    problemStatement:
      'New developer onboarding takes 3-6 months. Tribal knowledge lives in Slack threads. Documentation is always outdated.',
    targetAudience: 'Engineering teams at Series A-C startups with 15-100 engineers, hiring 5+ devs/year',
    marketSize: '$2.1B developer experience market',
    existingSolutions: 'Notion, Confluence, README files, internal wikis',
    gaps: 'Static docs dont answer questions. No way to know if onboarding worked. No personalized learning paths.',
    proposedSolution:
      'AI onboarding assistant that answers questions from your codebase, tracks progress, and identifies knowledge gaps.',
    keyFeatures: [
      'AI chat that answers questions from your docs/code/Slack',
      'Personalized onboarding checklists',
      'Progress tracking for managers',
      'Knowledge gap identification',
      'Automatic doc generation from code',
    ],
    mvpScope:
      'VS Code extension with AI chat, connected to GitHub repo and Notion. Basic progress tracking dashboard.',
    technicalSpec: {
      stack: ['TypeScript', 'VS Code Extension API', 'OpenAI', 'Pinecone', 'PostgreSQL'],
      architecture: 'RAG pipeline indexing code, docs, and Slack. VS Code extension for chat interface.',
      estimatedEffort: '8-10 weeks for MVP',
    },
    businessModel: {
      pricing: '$49/new hire/month for first 3 months, then $19/seat/month for continued access',
      revenueProjection: '50 companies onboarding 10 devs/year = $150K ARR',
      monetizationPath: 'Usage-based for onboarding, platform fee for continued access',
    },
    goToMarket: {
      launchStrategy: 'Partner with recruiting firms, target companies with open engineering roles',
      channels: ['Engineering leadership newsletters', 'CTO Slack communities', 'Dev conferences'],
      firstCustomers: 'Fast-growing startups that just raised Series A/B',
    },
    risks: [
      'Long sales cycle for enterprise',
      'Requires deep integration to be useful',
      'Success metrics hard to measure',
    ],
    isPublished: true,
    publishedAt: new Date(),
  },
  {
    name: 'StatusPage Pro',
    tagline: 'Beautiful status pages that actually help during incidents',
    priorityScore: '72.50',
    effortEstimate: 'weekend',
    revenueEstimate: '$10K-40K ARR in Year 1',
    category: 'Developer Tools',
    problemStatement:
      'When services go down, customers flood support. Status pages are ugly, hard to update, and dont communicate well.',
    targetAudience: 'SaaS companies with 100-10,000 customers who need to communicate uptime',
    marketSize: '$800M incident management market',
    existingSolutions: 'Statuspage.io (Atlassian), Better Uptime, Instatus, Sorry',
    gaps: 'Expensive for small teams. Clunky mobile updates. No AI-assisted communication.',
    proposedSolution:
      'Modern status page with AI-drafted incident updates, one-click mobile publishing, and customer-friendly design.',
    keyFeatures: [
      'Beautiful, customizable status page themes',
      'AI-drafted incident updates',
      'Mobile app for quick updates',
      'Slack/PagerDuty integration',
      'Subscriber email notifications',
    ],
    mvpScope:
      'Hosted status page with manual updates, email notifications, and basic customization. Mobile web interface.',
    technicalSpec: {
      stack: ['Next.js', 'Tailwind CSS', 'Vercel', 'PostgreSQL', 'Resend'],
      architecture: 'Static site generation for status pages, API for updates, email queue for notifications',
      estimatedEffort: '2-3 weeks for MVP',
    },
    businessModel: {
      pricing: '$9/month hobby, $29/month startup, $99/month business',
      revenueProjection: '300 customers at $29 avg = $9K MRR by month 12',
      monetizationPath: 'Self-serve signup, credit card upfront',
    },
    goToMarket: {
      launchStrategy: 'Launch on Indie Hackers, target companies with ugly status pages',
      channels: ['Dev Twitter', 'Indie Hackers', 'Product Hunt', 'Hacker News'],
      firstCustomers: 'Indie hackers and early-stage startups (cheapest plan)',
    },
    risks: [
      'Highly competitive market',
      'Low switching costs means easy churn',
      'Features quickly commoditized',
    ],
    isPublished: true,
    publishedAt: new Date(),
  },
  {
    name: 'SupplyChainRadar',
    tagline: 'Early warning system for supply chain disruptions',
    priorityScore: '68.00',
    effortEstimate: 'quarter',
    revenueEstimate: '$200K-1M ARR in Year 1',
    category: 'Enterprise',
    problemStatement:
      'Supply chain disruptions cost companies millions. By the time issues surface in the news, its too late to react.',
    targetAudience: 'Supply chain managers at manufacturing companies with $50M-500M revenue',
    marketSize: '$19B supply chain management software market',
    existingSolutions: 'Resilinc, Everstream, Interos, DHL Resilience360',
    gaps: 'Enterprise-only pricing. Slow to add new data sources. No SMB-friendly option.',
    proposedSolution:
      'AI-powered monitoring of news, social media, and shipping data to predict disruptions before they happen.',
    keyFeatures: [
      'Real-time monitoring of global news and social media',
      'Supplier risk scoring',
      'Disruption prediction with lead time estimates',
      'Alternative supplier recommendations',
      'Integration with ERP systems',
    ],
    mvpScope:
      'News monitoring dashboard with alerts for specified suppliers/regions. Manual risk scoring, email alerts.',
    technicalSpec: {
      stack: ['Python', 'FastAPI', 'Apache Kafka', 'Elasticsearch', 'PostgreSQL', 'GPT-4'],
      architecture: 'Event-driven pipeline for news ingestion, ML models for risk scoring, REST API for dashboard',
      estimatedEffort: '12-16 weeks for MVP',
    },
    businessModel: {
      pricing: '$499/month for SMB, $2,499/month for mid-market, enterprise custom',
      revenueProjection: '50 SMBs + 20 mid-market = $75K MRR by month 18',
      monetizationPath: 'Demo-based sales, annual contracts for enterprise',
    },
    goToMarket: {
      launchStrategy: 'Partner with supply chain consultancies, target companies affected by recent disruptions',
      channels: ['Supply chain conferences', 'LinkedIn outbound', 'Industry publications'],
      firstCustomers: 'Mid-market manufacturers with recent supply chain issues (public news)',
    },
    risks: [
      'Long enterprise sales cycles',
      'Data accuracy and false positives',
      'Requires domain expertise to build credibility',
      'Established competitors with deep pockets',
    ],
    isPublished: true,
    publishedAt: new Date(),
  },
];

// Generate test API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(40);
  let key = 'if_test_';
  for (let i = 0; i < 40; i++) {
    key += chars.charAt(bytes[i] % chars.length);
  }
  return key;
}

export async function seed(): Promise<void> {
  console.log('Starting database seed...');

  try {
    // 1. Insert test users
    console.log('Inserting test users...');
    const insertedUsers: Array<{ id: string; email: string; tier: string }> = [];

    for (const userData of seedUsers) {
      // Check if user already exists
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  User ${userData.email} already exists, skipping`);
        insertedUsers.push({ id: existing[0].id, email: existing[0].email, tier: existing[0].tier });
        continue;
      }

      const [user] = await db
        .insert(users)
        .values(userData)
        .returning({ id: users.id, email: users.email, tier: users.tier });

      console.log(`  Created user: ${user.email} (${user.tier})`);
      insertedUsers.push(user);
    }

    // 2. Create preferences for each user
    console.log('Creating user preferences...');
    for (const user of insertedUsers) {
      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  Preferences for ${user.email} already exist, skipping`);
        continue;
      }

      await db.insert(userPreferences).values({
        userId: user.id,
        categories: ['Developer Tools', 'Productivity', 'FinTech'],
        maxEffort: 'month',
        emailFrequency: 'daily',
        minPriorityScore: '70.00',
      });
      console.log(`  Created preferences for ${user.email}`);
    }

    // 3. Create subscriptions for pro and enterprise users
    console.log('Creating subscriptions...');
    for (const user of insertedUsers) {
      if (user.tier === 'free') continue;

      const existing = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  Subscription for ${user.email} already exists, skipping`);
        continue;
      }

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await db.insert(subscriptions).values({
        userId: user.id,
        plan: user.tier,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
      console.log(`  Created ${user.tier} subscription for ${user.email}`);
    }

    // 4. Create API key for enterprise user
    console.log('Creating API keys...');
    const enterpriseUser = insertedUsers.find((u) => u.tier === 'enterprise');
    if (enterpriseUser) {
      const existing = await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, enterpriseUser.id))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  API key for ${enterpriseUser.email} already exists: ${existing[0].key.substring(0, 20)}...`);
      } else {
        const key = generateApiKey();
        await db.insert(apiKeys).values({
          userId: enterpriseUser.id,
          key,
          name: 'Test API Key',
          isActive: true,
        });
        console.log(`  Created API key for ${enterpriseUser.email}: ${key.substring(0, 20)}...`);
      }
    }

    // 5. Insert sample ideas
    console.log('Inserting sample ideas...');
    for (const ideaData of seedIdeas) {
      const existing = await db
        .select()
        .from(ideas)
        .where(eq(ideas.name, ideaData.name))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  Idea "${ideaData.name}" already exists, skipping`);
        continue;
      }

      await db.insert(ideas).values(ideaData);
      console.log(`  Created idea: ${ideaData.name} (score: ${ideaData.priorityScore})`);
    }

    console.log('\nSeed completed successfully!');
    console.log(`  Users: ${insertedUsers.length}`);
    console.log(`  Ideas: ${seedIdeas.length}`);
  } catch (error) {
    console.error('Seed failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

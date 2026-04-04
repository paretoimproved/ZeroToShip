/**
 * Tech Stack Recommendations for ZeroToShip
 *
 * Provides opinionated tech stack recommendations based on
 * problem characteristics and effort estimates.
 */

export interface TechStackRecommendation {
  name: string;
  stack: string[];
  architecture: string;
  hosting: string;
  estimatedCost: string;
  bestFor: string[];
}

/**
 * Quick MVP stacks for weekend projects
 */
export const WEEKEND_STACKS: TechStackRecommendation[] = [
  {
    name: 'Next.js + Vercel',
    stack: ['Next.js 14', 'TypeScript', 'Tailwind CSS', 'Vercel Postgres', 'Clerk Auth'],
    architecture: 'Serverless full-stack with edge functions',
    hosting: 'Vercel (free tier)',
    estimatedCost: '$0-20/month',
    bestFor: ['SaaS dashboards', 'Landing pages with waitlist', 'Content sites', 'Simple CRUD apps'],
  },
  {
    name: 'Remix + Fly.io',
    stack: ['Remix', 'TypeScript', 'Tailwind CSS', 'SQLite', 'Lucia Auth'],
    architecture: 'Full-stack with server-side rendering',
    hosting: 'Fly.io (free tier)',
    estimatedCost: '$0-10/month',
    bestFor: ['Form-heavy apps', 'Real-time apps', 'Progressive enhancement'],
  },
  {
    name: 'SvelteKit + Supabase',
    stack: ['SvelteKit', 'TypeScript', 'Tailwind CSS', 'Supabase'],
    architecture: 'Serverless with BaaS',
    hosting: 'Vercel/Netlify + Supabase',
    estimatedCost: '$0-25/month',
    bestFor: ['Real-time apps', 'Apps needing auth + storage', 'Rapid prototyping'],
  },
];

/**
 * Week-long project stacks
 */
export const WEEK_STACKS: TechStackRecommendation[] = [
  {
    name: 'Next.js + Prisma + PostgreSQL',
    stack: ['Next.js 14', 'TypeScript', 'Prisma', 'PostgreSQL', 'NextAuth.js', 'Stripe'],
    architecture: 'Serverless with managed database',
    hosting: 'Vercel + Supabase/Neon',
    estimatedCost: '$10-50/month',
    bestFor: ['SaaS products', 'Marketplaces', 'Subscription services'],
  },
  {
    name: 'FastAPI + React + PostgreSQL',
    stack: ['FastAPI', 'Python', 'React', 'PostgreSQL', 'Redis', 'Docker'],
    architecture: 'API-first microservice',
    hosting: 'Railway/Render',
    estimatedCost: '$10-40/month',
    bestFor: ['AI/ML integrations', 'Data processing', 'API-heavy products'],
  },
  {
    name: 'T3 Stack',
    stack: ['Next.js', 'tRPC', 'Prisma', 'TypeScript', 'Tailwind CSS', 'NextAuth.js'],
    architecture: 'End-to-end type-safe full-stack',
    hosting: 'Vercel + PlanetScale',
    estimatedCost: '$0-30/month',
    bestFor: ['Complex web apps', 'Type-safety critical apps', 'Team projects'],
  },
];

/**
 * Month-long project stacks
 */
export const MONTH_STACKS: TechStackRecommendation[] = [
  {
    name: 'Enterprise SaaS Stack',
    stack: ['Next.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Stripe', 'Resend', 'Sentry', 'Posthog'],
    architecture: 'Multi-tenant SaaS with analytics',
    hosting: 'Vercel + AWS RDS',
    estimatedCost: '$50-200/month',
    bestFor: ['B2B SaaS', 'Team collaboration tools', 'Enterprise software'],
  },
  {
    name: 'AI-First Stack',
    stack: ['Next.js', 'Python/FastAPI', 'PostgreSQL + pgvector', 'OpenAI API', 'Pinecone', 'LangChain'],
    architecture: 'Hybrid: Node frontend + Python AI backend',
    hosting: 'Vercel + Modal/Replicate',
    estimatedCost: '$50-500/month (API costs)',
    bestFor: ['AI products', 'LLM applications', 'Semantic search', 'Chatbots'],
  },
  {
    name: 'Mobile-First Stack',
    stack: ['React Native/Expo', 'TypeScript', 'Supabase', 'RevenueCat', 'Sentry'],
    architecture: 'Cross-platform mobile with BaaS',
    hosting: 'App stores + Supabase',
    estimatedCost: '$100-300/month',
    bestFor: ['Consumer mobile apps', 'Utilities', 'Social apps'],
  },
];

/**
 * Quarter-long project stacks
 */
export const QUARTER_STACKS: TechStackRecommendation[] = [
  {
    name: 'Scalable Platform Stack',
    stack: ['Next.js', 'Go/Rust microservices', 'PostgreSQL', 'Redis', 'Kafka', 'Kubernetes'],
    architecture: 'Microservices with event-driven communication',
    hosting: 'AWS/GCP',
    estimatedCost: '$500-2000/month',
    bestFor: ['Platforms', 'High-traffic apps', 'Complex workflows'],
  },
  {
    name: 'Marketplace Stack',
    stack: ['Next.js', 'PostgreSQL', 'Stripe Connect', 'Algolia', 'SendGrid', 'Cloudflare'],
    architecture: 'Multi-sided marketplace with search',
    hosting: 'Vercel + AWS',
    estimatedCost: '$200-1000/month',
    bestFor: ['Marketplaces', 'Booking platforms', 'Service directories'],
  },
];

/**
 * All stacks by effort level
 */
export const STACKS_BY_EFFORT = {
  weekend: WEEKEND_STACKS,
  week: WEEK_STACKS,
  month: MONTH_STACKS,
  quarter: QUARTER_STACKS,
} as const;

export type EffortLevel = keyof typeof STACKS_BY_EFFORT;

/**
 * Problem categories and their typical stacks
 */
export const PROBLEM_CATEGORY_STACKS: Record<string, string[]> = {
  'developer-tools': ['Next.js', 'TypeScript', 'Tailwind CSS', 'PostgreSQL', 'Clerk'],
  'ai-ml': ['FastAPI', 'Python', 'OpenAI API', 'PostgreSQL + pgvector', 'LangChain'],
  'saas': ['Next.js', 'TypeScript', 'Prisma', 'PostgreSQL', 'Stripe', 'NextAuth.js'],
  'marketplace': ['Next.js', 'PostgreSQL', 'Stripe Connect', 'Algolia', 'SendGrid'],
  'mobile': ['React Native/Expo', 'TypeScript', 'Supabase', 'RevenueCat'],
  'automation': ['Node.js', 'TypeScript', 'Bull/BullMQ', 'Redis', 'PostgreSQL'],
  'analytics': ['Next.js', 'ClickHouse', 'TimescaleDB', 'Grafana', 'PostgreSQL'],
  'social': ['Next.js', 'PostgreSQL', 'Redis', 'WebSockets', 'S3/R2'],
  'productivity': ['Next.js', 'TypeScript', 'PostgreSQL', 'Clerk', 'Tailwind CSS'],
  'fintech': ['Next.js', 'TypeScript', 'PostgreSQL', 'Plaid', 'Stripe'],
};

/**
 * Keywords that map to problem categories
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'developer-tools': ['api', 'cli', 'sdk', 'developer', 'code', 'git', 'debug', 'testing', 'deploy'],
  'ai-ml': ['ai', 'ml', 'gpt', 'llm', 'chatbot', 'automate', 'intelligent', 'predict', 'classify'],
  'saas': ['subscription', 'team', 'collaborate', 'dashboard', 'manage', 'track', 'admin'],
  'marketplace': ['buy', 'sell', 'marketplace', 'listing', 'vendor', 'booking', 'hire'],
  'mobile': ['app', 'ios', 'android', 'mobile', 'notification', 'offline'],
  'automation': ['automate', 'workflow', 'schedule', 'trigger', 'integrate', 'sync'],
  'analytics': ['analytics', 'metrics', 'tracking', 'insights', 'report', 'dashboard'],
  'social': ['social', 'community', 'share', 'follow', 'feed', 'post', 'comment'],
  'productivity': ['productivity', 'todo', 'task', 'note', 'organize', 'reminder', 'calendar'],
  'fintech': ['payment', 'invoice', 'expense', 'budget', 'finance', 'money', 'bank'],
};

/**
 * Detect problem category from problem statement
 */
export function detectCategory(problemStatement: string): string {
  const lowerStatement = problemStatement.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = 0;
    for (const keyword of keywords) {
      if (lowerStatement.includes(keyword)) {
        scores[category]++;
      }
    }
  }

  const topCategory = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0];

  return topCategory[1] > 0 ? topCategory[0] : 'saas';
}

/**
 * Get recommended stack based on problem and effort level
 */
export function getRecommendedStack(
  problemStatement: string,
  effortLevel: EffortLevel
): TechStackRecommendation {
  const category = detectCategory(problemStatement);
  const stacks = STACKS_BY_EFFORT[effortLevel];

  // Find stack that best matches the category
  for (const stack of stacks) {
    const categoryStack = PROBLEM_CATEGORY_STACKS[category] || [];
    const overlap = stack.stack.filter(tech =>
      categoryStack.some(catTech =>
        tech.toLowerCase().includes(catTech.toLowerCase()) ||
        catTech.toLowerCase().includes(tech.toLowerCase())
      )
    ).length;

    if (overlap > 0) {
      return stack;
    }
  }

  // Default to first stack for effort level
  return stacks[0];
}

/**
 * Get all stacks for an effort level
 */
export function getStacksForEffort(effortLevel: EffortLevel): TechStackRecommendation[] {
  return STACKS_BY_EFFORT[effortLevel];
}

/**
 * Format stack as markdown
 */
export function formatStackMarkdown(stack: TechStackRecommendation): string {
  return `**${stack.name}**
- Stack: ${stack.stack.join(', ')}
- Architecture: ${stack.architecture}
- Hosting: ${stack.hosting}
- Estimated Cost: ${stack.estimatedCost}
- Best For: ${stack.bestFor.join(', ')}`;
}

/**
 * Tests for the Tech Stacks Module
 */

import { describe, it, expect } from 'vitest';
import {
  WEEKEND_STACKS,
  WEEK_STACKS,
  MONTH_STACKS,
  QUARTER_STACKS,
  STACKS_BY_EFFORT,
  PROBLEM_CATEGORY_STACKS,
  detectCategory,
  getRecommendedStack,
  getStacksForEffort,
  formatStackMarkdown,
  type TechStackRecommendation,
  type EffortLevel,
} from '../../src/generation/tech-stacks';

describe('Stack Constants', () => {
  describe('WEEKEND_STACKS', () => {
    it('has at least one stack', () => {
      expect(WEEKEND_STACKS.length).toBeGreaterThan(0);
    });

    it('all stacks have required properties', () => {
      WEEKEND_STACKS.forEach(stack => {
        expect(stack.name).toBeTruthy();
        expect(stack.stack.length).toBeGreaterThan(0);
        expect(stack.architecture).toBeTruthy();
        expect(stack.hosting).toBeTruthy();
        expect(stack.estimatedCost).toBeTruthy();
        expect(stack.bestFor.length).toBeGreaterThan(0);
      });
    });

    it('stacks have low estimated costs', () => {
      WEEKEND_STACKS.forEach(stack => {
        expect(stack.estimatedCost).toMatch(/\$0|\$\d+-\d+/);
      });
    });
  });

  describe('WEEK_STACKS', () => {
    it('has at least one stack', () => {
      expect(WEEK_STACKS.length).toBeGreaterThan(0);
    });

    it('all stacks have required properties', () => {
      WEEK_STACKS.forEach(stack => {
        expect(stack.name).toBeTruthy();
        expect(stack.stack.length).toBeGreaterThan(0);
        expect(stack.architecture).toBeTruthy();
      });
    });
  });

  describe('MONTH_STACKS', () => {
    it('has at least one stack', () => {
      expect(MONTH_STACKS.length).toBeGreaterThan(0);
    });

    it('includes more complex stacks', () => {
      const hasAIStack = MONTH_STACKS.some(s =>
        s.name.toLowerCase().includes('ai') || s.stack.some(t => t.toLowerCase().includes('openai'))
      );
      expect(hasAIStack).toBe(true);
    });
  });

  describe('QUARTER_STACKS', () => {
    it('has at least one stack', () => {
      expect(QUARTER_STACKS.length).toBeGreaterThan(0);
    });

    it('includes scalable/enterprise stacks', () => {
      const hasScalableStack = QUARTER_STACKS.some(s =>
        s.name.toLowerCase().includes('scalable') ||
        s.name.toLowerCase().includes('platform') ||
        s.name.toLowerCase().includes('marketplace')
      );
      expect(hasScalableStack).toBe(true);
    });

    it('has higher estimated costs', () => {
      QUARTER_STACKS.forEach(stack => {
        // Should include costs in the hundreds or thousands
        expect(stack.estimatedCost).toMatch(/\$\d{2,}/);
      });
    });
  });

  describe('STACKS_BY_EFFORT', () => {
    it('maps all effort levels', () => {
      expect(STACKS_BY_EFFORT.weekend).toBe(WEEKEND_STACKS);
      expect(STACKS_BY_EFFORT.week).toBe(WEEK_STACKS);
      expect(STACKS_BY_EFFORT.month).toBe(MONTH_STACKS);
      expect(STACKS_BY_EFFORT.quarter).toBe(QUARTER_STACKS);
    });

    it('all effort levels have stacks', () => {
      const levels: EffortLevel[] = ['weekend', 'week', 'month', 'quarter'];
      levels.forEach(level => {
        expect(STACKS_BY_EFFORT[level].length).toBeGreaterThan(0);
      });
    });
  });

  describe('PROBLEM_CATEGORY_STACKS', () => {
    it('has stacks for common categories', () => {
      const expectedCategories = [
        'developer-tools',
        'ai-ml',
        'saas',
        'marketplace',
        'mobile',
        'automation',
      ];

      expectedCategories.forEach(category => {
        expect(PROBLEM_CATEGORY_STACKS[category]).toBeDefined();
        expect(PROBLEM_CATEGORY_STACKS[category].length).toBeGreaterThan(0);
      });
    });

    it('each category has relevant technologies', () => {
      // AI/ML should include AI-related tech
      expect(PROBLEM_CATEGORY_STACKS['ai-ml'].some(t =>
        t.toLowerCase().includes('openai') || t.toLowerCase().includes('langchain')
      )).toBe(true);

      // Mobile should include React Native
      expect(PROBLEM_CATEGORY_STACKS['mobile'].some(t =>
        t.toLowerCase().includes('react native') || t.toLowerCase().includes('expo')
      )).toBe(true);

      // Marketplace should include Stripe
      expect(PROBLEM_CATEGORY_STACKS['marketplace'].some(t =>
        t.toLowerCase().includes('stripe')
      )).toBe(true);
    });
  });
});

describe('detectCategory', () => {
  it('detects developer-tools category', () => {
    // Keywords: api, cli, sdk, developer, code, git, debug, testing, deploy
    expect(detectCategory('Better API testing debug deploy')).toBe('developer-tools');
    expect(detectCategory('CLI sdk git developer code')).toBe('developer-tools');
    expect(detectCategory('Developer git testing code debug')).toBe('developer-tools');
  });

  it('detects ai-ml category', () => {
    // Keywords: ai, ml, gpt, llm, chatbot, automate, intelligent, predict, classify
    expect(detectCategory('Building AI chatbot gpt llm')).toBe('ai-ml');
    expect(detectCategory('ML predict classify intelligent')).toBe('ai-ml');
    expect(detectCategory('GPT llm ai chatbot predict')).toBe('ai-ml');
  });

  it('detects saas category', () => {
    // Keywords: subscription, team, collaborate, dashboard, manage, track, admin
    expect(detectCategory('Team collaborate dashboard manage')).toBe('saas');
    expect(detectCategory('Subscription admin manage track')).toBe('saas');
    expect(detectCategory('Dashboard admin team subscription')).toBe('saas');
  });

  it('detects marketplace category', () => {
    // Keywords: buy, sell, marketplace, listing, vendor, booking, hire
    expect(detectCategory('Marketplace buy sell listing vendor')).toBe('marketplace');
    expect(detectCategory('Vendor hire booking marketplace')).toBe('marketplace');
    expect(detectCategory('Buy sell listing booking hire')).toBe('marketplace');
  });

  it('detects mobile category', () => {
    // Keywords: app, ios, android, mobile, notification, offline
    expect(detectCategory('Mobile ios android app notification')).toBe('mobile');
    expect(detectCategory('iOS android offline notification')).toBe('mobile');
    expect(detectCategory('Mobile app offline notification android')).toBe('mobile');
  });

  it('detects automation category', () => {
    // Keywords: automate, workflow, schedule, trigger, integrate, sync
    expect(detectCategory('Automate workflow schedule trigger sync')).toBe('automation');
    expect(detectCategory('Workflow integrate trigger schedule')).toBe('automation');
    expect(detectCategory('Schedule trigger sync automate workflow')).toBe('automation');
  });

  it('detects analytics category', () => {
    // Keywords: analytics, metrics, tracking, insights, report, dashboard
    expect(detectCategory('Analytics metrics tracking insights report')).toBe('analytics');
    expect(detectCategory('Tracking metrics report analytics')).toBe('analytics');
    expect(detectCategory('Business analytics insights metrics tracking')).toBe('analytics');
  });

  it('detects social category', () => {
    // Keywords: social, community, share, follow, feed, post, comment
    expect(detectCategory('Social community share follow feed')).toBe('social');
    expect(detectCategory('Feed post comment share social')).toBe('social');
    expect(detectCategory('Community follow comment share post')).toBe('social');
  });

  it('detects productivity category', () => {
    // Keywords: productivity, todo, task, note, organize, reminder, calendar
    expect(detectCategory('Todo task note organize reminder calendar')).toBe('productivity');
    expect(detectCategory('Productivity task reminder calendar')).toBe('productivity');
    expect(detectCategory('Note organize todo task reminder')).toBe('productivity');
  });

  it('detects fintech category', () => {
    // Keywords: payment, invoice, expense, budget, finance, money, bank
    expect(detectCategory('Payment invoice expense budget finance')).toBe('fintech');
    expect(detectCategory('Budget finance money bank payment')).toBe('fintech');
    expect(detectCategory('Invoice expense budget bank payment')).toBe('fintech');
  });

  it('defaults to saas for unrecognized patterns', () => {
    expect(detectCategory('Some random text with no keywords')).toBe('saas');
    expect(detectCategory('')).toBe('saas');
  });

  it('is case insensitive', () => {
    expect(detectCategory('NEED AN API TOOL')).toBe('developer-tools');
    expect(detectCategory('AI CHATBOT')).toBe('ai-ml');
    expect(detectCategory('MOBILE APP')).toBe('mobile');
  });

  it('handles multiple category keywords by picking highest match', () => {
    // Contains both AI and developer keywords
    const result = detectCategory('AI tool for developers to test APIs automatically');
    // Should pick the category with more keyword matches
    expect(['ai-ml', 'developer-tools', 'automation']).toContain(result);
  });
});

describe('getRecommendedStack', () => {
  it('returns stack for weekend effort', () => {
    const stack = getRecommendedStack('Simple todo app', 'weekend');

    expect(stack).toBeDefined();
    expect(WEEKEND_STACKS).toContain(stack);
  });

  it('returns stack for week effort', () => {
    const stack = getRecommendedStack('SaaS dashboard with auth', 'week');

    expect(stack).toBeDefined();
    expect(WEEK_STACKS).toContain(stack);
  });

  it('returns stack for month effort', () => {
    const stack = getRecommendedStack('AI content generation platform', 'month');

    expect(stack).toBeDefined();
    expect(MONTH_STACKS).toContain(stack);
  });

  it('returns stack for quarter effort', () => {
    const stack = getRecommendedStack('Multi-vendor marketplace', 'quarter');

    expect(stack).toBeDefined();
    expect(QUARTER_STACKS).toContain(stack);
  });

  it('returns a valid stack for AI problems', () => {
    const stack = getRecommendedStack('Build AI chatbot gpt llm predict', 'month');

    // Should return a valid month-level stack
    expect(MONTH_STACKS).toContain(stack);
    expect(stack.name).toBeTruthy();
    expect(stack.stack.length).toBeGreaterThan(0);
  });

  it('returns first stack when no category match', () => {
    const stack = getRecommendedStack('xyz abc random words', 'weekend');

    // Should default to first stack in the effort level
    expect(stack).toBe(WEEKEND_STACKS[0]);
  });

  it('returns a valid stack for mobile problems', () => {
    const stack = getRecommendedStack('Mobile ios android app notification offline', 'month');

    // Should return a valid month-level stack
    expect(MONTH_STACKS).toContain(stack);
    expect(stack.name).toBeTruthy();
    expect(stack.stack.length).toBeGreaterThan(0);
  });

  it('always returns a valid stack object', () => {
    const levels: EffortLevel[] = ['weekend', 'week', 'month', 'quarter'];
    const problems = [
      'Simple web app',
      'Complex SaaS platform',
      'AI-powered tool',
      'Mobile marketplace',
    ];

    levels.forEach(level => {
      problems.forEach(problem => {
        const stack = getRecommendedStack(problem, level);
        expect(stack.name).toBeTruthy();
        expect(stack.stack.length).toBeGreaterThan(0);
        expect(stack.architecture).toBeTruthy();
        expect(stack.hosting).toBeTruthy();
        expect(stack.estimatedCost).toBeTruthy();
        expect(stack.bestFor.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('getStacksForEffort', () => {
  it('returns weekend stacks', () => {
    expect(getStacksForEffort('weekend')).toBe(WEEKEND_STACKS);
  });

  it('returns week stacks', () => {
    expect(getStacksForEffort('week')).toBe(WEEK_STACKS);
  });

  it('returns month stacks', () => {
    expect(getStacksForEffort('month')).toBe(MONTH_STACKS);
  });

  it('returns quarter stacks', () => {
    expect(getStacksForEffort('quarter')).toBe(QUARTER_STACKS);
  });

  it('returns arrays of TechStackRecommendation objects', () => {
    const levels: EffortLevel[] = ['weekend', 'week', 'month', 'quarter'];

    levels.forEach(level => {
      const stacks = getStacksForEffort(level);
      expect(Array.isArray(stacks)).toBe(true);

      stacks.forEach(stack => {
        expect(typeof stack.name).toBe('string');
        expect(Array.isArray(stack.stack)).toBe(true);
        expect(typeof stack.architecture).toBe('string');
        expect(typeof stack.hosting).toBe('string');
        expect(typeof stack.estimatedCost).toBe('string');
        expect(Array.isArray(stack.bestFor)).toBe(true);
      });
    });
  });
});

describe('formatStackMarkdown', () => {
  const mockStack: TechStackRecommendation = {
    name: 'Test Stack',
    stack: ['Tech A', 'Tech B', 'Tech C'],
    architecture: 'Serverless architecture',
    hosting: 'Cloud provider',
    estimatedCost: '$10-50/month',
    bestFor: ['Use case 1', 'Use case 2'],
  };

  it('includes stack name as header', () => {
    const markdown = formatStackMarkdown(mockStack);
    expect(markdown).toContain('**Test Stack**');
  });

  it('lists technologies', () => {
    const markdown = formatStackMarkdown(mockStack);
    expect(markdown).toContain('Stack: Tech A, Tech B, Tech C');
  });

  it('includes architecture', () => {
    const markdown = formatStackMarkdown(mockStack);
    expect(markdown).toContain('Architecture: Serverless architecture');
  });

  it('includes hosting info', () => {
    const markdown = formatStackMarkdown(mockStack);
    expect(markdown).toContain('Hosting: Cloud provider');
  });

  it('includes estimated cost', () => {
    const markdown = formatStackMarkdown(mockStack);
    expect(markdown).toContain('Estimated Cost: $10-50/month');
  });

  it('includes best for use cases', () => {
    const markdown = formatStackMarkdown(mockStack);
    expect(markdown).toContain('Best For: Use case 1, Use case 2');
  });

  it('formats as proper markdown with bullets', () => {
    const markdown = formatStackMarkdown(mockStack);

    // Should have bullet points
    expect(markdown.split('\n').filter(line => line.startsWith('-')).length).toBeGreaterThan(0);
  });

  it('handles single item arrays', () => {
    const singleItemStack: TechStackRecommendation = {
      name: 'Simple',
      stack: ['OneTech'],
      architecture: 'Monolith',
      hosting: 'VPS',
      estimatedCost: '$5/month',
      bestFor: ['One use case'],
    };

    const markdown = formatStackMarkdown(singleItemStack);
    expect(markdown).toContain('Stack: OneTech');
    expect(markdown).toContain('Best For: One use case');
  });

  it('handles empty bestFor array', () => {
    const emptyBestFor: TechStackRecommendation = {
      name: 'Empty',
      stack: ['Tech'],
      architecture: 'Any',
      hosting: 'Any',
      estimatedCost: '$0',
      bestFor: [],
    };

    const markdown = formatStackMarkdown(emptyBestFor);
    expect(markdown).toContain('Best For:');
  });

  it('produces consistent output format', () => {
    const stacks = [...WEEKEND_STACKS, ...WEEK_STACKS];

    stacks.forEach(stack => {
      const markdown = formatStackMarkdown(stack);

      // All should have the same structure
      expect(markdown).toMatch(/^\*\*[^*]+\*\*/); // Starts with bold name
      expect(markdown).toContain('- Stack:');
      expect(markdown).toContain('- Architecture:');
      expect(markdown).toContain('- Hosting:');
      expect(markdown).toContain('- Estimated Cost:');
      expect(markdown).toContain('- Best For:');
    });
  });
});

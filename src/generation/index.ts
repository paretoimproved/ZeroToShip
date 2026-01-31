/**
 * Generation Module for IdeaForge
 *
 * Exports brief generation functionality
 */

export {
  generateBrief,
  generateAllBriefs,
  formatBriefMarkdown,
  exportBriefs,
  getBriefStats,
  filterByEffort,
  filterByPriority,
  getQuickWins,
  type IdeaBrief,
  type BriefGeneratorConfig,
} from './brief-generator';

export {
  BRIEF_SYSTEM_PROMPT,
  buildBriefPrompt,
  buildNamePrompt,
  buildBusinessModelPrompt,
  buildGTMPrompt,
  buildRiskPrompt,
  parseJsonResponse,
  scoreToEffortLevel,
  effortToString,
} from './templates';

export {
  getRecommendedStack,
  getStacksForEffort,
  formatStackMarkdown,
  detectCategory,
  WEEKEND_STACKS,
  WEEK_STACKS,
  MONTH_STACKS,
  QUARTER_STACKS,
  STACKS_BY_EFFORT,
  PROBLEM_CATEGORY_STACKS,
  type TechStackRecommendation,
  type EffortLevel,
} from './tech-stacks';

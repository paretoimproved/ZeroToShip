/**
 * Email Delivery Module
 *
 * Handles sending daily brief emails to subscribers.
 */

// Email builder exports
export {
  buildDailyEmail,
  previewEmail,
  TIER_LIMITS,
  type SubscriberTier,
  type EmailContent,
  type EmailBuilderConfig,
} from './email-builder';

// Email service exports
export {
  sendDailyBrief,
  sendDailyBriefsBatch,
  previewDailyBrief,
  isValidEmail,
  getFailedDeliveries,
  getDeliveryStats,
  createTestSubscriber,
  type Subscriber,
  type DeliveryStatus,
  type BatchDeliveryResult,
  type EmailServiceConfig,
} from './email';

// Onboarding drip exports
export {
  sendOnboardingEmail,
  processOnboardingDrip,
  type OnboardingEmailResult,
  type DripProcessingResult,
} from './onboarding';

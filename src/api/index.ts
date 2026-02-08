/**
 * ZeroToShip API Module Exports
 */

// Server
export { createServer, startServer } from './server';
export type { ServerConfig } from './server';

// Database
export { db, closeDatabase, checkDatabaseHealth } from './db/client';
export {
  users,
  ideas,
  savedIdeas,
  viewedIdeas,
  apiKeys,
  rateLimits,
  userPreferences,
  subscriptions,
  validationRequests,
} from './db/schema';

// Schemas (includes UserTier and EffortLevel types)
export * from './schemas';

// Middleware
export * from './middleware';

// Services
export * as ideasService from './services/ideas';
export * as usersService from './services/users';

/**
 * Shared Pino Logger for IdeaForge
 *
 * Provides structured logging across all modules.
 * The scheduler has its own logger at src/scheduler/utils/logger.ts;
 * this module serves scrapers, analysis, generation, and delivery.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    service: 'ideaforge',
  },
});

export default logger;

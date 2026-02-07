/**
 * Shared Pino Logger for IdeaForge
 *
 * Provides structured logging across all modules.
 * The scheduler has its own logger at src/scheduler/utils/logger.ts;
 * this module serves scrapers, analysis, generation, and delivery.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pino = require('pino');
import { config } from '../config/env';

const logger = pino({
  level: config.logLevel,
  transport: !config.isProduction
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

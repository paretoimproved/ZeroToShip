/**
 * Structured Logger for IdeaForge Scheduler
 *
 * Uses Pino for high-performance structured logging with context support.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pino = require('pino');

export interface LogContext {
  runId?: string;
  phase?: string;
  [key: string]: unknown;
}

export interface Logger {
  info: (objOrMsg: object | string, msg?: string) => void;
  debug: (objOrMsg: object | string, msg?: string) => void;
  warn: (objOrMsg: object | string, msg?: string) => void;
  error: (objOrMsg: object | string, msg?: string) => void;
  child: (bindings: object) => Logger;
}

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Base logger configuration
 */
const baseLogger: Logger = pino({
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
    service: 'ideaforge-scheduler',
  },
});

/**
 * Create a child logger with context
 */
export function createLogger(context: LogContext = {}): Logger {
  return baseLogger.child(context);
}

/**
 * Create a run-specific logger
 */
export function createRunLogger(runId: string): Logger {
  return createLogger({ runId });
}

/**
 * Create a phase-specific logger
 */
export function createPhaseLogger(runId: string, phase: string): Logger {
  return createLogger({ runId, phase });
}

export { baseLogger as logger };

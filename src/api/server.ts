/**
 * Fastify Server for IdeaForge API
 *
 * High-performance REST API server with:
 * - JWT + API key authentication
 * - Tier-based rate limiting
 * - Request validation with Zod
 */

import Fastify, { FastifyInstance, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { config as envConfig } from '../config/env';
import { ApiError, isIdeaForgeError } from '../lib/errors';
import { closeDatabase } from './db/client';
import { healthRoutes } from './routes/health';
import { ideasRoutes } from './routes/ideas';
import { userRoutes } from './routes/user';
import { enterpriseRoutes } from './routes/enterprise';
import { billingRoutes } from './routes/billing';
import { webhookRoutes } from './routes/webhooks';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import type { UserTier } from './schemas';

// Extend FastifyRequest to include user info
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userTier: UserTier;
    apiKeyId?: string;
  }
}

export interface ServerConfig {
  port?: number;
  host?: string;
  logger?: boolean;
  trustProxy?: boolean;
}

const DEFAULT_CONFIG: Required<ServerConfig> = {
  port: envConfig.PORT,
  host: envConfig.HOST,
  logger: !envConfig.isTest,
  trustProxy: envConfig.isProduction,
};

/**
 * Create and configure the Fastify server
 */
export async function createServer(config: ServerConfig = {}): Promise<FastifyInstance> {
  const opts = { ...DEFAULT_CONFIG, ...config };

  // Create Fastify instance with Zod type provider
  const server = Fastify({
    logger: opts.logger
      ? {
          level: envConfig.logLevel,
          transport:
            !envConfig.isProduction
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true },
                }
              : undefined,
        }
      : false,
    trustProxy: opts.trustProxy,
  }).withTypeProvider<ZodTypeProvider>();

  // Set up Zod validators
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  // Security headers
  await server.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  // CORS
  await server.register(cors, {
    origin: envConfig.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Global rate limiting (per IP)
  await server.register(rateLimit, {
    max: 1000,
    timeWindow: '1 hour',
    keyGenerator: (request: FastifyRequest) => {
      return request.ip;
    },
    errorResponseBuilder: () => ({
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    }),
  });

  // Health, readiness, and liveness endpoints
  await server.register(healthRoutes);

  // API version prefix
  server.get('/api/v1', async () => {
    return {
      version: '1.0.0',
      name: 'IdeaForge API',
      documentation: 'https://ideaforge.io/docs/api',
    };
  });

  // Set default user tier for unauthenticated requests
  server.addHook('preHandler', async (request) => {
    if (!request.userTier) {
      request.userTier = 'anonymous';
    }
  });

  // Register route modules
  await server.register(ideasRoutes, { prefix: '/api/v1/ideas' });
  await server.register(userRoutes, { prefix: '/api/v1/user' });
  await server.register(billingRoutes, { prefix: '/api/v1/billing' });
  await server.register(authRoutes, { prefix: '/api/v1/auth' });
  await server.register(adminRoutes, { prefix: '/api/v1/admin' });
  await server.register(enterpriseRoutes, { prefix: '/api/v1' });

  // Webhooks need separate registration to avoid global JSON parsing
  // The webhook route has its own content type parser for raw body
  await server.register(webhookRoutes, { prefix: '/api/webhooks' });

  // Global error handler
  server.setErrorHandler((error, request, reply) => {
    // Handle ApiError from IdeaForge error classes
    if (error instanceof ApiError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, severity: error.severity, context: error.context }, error.message);
      }
      return reply.status(error.statusCode).send({
        code: error.name,
        message: error.message,
      });
    }

    // Handle other IdeaForge errors
    if (isIdeaForgeError(error)) {
      request.log.error({ err: error, severity: error.severity, phase: error.phase }, error.message);
      return reply.status(500).send({
        code: error.name,
        message: envConfig.isProduction ? 'An unexpected error occurred' : error.message,
      });
    }

    const statusCode = error.statusCode || 500;

    // Log server errors
    if (statusCode >= 500) {
      request.log.error(error);
    }

    // Handle Zod validation errors
    if (error.validation) {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: error.validation,
      });
    }

    // Handle known error codes
    if (error.code === 'FST_ERR_VALIDATION') {
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    // Handle JSON parse errors (malformed request body)
    if (error instanceof SyntaxError && statusCode === 400) {
      return reply.status(400).send({
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      });
    }

    // Generic error response
    return reply.status(statusCode).send({
      code: error.code || 'INTERNAL_ERROR',
      message:
        envConfig.isProduction
          ? 'An unexpected error occurred'
          : error.message,
    });
  });

  // Graceful shutdown
  const shutdown = async () => {
    server.log.info('Shutting down server...');
    await server.close();
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

/**
 * Start the server
 */
export async function startServer(config: ServerConfig = {}): Promise<FastifyInstance> {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const server = await createServer(opts);

  try {
    await server.listen({ port: opts.port, host: opts.host });
    server.log.info(`Server listening on http://${opts.host}:${opts.port}`);
    return server;
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server if run directly
if (require.main === module) {
  startServer();
}

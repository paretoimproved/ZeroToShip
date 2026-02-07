/**
 * Health Check Routes
 *
 * Provides health and readiness endpoints for monitoring and orchestration.
 */

import type { FastifyPluginAsync } from 'fastify';
import { checkDatabaseHealth } from '../db/client';
import { isSchedulerRunning } from '../../scheduler';

// Package version — npm_package_version is set by npm at runtime, not in .env
const VERSION = process.env.npm_package_version || '1.0.0';

interface ServiceStatus {
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'not_configured';
  scheduler: 'running' | 'idle';
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: ServiceStatus;
  uptime: number;
}

/**
 * Check Redis connection status
 * Returns 'not_configured' since Redis is optional
 */
async function checkRedisHealth(): Promise<'connected' | 'not_configured'> {
  // Redis is optional - not currently configured
  // When adding Redis, implement connection check here
  return 'not_configured';
}

/**
 * Determine overall health status based on service statuses
 */
function determineOverallStatus(services: ServiceStatus): 'ok' | 'degraded' | 'unhealthy' {
  if (services.database === 'disconnected') {
    return 'unhealthy';
  }
  return 'ok';
}

export const healthRoutes: FastifyPluginAsync = async (server) => {
  /**
   * GET /health
   * Main health check endpoint for load balancers and monitoring
   */
  server.get<{
    Reply: HealthResponse;
  }>('/health', async (request, reply) => {
    const dbHealthy = await checkDatabaseHealth();
    const redisStatus = await checkRedisHealth();
    const schedulerStatus = isSchedulerRunning() ? 'running' : 'idle';

    const services: ServiceStatus = {
      database: dbHealthy ? 'connected' : 'disconnected',
      redis: redisStatus,
      scheduler: schedulerStatus,
    };

    const status = determineOverallStatus(services);

    const response: HealthResponse = {
      status,
      version: VERSION,
      timestamp: new Date().toISOString(),
      services,
      uptime: process.uptime(),
    };

    // Return 503 if unhealthy for load balancer detection
    const statusCode = status === 'unhealthy' ? 503 : 200;
    return reply.status(statusCode).send(response);
  });

  /**
   * GET /ready
   * Readiness probe for Kubernetes/Railway
   * Returns 200 only when the service is ready to accept traffic
   */
  server.get('/ready', async (request, reply) => {
    const dbHealthy = await checkDatabaseHealth();

    if (!dbHealthy) {
      return reply.status(503).send({
        ready: false,
        reason: 'Database not connected',
      });
    }

    return {
      ready: true,
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * GET /live
   * Liveness probe for Kubernetes/Railway
   * Returns 200 if the process is running (basic check)
   */
  server.get('/live', async () => {
    return {
      alive: true,
      timestamp: new Date().toISOString(),
    };
  });
};

export default healthRoutes;

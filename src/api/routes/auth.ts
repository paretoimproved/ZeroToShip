/**
 * Auth Routes for IdeaForge API
 */

import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { supabase } from '../middleware/auth';
import { getOrCreateUser, getUserById } from '../services/users';

const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const AuthResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    tier: z.string(),
  }),
});

const UserResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  tier: z.string(),
});

const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
});

/**
 * Sanitize error message for safe JSON serialization
 */
function sanitizeMessage(msg: string): string {
  return msg.replace(/[\x00-\x1F\x7F]/g, '');
}

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * POST /api/v1/auth/signup
   */
  app.post(
    '/signup',
    {
      schema: {
        body: SignupRequestSchema,
        response: {
          200: AuthResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password, name } = request.body;

      if (!supabase) {
        return reply.status(500).send({
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Authentication service is not configured',
        });
      }

      let data;
      let error;
      try {
        const result = await supabase.auth.signUp({ email, password });
        data = result.data;
        error = result.error;
      } catch (err) {
        return reply.status(500).send({
          code: 'AUTH_SERVICE_ERROR',
          message: sanitizeMessage(err instanceof Error ? err.message : 'Authentication service error'),
        });
      }

      if (error) {
        return reply.status(400).send({
          code: 'SIGNUP_FAILED',
          message: sanitizeMessage(error.message),
        });
      }

      if (!data.user || !data.session) {
        return reply.status(400).send({
          code: 'SIGNUP_FAILED',
          message: 'Failed to create user account',
        });
      }

      const user = await getOrCreateUser(data.user.id, email, name);

      return reply.send({
        token: data.session.access_token,
        user,
      });
    }
  );

  /**
   * POST /api/v1/auth/login
   */
  app.post(
    '/login',
    {
      schema: {
        body: LoginRequestSchema,
        response: {
          200: AuthResponseSchema,
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      if (!supabase) {
        return reply.status(500).send({
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Authentication service is not configured',
        });
      }

      let data;
      let error;
      try {
        const result = await supabase.auth.signInWithPassword({ email, password });
        data = result.data;
        error = result.error;
      } catch (err) {
        return reply.status(500).send({
          code: 'AUTH_SERVICE_ERROR',
          message: sanitizeMessage(err instanceof Error ? err.message : 'Authentication service error'),
        });
      }

      if (error) {
        return reply.status(401).send({
          code: 'LOGIN_FAILED',
          message: sanitizeMessage(error.message),
        });
      }

      if (!data.user || !data.session) {
        return reply.status(401).send({
          code: 'LOGIN_FAILED',
          message: 'Invalid credentials',
        });
      }

      const user = await getOrCreateUser(data.user.id, email);

      return reply.send({
        token: data.session.access_token,
        user,
      });
    }
  );

  /**
   * GET /api/v1/auth/me
   */
  app.get(
    '/me',
    {
      preHandler: [requireAuth],
      schema: {
        response: {
          200: UserResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await getUserById(request.userId!);

      if (!user) {
        return reply.status(401).send({
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        });
      }

      return reply.send(user);
    }
  );
};

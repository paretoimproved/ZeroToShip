/**
 * Auth Routes for ZeroToShip API
 */

import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth, isAdminEmail } from '../middleware/auth';
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
  isAdmin: z.boolean(),
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

      if (!data.user) {
        return reply.status(400).send({
          code: 'SIGNUP_FAILED',
          message: 'Failed to create user account',
        });
      }

      // If email confirmation is required, session may be null.
      // Auto-confirm by signing in immediately with the service role client.
      let token = data.session?.access_token;
      if (!token) {
        const signIn = await supabase.auth.signInWithPassword({ email, password });
        if (signIn.error || !signIn.data.session) {
          // User created but can't sign in yet — return with a placeholder token
          const user = await getOrCreateUser(data.user.id, email, name);
          return reply.send({
            token: '',
            user,
          });
        }
        token = signIn.data.session.access_token;
      }

      const user = await getOrCreateUser(data.user.id, email, name);

      return reply.send({
        token,
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
      let user = await getUserById(request.userId!);

      if (!user) {
        // User exists in Supabase but not in our DB (first OAuth login).
        // Extract display name from Supabase user_metadata.
        const meta = request.userMetadata;
        const name =
          (meta?.full_name as string) ||
          (meta?.name as string) ||
          (meta?.user_name as string) ||
          (meta?.preferred_username as string) ||
          undefined;

        user = await getOrCreateUser(request.userId!, request.userEmail!, name);
      }

      return reply.send({ ...user, isAdmin: isAdminEmail(user.email) });
    }
  );
};

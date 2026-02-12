/**
 * Auth Routes for ZeroToShip API
 */

import { FastifyPluginAsync } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { supabase } from '../middleware/auth';
import { ApiErrorSchema } from '../schemas';
import { getOrCreateUser, getUserById, getUserTierById } from '../services/users';
import { config } from '../../config/env';

const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const GoogleAuthRequestSchema = z.object({
  code: z.string().min(1),
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
          400: ApiErrorSchema,
          500: ApiErrorSchema,
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
          const tier = await getUserTierById(data.user.id);
          return reply.send({
            token: '',
            user: { ...user, tier },
          });
        }
        token = signIn.data.session.access_token;
      }

      const user = await getOrCreateUser(data.user.id, email, name);
      const tier = await getUserTierById(data.user.id);

      return reply.send({
        token,
        user: { ...user, tier },
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
          401: ApiErrorSchema,
          500: ApiErrorSchema,
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
      const tier = await getUserTierById(data.user.id);

      return reply.send({
        token: data.session.access_token,
        user: { ...user, tier },
      });
    }
  );

  /**
   * POST /api/v1/auth/google
   * Exchange a Google authorization code for a Supabase session.
   */
  app.post(
    '/google',
    {
      schema: {
        body: GoogleAuthRequestSchema,
        response: {
          200: AuthResponseSchema,
          400: ApiErrorSchema,
          500: ApiErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const { code } = request.body;

      if (!supabase) {
        return reply.status(500).send({
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Authentication service is not configured',
        });
      }

      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
        return reply.status(500).send({
          code: 'GOOGLE_NOT_CONFIGURED',
          message: 'Google OAuth is not configured',
        });
      }

      // Exchange authorization code with Google for tokens
      let googleTokens;
      try {
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            client_id: config.GOOGLE_CLIENT_ID,
            client_secret: config.GOOGLE_CLIENT_SECRET,
            redirect_uri: 'postmessage',
            grant_type: 'authorization_code',
          }),
        });

        googleTokens = await tokenResponse.json() as { id_token?: string; error?: string };

        if (!tokenResponse.ok || !googleTokens.id_token) {
          return reply.status(400).send({
            code: 'GOOGLE_EXCHANGE_FAILED',
            message: sanitizeMessage(
              googleTokens.error || 'Failed to exchange Google authorization code'
            ),
          });
        }
      } catch (err) {
        return reply.status(500).send({
          code: 'GOOGLE_EXCHANGE_ERROR',
          message: sanitizeMessage(
            err instanceof Error ? err.message : 'Google token exchange failed'
          ),
        });
      }

      // Sign in to Supabase with the Google ID token
      let data;
      let error;
      try {
        const result = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: googleTokens.id_token,
        });
        data = result.data;
        error = result.error;
      } catch (err) {
        return reply.status(500).send({
          code: 'AUTH_SERVICE_ERROR',
          message: sanitizeMessage(
            err instanceof Error ? err.message : 'Authentication service error'
          ),
        });
      }

      if (error || !data.session || !data.user) {
        return reply.status(400).send({
          code: 'GOOGLE_LOGIN_FAILED',
          message: sanitizeMessage(error?.message || 'Google sign-in failed'),
        });
      }

      const meta = data.user.user_metadata || {};
      const name =
        (meta.full_name as string) ||
        (meta.name as string) ||
        (meta.user_name as string) ||
        undefined;

      const user = await getOrCreateUser(data.user.id, data.user.email!, name);
      const tier = await getUserTierById(data.user.id);

      return reply.send({
        token: data.session.access_token,
        user: { ...user, tier },
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
          401: ApiErrorSchema,
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

      const tier = await getUserTierById(request.userId!);
      return reply.send({ ...user, tier, isAdmin: user.isAdmin });
    }
  );
};

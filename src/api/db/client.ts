/**
 * Database Client for IdeaForge API
 *
 * Connects to Supabase PostgreSQL using Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Database connection string from environment
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

if (!connectionString && process.env.NODE_ENV !== 'test') {
  console.warn('No DATABASE_URL or SUPABASE_DB_URL environment variable set');
}

// Create postgres client
// Use connection pooling for production
const client = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 10 : 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export schema for use in queries
export * from './schema';

// Type exports for use in services
export type Database = typeof db;

/**
 * Close database connection (for graceful shutdown)
 */
export async function closeDatabase(): Promise<void> {
  await client.end();
}

/**
 * Check database connectivity
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await client`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

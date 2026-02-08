/**
 * Database Client for ZeroToShip API
 *
 * Connects to Supabase PostgreSQL using Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../../config/env';
import * as schema from './schema';

// Database connection string from centralized config
const connectionString = config.databaseUrl;

if (!connectionString && !config.isTest) {
  console.warn('No DATABASE_URL or SUPABASE_DB_URL environment variable set');
}

if (config.isProduction) {
  const masked = connectionString ? connectionString.replace(/\/\/[^@]+@/, '//***@') : '(empty)';
  console.log(`[DB] Connecting to: ${masked}, SSL: enabled`);
}

// Create postgres client
// Use connection pooling for production
const client = postgres(connectionString, {
  max: config.isProduction ? 10 : 1,
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: config.isProduction ? { rejectUnauthorized: false } : false,
  prepare: config.isProduction ? false : true,
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
  } catch (err) {
    console.error('[DB Health] Connection failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Database Seed Runner
 *
 * Usage: npm run db:seed
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { seed } from '../src/api/db/seed';
import { closeDatabase } from '../src/api/db/client';

async function main() {
  console.log('IdeaForge Database Seed\n');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database:', process.env.DATABASE_URL?.substring(0, 30) + '...\n');

  try {
    await seed();
    console.log('\nClosing database connection...');
    await closeDatabase();
    console.log('Done!');
    process.exit(0);
  } catch (error) {
    console.error('\nSeed failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

main();

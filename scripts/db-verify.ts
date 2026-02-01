/**
 * Database Verification Runner
 *
 * Usage: npm run db:verify
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { verify } from '../src/api/db/verify';
import { closeDatabase } from '../src/api/db/client';

async function main() {
  console.log('IdeaForge Database Verification\n');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database:', process.env.DATABASE_URL?.substring(0, 30) + '...\n');

  try {
    const passed = await verify();
    console.log('\nClosing database connection...');
    await closeDatabase();
    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error('\nVerification failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

main();

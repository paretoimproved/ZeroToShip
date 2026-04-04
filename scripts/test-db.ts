/**
 * Simple database connection test
 */

import * as dotenv from 'dotenv';
dotenv.config();

import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL || '';
console.log('Testing connection to:', connectionString.substring(0, 40) + '...');

const sql = postgres(connectionString, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 15,
});

async function test() {
  try {
    const result = await sql`SELECT 1 as test`;
    console.log('Connection successful!', result);
    await sql.end();
    process.exit(0);
  } catch (error) {
    console.error('Connection failed:', error);
    await sql.end();
    process.exit(1);
  }
}

test();

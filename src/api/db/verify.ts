/**
 * Database Verification Script for IdeaForge
 *
 * Verifies all tables, indexes, and constraints exist
 */

import { db, checkDatabaseHealth, closeDatabase } from './client';
import { sql } from 'drizzle-orm';

// Expected tables
const expectedTables = [
  'users',
  'user_preferences',
  'api_keys',
  'ideas',
  'saved_ideas',
  'viewed_ideas',
  'subscriptions',
  'rate_limits',
  'validation_requests',
];

// Expected indexes
const expectedIndexes = [
  { table: 'users', index: 'users_email_idx' },
  { table: 'api_keys', index: 'api_keys_key_idx' },
  { table: 'ideas', index: 'ideas_priority_idx' },
  { table: 'ideas', index: 'ideas_published_at_idx' },
  { table: 'ideas', index: 'ideas_category_idx' },
  { table: 'ideas', index: 'ideas_effort_idx' },
  { table: 'saved_ideas', index: 'saved_ideas_user_idx' },
  { table: 'saved_ideas', index: 'saved_ideas_idea_idx' },
  { table: 'viewed_ideas', index: 'viewed_ideas_user_idx' },
  { table: 'viewed_ideas', index: 'viewed_ideas_idea_idx' },
  { table: 'rate_limits', index: 'rate_limits_identifier_idx' },
  { table: 'rate_limits', index: 'rate_limits_window_idx' },
];

// Expected foreign keys
const expectedForeignKeys = [
  { table: 'api_keys', constraint: 'api_keys_user_id_users_id_fk' },
  { table: 'user_preferences', constraint: 'user_preferences_user_id_users_id_fk' },
  { table: 'saved_ideas', constraint: 'saved_ideas_user_id_users_id_fk' },
  { table: 'saved_ideas', constraint: 'saved_ideas_idea_id_ideas_id_fk' },
  { table: 'viewed_ideas', constraint: 'viewed_ideas_user_id_users_id_fk' },
  { table: 'viewed_ideas', constraint: 'viewed_ideas_idea_id_ideas_id_fk' },
  { table: 'subscriptions', constraint: 'subscriptions_user_id_users_id_fk' },
  { table: 'validation_requests', constraint: 'validation_requests_user_id_users_id_fk' },
  { table: 'validation_requests', constraint: 'validation_requests_idea_id_ideas_id_fk' },
];

export async function verify(): Promise<boolean> {
  console.log('Starting database verification...\n');

  let allPassed = true;

  try {
    // 1. Check database connection
    console.log('1. Checking database connection...');
    const isHealthy = await checkDatabaseHealth();
    if (isHealthy) {
      console.log('   ✓ Database connection successful\n');
    } else {
      console.log('   ✗ Database connection failed\n');
      return false;
    }

    // 2. Check tables exist
    console.log('2. Checking tables...');
    const tablesResult = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    const existingTables = (tablesResult as unknown as { table_name: string }[]).map(
      (r) => r.table_name
    );

    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        console.log(`   ✓ Table '${table}' exists`);
      } else {
        console.log(`   ✗ Table '${table}' MISSING`);
        allPassed = false;
      }
    }
    console.log();

    // 3. Check indexes exist
    console.log('3. Checking indexes...');
    const indexesResult = await db.execute(sql`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
    `);
    const existingIndexes = (
      indexesResult as unknown as { indexname: string; tablename: string }[]
    ).map((r) => ({
      index: r.indexname,
      table: r.tablename,
    }));

    for (const expected of expectedIndexes) {
      const found = existingIndexes.some(
        (i) => i.index === expected.index && i.table === expected.table
      );
      if (found) {
        console.log(`   ✓ Index '${expected.index}' on '${expected.table}'`);
      } else {
        console.log(`   ✗ Index '${expected.index}' on '${expected.table}' MISSING`);
        allPassed = false;
      }
    }
    console.log();

    // 4. Check foreign key constraints
    console.log('4. Checking foreign key constraints...');
    const constraintsResult = await db.execute(sql`
      SELECT constraint_name, table_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
      AND constraint_type = 'FOREIGN KEY'
    `);
    const existingConstraints = (
      constraintsResult as unknown as { constraint_name: string; table_name: string }[]
    ).map((r) => ({
      constraint: r.constraint_name,
      table: r.table_name,
    }));

    for (const expected of expectedForeignKeys) {
      const found = existingConstraints.some(
        (c) => c.constraint === expected.constraint && c.table === expected.table
      );
      if (found) {
        console.log(`   ✓ FK '${expected.constraint}' on '${expected.table}'`);
      } else {
        console.log(`   ✗ FK '${expected.constraint}' on '${expected.table}' MISSING`);
        allPassed = false;
      }
    }
    console.log();

    // 5. Check row counts
    console.log('5. Checking row counts...');
    for (const table of expectedTables) {
      const countResult = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM "${table}"`));
      const rows = countResult as unknown as { count: number | string }[];
      const count = rows[0]?.count || 0;
      console.log(`   ${table}: ${count} rows`);
    }
    console.log();

    // 6. Check extensions
    console.log('6. Checking extensions...');
    const extensionsResult = await db.execute(sql`
      SELECT extname FROM pg_extension
    `);
    const extensions = (extensionsResult as unknown as { extname: string }[]).map(
      (r) => r.extname
    );

    if (extensions.includes('vector')) {
      console.log('   ✓ pgvector extension enabled');
    } else {
      console.log('   ⚠ pgvector extension not enabled (optional for future use)');
    }
    console.log();

    // Summary
    console.log('='.repeat(50));
    if (allPassed) {
      console.log('✓ All verification checks passed!');
    } else {
      console.log('✗ Some verification checks failed. Please review above.');
    }
    console.log('='.repeat(50));

    return allPassed;
  } catch (error) {
    console.error('Verification failed with error:', error);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  verify()
    .then((passed) => {
      closeDatabase().then(() => {
        process.exit(passed ? 0 : 1);
      });
    })
    .catch((error) => {
      console.error(error);
      closeDatabase().then(() => {
        process.exit(1);
      });
    });
}

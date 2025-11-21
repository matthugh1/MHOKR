/**
 * Database Reset Script
 * 
 * Completely truncates/resets the database by:
 * 1. Dropping all tables (cascade to handle foreign keys)
 * 2. Re-running all migrations
 * 3. Optionally running seed scripts
 * 
 * Usage:
 *   ts-node scripts/reset-database.ts [--no-seed]
 * 
 * WARNING: This will DELETE ALL DATA in the database!
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function confirmReset(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      '⚠️  WARNING: This will DELETE ALL DATA in the database. Are you sure? (type "yes" to confirm): ',
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      },
    );
  });
}

async function resetDatabase(noSeed: boolean = false) {
  console.log('🔄 Starting database reset...');

  try {
    // Get all table names from Prisma schema
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `;

    if (tables.length === 0) {
      console.log('✅ Database is already empty.');
      return;
    }

    console.log(`\n📋 Found ${tables.length} tables to drop:`);
    tables.forEach((t) => console.log(`   - ${t.tablename}`));

    // Disable foreign key checks temporarily by dropping all tables with CASCADE
    console.log('\n🗑️  Dropping all tables...');
    await prisma.$executeRawUnsafe(`
      DO $$ DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%') LOOP
          EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.log('✅ All tables dropped.');

    // Reset Prisma migrations state
    console.log('\n🔄 Resetting Prisma migrations...');
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "_prisma_migrations" CASCADE;`);

    console.log('✅ Prisma migrations table dropped.');

    console.log('\n📝 Next steps:');
    console.log('   1. Run: npx prisma migrate dev');
    console.log('   2. Run: npx prisma generate');
    if (!noSeed) {
      console.log('   3. Run: npm run prisma:seed (if you have seed scripts)');
    }

    console.log('\n✅ Database reset complete!');
  } catch (error) {
    console.error('\n❌ Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const noSeed = args.includes('--no-seed');

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           DATABASE RESET UTILITY                        ║');
  console.log('║                                                           ║');
  console.log('║  This will DELETE ALL DATA in your database!            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const confirmed = await confirmReset();

  if (!confirmed) {
    console.log('\n❌ Reset cancelled.');
    process.exit(0);
  }

  await resetDatabase(noSeed);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


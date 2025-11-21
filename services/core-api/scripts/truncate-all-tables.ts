/**
 * Truncate All Tables Script
 * 
 * Completely truncates all data from all tables while preserving schema.
 * This is faster than dropping/recreating tables.
 * 
 * Usage:
 *   ts-node scripts/truncate-all-tables.ts
 * 
 * WARNING: This will DELETE ALL DATA in the database!
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function confirmTruncate(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      '⚠️  WARNING: This will DELETE ALL DATA in all tables. Are you sure? (type "yes" to confirm): ',
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes');
      },
    );
  });
}

async function truncateAllTables() {
  console.log('🔄 Starting database truncation...');

  try {
    // Get all table names
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

    console.log(`\n📋 Found ${tables.length} tables to truncate:`);
    tables.forEach((t) => console.log(`   - ${t.tablename}`));

    // Build TRUNCATE command with CASCADE to handle foreign keys
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    
    console.log('\n🗑️  Truncating all tables...');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);

    console.log('\n✅ All tables truncated successfully!');
    console.log('   Schema preserved - migrations intact.');
  } catch (error) {
    console.error('\n❌ Error truncating database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           DATABASE TRUNCATE UTILITY                      ║');
  console.log('║                                                           ║');
  console.log('║  This will DELETE ALL DATA but preserve schema!          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const confirmed = await confirmTruncate();

  if (!confirmed) {
    console.log('\n❌ Truncation cancelled.');
    process.exit(0);
  }

  await truncateAllTables();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


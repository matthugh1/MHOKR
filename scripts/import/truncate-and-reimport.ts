#!/usr/bin/env ts-node

/**
 * Truncate Database and Re-import Script
 * 
 * This script will:
 * 1. Truncate all database tables (preserves schema)
 * 2. Re-import Viva Goals JSON data with fixed import logic
 * 
 * Usage:
 *   ts-node scripts/truncate-and-reimport.ts --tenant=<tenant-slug> [--import-dir=./import] [--skip-truncate]
 * 
 * Example:
 *   ts-node scripts/truncate-and-reimport.ts --tenant=puzzel
 */

import { PrismaClient } from '@prisma/client';
import * as readline from 'readline';
import { execSync } from 'child_process';
import * as path from 'path';

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
  console.log('🔄 Starting database truncation...\n');

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
      console.log('✅ Database is already empty.\n');
      return;
    }

    console.log(`📋 Found ${tables.length} tables to truncate:`);
    tables.forEach((t) => console.log(`   - ${t.tablename}`));

    // Build TRUNCATE command with CASCADE to handle foreign keys
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
    
    console.log('\n🗑️  Truncating all tables...');
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);

    console.log('\n✅ All tables truncated successfully!');
    console.log('   Schema preserved - migrations intact.\n');
  } catch (error) {
    console.error('\n❌ Error truncating database:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let tenantSlug = '';
  let importDir = './import';
  let skipTruncate = false;

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--tenant=')) {
      tenantSlug = arg.split('=')[1];
    } else if (arg.startsWith('--import-dir=')) {
      importDir = arg.split('=')[1];
    } else if (arg === '--skip-truncate') {
      skipTruncate = true;
    }
  }

  if (!tenantSlug) {
    console.error('❌ Error: --tenant=<tenant-slug> is required');
    console.error('   Example: ts-node scripts/truncate-and-reimport.ts --tenant=puzzel');
    process.exit(1);
  }

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     TRUNCATE AND RE-IMPORT SCRIPT                        ║');
  console.log('║                                                           ║');
  console.log('║  This will DELETE ALL DATA and re-import with fixes!     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  console.log(`   Tenant: ${tenantSlug}`);
  console.log(`   Import Directory: ${importDir}`);
  console.log(`   Skip Truncate: ${skipTruncate ? 'YES' : 'NO'}\n`);

  try {
    // Step 1: Truncate database
    if (!skipTruncate) {
      const confirmed = await confirmTruncate();
      if (!confirmed) {
        console.log('\n❌ Truncation cancelled.');
        process.exit(0);
      }

      await truncateAllTables();
    } else {
      console.log('⏭️  Skipping truncate (--skip-truncate flag set)\n');
    }

    // Step 2: Run import script
    console.log('📥 Starting re-import with fixed import logic...\n');
    const importScriptPath = path.join(__dirname, 'import-viva-goals-json.ts');
    const importCommand = `ts-node "${importScriptPath}" --tenant=${tenantSlug} --import-dir=${importDir}`;
    
    console.log(`Running: ${importCommand}\n`);
    execSync(importCommand, { stdio: 'inherit', cwd: process.cwd() });

    console.log('\n✅ Truncate and re-import completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Database truncated');
    console.log('   - Data re-imported with fixed metric type handling');
    console.log('   - Progress values should now be calculated correctly');
    console.log('   - Metric types mapped from Target Type');
    console.log('   - Units imported correctly\n');
  } catch (error) {
    console.error('\n❌ Error during truncate and re-import:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


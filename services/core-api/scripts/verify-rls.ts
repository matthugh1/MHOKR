#!/usr/bin/env ts-node

/**
 * Verify PostgreSQL RLS is enabled and working
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyRLS() {
  console.log('🔍 Verifying PostgreSQL RLS status...\n');

  try {
    // Check if RLS is enabled on tables
    const tables = [
      'objectives',
      'key_results',
      'workspaces',
      'teams',
      'cycles',
      'strategic_pillars',
      'check_in_requests',
      'organizations',
    ];

    console.log('Checking RLS status on tables:');
    for (const table of tables) {
      const result = await prisma.$queryRawUnsafe<Array<{ rowsecurity: boolean }>>(
        `SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = $1`,
        table,
      );
      const isEnabled = result[0]?.rowsecurity || false;
      console.log(`  ${table.padEnd(25)} ${isEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    }

    console.log('\nChecking RLS policies:');
    const policies = await prisma.$queryRawUnsafe<Array<{ tablename: string; policyname: string; count: number }>>(
      `SELECT tablename, policyname, COUNT(*) as count
       FROM pg_policies
       WHERE tablename IN ('objectives', 'key_results', 'workspaces', 'teams', 'cycles', 'strategic_pillars', 'check_in_requests', 'organizations')
       GROUP BY tablename, policyname
       ORDER BY tablename, policyname`,
    );

    const policyCounts = new Map<string, number>();
    for (const policy of policies) {
      const count = policyCounts.get(policy.tablename) || 0;
      policyCounts.set(policy.tablename, count + 1);
    }

    for (const table of tables) {
      const count = policyCounts.get(table) || 0;
      console.log(`  ${table.padEnd(25)} ${count.toString().padStart(2)} policies`);
    }

    console.log('\n✅ RLS verification complete!');
    console.log('\n📝 Next steps:');
    console.log('  1. Test queries with different tenant contexts');
    console.log('  2. Verify SUPERUSER can read all data (read-only)');
    console.log('  3. Verify normal users can only see their tenant data');
    console.log('  4. Monitor query performance');
  } catch (error) {
    console.error('❌ Error verifying RLS:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyRLS();





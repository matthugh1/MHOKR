#!/usr/bin/env ts-node
/**
 * Diagnostics script to list records using legacy visibility values
 * 
 * Usage:
 *   ts-node scripts/audit-legacy-visibility.ts
 * 
 * This script queries the database to find any Objectives or Key Results
 * that still use deprecated visibility levels: WORKSPACE_ONLY, TEAM_ONLY, MANAGER_CHAIN, EXEC_ONLY
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LEGACY_VISIBILITY_LEVELS = ['WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY'] as const;

async function auditLegacyVisibility() {
  console.log('🔍 Auditing legacy visibility levels...\n');

  try {
    // Query Objectives with legacy visibility
    const objectivesWithLegacy = await prisma.objective.findMany({
      where: {
        visibilityLevel: {
          in: LEGACY_VISIBILITY_LEVELS,
        },
      },
      select: {
        id: true,
        title: true,
        visibilityLevel: true,
        tenantId: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Query Key Results with legacy visibility
    const keyResultsWithLegacy = await prisma.keyResult.findMany({
      where: {
        visibilityLevel: {
          in: LEGACY_VISIBILITY_LEVELS,
        },
      },
      select: {
        id: true,
        title: true,
        visibilityLevel: true,
        tenantId: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Count by visibility level
    const objectiveCounts: Record<string, number> = {};
    const keyResultCounts: Record<string, number> = {};

    objectivesWithLegacy.forEach((obj) => {
      objectiveCounts[obj.visibilityLevel] = (objectiveCounts[obj.visibilityLevel] || 0) + 1;
    });

    keyResultsWithLegacy.forEach((kr) => {
      keyResultCounts[kr.visibilityLevel] = (keyResultCounts[kr.visibilityLevel] || 0) + 1;
    });

    // Print summary
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`\nObjectives with legacy visibility: ${objectivesWithLegacy.length}`);
    LEGACY_VISIBILITY_LEVELS.forEach((level) => {
      const count = objectiveCounts[level] || 0;
      if (count > 0) {
        console.log(`  - ${level}: ${count}`);
      }
    });

    console.log(`\nKey Results with legacy visibility: ${keyResultsWithLegacy.length}`);
    LEGACY_VISIBILITY_LEVELS.forEach((level) => {
      const count = keyResultCounts[level] || 0;
      if (count > 0) {
        console.log(`  - ${level}: ${count}`);
      }
    });

    // Print detailed list if any found
    if (objectivesWithLegacy.length > 0) {
      console.log('\n\n📋 OBJECTIVES WITH LEGACY VISIBILITY');
      console.log('='.repeat(60));
      objectivesWithLegacy.forEach((obj) => {
        console.log(`\n  ID: ${obj.id}`);
        console.log(`  Title: ${obj.title}`);
        console.log(`  Visibility: ${obj.visibilityLevel}`);
        console.log(`  Tenant ID: ${obj.tenantId}`);
        console.log(`  Owner ID: ${obj.ownerId}`);
        console.log(`  Created: ${obj.createdAt.toISOString()}`);
        console.log(`  Updated: ${obj.updatedAt.toISOString()}`);
      });
    }

    if (keyResultsWithLegacy.length > 0) {
      console.log('\n\n📋 KEY RESULTS WITH LEGACY VISIBILITY');
      console.log('='.repeat(60));
      keyResultsWithLegacy.forEach((kr) => {
        console.log(`\n  ID: ${kr.id}`);
        console.log(`  Title: ${kr.title}`);
        console.log(`  Visibility: ${kr.visibilityLevel}`);
        console.log(`  Tenant ID: ${kr.tenantId}`);
        console.log(`  Owner ID: ${kr.ownerId}`);
        console.log(`  Created: ${kr.createdAt.toISOString()}`);
        console.log(`  Updated: ${kr.updatedAt.toISOString()}`);
      });
    }

    if (objectivesWithLegacy.length === 0 && keyResultsWithLegacy.length === 0) {
      console.log('\n✅ No records found with legacy visibility levels.');
    } else {
      console.log('\n\n💡 RECOMMENDATION');
      console.log('='.repeat(60));
      console.log('These records should be migrated to PUBLIC_TENANT or PRIVATE visibility.');
      console.log('Legacy visibility levels are deprecated and will be rejected on create/update.');
      console.log('Historical data remains intact, but new records cannot use these values.');
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Error auditing legacy visibility:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the audit
auditLegacyVisibility().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});



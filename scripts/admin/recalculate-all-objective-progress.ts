#!/usr/bin/env ts-node

/**
 * Recalculate Progress for All Objectives
 * 
 * This script recalculates progress for all objectives based on their Key Results.
 * Useful after importing data where objectives might not have correct progress percentages.
 * 
 * The recalculation:
 * - Calculates from Key Results (weighted average)
 * - Falls back to child Objectives if no KRs
 * - Cascades up to parent Objectives automatically
 * - Skips objectives with manualProgress enabled
 * 
 * Usage:
 *   ts-node scripts/admin/recalculate-all-objective-progress.ts [--tenant-id=<id>] [--dry-run]
 * 
 * Options:
 *   --tenant-id=<id>  Only recalculate objectives for a specific tenant
 *   --dry-run         Show what would be recalculated without making changes
 */

// Use require to avoid TypeScript module resolution issues
const { PrismaClient } = require('@prisma/client');
const { OkrProgressService } = require('../../services/core-api/src/modules/okr/okr-progress.service');

const prisma = new PrismaClient();

interface Options {
  tenantId?: string;
  dryRun?: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {};

  for (const arg of args) {
    if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function recalculateAllObjectiveProgress() {
  const options = parseArgs();
  
  try {
    // Create progress service
    const progressService = new OkrProgressService(prisma as any);

    console.log('🔄 Recalculating progress for all objectives...\n');

    if (options.tenantId) {
      console.log(`📍 Filtering by tenant: ${options.tenantId}\n`);
    }

    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made\n');
    }

    // Build where clause
    const where: any = {};
    if (options.tenantId) {
      where.tenantId = options.tenantId;
    }

    // Get all objectives (or filtered by tenant)
    const objectives = await prisma.objective.findMany({
      where,
      select: {
        id: true,
        title: true,
        tenantId: true,
        progress: true,
        manualProgress: true,
        keyResults: {
          select: {
            keyResult: {
              select: {
                id: true,
                progress: true,
              },
            },
          },
        },
        children: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`Found ${objectives.length} objectives to process\n`);

    if (objectives.length === 0) {
      console.log('✅ No objectives found to recalculate!');
      return;
    }

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const stats = {
      withKRs: 0,
      withChildren: 0,
      noChildren: 0,
      manualProgress: 0,
    };

    // Process objectives from bottom-up (children first, then parents)
    // This ensures parent objectives get accurate progress from their children
    // We'll process objectives without children first, then those with children
    const objectivesWithoutChildren = objectives.filter((obj: any) => 
      (!obj.children || obj.children.length === 0) && 
      (!obj.keyResults || obj.keyResults.length === 0)
    );
    const objectivesWithChildren = objectives.filter((obj: any) => 
      (obj.children && obj.children.length > 0) || 
      (obj.keyResults && obj.keyResults.length > 0)
    );

    // Process leaf objectives first (those without children or KRs)
    console.log('📊 Processing leaf objectives first...');
    for (const objective of objectivesWithoutChildren) {
      try {
        if (objective.manualProgress) {
          console.log(`⏭️  Skipping ${objective.title} (manual progress enabled)`);
          skipped++;
          stats.manualProgress++;
          continue;
        }

        if (!options.dryRun) {
          await progressService.recalculateObjectiveProgress(objective.id);
        }
        
        processed++;
        stats.noChildren++;
        
        if (processed % 10 === 0) {
          console.log(`   Processed ${processed} objectives...`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${objective.title} (${objective.id}):`, error.message);
        errors++;
      }
    }

    // Then process objectives with children/KRs
    console.log('\n📊 Processing objectives with children/KRs...');
    for (const objective of objectivesWithChildren) {
      try {
        if (objective.manualProgress) {
          console.log(`⏭️  Skipping ${objective.title} (manual progress enabled)`);
          skipped++;
          stats.manualProgress++;
          continue;
        }

        const hasKRs = objective.keyResults && objective.keyResults.length > 0;
        const hasChildren = objective.children && objective.children.length > 0;

        if (!options.dryRun) {
          await progressService.recalculateObjectiveProgress(objective.id);
        }
        
        processed++;
        if (hasKRs) {
          stats.withKRs++;
        } else if (hasChildren) {
          stats.withChildren++;
        } else {
          stats.noChildren++;
        }
        
        if (processed % 10 === 0) {
          console.log(`   Processed ${processed} objectives...`);
        }
      } catch (error: any) {
        console.error(`❌ Error processing ${objective.title} (${objective.id}):`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   - Processed: ${processed}`);
    console.log(`     • With Key Results: ${stats.withKRs}`);
    console.log(`     • With Child Objectives: ${stats.withChildren}`);
    console.log(`     • No children/KRs: ${stats.noChildren}`);
    console.log(`   - Skipped (manual progress): ${stats.manualProgress}`);
    console.log(`   - Errors: ${errors}`);

    if (options.dryRun) {
      console.log('\n🔍 This was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('\n✅ Progress recalculation complete!');
      console.log('   Note: Progress cascades up to parent objectives automatically.');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

recalculateAllObjectiveProgress().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


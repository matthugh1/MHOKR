#!/usr/bin/env ts-node

/**
 * Script to backfill cycleId for existing Key Results and Initiatives
 * Run after adding cycleId columns to key_results and initiatives tables
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillCycleIds() {
  console.log('🔄 Starting cycleId backfill...');

  try {
    // Backfill Key Results - use Prisma query builder for safety
    const krs = await prisma.keyResult.findMany({
      where: {
        cycleId: null,
        objectives: {
          some: {
            objective: {
              cycleId: { not: null },
            },
          },
        },
      },
      include: {
        objectives: {
          take: 1,
          include: {
            objective: {
              select: {
                cycleId: true,
              },
            },
          },
        },
      },
    });

    let krUpdated = 0;
    for (const kr of krs) {
      const objectiveCycleId = kr.objectives[0]?.objective?.cycleId;
      if (objectiveCycleId) {
        await prisma.keyResult.update({
          where: { id: kr.id },
          data: { cycleId: objectiveCycleId },
        });
        krUpdated++;
      }
    }
    console.log(`✅ Updated ${krUpdated} Key Results with cycleId from parent Objective`);

    // Backfill Initiatives from Objective
    const initiativesFromObj = await prisma.initiative.findMany({
      where: {
        cycleId: null,
        objectiveId: { not: null },
        objective: {
          cycleId: { not: null },
        },
      },
      include: {
        objective: {
          select: {
            cycleId: true,
          },
        },
      },
    });

    let initFromObjUpdated = 0;
    for (const init of initiativesFromObj) {
      if (init.objective?.cycleId) {
        await prisma.initiative.update({
          where: { id: init.id },
          data: { cycleId: init.objective.cycleId },
        });
        initFromObjUpdated++;
      }
    }
    console.log(`✅ Updated ${initFromObjUpdated} Initiatives with cycleId from parent Objective`);

    // Backfill Initiatives from KeyResult's Objective
    // First get initiatives linked to KRs
    const initiativesWithKr = await prisma.initiative.findMany({
      where: {
        cycleId: null,
        keyResultId: { not: null },
        objectiveId: null,
      },
      select: {
        id: true,
        keyResultId: true,
      },
    });

    let initFromKrUpdated = 0;
    for (const init of initiativesWithKr) {
      if (!init.keyResultId) continue;
      
      // Find the KR and its parent objective
      const keyResult = await prisma.keyResult.findUnique({
        where: { id: init.keyResultId },
        include: {
          objectives: {
            take: 1,
            include: {
              objective: {
                select: {
                  cycleId: true,
                },
              },
            },
          },
        },
      });

      const objectiveCycleId = keyResult?.objectives[0]?.objective?.cycleId;
      if (objectiveCycleId) {
        await prisma.initiative.update({
          where: { id: init.id },
          data: { cycleId: objectiveCycleId },
        });
        initFromKrUpdated++;
      }
    }
    console.log(`✅ Updated ${initFromKrUpdated} Initiatives with cycleId via KeyResult's Objective`);

    // Summary
    const krWithCycle = await prisma.keyResult.count({
      where: { cycleId: { not: null } },
    });
    const initWithCycle = await prisma.initiative.count({
      where: { cycleId: { not: null } },
    });

    console.log('');
    console.log('📊 Summary:');
    console.log(`   Key Results with cycleId: ${krWithCycle}`);
    console.log(`   Initiatives with cycleId: ${initWithCycle}`);
    console.log('');
    console.log('✅ Backfill complete!');
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backfillCycleIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findOKRWithInitiatives() {
  console.log('=== Finding Objectives and Key Results with Initiatives ===\n');

  try {
    // Find objectives that have initiatives directly attached
    const objectivesWithInitiatives = await prisma.objective.findMany({
      where: {
        initiatives: {
          some: {
            id: { not: undefined },
          },
        },
      },
      include: {
        initiatives: {
          select: {
            id: true,
            title: true,
            status: true,
            keyResultId: true,
            objectiveId: true,
          },
        },
        keyResults: {
          include: {
            keyResult: {
              include: {
                initiatives: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    keyResultId: true,
                    objectiveId: true,
                  },
                },
              },
            },
          },
        },
      },
      take: 5, // Limit to 5 examples
    });

    console.log(`\n📊 Found ${objectivesWithInitiatives.length} Objective(s) with direct initiatives:\n`);

    objectivesWithInitiatives.forEach((objective, idx) => {
      console.log(`${idx + 1}. Objective: "${objective.title}" (ID: ${objective.id})`);
      console.log(`   Direct Initiatives: ${objective.initiatives.length}`);
      objective.initiatives.forEach(init => {
        console.log(`      - ${init.title} (ID: ${init.id})`);
        console.log(`        objectiveId: ${init.objectiveId}, keyResultId: ${init.keyResultId || 'null'}`);
      });

      // Check if any KRs have initiatives
      const krsWithInitiatives = objective.keyResults.filter(
        okr => okr.keyResult.initiatives.length > 0
      );

      if (krsWithInitiatives.length > 0) {
        console.log(`   Key Results with Initiatives: ${krsWithInitiatives.length}`);
        krsWithInitiatives.forEach(okr => {
          const kr = okr.keyResult;
          console.log(`      - KR: "${kr.title}" (ID: ${kr.id})`);
          kr.initiatives.forEach(init => {
            console.log(`        * ${init.title} (ID: ${init.id})`);
            console.log(`          objectiveId: ${init.objectiveId || 'null'}, keyResultId: ${init.keyResultId}`);
          });
        });
      }
      console.log('');
    });

    // Find key results that have initiatives (but may not be linked to objectives with initiatives)
    const keyResultsWithInitiatives = await prisma.keyResult.findMany({
      where: {
        initiatives: {
          some: {
            id: { not: undefined },
          },
        },
      },
      include: {
        initiatives: {
          select: {
            id: true,
            title: true,
            status: true,
            keyResultId: true,
            objectiveId: true,
          },
        },
        objectives: {
          include: {
            objective: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      take: 5, // Limit to 5 examples
    });

    console.log(`\n📊 Found ${keyResultsWithInitiatives.length} Key Result(s) with initiatives:\n`);

    keyResultsWithInitiatives.forEach((kr, idx) => {
      console.log(`${idx + 1}. Key Result: "${kr.title}" (ID: ${kr.id})`);
      console.log(`   Linked to Objectives: ${kr.objectives.length}`);
      kr.objectives.forEach(okr => {
        console.log(`      - Objective: "${okr.objective.title}" (ID: ${okr.objective.id})`);
      });
      console.log(`   Initiatives: ${kr.initiatives.length}`);
      kr.initiatives.forEach(init => {
        console.log(`      - ${init.title} (ID: ${init.id})`);
        console.log(`        objectiveId: ${init.objectiveId || 'null'}, keyResultId: ${init.keyResultId}`);
      });
      console.log('');
    });

    // Summary
    console.log('\n=== SUMMARY ===');
    if (objectivesWithInitiatives.length > 0) {
      const firstObj = objectivesWithInitiatives[0];
      console.log(`\n✅ Example Objective with Initiative:`);
      console.log(`   Objective ID: ${firstObj.id}`);
      console.log(`   Objective Title: "${firstObj.title}"`);
      console.log(`   Number of Direct Initiatives: ${firstObj.initiatives.length}`);
      if (firstObj.initiatives.length > 0) {
        console.log(`   First Initiative ID: ${firstObj.initiatives[0].id}`);
        console.log(`   First Initiative Title: "${firstObj.initiatives[0].title}"`);
      }
    }

    if (keyResultsWithInitiatives.length > 0) {
      const firstKR = keyResultsWithInitiatives[0];
      console.log(`\n✅ Example Key Result with Initiative:`);
      console.log(`   Key Result ID: ${firstKR.id}`);
      console.log(`   Key Result Title: "${firstKR.title}"`);
      console.log(`   Number of Initiatives: ${firstKR.initiatives.length}`);
      if (firstKR.initiatives.length > 0) {
        console.log(`   First Initiative ID: ${firstKR.initiatives[0].id}`);
        console.log(`   First Initiative Title: "${firstKR.initiatives[0].title}"`);
      }
    }

    if (objectivesWithInitiatives.length === 0 && keyResultsWithInitiatives.length === 0) {
      console.log('\n⚠️  No objectives or key results with initiatives found in the database.');
      console.log('   You may need to create some test data first.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findOKRWithInitiatives()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




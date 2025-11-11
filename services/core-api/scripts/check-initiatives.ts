import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInitiatives() {
  console.log('=== Checking Initiatives in Database ===\n');

  try {
    // Get all initiatives
    const allInitiatives = await prisma.initiative.findMany({
      include: {
        objective: {
          select: {
            id: true,
            title: true,
            organizationId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`Total initiatives found: ${allInitiatives.length}\n`);

    if (allInitiatives.length === 0) {
      console.log('⚠️  No initiatives found in the database!');
      return;
    }

    // Group by type
    const objectiveInitiatives = allInitiatives.filter(i => i.objectiveId && !i.keyResultId);
    const keyResultInitiatives = allInitiatives.filter(i => i.keyResultId);
    const orphanedInitiatives = allInitiatives.filter(i => !i.objectiveId && !i.keyResultId);

    console.log(`📊 Breakdown:`);
    console.log(`   - Linked to Objective only: ${objectiveInitiatives.length}`);
    console.log(`   - Linked to Key Result: ${keyResultInitiatives.length}`);
    console.log(`   - Orphaned (no parent): ${orphanedInitiatives.length}\n`);

    // Show details of each initiative
    console.log('=== Initiative Details ===\n');
    allInitiatives.forEach((init, index) => {
      console.log(`${index + 1}. "${init.title}"`);
      console.log(`   ID: ${init.id}`);
      console.log(`   Status: ${init.status}`);
      console.log(`   Due Date: ${init.dueDate || 'None'}`);
      console.log(`   Objective ID: ${init.objectiveId || 'None'}`);
      console.log(`   Key Result ID: ${init.keyResultId || 'None'}`);
      if (init.objective) {
        console.log(`   Objective Title: "${init.objective.title}"`);
        console.log(`   Organization ID: ${init.objective.organizationId || 'None'}`);
      }
      console.log(`   Owner ID: ${init.ownerId}`);
      console.log(`   Created: ${init.createdAt}`);
      console.log('');
    });

    // Check if initiatives are linked to valid objectives/key results
    console.log('=== Validation Checks ===\n');
    
    for (const init of allInitiatives) {
      if (init.objectiveId) {
        const objective = await prisma.objective.findUnique({
          where: { id: init.objectiveId },
          select: { id: true, title: true },
        });
        if (!objective) {
          console.log(`⚠️  Initiative "${init.title}" links to non-existent objective: ${init.objectiveId}`);
        }
      }

      if (init.keyResultId) {
        const keyResult = await prisma.keyResult.findUnique({
          where: { id: init.keyResultId },
          select: { id: true, title: true },
        });
        if (!keyResult) {
          console.log(`⚠️  Initiative "${init.title}" links to non-existent key result: ${init.keyResultId}`);
        } else {
          // Check if the key result is linked to an objective
          const krObjectives = await prisma.objectiveKeyResult.findMany({
            where: { keyResultId: init.keyResultId },
            include: {
              objective: {
                select: { id: true, title: true, organizationId: true },
              },
            },
          });
          console.log(`   ✓ Key Result "${keyResult.title}" is linked to ${krObjectives.length} objective(s)`);
          krObjectives.forEach(okr => {
            console.log(`     - Objective: "${okr.objective.title}" (${okr.objective.id})`);
            console.log(`       Organization: ${okr.objective.organizationId || 'None'}`);
          });
        }
      }
    }

    // Check recent initiatives (last 10)
    console.log('\n=== Recent Initiatives (Last 10) ===\n');
    const recentInitiatives = allInitiatives.slice(0, 10);
    recentInitiatives.forEach((init, index) => {
      console.log(`${index + 1}. "${init.title}"`);
      console.log(`   Objective: ${init.objectiveId || 'None'}`);
      console.log(`   Key Result: ${init.keyResultId || 'None'}`);
      console.log(`   Created: ${init.createdAt.toISOString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkInitiatives()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




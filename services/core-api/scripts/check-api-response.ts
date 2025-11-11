import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAPIResponse() {
  console.log('=== Checking what the API should return ===\n');

  try {
    // Get the objective
    const objective = await prisma.objective.findUnique({
      where: { id: 'cmhkarelb000p13qiasro4szc' },
      include: {
        keyResults: {
          include: {
            keyResult: {
              include: {
                initiatives: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    dueDate: true,
                    keyResultId: true,
                    objectiveId: true,
                  },
                },
              },
            },
          },
        },
        initiatives: {
          select: {
            id: true,
            title: true,
            status: true,
            dueDate: true,
            keyResultId: true,
            objectiveId: true,
          },
        },
      },
    });

    if (!objective) {
      console.log('Objective not found!');
      return;
    }

    console.log('Objective:', objective.title);
    console.log('Key Results:', objective.keyResults.length);
    objective.keyResults.forEach(krLink => {
      const kr = krLink.keyResult;
      console.log(`  - KR: ${kr.title} (${kr.id})`);
      console.log(`    Initiatives in KR: ${kr.initiatives.length}`);
      kr.initiatives.forEach(init => {
        console.log(`      * ${init.title} (${init.id})`);
        console.log(`        keyResultId: ${init.keyResultId}`);
        console.log(`        objectiveId: ${init.objectiveId}`);
      });
    });

    console.log('\nDirect Objective Initiatives:', objective.initiatives.length);
    objective.initiatives.forEach(init => {
      console.log(`  - ${init.title} (${init.id})`);
      console.log(`    keyResultId: ${init.keyResultId}`);
      console.log(`    objectiveId: ${init.objectiveId}`);
    });

    // Check what the query would return
    const keyResultIds = objective.keyResults.map(okr => okr.keyResult.id);
    console.log('\nKey Result IDs to query:', keyResultIds);

    const krInitiatives = await prisma.initiative.findMany({
      where: {
        keyResultId: { in: keyResultIds },
      },
    });

    console.log(`\nInitiatives found for Key Results: ${krInitiatives.length}`);
    krInitiatives.forEach(init => {
      console.log(`  - ${init.title} (${init.id})`);
      console.log(`    keyResultId: ${init.keyResultId}`);
      console.log(`    objectiveId: ${init.objectiveId}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAPIResponse()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




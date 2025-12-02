import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserData() {
  const email = process.argv[2] || 'frederic.laziou@puzzel.com';
  
  console.log(`\n=== Checking data for user: ${email} ===\n`);

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        primaryOrganizationId: true,
      },
    });

    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return;
    }

    console.log(`✅ User found:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Primary Organization ID: ${user.primaryOrganizationId || 'None'}\n`);

    if (!user.primaryOrganizationId) {
      console.log(`⚠️  User has no primary organization - todos will be empty!\n`);
    }

    // Check objectives
    const objectives = await prisma.objective.findMany({
      where: {
        ownerId: user.id,
        ...(user.primaryOrganizationId ? { tenantId: user.primaryOrganizationId } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        tenantId: true,
      },
    });

    console.log(`📊 Objectives owned: ${objectives.length}`);
    if (objectives.length > 0) {
      objectives.slice(0, 5).forEach((obj, i) => {
        console.log(`   ${i + 1}. "${obj.title}" (${obj.status})`);
      });
    }
    console.log('');

    // Check key results
    const keyResults = await prisma.keyResult.findMany({
      where: {
        ownerId: user.id,
        ...(user.primaryOrganizationId ? {
          objectives: {
            some: {
              objective: {
                tenantId: user.primaryOrganizationId,
              },
            },
          },
        } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        checkInCadence: true,
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    console.log(`📊 Key Results owned: ${keyResults.length}`);
    if (keyResults.length > 0) {
      keyResults.slice(0, 5).forEach((kr, i) => {
        const lastCheckIn = kr.checkIns[0]?.createdAt;
        console.log(`   ${i + 1}. "${kr.title}" (${kr.status}, cadence: ${kr.checkInCadence || 'none'}, last check-in: ${lastCheckIn ? lastCheckIn.toISOString() : 'never'})`);
      });
    }
    console.log('');

    // Check initiatives
    const initiatives = await prisma.initiative.findMany({
      where: {
        ownerId: user.id,
        ...(user.primaryOrganizationId ? { tenantId: user.primaryOrganizationId } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    console.log(`📊 Initiatives owned: ${initiatives.length}`);
    if (initiatives.length > 0) {
      initiatives.slice(0, 5).forEach((init, i) => {
        console.log(`   ${i + 1}. "${init.title}" (${init.status})`);
      });
    }
    console.log('');

    // Check tasks
    const tasks = await prisma.task.findMany({
      where: {
        ownerId: user.id,
        ...(user.primaryOrganizationId ? { tenantId: user.primaryOrganizationId } : {}),
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
      },
    });

    console.log(`📊 Tasks owned: ${tasks.length}`);
    if (tasks.length > 0) {
      tasks.slice(0, 5).forEach((task, i) => {
        console.log(`   ${i + 1}. "${task.title}" (${task.status}, due: ${task.dueDate ? task.dueDate.toISOString() : 'none'})`);
      });
    }
    console.log('');

    // Summary
    console.log(`\n=== Summary ===`);
    console.log(`Total owned items: ${objectives.length + keyResults.length + initiatives.length + tasks.length}`);
    console.log(`  - Objectives: ${objectives.length}`);
    console.log(`  - Key Results: ${keyResults.length}`);
    console.log(`  - Initiatives: ${initiatives.length}`);
    console.log(`  - Tasks: ${tasks.length}`);

    if (objectives.length === 0 && keyResults.length === 0 && initiatives.length === 0 && tasks.length === 0) {
      console.log(`\n⚠️  User has no owned items - todos will be empty!`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserData();


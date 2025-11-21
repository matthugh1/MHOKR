/**
 * Test Script for Progress Aggregation Features
 * 
 * Tests:
 * 1. Weighted average for Key Results
 * 2. Weighted average for child Objectives
 * 3. Manual progress override
 * 4. Progress contribution breakdown
 * 5. Cascading progress updates
 * 
 * Usage:
 *   ts-node scripts/test-progress-aggregation.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { OkrProgressService } from '../src/modules/okr/okr-progress.service';

const prismaClient = new PrismaClient();
const prisma = prismaClient as any as PrismaService;
const progressService = new OkrProgressService(prisma);

async function main() {
  console.log('🧪 Testing Progress Aggregation Features\n');

  try {
    // Find or create a test tenant
    let tenant = await prisma.organization.findFirst({
      where: { slug: 'test-progress' },
    });

    if (!tenant) {
      tenant = await prisma.organization.create({
        data: {
          name: 'Test Progress Tenant',
          slug: 'test-progress',
        },
      });
      console.log(`✅ Created test tenant: ${tenant.id}`);
    } else {
      console.log(`✅ Using existing test tenant: ${tenant.id}`);
    }

    // Find or create a test user
    let user = await prisma.user.findFirst({
      where: { email: 'test-progress@example.com' },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'test-progress@example.com',
          name: 'Test Progress User',
          passwordHash: 'dummy',
        },
      });
      console.log(`✅ Created test user: ${user.id}`);
    } else {
      console.log(`✅ Using existing test user: ${user.id}`);
    }

    // Find or create a test cycle
    let cycle = await prisma.cycle.findFirst({
      where: {
        tenantId: tenant.id,
        name: 'Q1 2025',
      },
    });

    if (!cycle) {
      cycle = await prisma.cycle.create({
        data: {
          tenantId: tenant.id,
          name: 'Q1 2025',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-03-31'),
          status: 'ACTIVE',
        },
      });
      console.log(`✅ Created test cycle: ${cycle.id}`);
    } else {
      console.log(`✅ Using existing test cycle: ${cycle.id}`);
    }

    console.log('\n📊 Test 1: Weighted Average for Key Results\n');

    // Create parent objective
    const parentObj = await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Parent Objective (KR Weighted Test)',
        ownerId: user.id,
        cycleId: cycle.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 0,
        status: 'ON_TRACK',
      },
    });
    console.log(`✅ Created parent objective: ${parentObj.id}`);

    // Create Key Results with different weights
    const kr1 = await prisma.keyResult.create({
      data: {
        tenantId: tenant.id,
        title: 'KR1 (weight: 2.0, progress: 50%)',
        ownerId: user.id,
        startValue: 0,
        targetValue: 100,
        currentValue: 50,
        progress: 50,
        metricType: 'INCREASE',
        status: 'ON_TRACK',
      },
    });

    const kr2 = await prisma.keyResult.create({
      data: {
        tenantId: tenant.id,
        title: 'KR2 (weight: 1.0, progress: 75%)',
        ownerId: user.id,
        startValue: 0,
        targetValue: 100,
        currentValue: 75,
        progress: 75,
        metricType: 'INCREASE',
        status: 'ON_TRACK',
      },
    });

    const kr3 = await prisma.keyResult.create({
      data: {
        tenantId: tenant.id,
        title: 'KR3 (weight: 1.0, progress: 100%)',
        ownerId: user.id,
        startValue: 0,
        targetValue: 100,
        currentValue: 100,
        progress: 100,
        metricType: 'INCREASE',
        status: 'ON_TRACK',
      },
    });

    // Link KRs to objective with weights
    await prisma.objectiveKeyResult.createMany({
      data: [
        { objectiveId: parentObj.id, keyResultId: kr1.id, tenantId: tenant.id, weight: 2.0 },
        { objectiveId: parentObj.id, keyResultId: kr2.id, tenantId: tenant.id, weight: 1.0 },
        { objectiveId: parentObj.id, keyResultId: kr3.id, tenantId: tenant.id, weight: 1.0 },
      ],
    });

    console.log(`✅ Created 3 Key Results with weights: 2.0, 1.0, 1.0`);

    // Recalculate progress
    await progressService.recalculateObjectiveProgress(parentObj.id);

    const updatedParent = await prisma.objective.findUnique({
      where: { id: parentObj.id },
    });

    const expectedProgress = (2.0 * 50 + 1.0 * 75 + 1.0 * 100) / (2.0 + 1.0 + 1.0); // 68.75%
    console.log(`\n📈 Expected progress: ${expectedProgress.toFixed(2)}%`);
    console.log(`📈 Actual progress: ${updatedParent?.progress.toFixed(2)}%`);

    if (Math.abs((updatedParent?.progress || 0) - expectedProgress) < 0.01) {
      console.log('✅ Test 1 PASSED: Weighted average for Key Results works correctly\n');
    } else {
      console.log('❌ Test 1 FAILED: Progress mismatch\n');
    }

    // Get contribution breakdown
    const breakdown1 = await progressService.getProgressContributionBreakdown(parentObj.id);
    console.log('📊 Contribution Breakdown:');
    breakdown1.contributions.forEach(c => {
      console.log(`   ${c.type}: ${c.title}`);
      console.log(`      Progress: ${c.progress}%, Weight: ${c.weight}, Contribution: ${c.contribution.toFixed(2)}%, Percentage: ${c.percentage.toFixed(2)}%`);
    });

    console.log('\n📊 Test 2: Weighted Average for Child Objectives\n');

    // Create grandparent objective
    const grandparentObj = await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Grandparent Objective (Child Weighted Test)',
        ownerId: user.id,
        cycleId: cycle.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 0,
        status: 'ON_TRACK',
      },
    });

    // Create child objectives with different weights
    await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Child 1 (weight: 2.0, progress: 60%)',
        ownerId: user.id,
        cycleId: cycle.id,
        parentId: grandparentObj.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 60,
        weight: 2.0,
        status: 'ON_TRACK',
      },
    });

    await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Child 2 (weight: 1.0, progress: 80%)',
        ownerId: user.id,
        cycleId: cycle.id,
        parentId: grandparentObj.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 80,
        weight: 1.0,
        status: 'ON_TRACK',
      },
    });

    await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Child 3 (weight: 1.0, progress: 90%)',
        ownerId: user.id,
        cycleId: cycle.id,
        parentId: grandparentObj.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 90,
        weight: 1.0,
        status: 'ON_TRACK',
      },
    });

    console.log(`✅ Created 3 child objectives with weights: 2.0, 1.0, 1.0`);

    // Recalculate progress
    await progressService.recalculateObjectiveProgress(grandparentObj.id);

    const updatedGrandparent = await prisma.objective.findUnique({
      where: { id: grandparentObj.id },
    });

    const expectedChildProgress = (2.0 * 60 + 1.0 * 80 + 1.0 * 90) / (2.0 + 1.0 + 1.0); // 72.5%
    console.log(`\n📈 Expected progress: ${expectedChildProgress.toFixed(2)}%`);
    console.log(`📈 Actual progress: ${updatedGrandparent?.progress.toFixed(2)}%`);

    if (Math.abs((updatedGrandparent?.progress || 0) - expectedChildProgress) < 0.01) {
      console.log('✅ Test 2 PASSED: Weighted average for child Objectives works correctly\n');
    } else {
      console.log('❌ Test 2 FAILED: Progress mismatch\n');
    }

    // Get contribution breakdown
    const breakdown2 = await progressService.getProgressContributionBreakdown(grandparentObj.id);
    console.log('📊 Contribution Breakdown:');
    breakdown2.contributions.forEach(c => {
      console.log(`   ${c.type}: ${c.title}`);
      console.log(`      Progress: ${c.progress}%, Weight: ${c.weight}, Contribution: ${c.contribution.toFixed(2)}%, Percentage: ${c.percentage.toFixed(2)}%`);
    });

    console.log('\n📊 Test 3: Manual Progress Override\n');

    const manualObj = await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Manual Progress Objective',
        ownerId: user.id,
        cycleId: cycle.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 50,
        manualProgress: true,
        status: 'ON_TRACK',
      },
    });

    // Create a KR and link it
    const manualKr = await prisma.keyResult.create({
      data: {
        tenantId: tenant.id,
        title: 'KR for Manual Objective',
        ownerId: user.id,
        startValue: 0,
        targetValue: 100,
        currentValue: 100,
        progress: 100,
        metricType: 'INCREASE',
        status: 'ON_TRACK',
      },
    });

    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: manualObj.id,
        keyResultId: manualKr.id,
        tenantId: tenant.id,
        weight: 1.0,
      },
    });

    console.log(`✅ Created objective with manual progress: 50%`);
    console.log(`✅ Linked KR with progress: 100%`);

    // Try to recalculate (should be skipped)
    await progressService.recalculateObjectiveProgress(manualObj.id);

    const updatedManual = await prisma.objective.findUnique({
      where: { id: manualObj.id },
    });

    if (updatedManual?.progress === 50 && updatedManual?.manualProgress === true) {
      console.log('✅ Test 3 PASSED: Manual progress override prevents auto-calculation\n');
    } else {
      console.log('❌ Test 3 FAILED: Manual progress was recalculated\n');
    }

    // Get contribution breakdown (should return MANUAL)
    const breakdown3 = await progressService.getProgressContributionBreakdown(manualObj.id);
    if (breakdown3.calculationMethod === 'MANUAL') {
      console.log('✅ Contribution breakdown correctly identifies MANUAL progress\n');
    } else {
      console.log('❌ Contribution breakdown failed to identify MANUAL progress\n');
    }

    console.log('\n📊 Test 4: Cascading Progress Updates\n');

    // Create a hierarchy: root -> child -> grandchild
    const root = await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Root Objective (Cascade Test)',
        ownerId: user.id,
        cycleId: cycle.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 0,
        status: 'ON_TRACK',
      },
    });

    const child = await prisma.objective.create({
      data: {
        tenantId: tenant.id,
        title: 'Child Objective',
        ownerId: user.id,
        cycleId: cycle.id,
        parentId: root.id,
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-03-31'),
        progress: 0,
        weight: 1.0,
        status: 'ON_TRACK',
      },
    });

    const grandchildKr = await prisma.keyResult.create({
      data: {
        tenantId: tenant.id,
        title: 'Grandchild KR',
        ownerId: user.id,
        startValue: 0,
        targetValue: 100,
        currentValue: 80,
        progress: 80,
        metricType: 'INCREASE',
        status: 'ON_TRACK',
      },
    });

    await prisma.objectiveKeyResult.create({
      data: {
        objectiveId: child.id,
        keyResultId: grandchildKr.id,
        tenantId: tenant.id,
        weight: 1.0,
      },
    });

    console.log(`✅ Created hierarchy: root -> child -> KR`);

    // Update KR progress (should cascade up)
    await prisma.keyResult.update({
      where: { id: grandchildKr.id },
      data: { currentValue: 80, progress: 80 },
    });

    await progressService.refreshObjectiveProgressForKeyResult(grandchildKr.id);

    const updatedChild = await prisma.objective.findUnique({
      where: { id: child.id },
    });
    const updatedRoot = await prisma.objective.findUnique({
      where: { id: root.id },
    });

    console.log(`\n📈 Child progress: ${updatedChild?.progress.toFixed(2)}%`);
    console.log(`📈 Root progress: ${updatedRoot?.progress.toFixed(2)}%`);

    if (updatedChild?.progress === 80 && updatedRoot?.progress === 80) {
      console.log('✅ Test 4 PASSED: Progress cascades correctly up the hierarchy\n');
    } else {
      console.log('❌ Test 4 FAILED: Cascade did not work correctly\n');
    }

    console.log('\n✅ All tests completed!\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prismaClient.$disconnect();
  }
}

main().catch(console.error);


#!/usr/bin/env ts-node

/**
 * Check-ins and Check-in Requests
 * 
 * Creates check-ins with overdue items and manager-requested check-ins.
 */

import { PrismaClient } from '@prisma/client';
import { randomInt } from '../../services/core-api/prisma/factories/rng';

const prisma = new PrismaClient();

async function createCheckInsAndRequests(
  orgId: string,
  cycleIds: Map<string, string>,
): Promise<void> {
  console.log('✅ Creating check-ins...');

  const activeCycleIds = [
    cycleIds.get('Q4 2025')!,
    cycleIds.get('Q1 2026')!,
  ].filter(Boolean);

  const keyResults = await prisma.keyResult.findMany({
    where: {
      cycleId: { in: activeCycleIds },
      checkInCadence: { not: null },
    },
    include: {
      objectives: {
        include: {
          objective: true,
        },
      },
    },
  });

  const now = new Date();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);

  let checkInCount = 0;
  let overdueCount = 0;
  let noProgressCount = 0;

  for (let idx = 0; idx < keyResults.length; idx++) {
    const kr = keyResults[idx];
    const ownerId = kr.ownerId;

    if (!kr.checkInCadence || kr.checkInCadence === 'NONE') {
      continue;
    }

    let createdAt: Date;
    let isOverdue = false;
    let isNoProgress = false;

    if (kr.checkInCadence === 'WEEKLY') {
      if (idx % 10 === 0) {
        createdAt = eightDaysAgo;
        isOverdue = true;
        overdueCount++;
      } else if (idx % 7 === 0) {
        createdAt = twoWeeksAgo;
        isNoProgress = true;
        noProgressCount++;
      } else {
        createdAt = idx % 2 === 0 ? threeDaysAgo : oneDayAgo;
      }
    } else if (kr.checkInCadence === 'BIWEEKLY') {
      if (idx % 12 === 0) {
        createdAt = twoWeeksAgo;
        isOverdue = true;
        overdueCount++;
      } else if (idx % 8 === 0) {
        createdAt = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
        isNoProgress = true;
        noProgressCount++;
      } else {
        createdAt = idx % 2 === 0 ? fiveDaysAgo : oneDayAgo;
      }
    } else {
      createdAt = idx % 2 === 0 ? fiveDaysAgo : oneDayAgo;
    }

    await prisma.checkIn.create({
      data: {
        keyResultId: kr.id,
        userId: ownerId,
        value: Math.max(0, kr.currentValue + randomInt(-5, 5)),
        confidence: randomInt(1, 5),
        note: isOverdue
          ? `Overdue check-in: ${kr.title} - Behind schedule`
          : isNoProgress
          ? `No progress update: ${kr.title} - Blocked`
          : `Check-in for ${kr.title}`,
        blockers: isOverdue || isNoProgress ? 'Resource constraints identified' : null,
        createdAt: createdAt,
      },
    });
    checkInCount++;
  }

  console.log(`✅ Created ${checkInCount} check-ins (${overdueCount} overdue, ${noProgressCount} no progress)`);

  const managers = await prisma.user.findMany({
    where: {
      email: { contains: '@puzzelcx.local' },
      roleAssignments: {
        some: {
          role: { in: ['TENANT_ADMIN', 'WORKSPACE_LEAD', 'TEAM_LEAD'] },
        },
      },
    },
    take: 10,
  });

  const members = await prisma.user.findMany({
    where: {
      email: { contains: '@puzzelcx.local' },
      roleAssignments: {
        some: {
          role: { in: ['TEAM_CONTRIBUTOR', 'WORKSPACE_MEMBER'] },
        },
      },
    },
    take: 15,
  });

  for (let i = 0; i < 10; i++) {
    const manager = managers[i % managers.length];
    const member = members[i % members.length];

    await prisma.checkInRequest.create({
      data: {
        requesterUserId: manager.id,
        targetUserId: member.id,
        organizationId: orgId,
        dueAt: new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000),
        status: i < 6 ? 'OPEN' : i < 9 ? 'SUBMITTED' : 'LATE',
      },
    });
  }

  console.log('✅ Created 10 check-in requests');
}

if (require.main === module) {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error('❌ Usage: ts-node 07_checkins_and_requests.ts <orgId>');
    process.exit(1);
  }

  createCheckInsAndRequests(orgId, new Map())
    .then(() => {
      console.log('✅ Check-ins and requests complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { createCheckInsAndRequests };

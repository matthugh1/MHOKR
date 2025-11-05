#!/usr/bin/env ts-node

/**
 * Cycles
 * 
 * Creates 4 cycles: Q4 2025 (ACTIVE), Q1 2026 (ACTIVE), Q2 2026 (DRAFT), Q3 2026 (ARCHIVED).
 */

import { PrismaClient } from '@prisma/client';
import { createCycle, STANDARD_CYCLES } from '../../services/core-api/prisma/factories/cycles';

const prisma = new PrismaClient();

async function createCycles(orgId: string): Promise<Map<string, string>> {
  console.log('📅 Creating cycles...');

  const cycleIds = new Map<string, string>();

  for (const cycleData of STANDARD_CYCLES) {
    const cycleId = await createCycle(prisma, orgId, cycleData);
    cycleIds.set(cycleData.name, cycleId);
    console.log(`✅ Created cycle: ${cycleData.name} (${cycleData.status})`);
  }

  console.log(`✅ Created ${cycleIds.size} cycles`);
  return cycleIds;
}

if (require.main === module) {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error('❌ Usage: ts-node 04_cycles.ts <orgId>');
    process.exit(1);
  }

  createCycles(orgId)
    .then(() => {
      console.log('✅ Cycles creation complete');
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

export { createCycles };


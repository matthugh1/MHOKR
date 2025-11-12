#!/usr/bin/env ts-node

/**
 * Initiatives
 * 
 * Creates initiatives linked to objectives (simplified - initiatives created with objectives).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createInitiatives(): Promise<void> {
  console.log('🚀 Initiatives are created alongside objectives in 05_okrs_objectives_krs.ts');
  console.log('✅ No additional initiative creation needed');
}

if (require.main === module) {
  createInitiatives()
    .then(() => {
      console.log('✅ Initiatives complete');
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

export { createInitiatives };


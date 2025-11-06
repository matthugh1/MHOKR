#!/usr/bin/env ts-node

/**
 * Feature Flags
 * 
 * Enables rbacInspector for 5 users (done during user creation).
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function configureFeatureFlags(): Promise<void> {
  console.log('🚩 Feature flags (rbacInspector) are configured during user creation');
  console.log('✅ No additional feature flag configuration needed');
}

if (require.main === module) {
  configureFeatureFlags()
    .then(() => {
      console.log('✅ Feature flags complete');
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

export { configureFeatureFlags };


#!/usr/bin/env ts-node

/**
 * RBAC Whitelists
 * 
 * Configures PRIVATE visibility whitelists for confidential OKRs.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function configureRBACWhitelists(orgId: string, userIds: Map<string, string>): Promise<void> {
  console.log('🔐 Configuring RBAC whitelists...');

  const founderEmail = 'founder@puzzelcx.local';
  const founderId = userIds.get(founderEmail)!;

  const adminEmails = ['admin1@puzzelcx.local', 'admin2@puzzelcx.local'];
  const whitelistIds = [
    founderId,
    ...adminEmails.map(email => userIds.get(email)).filter(Boolean) as string[],
  ];

  await prisma.organization.update({
    where: { id: orgId },
    data: {
      execOnlyWhitelist: whitelistIds,
    },
  });

  console.log(`✅ Configured whitelist with ${whitelistIds.length} users`);
}

if (require.main === module) {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error('❌ Usage: ts-node 08_rbac_whitelists.ts <orgId>');
    process.exit(1);
  }

  configureRBACWhitelists(orgId, new Map())
    .then(() => {
      console.log('✅ RBAC whitelists complete');
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

export { configureRBACWhitelists };


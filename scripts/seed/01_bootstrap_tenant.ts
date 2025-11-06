#!/usr/bin/env ts-node

/**
 * Bootstrap Tenant
 * 
 * Creates the tenant organisation, owner, and superuser.
 */

import { PrismaClient } from '@prisma/client';
import { generateOrgId } from '../../services/core-api/prisma/factories/ids';
import { createUser } from '../../services/core-api/prisma/factories/users';

const prisma = new PrismaClient();

const TENANT_SLUG = 'puzzel-cx-demo';
const TENANT_NAME = 'Puzzel CX Demo';
const FOUNDER_EMAIL = 'founder@puzzelcx.local';
const SUPERUSER_EMAIL = 'platform@puzzelcx.local';

async function bootstrapTenant(): Promise<{ orgId: string; founderId: string; superuserId: string }> {
  console.log('🏢 Bootstrapping tenant...');

  const orgId = generateOrgId(TENANT_SLUG);

  const existingOrg = await prisma.organization.findUnique({
    where: { slug: TENANT_SLUG },
  });

  if (existingOrg) {
    console.log(`✅ Tenant already exists: ${existingOrg.name} (${existingOrg.id})`);
  } else {
    await prisma.organization.create({
      data: {
        id: orgId,
        name: TENANT_NAME,
        slug: TENANT_SLUG,
        allowTenantAdminExecVisibility: false,
        execOnlyWhitelist: [],
        metadata: {},
      },
    });
    console.log(`✅ Created tenant: ${TENANT_NAME} (${orgId})`);
  }

  const founderId = await createUser(prisma, {
    email: FOUNDER_EMAIL,
    name: 'Founder',
    role: 'TENANT_OWNER',
    scopeType: 'TENANT',
    scopeId: orgId,
  });

  console.log(`✅ Created tenant owner: ${FOUNDER_EMAIL} (${founderId})`);

  const superuserId = await createUser(prisma, {
    email: SUPERUSER_EMAIL,
    name: 'Platform Superuser',
    role: 'SUPERUSER',
    scopeType: 'PLATFORM',
    isSuperuser: true,
  });

  console.log(`✅ Created superuser: ${SUPERUSER_EMAIL} (${superuserId})`);

  await prisma.roleAssignment.upsert({
    where: {
      userId_role_scopeType_scopeId: {
        userId: founderId,
        role: 'TENANT_OWNER',
        scopeType: 'TENANT',
        scopeId: orgId,
      },
    },
    update: {},
    create: {
      userId: founderId,
      role: 'TENANT_OWNER',
      scopeType: 'TENANT',
      scopeId: orgId,
    },
  });

  console.log(`✅ Assigned TENANT_OWNER role to founder`);

  return { orgId, founderId, superuserId };
}

if (require.main === module) {
  bootstrapTenant()
    .then(() => {
      console.log('✅ Bootstrap complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Bootstrap failed:', error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

export { bootstrapTenant };


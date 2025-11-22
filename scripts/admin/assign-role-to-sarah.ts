/**
 * Script to assign TENANT_ADMIN role to Sarah Chen
 * Run with: npx ts-node scripts/assign-role-to-sarah.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'cmhesnyxo00054xhjb6h2qm1v'; // Sarah Chen
  const tenantId = 'cmhesnyvx00004xhjjxs272gs'; // Puzzel CX
  const role = 'TENANT_ADMIN';

  console.log(`Assigning ${role} role to user ${userId} for tenant ${tenantId}...`);

  // Check if role assignment already exists
  const existing = await prisma.roleAssignment.findFirst({
    where: {
      userId,
      role,
      scopeType: 'TENANT',
      scopeId: tenantId,
    },
  });

  if (existing) {
    console.log('Role assignment already exists:', existing);
    return;
  }

  // Create role assignment
  const assignment = await prisma.roleAssignment.create({
    data: {
      userId,
      role,
      scopeType: 'TENANT',
      scopeId: tenantId,
    },
  });

  console.log('✅ Role assignment created:', assignment);

  // Verify it was created
  const verify = await prisma.roleAssignment.findMany({
    where: { userId },
  });
  console.log(`\n✅ User now has ${verify.length} role assignment(s):`);
  verify.forEach((ra) => {
    console.log(`  - ${ra.role} at ${ra.scopeType} scope ${ra.scopeId || '(null)'}`);
  });
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


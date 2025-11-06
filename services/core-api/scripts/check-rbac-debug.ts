/**
 * Debug script to check RBAC for Sarah Chen
 * Run with: npx ts-node scripts/check-rbac-debug.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'cmhesnyxo00054xhjb6h2qm1v'; // Sarah Chen
  const tenantId = 'cmhesnyvx00004xhjjxs272gs'; // Puzzel CX

  console.log('=== Checking Role Assignments ===');
  const roleAssignments = await prisma.roleAssignment.findMany({
    where: { userId },
  });

  console.log(`Found ${roleAssignments.length} role assignments for user ${userId}:`);
  roleAssignments.forEach((ra) => {
    console.log(`  - Role: ${ra.role}, ScopeType: ${ra.scopeType}, ScopeId: ${ra.scopeId}`);
  });

  console.log('\n=== Checking Tenant Roles ===');
  const tenantRoleAssignments = roleAssignments.filter(
    (ra) => ra.scopeType === 'TENANT' && ra.scopeId === tenantId
  );
  console.log(`Found ${tenantRoleAssignments.length} TENANT role assignments for tenant ${tenantId}:`);
  tenantRoleAssignments.forEach((ra) => {
    console.log(`  - Role: ${ra.role}`);
  });

  console.log('\n=== Checking Organization ===');
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });
  console.log(`Organization: ${org ? `${org.name} (${org.id})` : 'NOT FOUND'}`);

  console.log('\n=== Building User Context (simulating RBAC) ===');
  const tenantRoles = tenantRoleAssignments.map((ra) => ra.role as string);
  console.log(`Tenant roles for ${tenantId}:`, tenantRoles);

  // Simulate canCreateOKRAction logic
  if (tenantRoles.length > 0) {
    const isTenantViewerOnly = tenantRoles.includes('TENANT_VIEWER') && tenantRoles.length === 1;
    console.log(`\n=== RBAC Check Result ===`);
    console.log(`  - Has tenant roles: YES (${tenantRoles.length} roles)`);
    console.log(`  - Is TENANT_VIEWER only: ${isTenantViewerOnly}`);
    console.log(`  - Can create OKR: ${!isTenantViewerOnly}`);
  } else {
    console.log(`\n=== RBAC Check Result ===`);
    console.log(`  - Has tenant roles: NO`);
    console.log(`  - Can create OKR: NO`);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



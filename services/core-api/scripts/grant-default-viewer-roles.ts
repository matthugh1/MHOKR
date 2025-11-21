/**
 * Grant default viewer roles to all users who don't have any RBAC roles
 * 
 * This script ensures all users have at least TENANT_VIEWER role in their organization
 * so they can view OKRs. Run this after user creation or migration.
 * 
 * Usage: npx ts-node scripts/grant-default-viewer-roles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding users without RBAC roles...');

  // Get all users
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
    },
  });

  console.log(`Found ${allUsers.length} total users`);

  // For each user, check if they have any role assignments
  let usersUpdated = 0;
  let usersSkipped = 0;

  for (const user of allUsers) {
    // Skip superusers (they already have platform-level access)
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperuser: true },
    });

    if (userRecord?.isSuperuser) {
      console.log(`⏭️  Skipping superuser: ${user.email}`);
      usersSkipped++;
      continue;
    }

    // Get full user record to check primaryOrganizationId
    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        primaryOrganizationId: true,
        isSuperuser: true,
      },
    });

    if (!userRecord) {
      continue;
    }

    // Skip if user has no primary organization
    if (!userRecord.primaryOrganizationId) {
      console.log(`⚠️  User ${user.email} has no primaryOrganizationId, skipping`);
      usersSkipped++;
      continue;
    }

    // Check if user already has TENANT role assignment for their primary organization
    const existingTenantRole = await prisma.roleAssignment.findFirst({
      where: {
        userId: user.id,
        scopeType: 'TENANT',
        scopeId: userRecord.primaryOrganizationId,
      },
    });

    if (existingTenantRole) {
      console.log(`⏭️  User ${user.email} already has ${existingTenantRole.role} role in their organization, skipping`);
      usersSkipped++;
      continue;
    }

    // Get organization name for logging
    const organization = await prisma.organization.findUnique({
      where: { id: userRecord.primaryOrganizationId },
      select: { name: true },
    });

    // Grant TENANT_VIEWER role in their primary organization
    await prisma.roleAssignment.create({
      data: {
        userId: user.id,
        role: 'TENANT_VIEWER',
        scopeType: 'TENANT',
        scopeId: userRecord.primaryOrganizationId,
      },
    });

    console.log(`✅ Granted TENANT_VIEWER role to ${user.email} in ${organization?.name || userRecord.primaryOrganizationId}`);
    usersUpdated++;

    // Also grant WORKSPACE_MEMBER role if they're in a workspace
    const workspaceMemberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            organization: true,
          },
        },
      },
    });

    for (const wsMembership of workspaceMemberships) {
      // Check if role already exists
      const existing = await prisma.roleAssignment.findFirst({
        where: {
          userId: user.id,
          role: 'WORKSPACE_MEMBER',
          scopeType: 'WORKSPACE',
          scopeId: wsMembership.workspaceId,
        },
      });

      if (existing) {
        continue;
      }

      // Create role assignment
      await prisma.roleAssignment.create({
        data: {
          userId: user.id,
          role: 'WORKSPACE_MEMBER',
          scopeType: 'WORKSPACE',
          scopeId: wsMembership.workspaceId,
        },
      });

      console.log(`✅ Granted WORKSPACE_MEMBER role to ${user.email} in ${wsMembership.workspace.name}`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   - Users updated: ${usersUpdated}`);
  console.log(`   - Users skipped: ${usersSkipped}`);
  console.log(`   - Total users: ${allUsers.length}`);
  console.log('\n✅ Done! All users should now be able to view OKRs.');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });










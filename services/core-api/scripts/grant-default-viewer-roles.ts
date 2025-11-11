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

    // Check if user has any role assignments
    const existingRoles = await prisma.roleAssignment.findMany({
      where: { userId: user.id },
    });

    if (existingRoles.length > 0) {
      console.log(`⏭️  User ${user.email} already has ${existingRoles.length} role(s), skipping`);
      usersSkipped++;
      continue;
    }

    // Find user's organization memberships
    const orgMemberships = await prisma.organizationMember.findMany({
      where: { userId: user.id },
      include: {
        organization: true,
      },
    });

    if (orgMemberships.length === 0) {
      console.log(`⚠️  User ${user.email} has no organization membership, skipping`);
      usersSkipped++;
      continue;
    }

    // Grant TENANT_VIEWER role in each organization they belong to
    for (const membership of orgMemberships) {
      // Check if role already exists
      const existing = await prisma.roleAssignment.findFirst({
        where: {
          userId: user.id,
          role: 'TENANT_VIEWER',
          scopeType: 'TENANT',
          scopeId: membership.organizationId,
        },
      });

      if (existing) {
        console.log(`⏭️  User ${user.email} already has TENANT_VIEWER in ${membership.organization.name}`);
        continue;
      }

      // Create role assignment
      await prisma.roleAssignment.create({
        data: {
          userId: user.id,
          role: 'TENANT_VIEWER',
          scopeType: 'TENANT',
          scopeId: membership.organizationId,
        },
      });

      console.log(`✅ Granted TENANT_VIEWER role to ${user.email} in ${membership.organization.name}`);
      usersUpdated++;
    }

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








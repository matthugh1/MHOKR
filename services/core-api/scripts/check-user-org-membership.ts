/**
 * Check user organization membership and RBAC roles
 * 
 * Usage: npx ts-node scripts/check-user-org-membership.ts [user-email]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userEmail = process.argv[2];
  
  if (!userEmail) {
    console.log('Usage: npx ts-node scripts/check-user-org-membership.ts <user-email>');
    console.log('Example: npx ts-node scripts/check-user-org-membership.ts user@example.com');
    process.exit(1);
  }

  console.log(`🔍 Checking user: ${userEmail}\n`);

  // Find user
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperuser: true,
    },
  });

  if (!user) {
    console.log(`❌ User not found: ${userEmail}`);
    process.exit(1);
  }

  console.log('📋 User Info:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Superuser: ${user.isSuperuser ? 'Yes' : 'No'}\n`);

  // Check organization memberships
  const orgMemberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  console.log('🏢 Organization Memberships:');
  if (orgMemberships.length === 0) {
    console.log('   ❌ User has NO organization memberships!');
    console.log('   ⚠️  This is why they cannot view OKRs.');
  } else {
    orgMemberships.forEach((membership) => {
      console.log(`   ✅ ${membership.organization.name} (${membership.organization.slug})`);
      console.log(`      Organization ID: ${membership.organizationId}`);
      console.log(`      Role: ${membership.role}`);
    });
  }

  // Check RBAC role assignments
  const roleAssignments = await prisma.roleAssignment.findMany({
    where: { userId: user.id },
    include: {
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  console.log('\n🔐 RBAC Role Assignments:');
  if (roleAssignments.length === 0) {
    console.log('   ❌ User has NO RBAC role assignments!');
    console.log('   ⚠️  This may cause permission issues.');
  } else {
    const byScope = {
      TENANT: [] as any[],
      WORKSPACE: [] as any[],
      TEAM: [] as any[],
    };

    roleAssignments.forEach((assignment) => {
      byScope[assignment.scopeType as keyof typeof byScope].push(assignment);
    });

    if (byScope.TENANT.length > 0) {
      console.log('   Tenant Roles:');
      byScope.TENANT.forEach((ra) => {
        const org = orgMemberships.find((om) => om.organizationId === ra.scopeId);
        console.log(`      ✅ ${ra.role} in ${org?.organization.name || ra.scopeId}`);
      });
    }

    if (byScope.WORKSPACE.length > 0) {
      console.log('   Workspace Roles:');
      byScope.WORKSPACE.forEach((ra) => {
        console.log(`      ✅ ${ra.role} in workspace ${ra.scopeId}`);
      });
    }

    if (byScope.TEAM.length > 0) {
      console.log('   Team Roles:');
      byScope.TEAM.forEach((ra) => {
        console.log(`      ✅ ${ra.role} in team ${ra.scopeId}`);
      });
    }
  }

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Organization Memberships: ${orgMemberships.length}`);
  console.log(`   RBAC Role Assignments: ${roleAssignments.length}`);
  
  if (orgMemberships.length === 0) {
    console.log('\n⚠️  ISSUE: User has no organization membership!');
    console.log('   Fix: Add user to an organization using:');
    console.log('   - Organization settings UI, or');
    console.log('   - Database: INSERT INTO organization_members (user_id, organization_id, role) VALUES (...)');
  } else if (roleAssignments.length === 0) {
    console.log('\n⚠️  ISSUE: User has no RBAC roles!');
    console.log('   Fix: Run: npx ts-node scripts/grant-default-viewer-roles.ts');
  } else {
    const hasTenantRole = roleAssignments.some(
      (ra) => ra.scopeType === 'TENANT' && ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_VIEWER'].includes(ra.role)
    );
    if (!hasTenantRole) {
      console.log('\n⚠️  ISSUE: User has no tenant-level RBAC role!');
      console.log('   Fix: Grant TENANT_VIEWER role using RBAC assignment API or database');
    } else {
      console.log('\n✅ User should be able to view OKRs');
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });






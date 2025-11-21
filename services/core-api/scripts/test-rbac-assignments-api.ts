/**
 * Test script to verify RBAC assignments API returns correct data for a user
 * 
 * Usage: npx tsx services/core-api/scripts/test-rbac-assignments-api.ts <email>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testRBACAssignments(email: string) {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Testing RBAC Assignments for: ${email}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Find user
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      isSuperuser: true,
      primaryOrganizationId: true,
      primaryOrganization: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    console.log(`❌ User not found: ${email}`);
    await prisma.$disconnect();
    return;
  }

  console.log('📋 USER INFO:');
  console.log(`   ID: ${user.id}`);
  console.log(`   Name: ${user.name}`);
  console.log(`   Superuser: ${user.isSuperuser ? 'YES' : 'NO'}`);
  console.log(`   Primary Organization: ${user.primaryOrganization?.name || 'None'}`);
  console.log(`   Primary Org ID: ${user.primaryOrganizationId || 'N/A'}\n`);

  // Get all role assignments (what getUserRoleAssignments returns)
  const roleAssignments = await prisma.roleAssignment.findMany({
    where: { userId: user.id },
    orderBy: [{ scopeType: 'asc' }, { scopeId: 'asc' }],
  });

  console.log(`📋 ROLE ASSIGNMENTS (${roleAssignments.length} total):\n`);

  if (roleAssignments.length === 0) {
    console.log('   ⚠️  NO ROLE ASSIGNMENTS FOUND');
    await prisma.$disconnect();
    return;
  }

  // Group by scope type (mimicking API response)
  const rolesByScope: {
    tenant: Array<{ tenantId: string; roles: string[] }>;
    workspace: Array<{ workspaceId: string; roles: string[] }>;
    team: Array<{ teamId: string; roles: string[] }>;
  } = {
    tenant: [],
    workspace: [],
    team: [],
  };

  const tenantMap = new Map<string, string[]>();
  const workspaceMap = new Map<string, string[]>();
  const teamMap = new Map<string, string[]>();

  for (const assignment of roleAssignments) {
    const role = assignment.role;

    switch (assignment.scopeType) {
      case 'TENANT':
        if (assignment.scopeId) {
          const existing = tenantMap.get(assignment.scopeId) || [];
          tenantMap.set(assignment.scopeId, [...existing, role]);
        }
        break;
      case 'WORKSPACE':
        if (assignment.scopeId) {
          const existing = workspaceMap.get(assignment.scopeId) || [];
          workspaceMap.set(assignment.scopeId, [...existing, role]);
        }
        break;
      case 'TEAM':
        if (assignment.scopeId) {
          const existing = teamMap.get(assignment.scopeId) || [];
          teamMap.set(assignment.scopeId, [...existing, role]);
        }
        break;
    }
  }

  // Convert maps to arrays
  for (const [tenantId, roles] of tenantMap.entries()) {
    const org = await prisma.organization.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    rolesByScope.tenant.push({ tenantId, roles });
    console.log(`   🏢 TENANT: ${roles.join(', ')} (${org?.name || tenantId}) [${tenantId}]`);
  }

  for (const [workspaceId, roles] of workspaceMap.entries()) {
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    rolesByScope.workspace.push({ workspaceId, roles });
    console.log(`   📁 WORKSPACE: ${roles.join(', ')} (${ws?.name || workspaceId}) [${workspaceId}]`);
  }

  for (const [teamId, roles] of teamMap.entries()) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });
    rolesByScope.team.push({ teamId, roles });
    console.log(`   👥 TEAM: ${roles.join(', ')} (${team?.name || teamId}) [${teamId}]`);
  }

  console.log('\n📤 EXPECTED API RESPONSE:');
  console.log(JSON.stringify({
    userId: user.id,
    isSuperuser: user.isSuperuser || false,
    roles: rolesByScope,
  }, null, 2));

  console.log('\n🔍 SCOPE AVAILABILITY CHECK:');
  if (user.primaryOrganizationId) {
    const tenantRoles = rolesByScope.tenant.find(
      (t) => t.tenantId === user.primaryOrganizationId
    );
    const hasTenantRole = tenantRoles !== undefined && tenantRoles.roles.length > 0;
    
    console.log(`   Current Org ID: ${user.primaryOrganizationId}`);
    console.log(`   Matching Tenant Roles: ${tenantRoles ? JSON.stringify(tenantRoles) : 'NONE'}`);
    console.log(`   Has Tenant Role: ${hasTenantRole ? '✅ YES' : '❌ NO'}`);
    
    if (!hasTenantRole && rolesByScope.tenant.length > 0) {
      console.log(`   ⚠️  WARNING: User has tenant roles but NOT for current organization!`);
      console.log(`   This might cause the "Company OKRs" button to not appear.`);
    }
  } else {
    console.log('   ⚠️  No primary organization set');
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

// Run
const email = process.argv[2] || 'frederic.laziou@puzzel.com';
testRBACAssignments(email).catch(console.error);


import { RBACService } from '../src/modules/rbac/rbac.service';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit/audit-log.service';
import { buildResourceContextFromOKR } from '../src/modules/rbac/helpers';

const prisma = new PrismaService();
const auditLogService = new AuditLogService(prisma);
const rbacService = new RBACService(prisma, auditLogService);

async function checkUserPermissions(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      roleAssignments: {
        orderBy: [{ scopeType: 'asc' }, { role: 'asc' }],
      },
      ownedWorkspaces: {
        include: {
          tenant: {
            select: { id: true, name: true },
          },
        },
      },
      ownedTeams: {
        include: {
          workspace: {
            select: { id: true, name: true, tenantId: true },
          },
        },
      },
      primaryOrganization: {
        select: { id: true, name: true },
      },
    },
  });

  if (!user) {
    console.log(`❌ User not found: ${email}`);
    await prisma.$disconnect();
    return;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`PERMISSION ANALYSIS: ${user.name} (${user.email})`);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📋 USER DETAILS');
  console.log(`   ID: ${user.id}`);
  console.log(`   Superuser: ${user.isSuperuser ? '✅ YES' : '❌ NO'}`);
  console.log(`   Primary Organization: ${user.primaryOrganization?.name || 'None'}`);
  console.log('');

  console.log('🎭 ROLE ASSIGNMENTS');
  const tenantRoles = user.roleAssignments.filter(ra => ra.scopeType === 'TENANT');
  const workspaceRoles = user.roleAssignments.filter(ra => ra.scopeType === 'WORKSPACE');
  const teamRoles = user.roleAssignments.filter(ra => ra.scopeType === 'TEAM');

  if (tenantRoles.length === 0 && workspaceRoles.length === 0 && teamRoles.length === 0) {
    console.log('   ⚠️  No role assignments found');
  } else {
    if (tenantRoles.length > 0) {
      console.log('   Tenant Level:');
      for (const ra of tenantRoles) {
        const org = await prisma.organization.findUnique({
          where: { id: ra.scopeId || '' },
          select: { name: true },
        });
        console.log(`     • ${ra.role}${org ? ` (${org.name})` : ''}`);
      }
    }

    if (workspaceRoles.length > 0) {
      console.log('   Workspace Level (DEPRECATED):');
      for (const ra of workspaceRoles) {
        const ws = await prisma.workspace.findUnique({
          where: { id: ra.scopeId || '' },
          select: { name: true },
        });
        console.log(`     • ${ra.role}${ws ? ` (${ws.name})` : ''}`);
      }
    }

    if (teamRoles.length > 0) {
      console.log('   Team Level (DEPRECATED):');
      for (const ra of teamRoles) {
        const team = await prisma.team.findUnique({
          where: { id: ra.scopeId || '' },
          select: { name: true },
        });
        console.log(`     • ${ra.role}${team ? ` (${team.name})` : ''}`);
      }
    }
  }
  console.log('');

  console.log('👑 OWNERSHIP');
  if (user.ownedWorkspaces.length === 0 && user.ownedTeams.length === 0) {
    console.log('   ⚠️  No workspace or team ownership');
  } else {
    if (user.ownedWorkspaces.length > 0) {
      console.log(`   Workspace Owner (${user.ownedWorkspaces.length}):`);
      user.ownedWorkspaces.forEach(ws => {
        console.log(`     • ${ws.name} (${ws.tenant.name})`);
      });
    }

    if (user.ownedTeams.length > 0) {
      console.log(`   Team Owner (${user.ownedTeams.length}):`);
      for (const team of user.ownedTeams) {
        const ws = await prisma.workspace.findUnique({
          where: { id: team.workspaceId },
          select: { name: true },
        });
        console.log(`     • ${team.name}${ws ? ` (${ws.name})` : ''}`);
      }
    }
  }
  console.log('');

  console.log('🔐 EFFECTIVE PERMISSIONS');
  console.log('');

  // Determine role level
  if (user.isSuperuser) {
    console.log('   Role: ✅ SUPERUSER');
    console.log('   Capabilities:');
    console.log('     • Full system access');
    console.log('     • Can view/edit everything');
    console.log('     • Bypasses all locks');
    console.log('     • Can manage all tenants');
  } else {
    const hasTenantAdmin = tenantRoles.some(ra => ra.role === 'TENANT_ADMIN' || ra.role === 'TENANT_OWNER');
    const hasTenantViewer = tenantRoles.some(ra => ra.role === 'TENANT_VIEWER');

    if (hasTenantAdmin) {
      console.log('   Role: ✅ TENANT_ADMIN/OWNER');
      console.log('   Capabilities:');
      console.log('     • Edit all OKRs in tenant (including published)');
      console.log('     • Manage users, workspaces, teams');
      console.log('     • Export data');
      console.log('     • Bypass publish/cycle locks');
    } else if (hasTenantViewer) {
      console.log('   Role: 👁️  TENANT_VIEWER');
      console.log('   Capabilities:');
      console.log('     • View all OKRs in tenant');
      console.log('     • Export data');
      console.log('     • ❌ Cannot edit tenant-level OKRs');
      console.log('     • ❌ Cannot manage users/workspaces');
    } else {
      console.log('   Role: 👤 TENANT_USER (default)');
      console.log('   Capabilities:');
      console.log('     • Edit own OKRs (when not published/locked)');
      console.log('     • View other OKRs');
      console.log('     • ❌ Cannot edit published OKRs');
      console.log('     • ❌ Cannot manage users/workspaces');
    }
  }

  // Ownership-based permissions
  if (user.ownedWorkspaces.length > 0) {
    console.log('');
    console.log('   Workspace Ownership:');
    console.log('     • Can edit all workspace-level OKRs');
    console.log('     • Can publish workspace OKRs');
    console.log('     • Can manage workspace members');
  }

  if (user.ownedTeams.length > 0) {
    console.log('');
    console.log('   Team Ownership:');
    console.log('     • Can edit all team-level OKRs');
    console.log('     • Can publish team OKRs');
    console.log('     • Can manage team members');
  }

  console.log('');

  // Test actual permissions
  console.log('🧪 PERMISSION TESTS');
  
  // Test 1: Can edit team OKR
  if (user.ownedTeams.length > 0) {
    const team = user.ownedTeams[0];
    const teamOKR = await prisma.objective.findFirst({
      where: { teamId: team.id },
      select: {
        id: true,
        title: true,
        ownerId: true,
        tenantId: true,
        workspaceId: true,
        teamId: true,
        isPublished: true,
      },
    });

    if (teamOKR) {
      try {
        const resourceContext = await buildResourceContextFromOKR(prisma, teamOKR.id);
        const canEdit = await rbacService.canPerformAction(user.id, 'edit_okr', resourceContext);
        const canDelete = await rbacService.canPerformAction(user.id, 'delete_okr', resourceContext);
        const canPublish = await rbacService.canPerformAction(user.id, 'publish_okr', resourceContext);

        console.log(`   Team OKR: "${teamOKR.title}"`);
        console.log(`     Edit: ${canEdit ? '✅ YES' : '❌ NO'}`);
        console.log(`     Delete: ${canDelete ? '✅ YES' : '❌ NO'}`);
        console.log(`     Publish: ${canPublish ? '✅ YES' : '❌ NO'}`);
      } catch (error: any) {
        console.log(`   ⚠️  Error testing permissions: ${error.message}`);
      }
    } else {
      console.log(`   No OKRs found in team "${team.name}"`);
    }
  }

  // Test 2: Can export data
  if (user.primaryOrganization) {
    const resourceContext = {
      tenantId: user.primaryOrganization.id,
    };
    const canExport = await rbacService.canPerformAction(user.id, 'export_data', resourceContext);
    console.log(`   Export Data: ${canExport ? '✅ YES' : '❌ NO'}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');

  await prisma.$disconnect();
}

// Run
const email = process.argv[2] || 'frederic.laziou@puzzel.com';
checkUserPermissions(email).catch(console.error);


import { PrismaClient, RBACRole } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migration script to convert workspace/team roles to ownership model
 * 
 * This script:
 * 1. Migrates WORKSPACE_LEAD roles to workspace.ownerId
 * 2. Migrates TEAM_LEAD roles to team.ownerId
 * 3. Sets default owners for workspaces/teams without leads
 * 4. Removes deprecated workspace/team role assignments
 */
async function migrateToSimplifiedRoles() {
  console.log('Starting role simplification migration...');

  try {
    // Step 1: Migrate workspace owners
    console.log('Step 1: Migrating workspace owners...');
    const workspaceLeads = await prisma.roleAssignment.findMany({
      where: {
        scopeType: 'WORKSPACE',
        role: 'WORKSPACE_LEAD',
      },
    });

    let workspaceCount = 0;
    for (const assignment of workspaceLeads) {
      if (assignment.scopeId) {
        try {
          await prisma.workspace.update({
            where: { id: assignment.scopeId },
            data: { ownerId: assignment.userId },
          });
          workspaceCount++;
          console.log(`  ✓ Set workspace ${assignment.scopeId} owner to ${assignment.userId}`);
        } catch (error: any) {
          console.error(`  ✗ Failed to set owner for workspace ${assignment.scopeId}:`, error.message);
        }
      }
    }
    console.log(`  Completed: ${workspaceCount} workspaces updated`);

    // Step 2: Migrate team owners
    console.log('Step 2: Migrating team owners...');
    const teamLeads = await prisma.roleAssignment.findMany({
      where: {
        scopeType: 'TEAM',
        role: 'TEAM_LEAD',
      },
    });

    let teamCount = 0;
    for (const assignment of teamLeads) {
      if (assignment.scopeId) {
        try {
          await prisma.team.update({
            where: { id: assignment.scopeId },
            data: { ownerId: assignment.userId },
          });
          teamCount++;
          console.log(`  ✓ Set team ${assignment.scopeId} owner to ${assignment.userId}`);
        } catch (error: any) {
          console.error(`  ✗ Failed to set owner for team ${assignment.scopeId}:`, error.message);
        }
      }
    }
    console.log(`  Completed: ${teamCount} teams updated`);

    // Step 3: Set default owners for workspaces without owners
    console.log('Step 3: Setting default workspace owners...');
    const workspacesWithoutOwners = await prisma.workspace.findMany({
      where: { ownerId: null },
      include: {
        objectives: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { ownerId: true },
        },
      },
    });

    let defaultWorkspaceCount = 0;
    for (const workspace of workspacesWithoutOwners) {
      let defaultOwnerId: string | null = null;

      // Use first objective creator as default owner
      if (workspace.objectives.length > 0) {
        defaultOwnerId = workspace.objectives[0].ownerId;
      } else {
        // Find first tenant admin for this tenant
        const tenantAdmin = await prisma.roleAssignment.findFirst({
          where: {
            scopeType: 'TENANT',
            scopeId: workspace.tenantId,
            role: { in: [RBACRole.TENANT_OWNER, RBACRole.TENANT_ADMIN] },
          },
        });
        if (tenantAdmin) {
          defaultOwnerId = tenantAdmin.userId;
        }
      }

      if (defaultOwnerId) {
        try {
          await prisma.workspace.update({
            where: { id: workspace.id },
            data: { ownerId: defaultOwnerId },
          });
          defaultWorkspaceCount++;
          console.log(`  ✓ Set default owner for workspace ${workspace.id} to ${defaultOwnerId}`);
        } catch (error: any) {
          console.error(`  ✗ Failed to set default owner for workspace ${workspace.id}:`, error.message);
        }
      } else {
        console.warn(`  ⚠ No default owner found for workspace ${workspace.id}`);
      }
    }
    console.log(`  Completed: ${defaultWorkspaceCount} workspaces assigned default owners`);

    // Step 4: Set default owners for teams without owners
    console.log('Step 4: Setting default team owners...');
    const teamsWithoutOwners = await prisma.team.findMany({
      where: { ownerId: null },
      include: {
        objectives: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          select: { ownerId: true },
        },
        workspace: {
          select: { ownerId: true, tenantId: true },
        },
      },
    });

    let defaultTeamCount = 0;
    for (const team of teamsWithoutOwners) {
      let defaultOwnerId: string | null = null;

      // Prefer team objective creator
      if (team.objectives.length > 0) {
        defaultOwnerId = team.objectives[0].ownerId;
      }
      // Fallback to workspace owner
      else if (team.workspace?.ownerId) {
        defaultOwnerId = team.workspace.ownerId;
      }
      // Fallback to first tenant admin
      else if (team.workspace?.tenantId) {
        const tenantAdmin = await prisma.roleAssignment.findFirst({
          where: {
            scopeType: 'TENANT',
            scopeId: team.workspace.tenantId,
            role: { in: [RBACRole.TENANT_OWNER, RBACRole.TENANT_ADMIN] },
          },
        });
        if (tenantAdmin) {
          defaultOwnerId = tenantAdmin.userId;
        }
      }

      if (defaultOwnerId) {
        try {
          await prisma.team.update({
            where: { id: team.id },
            data: { ownerId: defaultOwnerId },
          });
          defaultTeamCount++;
          console.log(`  ✓ Set default owner for team ${team.id} to ${defaultOwnerId}`);
        } catch (error: any) {
          console.error(`  ✗ Failed to set default owner for team ${team.id}:`, error.message);
        }
      } else {
        console.warn(`  ⚠ No default owner found for team ${team.id}`);
      }
    }
    console.log(`  Completed: ${defaultTeamCount} teams assigned default owners`);

    // Step 5: Remove deprecated workspace/team role assignments
    console.log('Step 5: Removing deprecated workspace/team role assignments...');
    const deprecatedRoles: RBACRole[] = [
      RBACRole.WORKSPACE_LEAD,
      RBACRole.WORKSPACE_ADMIN,
      RBACRole.WORKSPACE_MEMBER,
      RBACRole.TEAM_LEAD,
      RBACRole.TEAM_CONTRIBUTOR,
      RBACRole.TEAM_VIEWER,
    ];

    const deleted = await prisma.roleAssignment.deleteMany({
      where: {
        scopeType: { in: ['WORKSPACE', 'TEAM'] },
        role: { in: deprecatedRoles },
      },
    });

    console.log(`  Completed: ${deleted.count} deprecated role assignments removed`);

    // Step 6: Summary
    console.log('\n=== Migration Summary ===');
    const remainingWorkspaces = await prisma.workspace.count({ where: { ownerId: null } });
    const remainingTeams = await prisma.team.count({ where: { ownerId: null } });
    const remainingDeprecatedRoles = await prisma.roleAssignment.count({
      where: {
        scopeType: { in: ['WORKSPACE', 'TEAM'] },
        role: { in: deprecatedRoles as RBACRole[] },
      },
    });

    console.log(`Workspaces with owners: ${await prisma.workspace.count({ where: { ownerId: { not: null } } })}`);
    console.log(`Workspaces without owners: ${remainingWorkspaces}`);
    console.log(`Teams with owners: ${await prisma.team.count({ where: { ownerId: { not: null } } })}`);
    console.log(`Teams without owners: ${remainingTeams}`);
    console.log(`Remaining deprecated role assignments: ${remainingDeprecatedRoles}`);

    if (remainingWorkspaces > 0 || remainingTeams > 0) {
      console.warn('\n⚠ Warning: Some workspaces/teams still lack owners. Please review and assign manually.');
    }

    if (remainingDeprecatedRoles > 0) {
      console.warn('\n⚠ Warning: Some deprecated role assignments remain. Please review manually.');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
migrateToSimplifiedRoles()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


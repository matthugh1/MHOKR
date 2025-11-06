/**
 * RBAC Migration Service
 * 
 * Service to migrate from old membership tables (OrganizationMember, WorkspaceMember, TeamMember)
 * to the new RoleAssignment model.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from './rbac.service';
import { Role } from './types';


/**
 * Mapping from old MemberRole to workspace-level roles
 */
const WORKSPACE_ROLE_MAPPING: Record<string, Role> = {
  WORKSPACE_OWNER: 'WORKSPACE_LEAD',
  MEMBER: 'WORKSPACE_MEMBER',
  VIEWER: 'WORKSPACE_MEMBER', // VIEWER at workspace becomes MEMBER
};

/**
 * Mapping from old MemberRole to team-level roles
 */
const TEAM_ROLE_MAPPING: Record<string, Role> = {
  TEAM_LEAD: 'TEAM_LEAD',
  MEMBER: 'TEAM_CONTRIBUTOR',
  VIEWER: 'TEAM_VIEWER',
};

@Injectable()
export class RBACMigrationService {
  private readonly logger = new Logger(RBACMigrationService.name);

  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
  ) {}

  /**
   * Migrate all existing memberships to RoleAssignment model
   * 
   * This should be run once to populate the new RoleAssignment table from
   * the existing OrganizationMember, WorkspaceMember, and TeamMember tables.
   * 
   * Note: Superusers are skipped since they have implicit access via isSuperuser flag.
   * 
   * Note: Uses raw SQL queries because legacy tables may not be in Prisma schema
   */
  async migrateAllMemberships(migratedBy: string = 'system'): Promise<{
    organizationMembers: number;
    workspaceMembers: number;
    teamMembers: number;
    total: number;
  }> {
    this.logger.log('Starting RBAC migration...');

    let orgCount = 0;
    let workspaceCount = 0;
    let teamCount = 0;

    // Get all superuser IDs to skip them
    const superusers = await this.prisma.user.findMany({
      where: { isSuperuser: true },
      select: { id: true },
    });
    const superuserIds = new Set(superusers.map(u => u.id));

    // Migrate organization memberships - use raw SQL if Prisma schema doesn't have the table
    let orgMembers: Array<{id: string, userId: string, tenantId: string, role: string}> = [];
    try {
      // Try Prisma first
      orgMembers = await this.prisma.$queryRaw`
        SELECT id, "userId", "tenantId", role::text
        FROM organization_members
      `;
    } catch (error) {
      // If table doesn't exist in Prisma schema, use raw SQL
      const result = await this.prisma.$queryRaw<Array<{id: string, userId: string, tenantId: string, role: string}>>`
        SELECT id, "userId", "tenantId", role::text
        FROM organization_members
      `;
      orgMembers = result;
    }

    for (const member of orgMembers) {
      // Skip superusers - they don't need role assignments
      if (superuserIds.has(member.userId)) {
        this.logger.debug(`Skipping superuser ${member.userId} for org membership migration`);
        continue;
      }

      const newRole = this.mapOrganizationRole(member.role);
      if (newRole) {
        try {
          await this.rbacService.assignRole(
            member.userId,
            newRole,
            'TENANT',
            member.tenantId,
            migratedBy,
            member.tenantId, // Use the organization being migrated, not null
          );
          orgCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to migrate org membership ${member.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    // Migrate workspace memberships
    let workspaceMembers: Array<{id: string, userId: string, workspaceId: string, role: string, tenantId: string}> = [];
    try {
      workspaceMembers = await this.prisma.$queryRaw`
        SELECT wm.id, wm."userId", wm."workspaceId", wm.role::text, w."tenantId"
        FROM workspace_members wm
        JOIN workspaces w ON wm."workspaceId" = w.id
      `;
    } catch (error) {
      const result = await this.prisma.$queryRaw<Array<{id: string, userId: string, workspaceId: string, role: string, tenantId: string}>>`
        SELECT wm.id, wm."userId", wm."workspaceId", wm.role::text, w."tenantId"
        FROM workspace_members wm
        JOIN workspaces w ON wm."workspaceId" = w.id
      `;
      workspaceMembers = result;
    }

    for (const member of workspaceMembers) {
      // Skip superusers - they don't need role assignments
      if (superuserIds.has(member.userId)) {
        this.logger.debug(`Skipping superuser ${member.userId} for workspace membership migration`);
        continue;
      }

      const newRole = this.mapWorkspaceRole(member.role);
      if (newRole) {
        try {
          await this.rbacService.assignRole(
            member.userId,
            newRole,
            'WORKSPACE',
            member.workspaceId,
            migratedBy,
            member.tenantId, // Use the workspace's organization
          );
          workspaceCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to migrate workspace membership ${member.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    // Migrate team memberships
    let teamMembers: Array<{id: string, userId: string, teamId: string, role: string, tenantId: string}> = [];
    try {
      teamMembers = await this.prisma.$queryRaw`
        SELECT tm.id, tm."userId", tm."teamId", tm.role::text, w."tenantId"
        FROM team_members tm
        JOIN teams t ON tm."teamId" = t.id
        JOIN workspaces w ON t."workspaceId" = w.id
      `;
    } catch (error) {
      const result = await this.prisma.$queryRaw<Array<{id: string, userId: string, teamId: string, role: string, tenantId: string}>>`
        SELECT tm.id, tm."userId", tm."teamId", tm.role::text, w."tenantId"
        FROM team_members tm
        JOIN teams t ON tm."teamId" = t.id
        JOIN workspaces w ON t."workspaceId" = w.id
      `;
      teamMembers = result;
    }

    for (const member of teamMembers) {
      // Skip superusers - they don't need role assignments
      if (superuserIds.has(member.userId)) {
        this.logger.debug(`Skipping superuser ${member.userId} for team membership migration`);
        continue;
      }

      const newRole = this.mapTeamRole(member.role);
      if (newRole) {
        try {
          await this.rbacService.assignRole(
            member.userId,
            newRole,
            'TEAM',
            member.teamId,
            migratedBy,
            member.tenantId, // Use the team's workspace organization
          );
          teamCount++;
        } catch (error) {
          this.logger.warn(
            `Failed to migrate team membership ${member.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    const total = orgCount + workspaceCount + teamCount;

    this.logger.log(
      `Migration complete: ${orgCount} org members, ${workspaceCount} workspace members, ${teamCount} team members (${total} total). Superusers skipped (they have implicit access).`,
    );

    return {
      organizationMembers: orgCount,
      workspaceMembers: workspaceCount,
      teamMembers: teamCount,
      total,
    };
  }

  /**
   * Migrate a single user's memberships
   */
  async migrateUserMemberships(
    userId: string,
    migratedBy: string = 'system',
  ): Promise<void> {
    // Get all superuser IDs to skip them
    const superusers = await this.prisma.user.findMany({
      where: { isSuperuser: true },
      select: { id: true },
    });
    const superuserIds = new Set(superusers.map(u => u.id));
    
    if (superuserIds.has(userId)) {
      this.logger.debug(`Skipping superuser ${userId} for migration`);
      return;
    }

    // Organization memberships - use raw SQL
    const orgMembers = await this.prisma.$queryRaw<Array<{id: string, userId: string, tenantId: string, role: string}>>`
      SELECT id, "userId", "tenantId", role::text
      FROM organization_members
      WHERE "userId" = ${userId}
    `;

    for (const member of orgMembers) {
      const newRole = this.mapOrganizationRole(member.role);
      if (newRole) {
        await this.rbacService.assignRole(
          userId,
          newRole,
          'TENANT',
          member.tenantId,
          migratedBy,
          member.tenantId,
        );
      }
    }

    // Workspace memberships - use raw SQL
    const workspaceMembers = await this.prisma.$queryRaw<Array<{id: string, userId: string, workspaceId: string, role: string, tenantId: string}>>`
      SELECT wm.id, wm."userId", wm."workspaceId", wm.role::text, w."tenantId"
      FROM workspace_members wm
      JOIN workspaces w ON wm."workspaceId" = w.id
      WHERE wm."userId" = ${userId}
    `;

    for (const member of workspaceMembers) {
      const newRole = this.mapWorkspaceRole(member.role);
      if (newRole) {
        await this.rbacService.assignRole(
          userId,
          newRole,
          'WORKSPACE',
          member.workspaceId,
          migratedBy,
          member.tenantId,
        );
      }
    }

    // Team memberships - use raw SQL
    const teamMembers = await this.prisma.$queryRaw<Array<{id: string, userId: string, teamId: string, role: string, tenantId: string}>>`
      SELECT tm.id, tm."userId", tm."teamId", tm.role::text, w."tenantId"
      FROM team_members tm
      JOIN teams t ON tm."teamId" = t.id
      JOIN workspaces w ON t."workspaceId" = w.id
      WHERE tm."userId" = ${userId}
    `;

    for (const member of teamMembers) {
      const newRole = this.mapTeamRole(member.role);
      if (newRole) {
        await this.rbacService.assignRole(
          userId,
          newRole,
          'TEAM',
          member.teamId,
          migratedBy,
          member.tenantId,
        );
      }
    }
  }

  /**
   * Map old organization role to new RBAC role
   */
  private mapOrganizationRole(oldRole: string): Role | null {
    const mapping: Record<string, Role> = {
      ORG_ADMIN: 'TENANT_ADMIN',
      MEMBER: 'TENANT_VIEWER', // MEMBER at organization level becomes TENANT_VIEWER
      VIEWER: 'TENANT_VIEWER',
    };

    return mapping[oldRole] || null;
  }

  /**
   * Map old workspace role to new RBAC role
   */
  private mapWorkspaceRole(oldRole: string): Role | null {
    return WORKSPACE_ROLE_MAPPING[oldRole] || null;
  }

  /**
   * Map old team role to new RBAC role
   */
  private mapTeamRole(oldRole: string): Role | null {
    return TEAM_ROLE_MAPPING[oldRole] || null;
  }

  /**
   * Verify migration completeness
   * 
   * Checks if all memberships have been migrated.
   */
  async verifyMigration(): Promise<{
    organizationMembersNotMigrated: number;
    workspaceMembersNotMigrated: number;
    teamMembersNotMigrated: number;
  }> {
    // Use raw SQL queries since legacy tables may not be in Prisma schema
    const orgMembersResult = await this.prisma.$queryRaw<Array<{count: bigint}>>`
      SELECT COUNT(*)::bigint as count FROM organization_members
    `;
    const orgMembers = Number(orgMembersResult[0]?.count || 0);

    const workspaceMembersResult = await this.prisma.$queryRaw<Array<{count: bigint}>>`
      SELECT COUNT(*)::bigint as count FROM workspace_members
    `;
    const workspaceMembers = Number(workspaceMembersResult[0]?.count || 0);

    const teamMembersResult = await this.prisma.$queryRaw<Array<{count: bigint}>>`
      SELECT COUNT(*)::bigint as count FROM team_members
    `;
    const teamMembers = Number(teamMembersResult[0]?.count || 0);

    return {
      organizationMembersNotMigrated: orgMembers,
      workspaceMembersNotMigrated: workspaceMembers,
      teamMembersNotMigrated: teamMembers,
    };
  }
}


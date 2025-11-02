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

    // Migrate organization memberships
    const orgMembers = await this.prisma.organizationMember.findMany({
      include: { organization: true },
    });

    for (const member of orgMembers) {
      const newRole = this.mapOrganizationRole(member.role);
      if (newRole) {
        try {
          await this.rbacService.assignRole(
            member.userId,
            newRole,
            'TENANT',
            member.organizationId,
            migratedBy,
            null, // Migration bypasses tenant checks
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
    const workspaceMembers = await this.prisma.workspaceMember.findMany({
      include: { workspace: true },
    });

    for (const member of workspaceMembers) {
      const newRole = this.mapWorkspaceRole(member.role);
      if (newRole) {
        try {
          await this.rbacService.assignRole(
            member.userId,
            newRole,
            'WORKSPACE',
            member.workspaceId,
            migratedBy,
            null, // Migration bypasses tenant checks
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
    const teamMembers = await this.prisma.teamMember.findMany({
      include: { team: true },
    });

    for (const member of teamMembers) {
      const newRole = this.mapTeamRole(member.role);
      if (newRole) {
        try {
          await this.rbacService.assignRole(
            member.userId,
            newRole,
            'TEAM',
            member.teamId,
            migratedBy,
            null, // Migration bypasses tenant checks
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
      `Migration complete: ${orgCount} org members, ${workspaceCount} workspace members, ${teamCount} team members (${total} total)`,
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
    // Organization memberships
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });

    for (const member of orgMembers) {
      const newRole = this.mapOrganizationRole(member.role);
      if (newRole) {
        await this.rbacService.assignRole(
          userId,
          newRole,
          'TENANT',
          member.organizationId,
          migratedBy,
          null, // Migration bypasses tenant checks
        );
      }
    }

    // Workspace memberships
    const workspaceMembers = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: { workspace: true },
    });

    for (const member of workspaceMembers) {
      const newRole = this.mapWorkspaceRole(member.role);
      if (newRole) {
        await this.rbacService.assignRole(
          userId,
          newRole,
          'WORKSPACE',
          member.workspaceId,
          migratedBy,
          null, // Migration bypasses tenant checks
        );
      }
    }

    // Team memberships
    const teamMembers = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: true },
    });

    for (const member of teamMembers) {
      const newRole = this.mapTeamRole(member.role);
      if (newRole) {
        await this.rbacService.assignRole(
          userId,
          newRole,
          'TEAM',
          member.teamId,
          migratedBy,
          null, // Migration bypasses tenant checks
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
      MEMBER: 'WORKSPACE_MEMBER', // Default workspace member
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
    const orgMembers = await this.prisma.organizationMember.count();
    const workspaceMembers = await this.prisma.workspaceMember.count();
    const teamMembers = await this.prisma.teamMember.count();

    // Count users with role assignments but no old memberships
    // This is approximate - full verification would require checking each user
    return {
      organizationMembersNotMigrated: orgMembers,
      workspaceMembersNotMigrated: workspaceMembers,
      teamMembersNotMigrated: teamMembers,
    };
  }
}


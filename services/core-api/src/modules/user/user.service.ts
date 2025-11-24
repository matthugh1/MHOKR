import { Injectable, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { OkrTenantGuard } from '../okr/tenant-guard';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditTargetType, MemberRole } from '@prisma/client';
import { RBACService } from '../rbac/rbac.service';
import { Role } from '../rbac/types';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    private rbacService: RBACService,
  ) {}

  async findAll(userOrganizationId: string | null | undefined) {
    // Tenant isolation: enforce tenant filtering for all users
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // User has no organisation - return empty array
      return [];
    }

    if (userOrganizationId === null) {
      // SUPERUSER: can see all users (read-only access)
      return this.prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
        orderBy: {
          name: 'asc',
        },
      });
    }

    // Normal user: return all users in their tenant
    // For tenant admins, they should see all users whose primaryOrganizationId matches
    // For regular users, they also see all users in their organization (tenant isolation)
    return this.prisma.user.findMany({
      where: {
        primaryOrganizationId: userOrganizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findById(id: string, userOrganizationId: string | null | undefined) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    // Tenant isolation: verify user belongs to caller's tenant
    if (userOrganizationId === undefined || userOrganizationId === '') {
      // Caller has no organisation - cannot access any user
      return null;
    }

    if (userOrganizationId === null) {
      // SUPERUSER: can see any user (read-only)
      return user;
    }

    // Normal user: verify target user is in same tenant
    const tenantAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId: id,
        scopeType: 'TENANT',
        scopeId: userOrganizationId,
      },
    });

    if (!tenantAssignment) {
      // User not in caller's tenant - return null (don't leak existence)
      return null;
    }

    return user;
  }

  async findByEmail(email: string) {
    // Normalize email to lowercase for case-insensitive lookup
    const normalizedEmail = email.toLowerCase().trim();
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async findByKeycloakId(keycloakId: string) {
    return this.prisma.user.findUnique({
      where: { keycloakId },
    });
  }

  /**
   * Map RBAC role to legacy MemberRole for backward compatibility
   * Used during migration period to maintain compatibility with frontend
   */
  private mapRBACRoleToLegacyRole(rbacRole: Role, scopeType: 'TEAM' | 'WORKSPACE' | 'TENANT'): MemberRole {
    // Team-level role mapping
    if (scopeType === 'TEAM') {
      switch (rbacRole) {
        case 'TEAM_LEAD':
          return MemberRole.TEAM_LEAD;
        case 'TEAM_CONTRIBUTOR':
          return MemberRole.MEMBER;
        case 'TEAM_VIEWER':
          return MemberRole.VIEWER;
        default:
          return MemberRole.MEMBER; // Default fallback
      }
    }

    // Workspace-level role mapping
    if (scopeType === 'WORKSPACE') {
      switch (rbacRole) {
        case 'WORKSPACE_LEAD':
        case 'WORKSPACE_ADMIN':
          return MemberRole.WORKSPACE_OWNER;
        case 'WORKSPACE_MEMBER':
          return MemberRole.MEMBER;
        default:
          return MemberRole.MEMBER; // Default fallback
      }
    }

    // Tenant-level role mapping
    if (scopeType === 'TENANT') {
      switch (rbacRole) {
        case 'TENANT_OWNER':
        case 'TENANT_ADMIN':
          return MemberRole.ORG_ADMIN;
        case 'TENANT_VIEWER':
          return MemberRole.VIEWER;
        default:
          return MemberRole.MEMBER; // Default fallback
      }
    }

    return MemberRole.MEMBER; // Default fallback
  }

  async getUserContext(userId: string) {
    // Get user basic info
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Build RBAC user context to get role assignments (Phase 4: RBAC only)
    const rbacContext = await this.rbacService.buildUserContext(userId, true);

    // SINGLE-TENANT ACCESS: Return only the user's primary organization
    // Multi-tenant access is disabled - users can only access their primary organization.
    const primaryOrg = user.primaryOrganizationId
      ? await this.prisma.organization.findUnique({
          where: { id: user.primaryOrganizationId },
        })
      : null;

    // Return single organization (array format for backward compatibility with frontend)
    const organizations = primaryOrg ? [primaryOrg] : [];

    // Check if user is TENANT_ADMIN or TENANT_OWNER - they should see all workspaces in their tenant
    const tenantRoles = rbacContext.tenantRoles.get(user.primaryOrganizationId || '') || new Set();
    const tenantRolesSet = tenantRoles instanceof Set ? tenantRoles : new Set(tenantRoles);
    const isTenantAdmin = tenantRolesSet.has('TENANT_ADMIN') || tenantRolesSet.has('TENANT_OWNER');

    let directWorkspaces: any[] = [];

    if (isTenantAdmin && user.primaryOrganizationId) {
      // TENANT_ADMIN/TENANT_OWNER: Return all workspaces in their organization
      directWorkspaces = await this.prisma.workspace.findMany({
        where: {
          tenantId: user.primaryOrganizationId,
        },
        include: {
          tenant: true,
          parentWorkspace: true,
          childWorkspaces: true,
        },
      });
    } else {
      // Regular users: Get workspaces from RBAC workspace role assignments
      // Filter to only include workspaces in the primary organization
      const workspaceAssignments = await this.prisma.roleAssignment.findMany({
        where: {
          userId,
          scopeType: 'WORKSPACE',
          scopeId: { not: null },
        },
      });

      // Get unique workspace IDs
      const workspaceIds = [...new Set(
        workspaceAssignments
          .map(wa => wa.scopeId)
          .filter((id): id is string => id !== null)
      )];

      // Fetch workspaces with relations, then filter to primary org only
      const allDirectWorkspaces = workspaceIds.length > 0
        ? await this.prisma.workspace.findMany({
            where: { id: { in: workspaceIds } },
            include: {
              tenant: true,
              parentWorkspace: true,
              childWorkspaces: true,
            },
          })
        : [];

      // Filter workspaces to only include those in primary organization
      directWorkspaces = user.primaryOrganizationId
        ? allDirectWorkspaces.filter(ws => ws.tenantId === user.primaryOrganizationId)
        : allDirectWorkspaces;
    }

    let teamsWithWorkspaces: any[] = [];

    if (isTenantAdmin && user.primaryOrganizationId) {
      // TENANT_ADMIN/TENANT_OWNER: Return all teams in workspaces belonging to their organization
      teamsWithWorkspaces = await this.prisma.team.findMany({
        where: {
          workspace: {
            tenantId: user.primaryOrganizationId,
          },
        },
        include: {
          workspace: {
            include: {
              tenant: true,
              parentWorkspace: true,
              childWorkspaces: true,
            },
          },
        },
      });
    } else {
      // Regular users: Get teams from RBAC team role assignments
      // Filter to only include teams whose workspace belongs to primary organization
      const teamAssignments = await this.prisma.roleAssignment.findMany({
        where: {
          userId,
          scopeType: 'TEAM',
          scopeId: { not: null },
        },
      });

      // Get unique team IDs
      const teamIds = [...new Set(
        teamAssignments
          .map(ta => ta.scopeId)
          .filter((id): id is string => id !== null)
      )];

      // Fetch teams with workspace relations, then filter to primary org only
      const allTeamsWithWorkspaces = teamIds.length > 0
        ? await this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            include: {
              workspace: {
                include: {
                  tenant: true,
                  parentWorkspace: true,
                  childWorkspaces: true,
                },
              },
            },
          })
        : [];

      // Filter teams to only include those whose workspace belongs to primary organization
      teamsWithWorkspaces = user.primaryOrganizationId
        ? allTeamsWithWorkspaces.filter(team => team.workspace.tenantId === user.primaryOrganizationId)
        : allTeamsWithWorkspaces;
    }

    // Extract indirect workspaces from teams
    const indirectWorkspaces = teamsWithWorkspaces
      .map(t => t.workspace)
      .filter((ws, index, self) => 
        index === self.findIndex(w => w.id === ws.id)
      );

    // Combine direct and indirect workspaces
    const allWorkspaces = [...directWorkspaces, ...indirectWorkspaces];
    const workspaces = allWorkspaces.filter((ws, index, self) => 
      index === self.findIndex(w => w.id === ws.id)
    );

    // Get teams with their roles from RBAC system (Phase 4: RBAC only)
    const teams = await Promise.all(
      teamsWithWorkspaces.map(async (team) => {
        // Get role from RBAC
        const teamRoles = rbacContext.teamRoles.get(team.id);
        let role: MemberRole;

        if (teamRoles && teamRoles.length > 0) {
          // Use highest priority role from RBAC (TEAM_LEAD > TEAM_CONTRIBUTOR > TEAM_VIEWER)
          const rbacRole = teamRoles.includes('TEAM_LEAD') 
            ? 'TEAM_LEAD' 
            : teamRoles.includes('TEAM_CONTRIBUTOR')
            ? 'TEAM_CONTRIBUTOR'
            : teamRoles[0];
          role = this.mapRBACRoleToLegacyRole(rbacRole as Role, 'TEAM');
        } else {
          // Fallback to MEMBER if no role found (shouldn't happen in Phase 4)
          role = MemberRole.MEMBER;
        }

        return {
          id: team.id,
          name: team.name,
          role: role as string, // Frontend expects string
          workspaceId: team.workspaceId,
          workspace: team.workspace.name,
        };
      })
    );

    // Default context for OKR creation
    // Prioritize direct workspace membership over indirect
    const defaultOrganization = organizations[0] || null;
    const defaultWorkspace = directWorkspaces[0] || indirectWorkspaces[0] || null;
    const defaultTeam = teams[0] || null;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      organization: defaultOrganization,
      organizations,
      workspace: defaultWorkspace,
      workspaces,
      team: defaultTeam,
      teams,
      defaultOKRContext: {
        workspaceId: defaultWorkspace?.id || null,
        teamId: defaultTeam?.id || null,
        ownerId: user.id,
      },
    };
  }

  /**
   * Map legacy organization role to RBAC role
   */
  private mapLegacyOrgRoleToRBAC(legacyRole: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER'): Role {
    switch (legacyRole) {
      case 'ORG_ADMIN':
        return 'TENANT_ADMIN';
      case 'VIEWER':
        return 'TENANT_VIEWER';
      case 'MEMBER':
      default:
        return 'TENANT_VIEWER'; // Default to VIEWER for MEMBER
    }
  }

  /**
   * Map legacy workspace role to RBAC role
   */
  private mapLegacyWorkspaceRoleToRBAC(legacyRole: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER'): Role {
    switch (legacyRole) {
      case 'WORKSPACE_OWNER':
        return 'WORKSPACE_LEAD';
      case 'MEMBER':
        return 'WORKSPACE_MEMBER';
      case 'VIEWER':
      default:
        return 'WORKSPACE_MEMBER'; // VIEWER becomes MEMBER in RBAC
    }
  }

  async createUser(
    data: { 
      email: string; 
      name: string; 
      password: string; 
      tenantId: string; // Required - all users must belong to an organization (auto-injected if not provided)
      workspaceId?: string; // Optional - only required if workspace role assignment needed
      role?: 'ORG_ADMIN' | 'MEMBER' | 'VIEWER';
      workspaceRole?: 'WORKSPACE_OWNER' | 'MEMBER' | 'VIEWER';
    },
    userOrganizationId: string | null | undefined,
    actorUserId: string,
  ) {
    const isSuperuser = userOrganizationId === null;
    
    // Tenant isolation: enforce mutation rules (skip for SUPERUSER who can create users)
    if (!isSuperuser) {
      OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
    }

    // Tenant isolation: verify caller's org matches the org being created in
    // SUPERUSER can create in any tenant (controller handles dev inspector check for cross-tenant)
    // Regular users must create within their own tenant
    if (!isSuperuser) {
      OkrTenantGuard.assertSameTenant(data.tenantId, userOrganizationId);
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Verify organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id: data.tenantId },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID ${data.tenantId} not found`);
    }

    // Verify workspace exists and belongs to the organization (if provided)
    let workspace = null;
    if (data.workspaceId) {
      workspace = await this.prisma.workspace.findUnique({
        where: { id: data.workspaceId },
      });

      if (!workspace) {
        throw new NotFoundException(`Workspace with ID ${data.workspaceId} not found`);
      }

      if (workspace.tenantId !== data.tenantId) {
        throw new ConflictException(`Workspace ${data.workspaceId} does not belong to organization ${data.tenantId}`);
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Map legacy roles to RBAC roles (do this before transaction)
    const orgRBACRole = this.mapLegacyOrgRoleToRBAC(data.role || 'MEMBER');
    const workspaceRBACRole = data.workspaceId && data.workspaceRole
      ? this.mapLegacyWorkspaceRoleToRBAC(data.workspaceRole)
      : null;

    // Create user and role assignments atomically in a single transaction
    const user = await this.prisma.$transaction(async (tx) => {
      // Create user with primaryOrganizationId
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: hashedPassword,
          primaryOrganizationId: data.tenantId, // Set primary organization
        },
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // Create tenant role assignment (always required)
      // For SUPERUSER creating users, we skip tenant validation by passing null
      // The assignRole method will handle SUPERUSER case appropriately
      await tx.roleAssignment.create({
        data: {
          userId: newUser.id,
          role: orgRBACRole,
          scopeType: 'TENANT',
          scopeId: data.tenantId,
        },
      });

      // Create workspace role assignment (if provided)
      if (data.workspaceId && workspaceRBACRole) {
        // Verify workspace belongs to the organization
        const workspace = await tx.workspace.findUnique({
          where: { id: data.workspaceId },
          select: { tenantId: true },
        });

        if (!workspace) {
          throw new NotFoundException(`Workspace with ID ${data.workspaceId} not found`);
        }

        if (workspace.tenantId !== data.tenantId) {
          throw new ForbiddenException('Workspace does not belong to the specified organization');
        }

        await tx.roleAssignment.create({
          data: {
            userId: newUser.id,
            role: workspaceRBACRole,
            scopeType: 'WORKSPACE',
            scopeId: data.workspaceId,
          },
        });
      }

      return newUser;
    });

    // Audit log for role assignments
    // Note: We create role assignments directly in the transaction above to ensure atomicity
    // The RBAC service's assignRole method does validation, but we need to bypass it for SUPERUSER
    // and ensure atomicity. We'll record audit logs directly here.
    try {
      await this.auditLogService.record({
        action: 'GRANT_ROLE',
        actorUserId,
        targetUserId: user.id,
        targetId: user.id,
        targetType: AuditTargetType.ROLE_ASSIGNMENT,
        newRole: orgRBACRole as any,
        tenantId: data.tenantId,
        metadata: { scopeType: 'TENANT', scopeId: data.tenantId },
      });
    } catch (error) {
      // If audit logging fails, log but don't fail user creation
      this.logger.warn('Failed to record audit log for tenant role assignment', { error });
    }

    // Record workspace role assignment audit log if applicable
    if (data.workspaceId && workspaceRBACRole) {
      try {
        await this.auditLogService.record({
          action: 'GRANT_ROLE',
          actorUserId,
          targetUserId: user.id,
          targetId: user.id,
          targetType: AuditTargetType.ROLE_ASSIGNMENT,
          newRole: workspaceRBACRole as any,
          metadata: { scopeType: 'WORKSPACE', scopeId: data.workspaceId },
        });
      } catch (error) {
        this.logger.warn('Failed to record audit log for workspace role assignment', { error });
      }
    }

    await this.auditLogService.record({
      action: 'CREATE_USER',
      actorUserId,
      targetUserId: user.id,
      targetId: user.id,
      targetType: AuditTargetType.USER,
      tenantId: data.tenantId,
      metadata: {
        role: data.role || 'MEMBER',
        workspaceId: data.workspaceId || null,
        workspaceRole: data.workspaceRole || null,
      },
    });

    return user;
  }

  async resetPassword(userId: string, newPassword: string, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Check if actor is superuser from database (source of truth)
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { isSuperuser: true },
    });

    if (!actor) {
      throw new NotFoundException(`Actor user with ID ${actorUserId} not found`);
    }

    const isSuperuser = actor.isSuperuser || false;

    // Tenant isolation: enforce mutation rules (unless superuser)
    // Superusers can reset any user's password (they have manage_users permission)
    if (!isSuperuser) {
      OkrTenantGuard.assertCanMutateTenant(userOrganizationId);
    }

    // Check if target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Tenant isolation: verify user belongs to caller's org via RBAC (unless superuser)
    if (!isSuperuser) {
      // Check if user's primaryOrganizationId matches the actor's tenant
      const belongsToTenant = user.primaryOrganizationId === userOrganizationId;
      
      // Also check for TENANT role assignment
      const tenantAssignment = await this.prisma.roleAssignment.findFirst({
        where: {
          userId,
          scopeType: 'TENANT',
          scopeId: userOrganizationId || undefined,
        },
      });

      // User must belong to tenant via primaryOrganizationId OR have a role assignment
      if (!belongsToTenant && !tenantAssignment) {
        throw new NotFoundException('User not found in your organization');
      }
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedPassword },
    });

    // Determine tenant ID for audit log (use target user's tenant if superuser)
    let auditTenantId = userOrganizationId || undefined;
    if (isSuperuser && !auditTenantId) {
      // For superuser actions, try to get target user's tenant for audit log
      const targetTenantAssignment = await this.prisma.roleAssignment.findFirst({
        where: {
          userId,
          scopeType: 'TENANT',
        },
        select: { scopeId: true },
      });
      auditTenantId = targetTenantAssignment?.scopeId || undefined;
    }

    await this.auditLogService.record({
      action: 'RESET_PASSWORD',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      tenantId: auditTenantId,
    });

    return { message: 'Password reset successfully' };
  }

  async updateUser(userId: string, data: { name?: string; email?: string }, userOrganizationId: string | null | undefined, actorUserId: string) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Check if user exists and belongs to caller's org (Phase 4: RBAC only)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Tenant isolation: verify user belongs to caller's org via RBAC
    // Check if user's primaryOrganizationId matches the actor's tenant
    const belongsToTenant = user.primaryOrganizationId === userOrganizationId;
    
    // Also check for TENANT role assignment
    const tenantAssignment = await this.prisma.roleAssignment.findFirst({
      where: {
        userId,
        scopeType: 'TENANT',
        scopeId: userOrganizationId || undefined,
      },
    });

    // User must belong to tenant via primaryOrganizationId OR have a role assignment
    if (!belongsToTenant && !tenantAssignment) {
      throw new NotFoundException('User not found in your organization');
    }

    // Check if email is being changed and if it already exists
    if (data.email && data.email !== user.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditLogService.record({
      action: 'UPDATE_USER',
      actorUserId,
      targetUserId: userId,
      targetId: userId,
      targetType: AuditTargetType.USER,
      tenantId: userOrganizationId || undefined,
    });

    return updatedUser;
  }
}


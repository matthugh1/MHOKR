/**
 * RBAC Assignment Controller
 * 
 * REST endpoints for managing role assignments.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RBACService } from './rbac.service';
import { ExecWhitelistService } from './exec-whitelist.service';
import { UserService } from '../user/user.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from './rbac.guard';
import { RequireAction } from './rbac.decorator';
import { Role, ScopeType } from './types';

interface AssignRoleDto {
  userEmail: string;
  role: Role;
  scopeType: ScopeType;
  scopeId: string | null;
}


@ApiTags('RBAC Assignments')
@Controller('rbac/assignments')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class RBACAssignmentController {
  constructor(
    private rbacService: RBACService,
    private userService: UserService,
    private prisma: PrismaService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user RBAC roles' })
  async getMyRoles(@Request() req: any) {
    const assignments = await this.rbacService.getUserRoleAssignments(req.user.id);

    // Group assignments by scopeType
    const rolesByScope: {
      tenant: Array<{ organizationId: string; roles: string[] }>;
      workspace: Array<{ workspaceId: string; roles: string[] }>;
      team: Array<{ teamId: string; roles: string[] }>;
    } = {
      tenant: [],
      workspace: [],
      team: [],
    };

    // Use Maps to merge roles for the same scopeId
    const tenantMap = new Map<string, string[]>();
    const workspaceMap = new Map<string, string[]>();
    const teamMap = new Map<string, string[]>();

    for (const assignment of assignments) {
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
    for (const [organizationId, roles] of tenantMap.entries()) {
      rolesByScope.tenant.push({ organizationId, roles });
    }
    for (const [workspaceId, roles] of workspaceMap.entries()) {
      rolesByScope.workspace.push({ workspaceId, roles });
    }
    for (const [teamId, roles] of teamMap.entries()) {
      rolesByScope.team.push({ teamId, roles });
    }

    return {
      userId: req.user.id,
      isSuperuser: req.user.isSuperuser || false,
      roles: rolesByScope,
    };
  }

  @Get()
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Get role assignments' })
  @ApiQuery({ name: 'scopeType', required: false })
  @ApiQuery({ name: 'scopeId', required: false })
  @ApiQuery({ name: 'userId', required: false })
  async getAssignments(
    @Query('scopeType') scopeType?: ScopeType,
    @Query('scopeId') scopeId?: string,
    @Query('userId') userId?: string,
  ) {
    // If userId provided, return that user's assignments
    if (userId) {
      const assignments = await this.rbacService.getUserRoleAssignments(userId);
      // Enrich with user and scope names
      return this.enrichAssignments(assignments);
    }

    // If scopeType and scopeId provided, get all assignments for that scope
    if (scopeType && scopeId) {
      const assignments = await this.prisma.roleAssignment.findMany({
        where: {
          scopeType,
          scopeId,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      return this.enrichAssignments(assignments.map(a => ({
        id: a.id,
        userId: a.userId,
        role: a.role as Role,
        scopeType: a.scopeType as ScopeType,
        scopeId: a.scopeId,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })));
    }

    // Default: return empty array (should filter by tenant in production)
    return [];
  }

  private async enrichAssignments(assignments: any[]) {
    const enriched = await Promise.all(
      assignments.map(async (assignment) => {
        const user = await this.prisma.user.findUnique({
          where: { id: assignment.userId },
          select: { id: true, email: true, name: true },
        });

        let scopeName = '';
        if (assignment.scopeId) {
          switch (assignment.scopeType) {
            case 'TENANT':
              const org = await this.prisma.organization.findUnique({
                where: { id: assignment.scopeId },
                select: { name: true },
              });
              scopeName = org?.name || '';
              break;
            case 'WORKSPACE':
              const ws = await this.prisma.workspace.findUnique({
                where: { id: assignment.scopeId },
                select: { name: true },
              });
              scopeName = ws?.name || '';
              break;
            case 'TEAM':
              const team = await this.prisma.team.findUnique({
                where: { id: assignment.scopeId },
                select: { name: true },
              });
              scopeName = team?.name || '';
              break;
          }
        }

        return {
          id: assignment.id,
          userId: assignment.userId,
          userName: user?.name || 'Unknown',
          userEmail: user?.email || 'Unknown',
          role: assignment.role,
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
          scopeName,
          createdAt: assignment.createdAt,
          updatedAt: assignment.updatedAt,
        };
      }),
    );

    return enriched;
  }

  @Post('assign')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRole(@Body() dto: AssignRoleDto, @Request() req: any) {
    // Lookup user by email
    let userId: string;
    if ((dto as any).userId) {
      userId = (dto as any).userId;
    } else {
      const user = await this.userService.findByEmail(dto.userEmail);
      if (!user) {
        throw new NotFoundException(`User with email ${dto.userEmail} not found`);
      }
      userId = user.id;
    }

    const assignment = await this.rbacService.assignRole(
      userId,
      dto.role,
      dto.scopeType,
      dto.scopeId,
      req.user.id,
      req.user.organizationId,
    );

    return assignment;
  }

  @Delete(':assignmentId')
  @RequireAction('manage_users')
  @ApiOperation({ summary: 'Revoke a role assignment' })
  async revokeRole(
    @Param('assignmentId') assignmentId: string,
    @Request() req: any,
  ) {
    // Get assignment to get details
    const assignment = await this.prisma.roleAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      throw new NotFoundException(`Role assignment ${assignmentId} not found`);
    }

    await this.rbacService.revokeRole(
      assignment.userId,
      assignment.role as Role,
      assignment.scopeType as ScopeType,
      assignment.scopeId,
      req.user.id,
      req.user.organizationId,
    );

    return { success: true };
  }
}

@ApiTags('RBAC Whitelist')
@Controller('rbac/whitelist')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class ExecWhitelistController {
  constructor(private execWhitelistService: ExecWhitelistService) {}

  @Get(':tenantId')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Get EXEC_ONLY whitelist for a tenant' })
  async getWhitelist(@Param('tenantId') tenantId: string) {
    const whitelist = await this.execWhitelistService.getWhitelist(tenantId);
    return { tenantId, whitelist };
  }

  @Post(':tenantId/add')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Add user to EXEC_ONLY whitelist' })
  async addToWhitelist(
    @Param('tenantId') tenantId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    // Verify tenant match
    if (tenantId !== req.user.organizationId) {
      throw new NotFoundException('Tenant not found');
    }
    const whitelist = await this.execWhitelistService.addToWhitelist(
      tenantId,
      body.userId,
      req.user.organizationId,
      req.user.id,
    );
    return { tenantId, whitelist };
  }

  @Post(':tenantId/remove')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Remove user from EXEC_ONLY whitelist' })
  async removeFromWhitelist(
    @Param('tenantId') tenantId: string,
    @Body() body: { userId: string },
    @Request() req: any,
  ) {
    // Verify tenant match
    if (tenantId !== req.user.organizationId) {
      throw new NotFoundException('Tenant not found');
    }
    const whitelist = await this.execWhitelistService.removeFromWhitelist(
      tenantId,
      body.userId,
      req.user.organizationId,
      req.user.id,
    );
    return { tenantId, whitelist };
  }

  @Post(':tenantId/set')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Set entire EXEC_ONLY whitelist' })
  async setWhitelist(
    @Param('tenantId') tenantId: string,
    @Body() body: { userIds: string[] },
    @Request() req: any,
  ) {
    // Verify tenant match
    if (tenantId !== req.user.organizationId) {
      throw new NotFoundException('Tenant not found');
    }
    const whitelist = await this.execWhitelistService.setWhitelist(
      tenantId,
      body.userIds,
      req.user.organizationId,
      req.user.id,
    );
    return { tenantId, whitelist };
  }

  @Delete(':tenantId')
  @RequireAction('manage_tenant_settings')
  @ApiOperation({ summary: 'Clear EXEC_ONLY whitelist' })
  async clearWhitelist(@Param('tenantId') tenantId: string, @Request() req: any) {
    // Verify tenant match
    if (tenantId !== req.user.organizationId) {
      throw new NotFoundException('Tenant not found');
    }
    await this.execWhitelistService.clearWhitelist(tenantId, req.user.organizationId, req.user.id);
    return { tenantId, whitelist: [] };
  }
}


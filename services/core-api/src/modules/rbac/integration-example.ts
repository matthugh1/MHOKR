/**
 * RBAC Integration Example
 * 
 * Example showing how to integrate RBAC into existing OKR services.
 * This demonstrates upgrading from the old PermissionService to the new RBAC system.
 */

import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from './rbac.service';
import { ResourceContextBuilder } from './context-builder';
import { requireAction, canViewOKRAsOwnerOrByVisibility } from './utils';

/**
 * Example: Updated ObjectiveService with RBAC integration
 * 
 * This shows how to replace PermissionService checks with RBAC checks.
 */
@Injectable()
export class ObjectiveServiceExample {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private contextBuilder: ResourceContextBuilder,
  ) {}

  /**
   * Find all OKRs user can view (with visibility filtering)
   */
  async findAll(userId: string, tenantId: string, workspaceId?: string) {
    // Build base query
    const where: any = { tenantId: tenantId };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    // Load all OKRs
    const objectives = await this.prisma.objective.findMany({
      where,
      include: {
        owner: true,
        tenant: true,
        workspace: true,
        team: true,
      },
    });

    // Filter by visibility
    const visibleObjectives = objectives.filter((objective) => {
      const okr = {
        id: objective.id,
        ownerId: objective.ownerId,
        tenantId: objective.tenantId || '',
        workspaceId: objective.workspaceId,
        teamId: objective.teamId,
        visibilityLevel: objective.visibilityLevel,
      };

      // Owner can always view
      if (objective.ownerId === userId) {
        return true;
      }

      // Check visibility-based access
      // This would use the visibilityPolicy.canViewOKR function
      // For simplicity, showing the pattern here
      return canViewOKRAsOwnerOrByVisibility(
        this.rbacService,
        userId,
        okr,
        objective.tenant ? {
          allowTenantAdminExecVisibility: objective.tenant.allowTenantAdminExecVisibility || false,
        } : undefined,
      );
    });

    return visibleObjectives;
  }

  /**
   * Find OKR by ID (with permission check)
   */
  async findById(id: string, userId: string) {
    const objective = await this.prisma.objective.findUnique({
      where: { id },
      include: {
        owner: true,
        tenant: true,
        workspace: true,
        team: true,
      },
    });

    if (!objective) {
      throw new NotFoundException(`Objective ${id} not found`);
    }

    // Build resource context
    const resourceContext = await this.contextBuilder.fromOKR(id);

    // Check permission
    const canView = await this.rbacService.canPerformAction(
      userId,
      'view_okr',
      resourceContext,
    );

    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this OKR');
    }

    return objective;
  }

  /**
   * Create OKR (with permission check)
   */
  async create(data: any, userId: string) {
    // Build resource context from creation data
    const resourceContext = this.contextBuilder.fromValues(
      data.tenantId,
      data.workspaceId,
      data.teamId,
    );

    // Check permission to create OKR
    await requireAction(
      this.rbacService,
      userId,
      'create_okr',
      resourceContext,
      'You do not have permission to create OKRs in this scope',
    );

    // Validate required fields
    if (!data.ownerId) {
      data.ownerId = userId;
    }

    // Validate organization exists
    if (data.tenantId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: data.tenantId },
      });
      if (!org) {
        throw new NotFoundException(`Organization ${data.tenantId} not found`);
      }
    }

    // Validate workspace exists
    if (data.workspaceId) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: data.workspaceId },
      });
      if (!workspace) {
        throw new NotFoundException(`Workspace ${data.workspaceId} not found`);
      }
    }

    // Set default visibility if not provided
    if (!data.visibilityLevel) {
      data.visibilityLevel = 'PUBLIC_TENANT';
    }

    // Set default published status
    if (data.isPublished === undefined) {
      data.isPublished = false;
    }

    return this.prisma.objective.create({
      data,
      include: {
        keyResults: true,
      },
    });
  }

  /**
   * Update OKR (with permission check)
   */
  async update(id: string, data: any, userId: string) {
    const objective = await this.prisma.objective.findUnique({
      where: { id },
    });

    if (!objective) {
      throw new NotFoundException(`Objective ${id} not found`);
    }

    // Build resource context
    const resourceContext = await this.contextBuilder.fromOKR(id);

    // Check permission to edit
    await requireAction(
      this.rbacService,
      userId,
      'edit_okr',
      resourceContext,
      'You do not have permission to edit this OKR',
    );

    return this.prisma.objective.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete OKR (with permission check)
   */
  async delete(id: string, userId: string) {
    const objective = await this.prisma.objective.findUnique({
      where: { id },
    });

    if (!objective) {
      throw new NotFoundException(`Objective ${id} not found`);
    }

    // Build resource context
    const resourceContext = await this.contextBuilder.fromOKR(id);

    // Check permission to delete
    await requireAction(
      this.rbacService,
      userId,
      'delete_okr',
      resourceContext,
      'You do not have permission to delete this OKR',
    );

    return this.prisma.objective.delete({
      where: { id },
    });
  }

  /**
   * Publish OKR (with permission check)
   */
  async publish(id: string, userId: string) {
    const objective = await this.prisma.objective.findUnique({
      where: { id },
    });

    if (!objective) {
      throw new NotFoundException(`Objective ${id} not found`);
    }

    // Build resource context
    const resourceContext = await this.contextBuilder.fromOKR(id);

    // Check permission to publish
    await requireAction(
      this.rbacService,
      userId,
      'publish_okr',
      resourceContext,
      'You do not have permission to publish this OKR',
    );

    return this.prisma.objective.update({
      where: { id },
      data: { isPublished: true },
    });
  }
}

/**
 * Example Controller with RBAC Guard
 */
/*
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { ObjectiveServiceExample } from './integration-example';

@Controller('objectives')
@UseGuards(JwtAuthGuard, RBACGuard)
export class ObjectiveControllerExample {
  constructor(private objectiveService: ObjectiveServiceExample) {}

  @Get()
  async findAll(@Req() req: any) {
    // Controller-level guard checks, service does fine-grained filtering
    return this.objectiveService.findAll(req.user.id, req.query.tenantId, req.query.workspaceId);
  }

  @Get(':id')
  @RequireAction('view_okr')
  async findById(@Param('id') id: string, @Req() req: any) {
    // Guard checks permission, service double-checks
    return this.objectiveService.findById(id, req.user.id);
  }

  @Post()
  @RequireAction('create_okr')
  async create(@Body() data: any, @Req() req: any) {
    return this.objectiveService.create(data, req.user.id);
  }

  @Patch(':id')
  @RequireAction('edit_okr')
  async update(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.objectiveService.update(id, data, req.user.id);
  }

  @Delete(':id')
  @RequireAction('delete_okr')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.objectiveService.delete(id, req.user.id);
  }

  @Post(':id/publish')
  @RequireAction('publish_okr')
  async publish(@Param('id') id: string, @Req() req: any) {
    return this.objectiveService.publish(id, req.user.id);
  }
}
*/


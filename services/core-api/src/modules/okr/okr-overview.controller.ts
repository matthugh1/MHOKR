import { Controller, Get, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { OkrTenantGuard } from './tenant-guard';
import { OkrVisibilityService } from './okr-visibility.service';
import { OkrGovernanceService } from './okr-governance.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';

/**
 * OKR Overview Controller
 * 
 * Provides a unified endpoint that returns fully denormalised Objectives
 * with their related Key Results and Initiatives, to be used as the system
 * of record for the OKR list page.
 * 
 * This replaces multiple fragmented API calls (/objectives, /key-results, /initiatives)
 * with a single endpoint: GET /okr/overview
 * 
 * W3.M2: Server-side pagination and visibility enforcement.
 * - Only returns objectives visible to the requester
 * - Only returns the requested page slice
 * - Includes canEdit/canDelete/canCheckIn flags per objective/KR
 */
@ApiTags('OKR Overview')
@Controller('okr')
@UseGuards(JwtAuthGuard, RBACGuard)
@ApiBearerAuth()
export class OkrOverviewController {
  constructor(
    private prisma: PrismaService,
    private visibilityService: OkrVisibilityService,
    private governanceService: OkrGovernanceService,
    private rbacService: RBACService,
  ) {}

  @Get('overview')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get unified OKR overview with nested Key Results and Initiatives' })
  @ApiQuery({ name: 'organizationId', required: true, description: 'Organization ID for tenant filtering' })
  @ApiQuery({ name: 'cycleId', required: false, description: 'Filter by cycle ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['ON_TRACK', 'AT_RISK', 'BLOCKED', 'COMPLETED', 'CANCELLED'], description: 'Filter by objective status' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Items per page (default: 20, max: 50)' })
  async getOverview(
    @Query('organizationId') organizationId: string | undefined,
    @Query('cycleId') cycleId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: any,
  ) {
    // Require organizationId query parameter
    if (!organizationId) {
      throw new BadRequestException('organizationId is required');
    }

    // Tenant isolation: validate user has access to this organization
    const userOrganizationId = req.user.organizationId;
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    
    // If user has a specific org and it doesn't match, deny access
    if (userOrganizationId !== null && orgFilter && orgFilter.organizationId !== organizationId) {
      throw new BadRequestException('You do not have access to this organisation');
    }

    // Parse pagination parameters
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 20;
    
    // Validate pagination parameters
    if (pageNum < 1) {
      throw new BadRequestException('Page must be >= 1');
    }
    if (pageSizeNum < 1 || pageSizeNum > 50) {
      throw new BadRequestException('Page size must be between 1 and 50');
    }

    const requesterUserId = req.user.id;

    // Build where clause for objectives (tenant isolation already enforced)
    const where: any = { organizationId };
    
    // Apply optional filters
    if (cycleId) {
      where.cycleId = cycleId;
    }
    
    if (status) {
      // Validate status enum
      const validStatuses = ['ON_TRACK', 'AT_RISK', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        throw new BadRequestException(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      }
      where.status = status;
    }

    // Fetch ALL objectives matching filters (before visibility filtering)
    const allObjectives = await this.prisma.objective.findMany({
      where,
      include: {
        keyResults: {
          include: {
            keyResult: true,
          },
        },
        initiatives: true,
        cycle: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter objectives by visibility
    const visibleObjectives = [];
    for (const objective of allObjectives) {
      const canSee = await this.visibilityService.canUserSeeObjective({
        objective: {
          id: objective.id,
          ownerId: objective.ownerId,
          organizationId: objective.organizationId,
          visibilityLevel: objective.visibilityLevel,
        },
        requesterUserId,
        requesterOrgId: userOrganizationId,
      });

      if (canSee) {
        visibleObjectives.push(objective);
      }
    }

    // Calculate total count AFTER visibility filtering
    const totalCount = visibleObjectives.length;

    // Apply pagination to filtered results
    const skip = (pageNum - 1) * pageSizeNum;
    const take = pageSizeNum;
    const paginatedObjectives = visibleObjectives.slice(skip, skip + take);

    // Fetch all initiatives for these objectives' Key Results
    const keyResultIds = paginatedObjectives.flatMap(o => 
      o.keyResults.map(okr => okr.keyResult.id)
    );

    // Fetch initiatives linked to Key Results
    const krInitiatives = keyResultIds.length > 0
      ? await this.prisma.initiative.findMany({
          where: {
            keyResultId: { in: keyResultIds },
          },
        })
      : [];

    // Group initiatives by keyResultId for efficient lookup
    const initiativesByKrId = new Map<string, typeof krInitiatives>();
    krInitiatives.forEach(init => {
      if (init.keyResultId) {
        if (!initiativesByKrId.has(init.keyResultId)) {
          initiativesByKrId.set(init.keyResultId, []);
        }
        initiativesByKrId.get(init.keyResultId)!.push(init);
      }
    });

    // Build resource context for governance checks
    const actingUser = {
      id: requesterUserId,
      organizationId: userOrganizationId,
    };

    // Transform to unified response format with canEdit/canDelete/canCheckIn flags
    const objectives = await Promise.all(
      paginatedObjectives.map(async (o) => {
        // Check if user can edit this objective
        let canEdit = false;
        let canDelete = false;
        try {
          const resourceContext = await buildResourceContextFromOKR(this.prisma, o.id);
          canEdit = await this.rbacService.canPerformAction(requesterUserId, 'edit_okr', resourceContext);
          canDelete = await this.rbacService.canPerformAction(requesterUserId, 'delete_okr', resourceContext);

          // Check governance locks (publish lock + cycle lock)
          if (canEdit || canDelete) {
            try {
              await this.governanceService.checkAllLocksForObjective({
                objective: {
                  id: o.id,
                  isPublished: o.isPublished,
                },
                actingUser,
                rbacService: this.rbacService,
              });
            } catch (error) {
              // If locked and user is not admin, deny edit/delete
              // (checkAllLocksForObjective throws if locked and user cannot bypass)
              canEdit = false;
              canDelete = false;
            }
          }
        } catch (error) {
          // If RBAC check fails, canEdit/canDelete remain false
        }

        // Filter key results by visibility and add canCheckIn flag
        const visibleKeyResults = [];
        for (const okr of o.keyResults) {
          const kr = okr.keyResult;
          
          const canSeeKr = await this.visibilityService.canUserSeeKeyResult({
            keyResult: {
              id: kr.id,
              ownerId: kr.ownerId,
            },
            parentObjective: {
              id: o.id,
              ownerId: o.ownerId,
              organizationId: o.organizationId,
              visibilityLevel: o.visibilityLevel,
            },
            requesterUserId,
            requesterOrgId: userOrganizationId,
          });

          if (!canSeeKr) {
            continue;
          }

          // Check if user can check in on this KR
          let canCheckIn = false;
          try {
            const resourceContext = await buildResourceContextFromOKR(this.prisma, o.id);
            canCheckIn = await this.rbacService.canPerformAction(requesterUserId, 'check_in_okr', resourceContext);

            // Check governance locks for check-in
            if (canCheckIn) {
              try {
                await this.governanceService.checkAllLocksForKeyResult({
                  parentObjective: {
                    id: o.id,
                    isPublished: o.isPublished,
                  },
                  actingUser,
                  rbacService: this.rbacService,
                });
              } catch (error) {
                // If locked and user is not admin, deny check-in
                canCheckIn = false;
              }
            }
          } catch (error) {
            // If RBAC check fails, canCheckIn remains false
          }

          const krInitiatives = initiativesByKrId.get(kr.id) || [];
          visibleKeyResults.push({
            keyResultId: kr.id,
            title: kr.title,
            status: kr.status,
            progress: kr.progress,
            canCheckIn,
            startValue: kr.startValue,
            targetValue: kr.targetValue,
            currentValue: kr.currentValue,
            unit: kr.unit,
            ownerId: kr.ownerId,
            initiatives: krInitiatives.map((i) => ({
              id: i.id,
              title: i.title,
              status: i.status,
              dueDate: i.dueDate,
              keyResultId: i.keyResultId,
            })),
          });
        }

        return {
          objectiveId: o.id,
          title: o.title,
          status: o.status,
          visibilityLevel: o.visibilityLevel,
          cycleStatus: o.cycle ? o.cycle.status : 'NONE',
          isPublished: o.isPublished,
          progress: o.progress,
          ownerId: o.ownerId,
          owner: o.owner
            ? {
                id: o.owner.id,
                name: o.owner.name,
                email: o.owner.email,
              }
            : null,
          cycle: o.cycle
            ? {
                id: o.cycle.id,
                name: o.cycle.name,
                status: o.cycle.status,
              }
            : null,
          canEdit,
          canDelete,
          keyResults: visibleKeyResults,
          initiatives: o.initiatives.map((i) => ({
            id: i.id,
            title: i.title,
            status: i.status,
            dueDate: i.dueDate,
            keyResultId: i.keyResultId,
          })),
        };
      })
    );

    // Return paginated envelope
    return {
      page: pageNum,
      pageSize: pageSizeNum,
      totalCount,
      objectives,
    };
  }
}

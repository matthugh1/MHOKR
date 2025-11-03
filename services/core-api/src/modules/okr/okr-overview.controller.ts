import { Controller, Get, Query, UseGuards, Req, BadRequestException, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { OkrTenantGuard } from './tenant-guard';
import { OkrVisibilityService } from './okr-visibility.service';
import { OkrGovernanceService } from './okr-governance.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { ObjectiveService } from './objective.service';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

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
    private objectiveService: ObjectiveService,
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
    console.log('[OKR OVERVIEW] Request received:', { organizationId, cycleId, status, page, pageSize });
    try {
      // Require organizationId query parameter
      if (!organizationId) {
        throw new BadRequestException('organizationId is required');
      }

      // Tenant isolation: validate user has access to this organization
      const userOrganizationId = req.user.organizationId;
      
      // If user has no organization (undefined), deny access
      if (userOrganizationId === undefined) {
        throw new BadRequestException('You do not have access to this organisation. No organization assigned.');
      }
      
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
      console.log('[OKR OVERVIEW] Fetching objectives with where clause:', JSON.stringify(where, null, 2));
      console.log('[OKR OVERVIEW] userOrganizationId:', userOrganizationId, 'type:', typeof userOrganizationId);
      let allObjectives;
      try {
        allObjectives = await this.prisma.objective.findMany({
        where,
        include: {
          keyResults: {
            include: {
              keyResult: {
                select: {
                  id: true,
                  title: true,
                  status: true,
                  progress: true,
                  startValue: true,
                  targetValue: true,
                  currentValue: true,
                  unit: true,
                  ownerId: true,
                  cycleId: true, // Include cycleId scalar field (but not the cycle relation)
                },
              },
            },
          },
          initiatives: true, // Include all initiative fields (we only need id, title, status, dueDate, keyResultId)
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
      } catch (queryError: any) {
        console.error('[OKR OVERVIEW] Database query error:', queryError?.message, queryError?.stack);
        throw queryError;
      }
      console.log('[OKR OVERVIEW] Fetched', allObjectives.length, 'objectives from database');

    // Filter objectives by visibility
    const visibleObjectives = [];
    for (const objective of allObjectives) {
      if (!objective.organizationId) {
        continue;
      }
      try {
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

        // Debug logging for visibility checks
        if (objective.title === 'Test' && objective.createdAt && new Date(objective.createdAt) > new Date('2025-11-03T10:00:00Z')) {
          console.log('[OKR OVERVIEW] Visibility check for Test objective:', {
            objectiveId: objective.id,
            title: objective.title,
            ownerId: objective.ownerId,
            requesterUserId,
            isOwner: objective.ownerId === requesterUserId,
            organizationId: objective.organizationId,
            requesterOrgId: userOrganizationId,
            visibilityLevel: objective.visibilityLevel,
            canSee,
          });
        }

        if (canSee) {
          visibleObjectives.push(objective);
        }
      } catch (visibilityError: any) {
        console.warn('[OKR OVERVIEW] Error checking visibility for objective:', objective.id, visibilityError?.message);
        // If visibility check fails, exclude the objective (fail closed for security)
        continue;
      }
    }

    // Calculate total count AFTER visibility filtering
    const totalCount = visibleObjectives.length;
    
    // Debug: Log summary
    console.log('[OKR OVERVIEW] Visibility filtering summary:', {
      totalObjectives: allObjectives.length,
      visibleObjectives: visibleObjectives.length,
      filteredOut: allObjectives.length - visibleObjectives.length,
      organizationId,
      cycleId: cycleId || 'all',
      requesterUserId,
      requesterOrgId: userOrganizationId,
    });
    
    // Debug: Log Test objectives specifically
    const testObjs = allObjectives.filter(o => o.title === 'Test')
    const visibleTestObjs = visibleObjectives.filter(o => o.title === 'Test')
    if (testObjs.length > 0) {
      console.log('[OKR OVERVIEW] Test objectives:', {
        totalInQuery: testObjs.length,
        visibleAfterFilter: visibleTestObjs.length,
        testObjectives: testObjs.map(o => ({
          id: o.id.substring(0, 15),
          title: o.title,
          ownerId: o.ownerId,
          requesterUserId,
          isOwner: o.ownerId === requesterUserId,
          visibilityLevel: o.visibilityLevel,
          organizationId: o.organizationId,
          requesterOrgId: userOrganizationId,
        })),
      })
    }

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
    // Ensure organizationId is never undefined - if it is, we shouldn't have gotten this far
    if (userOrganizationId === undefined) {
      console.error('[OKR OVERVIEW] CRITICAL: userOrganizationId is undefined after validation check');
      throw new BadRequestException('User organization not properly set');
    }

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
          console.warn('[OKR OVERVIEW] Error checking permissions for objective:', o.id, (error as any)?.message);
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
              organizationId: o.organizationId || '',
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
            canCheckIn = await this.rbacService.canPerformAction(requesterUserId, 'edit_okr', resourceContext);

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
            console.warn('[OKR OVERVIEW] Error checking canCheckIn for KR:', kr.id, (error as any)?.message);
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

        // W4.M1: Taxonomy alignment - canonical fields only
        // - status: progress state (ON_TRACK, AT_RISK, etc.)
        // - isPublished: governance state (true = Published, false = Draft)
        // - visibilityLevel: canonical enum (PUBLIC_TENANT, PRIVATE)
        // - pillarId: deprecated (not used in UI, kept for backward compatibility)
        return {
          objectiveId: o.id,
          title: o.title,
          status: o.status, // Progress state: ON_TRACK | AT_RISK | OFF_TRACK | COMPLETED | CANCELLED
          publishState: o.isPublished ? 'PUBLISHED' : 'DRAFT', // Governance state: PUBLISHED | DRAFT
          visibilityLevel: o.visibilityLevel, // Canonical: PUBLIC_TENANT | PRIVATE (deprecated values normalized to PUBLIC_TENANT)
          cycleStatus: o.cycle ? o.cycle.status : 'NONE',
          isPublished: o.isPublished, // Boolean kept for backward compatibility
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

    // Check if user can create objectives in this context
    let canCreateObjective = false;
    try {
      // Use the organizationId from query params (what user is viewing) for RBAC check
      // This is the tenant context we're checking permissions against
      const tenantIdForRBAC = organizationId || userOrganizationId || '';
      
      // Build resource context for creation check (no specific OKR ID needed)
      const resourceContext = {
        tenantId: tenantIdForRBAC,
        workspaceId: null,
        teamId: null,
      };

      // Check RBAC permission for create_okr action
      try {
        canCreateObjective = await this.rbacService.canPerformAction(
          requesterUserId,
          'create_okr',
          resourceContext,
        );
      } catch (rbacError) {
        console.error('[OKR OVERVIEW] RBAC check failed:', rbacError);
        canCreateObjective = false;
      }

      // Debug logging (remove in production)
      if (process.env.NODE_ENV === 'development') {
        console.log('[OKR OVERVIEW] canCreateObjective check:', {
          userId: requesterUserId,
          userOrganizationId,
          organizationIdFromQuery: organizationId,
          tenantIdForRBAC,
          canCreate: canCreateObjective,
        });
        
        // Additional debug: log what roles user has for this tenant
        if (!canCreateObjective) {
          try {
            const userContext = await this.rbacService.buildUserContext(requesterUserId, false);
            const tenantRoles = userContext.tenantRoles.get(tenantIdForRBAC) || [];
            console.warn('[OKR OVERVIEW] ⚠️ canCreateObjective is FALSE. User context:', {
              tenantIdForRBAC,
              tenantRolesForThisTenant: tenantRoles,
              allTenantRoles: Array.from(userContext.tenantRoles.entries()),
              'Expected tenantId (from role assignment)': 'cmhesnyvx00004xhjjxs272gs',
              'Does tenantIdForRBAC match expected?': tenantIdForRBAC === 'cmhesnyvx00004xhjjxs272gs',
            });
          } catch (error) {
            console.error('[OKR OVERVIEW] Failed to build user context for debug:', error);
          }
        }
      }

      // If user has create permission, check cycle governance if cycleId is provided
      if (canCreateObjective && cycleId) {
        try {
          const cycle = await this.prisma.cycle.findUnique({
            where: { id: cycleId },
            select: { status: true },
          });

          // If cycle is LOCKED or ARCHIVED, only admins can create
          if (cycle && (cycle.status === 'LOCKED' || cycle.status === 'ARCHIVED')) {
            // Check if user has admin override (edit_okr permission indicates admin role)
            const adminResourceContext = {
              tenantId: tenantIdForRBAC,
              workspaceId: null,
              teamId: null,
            };
            canCreateObjective = await this.rbacService.canPerformAction(
              requesterUserId,
              'edit_okr', // Use edit_okr as proxy for admin override
              adminResourceContext,
            );
          }
        } catch (error) {
          // If cycle lookup fails, conservatively deny creation
          canCreateObjective = false;
        }
      }

      // SUPERUSER cannot create (read-only)
      if (userOrganizationId === null) {
        canCreateObjective = false;
      }
    } catch (error) {
      // If RBAC check fails, conservatively deny creation
      console.error('[OKR OVERVIEW] Error checking canCreateObjective:', error);
      canCreateObjective = false;
    }

    // ALWAYS include canCreateObjective in response (even if false)
    // Return paginated envelope with creation permission flag
    const responsePayload = {
      page: pageNum,
      pageSize: pageSizeNum,
      totalCount,
      objectives,
      canCreateObjective: canCreateObjective || false, // Explicitly ensure it's always included
    };

    // Debug logging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[OKR OVERVIEW] Returning response:', {
        page: responsePayload.page,
        pageSize: responsePayload.pageSize,
        totalCount: responsePayload.totalCount,
        objectivesCount: responsePayload.objectives.length,
        hasCanCreateObjective: 'canCreateObjective' in responsePayload,
        canCreateObjective: responsePayload.canCreateObjective,
      });
    }

    return responsePayload;
    } catch (error: any) {
      console.error('[OKR OVERVIEW] ========== ERROR START ==========');
      console.error('[OKR OVERVIEW] Error in getOverview:');
      console.error('[OKR OVERVIEW] Message:', error?.message || 'Unknown error');
      console.error('[OKR OVERVIEW] Name:', error?.name || 'Unknown');
      console.error('[OKR OVERVIEW] Code:', error?.code || 'N/A');
      console.error('[OKR OVERVIEW] Stack:', error?.stack || 'No stack trace');
      if (error?.meta) {
        console.error('[OKR OVERVIEW] Prisma Meta:', JSON.stringify(error.meta, null, 2));
      }
      try {
        console.error('[OKR OVERVIEW] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (e) {
        console.error('[OKR OVERVIEW] Error object (non-serializable):', error);
      }
      console.error('[OKR OVERVIEW] Request params:', { organizationId, cycleId, status, page, pageSize });
      console.error('[OKR OVERVIEW] User:', { id: req?.user?.id, email: req?.user?.email, organizationId: req?.user?.organizationId });
      console.error('[OKR OVERVIEW] ========== ERROR END ==========');
      throw error;
    }
  }

  @Get('creation-context')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get creation context for OKR creation drawer' })
  @ApiQuery({ name: 'organizationId', required: true, description: 'Organization ID for tenant filtering' })
  async getCreationContext(
    @Query('organizationId') organizationId: string | undefined,
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

    const requesterUserId = req.user.id;

    // Build resource context for RBAC checks
    // Use organizationId from query params (what user is viewing) for RBAC check
    const tenantIdForRBAC = organizationId || userOrganizationId || '';
    const resourceContext = {
      tenantId: tenantIdForRBAC,
      workspaceId: null,
      teamId: null,
    };

    // Check if user can create OKRs
    let canCreate = false;
    try {
      canCreate = await this.rbacService.canPerformAction(
        requesterUserId,
        'create_okr',
        resourceContext,
      );
      // SUPERUSER cannot create (read-only)
      if (userOrganizationId === null) {
        canCreate = false;
      }
    } catch (error) {
      canCreate = false;
    }

    // Get allowed visibility levels
    // W4.M1: Canonical visibility levels only (PUBLIC_TENANT, PRIVATE)
    // Deprecated values (EXEC_ONLY, WORKSPACE_ONLY, etc.) are not exposed
    const allowedVisibilityLevels: string[] = ['PUBLIC_TENANT'];
    try {
      // Check if user is TENANT_ADMIN or TENANT_OWNER
      const canEdit = await this.rbacService.canPerformAction(
        requesterUserId,
        'edit_okr',
        resourceContext,
      );
      if (canEdit) {
        allowedVisibilityLevels.push('PRIVATE');
      }
    } catch (error) {
      // If check fails, only allow PUBLIC_TENANT
    }

    // Get allowed owners (users in same tenant) - Phase 2: Read from RBAC
    let allowedOwners: Array<{ id: string; name: string; email: string }> = [];
    try {
      const tenantAssignments = await this.prisma.roleAssignment.findMany({
        where: {
          scopeType: 'TENANT',
          scopeId: organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      allowedOwners = tenantAssignments.map(a => a.user);
    } catch (error) {
      // If user lookup fails, return empty array
      allowedOwners = [];
    }

    // Check if user can assign others as owner
    // For now, we'll allow assignment if user can create OKRs
    // This can be refined later with more granular RBAC
    const canAssignOthers = canCreate;

    // Get available cycles (active cycles user can create in)
    let availableCycles: Array<{ id: string; name: string; status: string }> = [];
    try {
      const cycles = await this.prisma.cycle.findMany({
        where: {
          organizationId: organizationId,
          status: {
            in: ['DRAFT', 'ACTIVE'], // Only allow creation in DRAFT or ACTIVE cycles
          },
        },
        select: {
          id: true,
          name: true,
          status: true,
        },
        orderBy: {
          startDate: 'desc',
        },
      });
      availableCycles = cycles;

      // If user is admin, also allow LOCKED cycles
      try {
        const canEdit = await this.rbacService.canPerformAction(
          requesterUserId,
          'edit_okr',
          resourceContext,
        );
        if (canEdit) {
          const lockedCycles = await this.prisma.cycle.findMany({
            where: {
              organizationId: organizationId,
              status: 'LOCKED',
            },
            select: {
              id: true,
              name: true,
              status: true,
            },
            orderBy: {
              startDate: 'desc',
            },
          });
          availableCycles = [...availableCycles, ...lockedCycles];
        }
      } catch (error) {
        // If admin check fails, don't include locked cycles
      }
    } catch (error) {
      // If cycle lookup fails, return empty array
      availableCycles = [];
    }

    return {
      allowedVisibilityLevels,
      allowedOwners,
      canAssignOthers,
      availableCycles,
    };
  }

  @Post('create-composite')
  @UseGuards(RateLimitGuard)
  @RequireAction('create_okr')
  @HttpCode(200)
  @ApiOperation({ summary: 'W5.M1: Create Objective and Key Results atomically' })
  async createComposite(
    @Body() body: {
      objective: {
        title: string;
        description?: string;
        ownerUserId: string;
        cycleId: string;
        visibilityLevel: 'PUBLIC_TENANT' | 'PRIVATE';
        whitelistUserIds?: string[];
      };
      keyResults: Array<{
        title: string;
        metricType: 'NUMERIC' | 'PERCENT' | 'BOOLEAN' | 'CUSTOM';
        targetValue: number | string | boolean | null;
        ownerUserId: string;
        updateCadence?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';
        startValue?: number;
        unit?: string;
      }>;
      draft?: boolean;
    },
    @Req() req: any,
  ) {
    const userOrganizationId = req.user.organizationId;
    const userId = req.user.id;

    // Validate request body
    if (!body.objective) {
      throw new BadRequestException('objective is required');
    }

    if (!body.keyResults || !Array.isArray(body.keyResults)) {
      throw new BadRequestException('keyResults array is required');
    }

    // Call service method
    const result = await this.objectiveService.createComposite(
      body.objective,
      body.keyResults,
      userId,
      userOrganizationId,
    );

    return result;
  }
}

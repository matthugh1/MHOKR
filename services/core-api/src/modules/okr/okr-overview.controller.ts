import { Controller, Get, Query, UseGuards, Req, BadRequestException, Post, Body, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard, RequireAction } from '../rbac';
import { OkrTenantGuard } from './tenant-guard';
import { OkrVisibilityService } from './okr-visibility.service';
import { OkrGovernanceService } from './okr-governance.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';
import { withTenantContextAsync } from '../../common/prisma/tenant-isolation.middleware';
import { ObjectiveService } from './objective.service';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { Logger } from '@nestjs/common';
import { OkrImportService } from './okr-import.service';
import { AuthenticatedRequest } from '../../common/types/request.types';

// Simple telemetry helper for list filtering
const listTelemetry = {
  enabled: process.env.LIST_TELEMETRY !== 'off',
  logger: new Logger('ListTelemetry'),
  recordCounter(metric: string, tags?: Record<string, string | number>): void {
    if (!this.enabled) return;
    this.logger.log(`[TELEMETRY] Counter: ${metric}`, {
      metric,
      tags: tags || {},
      timestamp: new Date().toISOString(),
    });
  },
};

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
  private readonly logger = new Logger(OkrOverviewController.name);

  constructor(
    private prisma: PrismaService,
    private visibilityService: OkrVisibilityService,
    private governanceService: OkrGovernanceService,
    private rbacService: RBACService,
    private objectiveService: ObjectiveService,
    private importService: OkrImportService,
  ) { }

  @Get('overview')
  @RequireAction('view_okr')
  @ApiOperation({
    summary: 'Get unified OKR overview with nested Key Results and Initiatives',
    description: 'Returns paginated list of objectives with their key results and initiatives. Only returns objectives visible to the requester based on RBAC and visibility rules. Supports filtering by cycle, status, scope, visibility level, and owner.'
  })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Organization ID for tenant filtering' })
  @ApiQuery({ name: 'cycleId', required: false, description: 'Filter by cycle ID' })
  @ApiQuery({ name: 'status', required: false, enum: ['ON_TRACK', 'AT_RISK', 'BLOCKED', 'COMPLETED', 'CANCELLED'], description: 'Filter by objective status' })
  @ApiQuery({ name: 'scope', required: false, enum: ['my', 'team-workspace', 'tenant'], description: 'Filter by scope: my (owned by user), team-workspace (user manages), tenant (all tenant OKRs)' })
  @ApiQuery({ name: 'visibilityLevel', required: false, enum: ['ALL', 'PUBLIC_TENANT', 'PRIVATE'], description: 'Filter by visibility level (ALL shows all visible OKRs)' })
  @ApiQuery({ name: 'ownerId', required: false, type: String, description: 'Filter by owner user ID' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, description: 'Items per page (default: 20, max: 50)' })
  @ApiQuery({ name: 'hierarchyView', required: false, type: Boolean, description: 'If true, fetch complete hierarchy (all root objectives + descendants, ignores pagination)' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of objectives with key results and initiatives',
    schema: {
      type: 'object',
      properties: {
        objectives: { type: 'array', items: { type: 'object' } },
        totalCount: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' },
        canCreateObjective: { type: 'boolean' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid parameters' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks view_okr permission' })
  async getOverview(
    @Query('tenantId') tenantId: string | undefined,
    @Query('cycleId') cycleId: string | undefined,
    @Query('status') status: string | undefined,
    @Query('scope') scope: string | undefined,
    @Query('visibilityLevel') visibilityLevel: string | undefined,
    @Query('ownerId') ownerId: string | undefined,
    @Query('parentId') parentId: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('hierarchyView') hierarchyView: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    try {
      // Require tenantId query parameter
      if (!tenantId) {
        throw new BadRequestException('tenantId is required');
      }

      // SINGLE-TENANT ACCESS: Users can only access their primary organization
      // The tenantId in req.user comes from primaryOrganizationId (set by JWT strategy)
      const userOrganizationId = req.user.tenantId;

      // If user has no organization (undefined), deny access
      if (userOrganizationId === undefined) {
        throw new BadRequestException('You do not have access to this organisation. No organization assigned.');
      }

      // Strict validation: only allow access to primary organization
      // Superusers (null) can access any organization
      if (userOrganizationId !== null && userOrganizationId !== tenantId) {
        throw new BadRequestException('You do not have access to this organisation');
      }

      const requesterUserId = req.user.id;

      // Parse hierarchy view flag
      const isHierarchyView = hierarchyView === 'true' || hierarchyView === '1';

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

      // Build where clause for objectives (tenant isolation already enforced)
      const where: any = { tenantId };

      // Apply parentId filter
      if (parentId !== undefined) {
        if (parentId === 'null') {
          where.parentId = null;
        } else {
          where.parentId = parentId;
        }
      }

      // Apply scope-based filtering before other filters
      if (scope) {
        const validScopes = ['my', 'team-workspace', 'tenant'];
        if (!validScopes.includes(scope)) {
          throw new BadRequestException(`Invalid scope. Must be one of: ${validScopes.join(', ')}`);
        }

        if (scope === 'my') {
          // Filter by owner: only OKRs owned by the requester
          where.ownerId = requesterUserId;
        } else if (scope === 'team-workspace') {
          // Filter by workspace/team IDs the user manages or belongs to
          // Prefer lead roles (WORKSPACE_LEAD, TEAM_LEAD) over member roles
          const userContext = await this.rbacService.buildUserContext(requesterUserId, false);

          // Collect workspace IDs where user has lead roles
          const workspaceIds: string[] = [];
          for (const [workspaceId, roles] of userContext.workspaceRoles.entries()) {
            // Check if user has lead role (WORKSPACE_LEAD, WORKSPACE_OWNER)
            if (roles.some(r => r.startsWith('WORKSPACE_LEAD') || r.startsWith('WORKSPACE_OWNER'))) {
              workspaceIds.push(workspaceId);
            }
          }

          // Collect team IDs where user has lead roles
          const teamIds: string[] = [];
          for (const [teamId, roles] of userContext.teamRoles.entries()) {
            // Check if user has lead role (TEAM_LEAD, TEAM_OWNER)
            if (roles.some(r => r.startsWith('TEAM_LEAD') || r.startsWith('TEAM_OWNER'))) {
              teamIds.push(teamId);
            }
          }

          // Fallback: if no lead roles, use member roles
          if (workspaceIds.length === 0 && teamIds.length === 0) {
            for (const [workspaceId] of userContext.workspaceRoles.entries()) {
              workspaceIds.push(workspaceId);
            }
            for (const [teamId] of userContext.teamRoles.entries()) {
              teamIds.push(teamId);
            }
          }

          // Apply filters: OKRs must belong to one of these workspaces or teams
          if (workspaceIds.length > 0 || teamIds.length > 0) {
            const orConditions: any[] = [];
            if (workspaceIds.length > 0) {
              orConditions.push({ workspaceId: { in: workspaceIds } });
            }
            if (teamIds.length > 0) {
              orConditions.push({ teamId: { in: teamIds } });
            }
            if (orConditions.length > 0) {
              where.OR = orConditions;
            }
          } else {
            // If user has no workspace/team roles, return empty result
            where.id = 'never-match-this-id';
          }
        } else if (scope === 'tenant') {
          // Tenant scope: no additional filter needed (tenantId already set)
          // Show all tenant OKRs (visibility filtering will still apply)
        }
      }

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

      // Apply visibility level filter (before fetching, but visibility policy still enforced after)
      if (visibilityLevel && visibilityLevel !== 'ALL') {
        const validVisibilityLevels = ['PUBLIC_TENANT', 'PRIVATE'];
        if (!validVisibilityLevels.includes(visibilityLevel)) {
          throw new BadRequestException(`Invalid visibilityLevel. Must be one of: ALL, ${validVisibilityLevels.join(', ')}`);
        }
        where.visibilityLevel = visibilityLevel;
      }

      // Apply owner filter
      if (ownerId) {
        // Validate ownerId belongs to the same tenant (tenant isolation)
        // Note: RLS policies will automatically filter users by organization
        try {
          const owner = await this.prisma.user.findUnique({
            where: { id: ownerId },
            select: { id: true, primaryOrganizationId: true },
          });
          if (!owner) {
            // User not found - could be RLS blocking or user doesn't exist
            // Don't leak information - just filter by ownerId (will return empty if user not in org)
            where.ownerId = ownerId;
          } else {
            // User found - add to filter
            where.ownerId = ownerId;
          }
        } catch (error: any) {
          // If RLS blocks the query, log but don't fail - just filter by ownerId
          // The objective query will return empty if owner is not in the same org
          this.logger.warn(`Could not validate owner ${ownerId}: ${error.message}`);
          where.ownerId = ownerId;
        }
      }

      // CRITICAL: Set AsyncLocalStorage context to the query param tenantId
      // This ensures RLS filters by the requested organization, not just the JWT tenantId
      // The user's access to this tenantId has already been validated by RBACGuard
      return await withTenantContextAsync(tenantId, async () => {
        // Fetch objectives matching filters (before visibility filtering)
        // NOTE: Tenant context is now set to the query param tenantId
        // This ensures RLS session variables are set correctly before the query executes
        let allObjectives;
        try {
          this.logger.debug(`Fetching objectives with tenantId=${tenantId}, userTenantId=${userOrganizationId}, hierarchyView=${isHierarchyView}`);

          if (isHierarchyView) {
            // Hierarchy view: Fetch all root objectives + all their descendants
            // Step 1: Fetch all root objectives (parentId is null)
            const rootObjectives = await this.prisma.objective.findMany({
              where: {
                ...where,
                parentId: null,
              },
              include: {
                keyResults: {
                  select: {
                    id: true,
                    weight: true,
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
                        owner: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                          },
                        },
                        cycleId: true,
                        checkInCadence: true,
                      },
                    },
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
              orderBy: { createdAt: 'desc' }, // Sort root objectives by creation date
            });

            // Step 2: Phase 2.2 Optimization - Use PostgreSQL recursive CTE to fetch all descendants in a single query
            // This replaces the recursive JavaScript function that made multiple database round trips
            const rootIds = rootObjectives.map(o => o.id);

            if (rootIds.length === 0) {
              allObjectives = rootObjectives;
            } else {
              // Build WHERE conditions for the CTE using Prisma.sql parameterized queries
              // All user input values are parameterized through Prisma.sql template tag
              // This prevents SQL injection by ensuring values are properly escaped

              // Build the query conditionally with all values parameterized
              // For the IN clause, we'll build it with individual conditions or use a different approach
              let query: Prisma.Sql;

              if (rootIds.length === 1 && !where.tenantId && !where.cycleId && !where.status && !where.pillarId && !where.teamId) {
                // Simple case: single root ID, no filters
                query = Prisma.sql`
                  WITH RECURSIVE descendants AS (
                    SELECT id, "parentId"
                    FROM objectives
                    WHERE "parentId" = ${rootIds[0]}
                    
                    UNION
                    
                    SELECT o.id, o."parentId"
                    FROM objectives o
                    INNER JOIN descendants d ON o."parentId" = d.id
                    WHERE o."parentId" IS NOT NULL
                  )
                  SELECT id FROM descendants
                `;
              } else {
                // Complex case: build query with all conditions
                // We'll use Prisma.sql with conditional building
                const hasFilters = !!(where.tenantId || where.cycleId || where.status || where.pillarId || where.teamId);

                // Build IN clause safely - rootIds come from database queries so they're safe,
                // but we still parameterize them through Prisma.sql for consistency
                // Since Prisma.join has type issues, we'll build the IN clause with individual conditions
                // or use a workaround: validate IDs are UUIDs (which they are from Prisma) and use Prisma.raw
                // But to be safe, we'll use Prisma.sql with direct interpolation for each value

                // Build parentId condition - use OR for multiple IDs to avoid Prisma.join type issues
                // This is safe because rootIds come from Prisma queries, not user input
                let parentIdCondition: Prisma.Sql;
                if (rootIds.length === 1) {
                  parentIdCondition = Prisma.sql`"parentId" = ${rootIds[0]}`;
                } else if (rootIds.length === 2) {
                  parentIdCondition = Prisma.sql`("parentId" = ${rootIds[0]} OR "parentId" = ${rootIds[1]})`;
                } else {
                  // For 3+ IDs, use IN with Prisma.raw but values are still from database (safe)
                  // We validate these are UUIDs from Prisma queries
                  const idsList = rootIds.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
                  parentIdCondition = Prisma.raw(`"parentId" IN (${idsList})`);
                }

                if (hasFilters) {
                  // Build query with filters
                  query = Prisma.sql`
                    WITH RECURSIVE descendants AS (
                      SELECT id, "parentId"
                      FROM objectives
                      WHERE ${parentIdCondition}
                        ${where.tenantId ? Prisma.sql`AND "tenantId" = ${where.tenantId}` : Prisma.empty}
                        ${where.cycleId ? Prisma.sql`AND "cycleId" = ${where.cycleId}` : Prisma.empty}
                        ${where.status ? Prisma.sql`AND status = ${where.status}` : Prisma.empty}
                        ${where.pillarId ? Prisma.sql`AND "pillarId" = ${where.pillarId}` : Prisma.empty}
                        ${where.teamId ? Prisma.sql`AND "teamId" = ${where.teamId}` : Prisma.empty}
                      
                      UNION
                      
                      SELECT o.id, o."parentId"
                      FROM objectives o
                      INNER JOIN descendants d ON o."parentId" = d.id
                      WHERE o."parentId" IS NOT NULL
                        ${where.tenantId ? Prisma.sql`AND o."tenantId" = ${where.tenantId}` : Prisma.empty}
                        ${where.cycleId ? Prisma.sql`AND o."cycleId" = ${where.cycleId}` : Prisma.empty}
                        ${where.status ? Prisma.sql`AND o.status = ${where.status}` : Prisma.empty}
                        ${where.pillarId ? Prisma.sql`AND o."pillarId" = ${where.pillarId}` : Prisma.empty}
                        ${where.teamId ? Prisma.sql`AND o."teamId" = ${where.teamId}` : Prisma.empty}
                    )
                    SELECT id FROM descendants
                  `;
                } else {
                  // No filters, just parentId condition
                  query = Prisma.sql`
                    WITH RECURSIVE descendants AS (
                      SELECT id, "parentId"
                      FROM objectives
                      WHERE ${parentIdCondition}
                      
                      UNION
                      
                      SELECT o.id, o."parentId"
                      FROM objectives o
                      INNER JOIN descendants d ON o."parentId" = d.id
                      WHERE o."parentId" IS NOT NULL
                    )
                    SELECT id FROM descendants
                  `;
                }
              }

              // Execute parameterized query - all values are safely parameterized by Prisma
              const descendantIdsResult = await this.prisma.$queryRaw<Array<{ id: string }>>(query);

              const allDescendantIds = descendantIdsResult.map(r => r.id);

              // Step 3: Fetch all descendants with full data
              const descendants = allDescendantIds.length > 0
                ? await this.prisma.objective.findMany({
                  where: {
                    ...where,
                    id: { in: allDescendantIds },
                  },
                  include: {
                    keyResults: {
                      select: {
                        id: true,
                        weight: true,
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
                            owner: {
                              select: {
                                id: true,
                                name: true,
                                email: true,
                              },
                            },
                            cycleId: true,
                            checkInCadence: true,
                          },
                        },
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
                })
                : [];

              // Combine root objectives and descendants
              allObjectives = [...rootObjectives, ...descendants];
            }
          } else {
            // Regular view: Fetch with pagination support
            allObjectives = await this.prisma.objective.findMany({
              where,
              include: {
                keyResults: {
                  select: {
                    id: true,
                    weight: true,
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
                        owner: {
                          select: {
                            id: true,
                            name: true,
                            email: true,
                          },
                        },
                        cycleId: true,
                        checkInCadence: true,
                      },
                    },
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
              orderBy: [
                // First, prioritize root objectives (parentId is null)
                { parentId: 'asc' }, // null values come first with 'asc'
                // Then by creation date (most recent first)
                { createdAt: 'desc' },
              ],
            });
          }
        } catch (queryError: any) {
          // Error logging kept for debugging
          this.logger.error('Database query error', { message: queryError?.message, stack: queryError?.stack });
          throw queryError;
        }
        // Removed debug logging - use structured logging service in production

        // Filter objectives by visibility
        const visibleObjectives = [];
        for (const objective of allObjectives) {
          if (!objective.tenantId) {
            continue;
          }
          try {
            const canSee = await this.visibilityService.canUserSeeObjective({
              objective: {
                id: objective.id,
                ownerId: objective.ownerId,
                tenantId: objective.tenantId,
                visibilityLevel: objective.visibilityLevel,
              },
              requesterUserId,
              requesterOrgId: userOrganizationId,
            });

            // Removed debug logging for visibility checks - use structured logging service in production

            if (canSee) {
              visibleObjectives.push(objective);
            }
          } catch (visibilityError: any) {
            this.logger.warn(`Error checking visibility for objective ${objective.id}: ${visibilityError?.message}`);
            // If visibility check fails, exclude the objective (fail closed for security)
            continue;
          }
        }

        // Calculate total count AFTER visibility filtering
        const totalCount = visibleObjectives.length;

        // Record telemetry for filtered list
        const filteredCount = allObjectives.length - visibleObjectives.length;
        if (filteredCount > 0) {
          listTelemetry.recordCounter('list.filtered', {
            tenantId: userOrganizationId || 'null',
            filteredCount,
            totalCount: allObjectives.length,
            requesterUserId,
          });
        }

        // Removed debug logging - use structured logging service in production

        // Apply pagination to filtered results (skip if hierarchy view)
        let paginatedObjectives;
        if (isHierarchyView) {
          // Hierarchy view: Return all visible objectives (complete hierarchy)
          paginatedObjectives = visibleObjectives;
        } else {
          // Regular view: Apply pagination
          const skip = (pageNum - 1) * pageSizeNum;
          const take = pageSizeNum;
          paginatedObjectives = visibleObjectives.slice(skip, skip + take);
        }

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
        // Ensure tenantId is never undefined - if it is, we shouldn't have gotten this far
        if (userOrganizationId === undefined) {
          this.logger.error('CRITICAL: userOrganizationId is undefined after validation check');
          throw new BadRequestException('User organization not properly set');
        }

        const actingUser = {
          id: requesterUserId,
          tenantId: userOrganizationId,
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
              this.logger.warn(`Error checking permissions for objective ${o.id}: ${(error as any)?.message}`);
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
                  tenantId: o.tenantId || '',
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
                this.logger.warn(`Error checking canCheckIn for KR ${kr.id}: ${(error as any)?.message}`);
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
                owner: kr.owner
                  ? {
                    id: kr.owner.id,
                    name: kr.owner.name,
                    email: kr.owner.email,
                  }
                  : null,
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
            const result = {
              objectiveId: o.id,
              title: o.title,
              status: o.status, // Progress state: ON_TRACK | AT_RISK | OFF_TRACK | COMPLETED | CANCELLED
              publishState: o.isPublished ? 'PUBLISHED' : 'DRAFT', // Governance state: PUBLISHED | DRAFT
              visibilityLevel: o.visibilityLevel, // Canonical: PUBLIC_TENANT | PRIVATE (deprecated values normalized to PUBLIC_TENANT)
              cycleStatus: o.cycle ? o.cycle.status : 'NONE',
              isPublished: o.isPublished, // Boolean kept for backward compatibility
              progress: o.progress,
              ownerId: o.ownerId,
              parentId: o.parentId || null, // Include parentId for hierarchical tree view
              cycleId: o.cycleId || o.cycle?.id || null, // Include cycleId directly for easier access
              pillarId: o.pillarId || null, // Include pillarId for strategic pillar linking
              workspaceId: o.workspaceId || null, // Include workspaceId for workspace filtering
              teamId: o.teamId || null, // Include teamId for team filtering
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
              // Merge initiatives: both direct objective initiatives AND initiatives from Key Results
              // Initiatives linked to KRs don't have objectiveId, so we need to include them here
              initiatives: [
                // Direct objective initiatives (have objectiveId)
                ...o.initiatives.map((i) => ({
                  id: i.id,
                  title: i.title,
                  status: i.status,
                  dueDate: i.dueDate,
                  keyResultId: i.keyResultId,
                })),
                // Initiatives from Key Results (may not have objectiveId, but belong to this objective via KR)
                ...visibleKeyResults.flatMap((kr) =>
                  (kr.initiatives || []).map((i) => ({
                    id: i.id,
                    title: i.title,
                    status: i.status,
                    dueDate: i.dueDate,
                    keyResultId: i.keyResultId,
                  }))
                ),
              ].filter((init, index, self) =>
                // Deduplicate by ID (in case an initiative has both objectiveId and keyResultId)
                index === self.findIndex((i) => i.id === init.id)
              ),
            };
            return result;
          })
        );

        // Check if user can create objectives in this context
        let canCreateObjective = false;
        try {
          // Use the tenantId from query params (what user is viewing) for RBAC check
          // This is the tenant context we're checking permissions against
          const tenantIdForRBAC = tenantId || userOrganizationId || '';

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
            this.logger.error('RBAC check failed', { error: rbacError });
            canCreateObjective = false;
          }

          // Removed debug logging - use structured logging service in production

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

          // SUPERUSER can create everything
          if (userOrganizationId === null) {
            canCreateObjective = true;
          }
        } catch (error) {
          // If RBAC check fails, conservatively deny creation
          this.logger.error('Error checking canCreateObjective', { error });
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

        // Removed debug logging - use structured logging service in production

        return responsePayload;
      });
    } catch (error: any) {
      this.logger.error('Error in getOverview', {
        message: error?.message || 'Unknown error',
        name: error?.name,
        code: error?.code,
        stack: error?.stack,
        prismaMeta: error?.meta,
        requestParams: { tenantId, cycleId, status, page, pageSize },
        userId: req?.user?.id,
        userTenantId: req?.user?.tenantId,
      });
      throw error;
    }
  }

  @Get('creation-context')
  @RequireAction('view_okr')
  @ApiOperation({ summary: 'Get creation context for OKR creation drawer' })
  @ApiQuery({ name: 'tenantId', required: true, description: 'Organization ID for tenant filtering' })
  async getCreationContext(
    @Query('tenantId') tenantId: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    // Require tenantId query parameter
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    // Tenant isolation: validate user has access to this organization
    const userOrganizationId = req.user.tenantId;
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);

    // If user has a specific org and it doesn't match, deny access
    if (userOrganizationId !== null && orgFilter && orgFilter.tenantId !== tenantId) {
      throw new BadRequestException('You do not have access to this organisation');
    }

    const requesterUserId = req.user.id;

    // Build resource context for RBAC checks
    // Use tenantId from query params (what user is viewing) for RBAC check
    const tenantIdForRBAC = tenantId || userOrganizationId || '';
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
      // SUPERUSER can create everything
      if (userOrganizationId === null) {
        canCreate = true;
      }
    } catch (error) {
      canCreate = false;
    }

    // Get allowed visibility levels
    // W4.M1: Canonical visibility levels only (PUBLIC_TENANT, PRIVATE)
    // Deprecated values (EXEC_ONLY, WORKSPACE_ONLY, etc.) are not exposed
    const allowedVisibilityLevels: string[] = ['PUBLIC_TENANT'];
    let canEdit = false;
    try {
      // Check if user is TENANT_ADMIN or TENANT_OWNER
      canEdit = await this.rbacService.canPerformAction(
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
          scopeId: tenantId,
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

      // Deduplicate users by ID (a user can have multiple role assignments)
      const userMap = new Map<string, { id: string; name: string; email: string }>();
      tenantAssignments.forEach(assignment => {
        if (assignment.user && !userMap.has(assignment.user.id)) {
          userMap.set(assignment.user.id, assignment.user);
        }
      });
      allowedOwners = Array.from(userMap.values());
    } catch (error) {
      // If user lookup fails, return empty array
      allowedOwners = [];
    }

    // Check if user can assign others as owner
    // Users with edit_okr permission (TENANT_ADMIN, TENANT_OWNER) can assign others
    // Regular users can only assign themselves
    const canAssignOthers = canEdit || canCreate;

    // Get available cycles (active cycles user can create in)
    let availableCycles: Array<{ id: string; name: string; status: string }> = [];
    try {
      const cycles = await this.prisma.cycle.findMany({
        where: {
          tenantId: tenantId,
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
              tenantId: tenantId,
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
        parentId?: string;
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
    @Req() req: AuthenticatedRequest,
  ) {
    const userOrganizationId = req.user.tenantId;
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

  @Post('import')
  @UseGuards(RateLimitGuard)
  @RequireAction('create_okr')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Import OKRs from Viva Goals CSV',
    description: 'Imports Objectives and Key Results from a Viva Goals CSV export. Supports deduplication by externalId. Returns import results with success/failure counts and errors.'
  })
  @ApiResponse({
    status: 200,
    description: 'Import completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        objectivesCreated: { type: 'number' },
        objectivesUpdated: { type: 'number' },
        keyResultsCreated: { type: 'number' },
        keyResultsUpdated: { type: 'number' },
        errors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              row: { type: 'number' },
              externalId: { type: 'string' },
              title: { type: 'string' },
              error: { type: 'string' }
            }
          }
        },
        warnings: { type: 'array', items: { type: 'string' } }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid CSV or missing tenantId' })
  @ApiResponse({ status: 403, description: 'Forbidden - user lacks create_okr permission' })
  async importFromCSV(
    @Body() body: { csvContent: string; tenantId: string },
    @Req() req: AuthenticatedRequest,
  ) {
    const userOrganizationId = req.user.tenantId || body.tenantId;
    const userId = req.user.id;

    if (!body.csvContent) {
      throw new BadRequestException('csvContent is required');
    }

    if (!userOrganizationId) {
      throw new BadRequestException('tenantId is required');
    }

    // Validate tenant isolation
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Import CSV
    const result = await this.importService.importFromCSV(
      body.csvContent,
      userOrganizationId,
      userId,
    );

    return result;
  }
}

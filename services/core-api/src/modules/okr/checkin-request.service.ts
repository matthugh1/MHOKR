import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OkrTenantGuard } from './tenant-guard';
import { RBACService } from '../rbac/rbac.service';
import { AuditLogService } from '../audit/audit-log.service';
import { assertNotSuperuserWrite } from '../rbac/superuser-guard.util';
import { AuditTargetType } from '@prisma/client';

/**
 * CheckInRequest Service
 * 
 * Handles async check-in requests and responses for Milestone 1.
 * 
 * Tenant isolation:
 * - All requests are scoped to an organization
 * - Users can only create requests for users in their organization
 * - Users can only view/submit requests assigned to them or created by them
 * 
 * Authorization:
 * - Only authorized users can create check-in requests for others
 * - Requester must be: direct manager, TENANT_OWNER/TENANT_ADMIN, WORKSPACE_LEAD, or TEAM_LEAD
 * - SUPERUSER cannot create check-in requests (read-only)
 */
@Injectable()
export class CheckInRequestService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Check if requester is authorized to create a check-in request for target user.
   * 
   * Authorization rules (at least one must be true):
   * 1. Requester is direct manager of target (targetUser.managerId === requester.id)
   * 2. Requester has TENANT_OWNER or TENANT_ADMIN role in the organization
   * 3. Requester is WORKSPACE_LEAD for any workspace the target belongs to
   * 4. Requester is TEAM_LEAD for any team the target belongs to
   * 
   * @param requesterUserId - User requesting the check-in
   * @param targetUserId - User who needs to submit the update
   * @param organizationId - Organization ID (tenant scope)
   * @returns true if requester is authorized, false otherwise
   */
  private async canRequestCheckinForUser(
    requesterUserId: string,
    targetUserId: string,
    organizationId: string,
  ): Promise<boolean> {
    // Load requester and target users
    const [requester, targetUser] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: requesterUserId },
        select: { id: true, isSuperuser: true, managerId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, managerId: true },
      }),
    ]);

    if (!requester || !targetUser) {
      return false;
    }

    // SUPERUSER cannot create check-in requests
    if (requester.isSuperuser) {
      return false;
    }

    // Check 1: Direct manager relationship
    if (targetUser.managerId === requesterUserId) {
      return true;
    }

    // Build user context for RBAC checks
    const requesterContext = await this.rbacService.buildUserContext(requesterUserId);

    // Check 2: TENANT_OWNER or TENANT_ADMIN role in organization
    const tenantRoles = requesterContext.tenantRoles.get(organizationId) || [];
    if (tenantRoles.includes('TENANT_OWNER') || tenantRoles.includes('TENANT_ADMIN')) {
      return true;
    }

    // Check 3 & 4: WORKSPACE_LEAD or TEAM_LEAD roles
    // Get all workspaces and teams the target user belongs to
    const targetWorkspaces = await this.prisma.workspaceMember.findMany({
      where: {
        userId: targetUserId,
        workspace: {
          organizationId,
        },
      },
      select: { workspaceId: true },
    });

    const targetTeams = await this.prisma.teamMember.findMany({
      where: {
        userId: targetUserId,
        team: {
          workspace: {
            organizationId,
          },
        },
      },
      select: { teamId: true },
    });

    // Check if requester is WORKSPACE_LEAD for any target workspace
    for (const ws of targetWorkspaces) {
      const workspaceRoles = requesterContext.workspaceRoles.get(ws.workspaceId) || [];
      if (workspaceRoles.includes('WORKSPACE_LEAD')) {
        return true;
      }
    }

    // Check if requester is TEAM_LEAD for any target team
    for (const team of targetTeams) {
      const teamRoles = requesterContext.teamRoles.get(team.teamId) || [];
      if (teamRoles.includes('TEAM_LEAD')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create check-in requests for one or more target users.
   * 
   * @param requesterUserId - Manager who is requesting the updates
   * @param targetUserIds - Array of user IDs who need to submit updates
   * @param dueAt - When the updates are due
   * @param userOrganizationId - Requester's organization ID (for tenant isolation)
   */
  async createRequests(
    requesterUserId: string,
    targetUserIds: string[],
    dueAt: Date,
    userOrganizationId: string | null | undefined,
  ) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    if (!userOrganizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    if (!targetUserIds || targetUserIds.length === 0) {
      throw new BadRequestException('At least one target user is required');
    }

    // Load requester to check superuser status
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterUserId },
      select: { id: true, isSuperuser: true },
    });

    if (!requester) {
      throw new NotFoundException('Requester user not found');
    }

    // Enforce SUPERUSER read-only rule
    assertNotSuperuserWrite(requester.isSuperuser);

    // Verify all target users belong to the same organization
    // Users can belong to an org via direct membership OR via team membership (team -> workspace -> org)
    const targetUsers = await this.prisma.user.findMany({
      where: {
        id: { in: targetUserIds },
        OR: [
          {
            organizationMembers: {
              some: {
                organizationId: userOrganizationId,
              },
            },
          },
          {
            teamMembers: {
              some: {
                team: {
                  workspace: {
                    organizationId: userOrganizationId,
                  },
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (targetUsers.length !== targetUserIds.length) {
      throw new BadRequestException('All target users must belong to your organization');
    }

    // Validate authorization for each target user
    for (const targetUserId of targetUserIds) {
      const isAuthorized = await this.canRequestCheckinForUser(
        requesterUserId,
        targetUserId,
        userOrganizationId,
      );

      if (!isAuthorized) {
        throw new ForbiddenException(
          `You are not allowed to request a check-in for user ${targetUserId}. You must be their direct manager, a tenant admin, workspace lead, or team lead.`,
        );
      }
    }

    // Create requests
    const requests = await Promise.all(
      targetUserIds.map(async (targetUserId) => {
        const request = await this.prisma.checkInRequest.create({
          data: {
            requesterUserId,
            targetUserId,
            organizationId: userOrganizationId,
            dueAt,
            status: 'OPEN',
          },
          include: {
            targetUser: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            requester: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        });

        // Audit log: record check-in request creation
        await this.auditLogService.record({
          action: 'REQUEST_CHECKIN_CREATED',
          actorUserId: requesterUserId,
          targetUserId: targetUserId,
          targetId: request.id,
          targetType: AuditTargetType.USER,
          organizationId: userOrganizationId,
          metadata: {
            dueAt: dueAt.toISOString(),
            reason: 'async_checkin_request',
          },
        });

        return request;
      }),
    );

    return requests;
  }

  /**
   * Get all OPEN or LATE check-in requests for the current user.
   * 
   * Automatically marks OPEN requests as LATE if dueAt < now.
   * Returns only requests in OPEN or LATE status.
   * 
   * @param userId - Current user ID
   * @param userOrganizationId - User's organization ID (for tenant isolation)
   */
  async getMyRequests(userId: string, userOrganizationId: string | null | undefined) {
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    
    if (!orgFilter && userOrganizationId !== null) {
      // User has no org → return empty array
      return [];
    }

    const now = new Date();
    
    // Fetch OPEN requests and update LATE status if needed
    const requests = await this.prisma.checkInRequest.findMany({
      where: {
        targetUserId: userId,
        ...(orgFilter ? { organizationId: orgFilter.organizationId } : {}),
        status: {
          in: ['OPEN', 'LATE'],
        },
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        response: true,
      },
      orderBy: {
        dueAt: 'asc',
      },
    });

    // Update status to LATE if due date has passed
    const updatedRequests = await Promise.all(
      requests.map(async (request) => {
        if (request.status === 'OPEN' && request.dueAt < now) {
          const updated = await this.prisma.checkInRequest.update({
            where: { id: request.id },
            data: { status: 'LATE' },
            include: {
              requester: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              response: true,
            },
          });
          return updated;
        }
        return request;
      }),
    );

    // Return only OPEN or LATE requests with required fields
    return updatedRequests.map((request) => ({
      id: request.id,
      requesterUserId: request.requesterUserId,
      requester: request.requester,
      targetUserId: request.targetUserId,
      dueAt: request.dueAt,
      status: request.status,
      createdAt: request.createdAt,
      response: request.response,
      // TODO [phase7-hardening]: include objective/key result context for richer reminders
    }));
  }

  /**
   * Submit a check-in response for a request.
   * 
   * @param requestId - Check-in request ID
   * @param userId - User submitting the response (must match request.targetUserId)
   * @param data - Response data (summaryWhatMoved, summaryBlocked, summaryNeedHelp)
   * @param userOrganizationId - User's organization ID (for tenant isolation)
   */
  async submitResponse(
    requestId: string,
    userId: string,
    data: {
      summaryWhatMoved?: string;
      summaryBlocked?: string;
      summaryNeedHelp?: string;
    },
    userOrganizationId: string | null | undefined,
  ) {
    // Tenant isolation: enforce mutation rules
    OkrTenantGuard.assertCanMutateTenant(userOrganizationId);

    // Find the request
    const request = await this.prisma.checkInRequest.findUnique({
      where: { id: requestId },
      include: {
        response: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Check-in request not found');
    }

    // Verify tenant match
    OkrTenantGuard.assertSameTenant(request.organizationId, userOrganizationId);

    // Verify user matches target
    if (request.targetUserId !== userId) {
      throw new BadRequestException('You can only submit responses for requests assigned to you');
    }

    // Verify request is still open
    if (request.status === 'SUBMITTED') {
      throw new BadRequestException('This request has already been submitted');
    }

    if (request.status === 'CANCELLED') {
      throw new BadRequestException('This request has been cancelled');
    }

    // Create or update response
    const response = await this.prisma.checkInResponse.upsert({
      where: { requestId },
      create: {
        requestId,
        targetUserId: userId,
        summaryWhatMoved: data.summaryWhatMoved?.trim() || null,
        summaryBlocked: data.summaryBlocked?.trim() || null,
        summaryNeedHelp: data.summaryNeedHelp?.trim() || null,
        submittedAt: new Date(),
      },
      update: {
        summaryWhatMoved: data.summaryWhatMoved?.trim() || null,
        summaryBlocked: data.summaryBlocked?.trim() || null,
        summaryNeedHelp: data.summaryNeedHelp?.trim() || null,
        submittedAt: new Date(),
      },
    });

    // Update request status to SUBMITTED
    await this.prisma.checkInRequest.update({
      where: { id: requestId },
      data: { status: 'SUBMITTED' },
    });

    // Return response with status
    return {
      id: response.id,
      requestId: response.requestId,
      targetUserId: response.targetUserId,
      summaryWhatMoved: response.summaryWhatMoved,
      summaryBlocked: response.summaryBlocked,
      summaryNeedHelp: response.summaryNeedHelp,
      submittedAt: response.submittedAt,
      status: 'SUBMITTED' as const,
    };
  }

  /**
   * Count overdue (LATE) requests for a user.
   * 
   * @param userId - User ID
   * @param userOrganizationId - User's organization ID (for tenant isolation)
   */
  async countOverdue(userId: string, userOrganizationId: string | null | undefined): Promise<number> {
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    
    if (!orgFilter && userOrganizationId !== null) {
      return 0;
    }

    const count = await this.prisma.checkInRequest.count({
      where: {
        targetUserId: userId,
        ...(orgFilter ? { organizationId: orgFilter.organizationId } : {}),
        status: 'LATE',
      },
    });

    return count;
  }

  /**
   * Get the most recent submission timestamp for a user.
   * 
   * @param userId - User ID
   * @param userOrganizationId - User's organization ID (for tenant isolation)
   */
  async lastSubmittedAt(userId: string, userOrganizationId: string | null | undefined): Promise<Date | null> {
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    
    if (!orgFilter && userOrganizationId !== null) {
      return null;
    }

    const latestResponse = await this.prisma.checkInResponse.findFirst({
      where: {
        targetUserId: userId,
        request: {
          ...(orgFilter ? { organizationId: orgFilter.organizationId } : {}),
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
      select: {
        submittedAt: true,
      },
    });

    return latestResponse?.submittedAt || null;
  }

  /**
   * Get rollup of check-in responses for a team/cycle.
   * 
   * Returns all responses for team members in the last N days, grouped by user.
   * 
   * @param requesterUserId - Manager requesting the rollup
   * @param cycleId - Optional cycle ID to filter by
   * @param teamId - Optional team ID to filter by
   * @param daysBack - Number of days to look back (default: 14)
   * @param userOrganizationId - Requester's organization ID (for tenant isolation)
   */
  async getRollup(
    _requesterUserId: string,
    cycleId: string | undefined,
    teamId: string | undefined,
    daysBack: number = 14,
    userOrganizationId: string | null | undefined,
  ) {
    const orgFilter = OkrTenantGuard.buildTenantWhereClause(userOrganizationId);
    
    if (!orgFilter && userOrganizationId !== null) {
      // User has no org → return empty array
      return [];
    }

    // TODO [phase7-hardening]: Verify requester is manager of the team or has appropriate permissions

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Build where clause for requests
    const where: any = {
      organizationId: orgFilter?.organizationId,
      status: 'SUBMITTED',
      response: {
        submittedAt: {
          gte: cutoffDate,
        },
      },
    };

    // Filter by cycle if provided (requests linked to cycle via organization/team context)
    // TODO [phase7-hardening]: Add cycleId to CheckInRequest model or link via team/workspace context
    if (cycleId) {
      // For now, we'll filter by responses submitted during the cycle period
      const cycle = await this.prisma.cycle.findUnique({
        where: { id: cycleId },
        select: { startDate: true, endDate: true, organizationId: true },
      });

      if (cycle && cycle.organizationId === orgFilter?.organizationId) {
        where.response = {
          ...where.response,
          submittedAt: {
            gte: cycle.startDate,
            lte: cycle.endDate,
          },
        };
      }
    }

    // Filter by team if provided
    let teamUserIds: string[] = [];
    if (teamId) {
      // Get team members
      const teamMembers = await this.prisma.teamMember.findMany({
        where: { teamId },
        select: { userId: true },
      });

      teamUserIds = teamMembers.map((tm) => tm.userId);
      where.targetUserId = { in: teamUserIds };
    }

    // Fetch submitted requests with responses
    const requests = await this.prisma.checkInRequest.findMany({
      where,
      include: {
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        response: true,
      },
      orderBy: {
        response: {
          submittedAt: 'desc',
        },
      },
    });

    // Group by user
    const rollupByUser = new Map<string, Array<typeof requests[0]>>();
    
    requests.forEach((request: any) => {
      const userId = request.targetUserId;
      if (!rollupByUser.has(userId)) {
        rollupByUser.set(userId, []);
      }
      rollupByUser.get(userId)!.push(request);
    });

    // Get all requests (including LATE) for overdue count
    const allRequests = await this.prisma.checkInRequest.findMany({
      where: {
        organizationId: orgFilter?.organizationId,
        ...(teamId && teamUserIds.length > 0 ? {
          targetUserId: { in: teamUserIds },
        } : {}),
      },
      select: {
        targetUserId: true,
        status: true,
      },
    });

    // Group overdue counts by user
    const overdueCountsByUser = new Map<string, number>();
    allRequests.forEach((req: any) => {
      if (req.status === 'LATE') {
        overdueCountsByUser.set(req.targetUserId, (overdueCountsByUser.get(req.targetUserId) || 0) + 1);
      }
    });

    // Get last submitted dates for each user
    const lastSubmittedByUser = new Map<string, Date | null>();
    for (const userId of Array.from(rollupByUser.keys())) {
      const latestResponse = await this.prisma.checkInResponse.findFirst({
        where: {
          targetUserId: userId,
          request: {
            ...(orgFilter ? { organizationId: orgFilter.organizationId } : {}),
          },
        },
        orderBy: {
          submittedAt: 'desc',
        },
        select: {
          submittedAt: true,
        },
      });
      lastSubmittedByUser.set(userId, latestResponse?.submittedAt || null);
    }

    // Transform to response format
    const result = Array.from(rollupByUser.entries()).map(([userId, userRequests]) => {
      const user = userRequests[0].targetUser;
      const responses = userRequests
        .filter((r) => r.response)
        .map((r) => ({
          id: r.id,
          requestId: r.id,
          submittedAt: r.response!.submittedAt,
          summaryWhatMoved: r.response!.summaryWhatMoved,
          summaryBlocked: r.response!.summaryBlocked,
          summaryNeedHelp: r.response!.summaryNeedHelp,
          dueAt: r.dueAt,
        }));

      const requestsOverdue = overdueCountsByUser.get(userId) || 0;
      const lastSubmittedAt = lastSubmittedByUser.get(userId) || null;
      const blockerCount = responses.filter((r) => r.summaryBlocked && r.summaryBlocked.trim().length > 0).length;
      const needHelpCount = responses.filter((r) => r.summaryNeedHelp && r.summaryNeedHelp.trim().length > 0).length;

      return {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        responses,
        hasBlockers: blockerCount > 0,
        needsHelp: needHelpCount > 0,
        requestsOverdue,
        lastSubmittedAt,
      };
    });

    // Sort order:
    // 1. requestsOverdue > 0
    // 2. blocker/needHelp count
    // 3. user name alphabetically
    // TODO [phase7-hardening]: refine sort priority once we have team-critical flags
    result.sort((a, b) => {
      // Primary: overdue requests
      if (a.requestsOverdue > 0 && b.requestsOverdue === 0) return -1;
      if (a.requestsOverdue === 0 && b.requestsOverdue > 0) return 1;
      
      // Secondary: blocker/needHelp count
      const aRiskCount = (a.hasBlockers ? 1 : 0) + (a.needsHelp ? 1 : 0);
      const bRiskCount = (b.hasBlockers ? 1 : 0) + (b.needsHelp ? 1 : 0);
      if (aRiskCount > bRiskCount) return -1;
      if (aRiskCount < bRiskCount) return 1;
      
      // Tertiary: alphabetical by name
      return a.userName.localeCompare(b.userName);
    });

    return result;
  }
}


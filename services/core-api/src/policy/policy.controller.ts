/**
 * Policy Controller
 * 
 * Read-only endpoint for Superuser Policy Decision Explorer.
 * Allows inspecting live permission decisions via AuthorisationService.
 */

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../rbac/rbac.guard';
import { AuthorisationService } from '../authorisation.service';
import { RBACService } from '../rbac/rbac.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SuperuserService } from '../superuser/superuser.service';
import { Action, ResourceContext } from '../rbac/types';
import { recordDeny } from '../rbac/rbac.telemetry';

interface DecideRequestDto {
  userId?: string;
  action: Action;
  resource?: {
    tenantId?: string;
    workspaceId?: string;
    teamId?: string;
    objectiveId?: string;
    keyResultId?: string;
    cycleId?: string;
  };
  context?: Record<string, any>;
}

interface DecideResponseDto {
  allow: boolean;
  reason: 'ALLOW' | 'ROLE_DENY' | 'TENANT_BOUNDARY' | 'PRIVATE_VISIBILITY' | 'PUBLISH_LOCK' | 'SUPERUSER_READ_ONLY';
  details: {
    userRoles: string[];
    scopes: {
      tenantIds: string[];
      workspaceIds: string[];
      teamIds: string[];
    };
    resourceCtxEcho: ResourceContext;
    ruleMatched?: string;
  };
  meta: {
    requestUserId: string;
    evaluatedUserId: string;
    action: Action;
    timestamp: string;
  };
}

@ApiTags('Policy')
@Controller('policy')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PolicyController {
  private readonly inspectorEnabled = process.env.RBAC_INSPECTOR === 'true';

  constructor(
    private authorisationService: AuthorisationService,
    private rbacService: RBACService,
    private prisma: PrismaService,
    private superuserService: SuperuserService,
  ) {}

  @Post('decide')
  @ApiOperation({ 
    summary: 'Policy Decision Explorer (Superuser only)',
    description: 'Read-only endpoint to inspect live permission decisions. Requires SUPERUSER role and RBAC_INSPECTOR flag enabled.',
  })
  async decide(@Body() body: DecideRequestDto, @Req() req: any): Promise<DecideResponseDto> {
    // Feature flag check
    if (!this.inspectorEnabled) {
      throw new NotFoundException('Policy Decision Explorer is not enabled');
    }

    // Superuser check
    const isSuperuser = await this.superuserService.isSuperuser(req.user.id);
    if (!isSuperuser) {
      throw new ForbiddenException('Only superusers can access the Policy Decision Explorer');
    }

    // Resolve target user
    const targetUserId = body.userId || req.user.id;

    // Build user context (no cache for freshness)
    const userContext = await this.rbacService.buildUserContext(targetUserId, false);

    // Build resource context from request
    const resourceContext: ResourceContext = {
      tenantId: body.resource?.tenantId || '',
      workspaceId: body.resource?.workspaceId || null,
      teamId: body.resource?.teamId || null,
    };

    // If objectiveId or keyResultId provided, try to load OKR entity
    if (body.resource?.objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: body.resource.objectiveId },
        select: {
          id: true,
          ownerId: true,
          organizationId: true,
          tenantId: true,
          workspaceId: true,
          teamId: true,
          visibilityLevel: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (objective) {
        resourceContext.okr = {
          id: objective.id,
          ownerId: objective.ownerId,
          organizationId: objective.organizationId,
          tenantId: objective.tenantId || objective.organizationId,
          workspaceId: objective.workspaceId,
          teamId: objective.teamId,
          visibilityLevel: objective.visibilityLevel as any,
          isPublished: objective.isPublished || false,
          createdAt: objective.createdAt,
          updatedAt: objective.updatedAt,
        };
        resourceContext.tenantId = objective.organizationId;
      }
    } else if (body.resource?.keyResultId) {
      const keyResult = await this.prisma.keyResult.findUnique({
        where: { id: body.resource.keyResultId },
        include: {
          objective: {
            select: {
              id: true,
              ownerId: true,
              organizationId: true,
              tenantId: true,
              workspaceId: true,
              teamId: true,
              visibilityLevel: true,
              isPublished: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (keyResult?.objective) {
        const objective = keyResult.objective;
        resourceContext.okr = {
          id: keyResult.id,
          ownerId: objective.ownerId,
          organizationId: objective.organizationId,
          tenantId: objective.tenantId || objective.organizationId,
          workspaceId: objective.workspaceId,
          teamId: objective.teamId,
          visibilityLevel: objective.visibilityLevel as any,
          isPublished: objective.isPublished || false,
          createdAt: objective.createdAt,
          updatedAt: objective.updatedAt,
        };
        resourceContext.tenantId = objective.organizationId;
      }
    }

    // Get user's organisation ID for tenant boundary checks (use target user's org if evaluating different user)
    const requestUserOrgId = req.user.organizationId || null;
    
    // For tenant boundary checks, use the evaluated user's organisation
    // If evaluating a different user, we need their org ID
    let evaluatedUserOrgId = requestUserOrgId;
    if (targetUserId !== req.user.id) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, isSuperuser: true },
      });
      
      if (targetUser?.isSuperuser) {
        evaluatedUserOrgId = null;
      } else {
        // Get target user's primary organisation
        const targetOrgAssignment = await this.prisma.roleAssignment.findFirst({
          where: {
            userId: targetUserId,
            scopeType: 'TENANT',
          },
          select: { scopeId: true },
          orderBy: { createdAt: 'asc' },
        });
        evaluatedUserOrgId = targetOrgAssignment?.scopeId || undefined;
      }
    }

    // Call authorisation service
    const decision = await this.authorisationService.can(
      userContext,
      body.action,
      resourceContext,
      evaluatedUserOrgId,
    );

    // Build response with details
    const tenantRoles = resourceContext.tenantId
      ? Array.from(userContext.tenantRoles.get(resourceContext.tenantId) || [])
      : [];
    const allTenantRoles = Array.from(userContext.tenantRoles.values()).flat();
    const allWorkspaceRoles = Array.from(userContext.workspaceRoles.values()).flat();
    const allTeamRoles = Array.from(userContext.teamRoles.values()).flat();

    const response: DecideResponseDto = {
      allow: decision.allow,
      reason: decision.reason,
      details: {
        userRoles: [
          ...(userContext.isSuperuser ? ['SUPERUSER'] : []),
          ...allTenantRoles,
          ...allWorkspaceRoles,
          ...allTeamRoles,
        ],
        scopes: {
          tenantIds: Array.from(userContext.tenantRoles.keys()),
          workspaceIds: Array.from(userContext.workspaceRoles.keys()),
          teamIds: Array.from(userContext.teamRoles.keys()),
        },
        resourceCtxEcho: resourceContext,
        ruleMatched: decision.allow ? 'ALLOW' : decision.reason,
      },
      meta: {
        requestUserId: req.user.id,
        evaluatedUserId: targetUserId,
        action: body.action,
        timestamp: new Date().toISOString(),
      },
    };

    // Record telemetry for deny events
    if (!decision.allow) {
      recordDeny({
        action: body.action,
        role: tenantRoles.length > 0 ? tenantRoles[0] : 'UNKNOWN',
        route: '/policy/decide',
        reasonCode: decision.reason,
        userId: targetUserId,
        tenantId: resourceContext.tenantId || undefined,
      });
    }

    return response;
  }
}


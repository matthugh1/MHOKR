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
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { AuthorisationService } from './authorisation.service';
import { RBACService } from '../modules/rbac/rbac.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SuperuserService } from '../modules/superuser/superuser.service';
import { Action, ResourceContext } from '../modules/rbac/types';
import { recordDeny } from '../modules/rbac/rbac.telemetry';

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

    // If no tenantId provided and user has tenant roles, use their primary tenant
    if (!resourceContext.tenantId && userContext.tenantRoles.size > 0) {
      const primaryTenantId = Array.from(userContext.tenantRoles.keys())[0];
      resourceContext.tenantId = primaryTenantId;
    }

    // If objectiveId or keyResultId provided, try to load OKR entity
    if (body.resource?.objectiveId) {
      const objective = await this.prisma.objective.findUnique({
        where: { id: body.resource.objectiveId },
        select: {
          id: true,
          ownerId: true,
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
        // Determine tenantId: use tenantId if present, otherwise look up from workspace/team
        let tenantId: string | null = objective.tenantId;
        if (!tenantId && objective.workspaceId) {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: objective.workspaceId },
            select: { tenantId: true },
          });
          tenantId = workspace?.tenantId || null;
        } else if (!tenantId && objective.teamId) {
          const team = await this.prisma.team.findUnique({
            where: { id: objective.teamId },
            include: { workspace: { select: { tenantId: true } } },
          });
          tenantId = team?.workspace?.tenantId || null;
        }

        // CRITICAL: If we still don't have a tenantId, we cannot proceed safely
        // This should never happen in production, but if it does, deny access
        if (!tenantId) {
          return {
            allow: false,
            reason: 'TENANT_BOUNDARY',
            details: {
              message: 'Resource has no tenant association. Cannot determine tenant boundary.',
              objectiveId: objective.id,
            },
            meta: {
              requestUserId: req.user.id,
              evaluatedUserId: targetUserId,
              action: body.action,
              timestamp: new Date().toISOString(),
            },
          } as any;
        }

        resourceContext.okr = {
          id: objective.id,
          ownerId: objective.ownerId,
          tenantId: tenantId!, // tenantId is guaranteed to be string after null check above
          workspaceId: objective.workspaceId,
          teamId: objective.teamId,
          visibilityLevel: objective.visibilityLevel as any,
          isPublished: objective.isPublished || false,
          createdAt: objective.createdAt,
          updatedAt: objective.updatedAt,
        };
        resourceContext.tenantId = tenantId!; // tenantId is guaranteed to be string after null check above
      }
    } else if (body.resource?.keyResultId) {
      // Find the objective that contains this key result via junction table
      const objectiveKeyResult = await this.prisma.objectiveKeyResult.findFirst({
        where: { keyResultId: body.resource.keyResultId },
        include: {
          objective: {
            select: {
              id: true,
              ownerId: true,
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

      if (objectiveKeyResult?.objective) {
        const objective = objectiveKeyResult.objective;
        
        // Determine tenantId: use tenantId if present, otherwise look up from workspace/team
        let tenantId: string | null = objective.tenantId;
        if (!tenantId && objective.workspaceId) {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: objective.workspaceId },
            select: { tenantId: true },
          });
          tenantId = workspace?.tenantId || null;
        } else if (!tenantId && objective.teamId) {
          const team = await this.prisma.team.findUnique({
            where: { id: objective.teamId },
            include: { workspace: { select: { tenantId: true } } },
          });
          tenantId = team?.workspace?.tenantId || null;
        }

        // CRITICAL: If we still don't have a tenantId, we cannot proceed safely
        if (!tenantId) {
          return {
            allow: false,
            reason: 'TENANT_BOUNDARY',
            details: {
              message: 'Resource has no tenant association. Cannot determine tenant boundary.',
              keyResultId: body.resource.keyResultId,
            },
            meta: {
              requestUserId: req.user.id,
              evaluatedUserId: targetUserId,
              action: body.action,
              timestamp: new Date().toISOString(),
            },
          } as any;
        }
        
        resourceContext.okr = {
          id: body.resource.keyResultId,
          ownerId: objective.ownerId,
          tenantId: tenantId!, // tenantId is guaranteed to be string after null check above
          workspaceId: objective.workspaceId,
          teamId: objective.teamId,
          visibilityLevel: objective.visibilityLevel as any,
          isPublished: objective.isPublished || false,
          createdAt: objective.createdAt,
          updatedAt: objective.updatedAt,
        };
        resourceContext.tenantId = tenantId!; // tenantId is guaranteed to be string after null check above
      }
    }

    // Get user's tenant ID for tenant boundary checks (use target user's tenant if evaluating different user)
    const requestUserTenantId = req.user.tenantId || null;
    
    // For tenant boundary checks, use the evaluated user's tenant
    // If evaluating a different user, we need their tenant ID
    let evaluatedUserTenantId = requestUserTenantId;
    if (targetUserId !== req.user.id) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, isSuperuser: true },
      });
      
      if (targetUser?.isSuperuser) {
        evaluatedUserTenantId = null;
      } else {
        // Get target user's primary tenant
        const targetTenantAssignment = await this.prisma.roleAssignment.findFirst({
          where: {
            userId: targetUserId,
            scopeType: 'TENANT',
          },
          select: { scopeId: true },
          orderBy: { createdAt: 'asc' },
        });
        evaluatedUserTenantId = targetTenantAssignment?.scopeId || undefined;
      }
    } else {
      // If evaluating same user and no tenantId provided, use their primary tenant
      if (!resourceContext.tenantId && userContext.tenantRoles.size > 0) {
        const primaryTenantId = Array.from(userContext.tenantRoles.keys())[0];
        resourceContext.tenantId = primaryTenantId;
        evaluatedUserTenantId = primaryTenantId;
      } else if (resourceContext.tenantId) {
        evaluatedUserTenantId = resourceContext.tenantId;
      }
    }

    // Call authorisation service
    const decision = await this.authorisationService.can(
      userContext,
      body.action,
      resourceContext,
      evaluatedUserTenantId,
    );

    // Build response with details
    const tenantRoles = resourceContext.tenantId
      ? Array.from(userContext.tenantRoles.get(resourceContext.tenantId) || [])
      : [];
    const allTenantRoles = Array.from(new Set(Array.from(userContext.tenantRoles.values()).flat()));
    const allWorkspaceRoles = Array.from(new Set(Array.from(userContext.workspaceRoles.values()).flat()));
    const allTeamRoles = Array.from(new Set(Array.from(userContext.teamRoles.values()).flat()));

    const response: DecideResponseDto = {
      allow: decision.allow,
      reason: decision.reason,
      details: {
        userRoles: [
          ...(userContext.isSuperuser ? ['SUPERUSER'] : []),
          ...allTenantRoles.map(r => String(r)),
          ...allWorkspaceRoles.map(r => String(r)),
          ...allTeamRoles.map(r => String(r)),
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


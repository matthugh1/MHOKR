import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { canViewOKR } from '../rbac/visibilityPolicy';

/**
 * OKR Visibility Service
 * 
 * Server-side visibility enforcement for OKRs.
 * This service determines which objectives and key results a user can see
 * based on visibility levels, roles, and whitelists.
 * 
 * This is the backend equivalent of the frontend canSeeObjective() logic.
 */
@Injectable()
export class OkrVisibilityService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
  ) {}

  /**
   * Check if a user can see an objective.
   * 
   * W4.M1: Taxonomy alignment - canonical visibility levels enforced.
   * 
   * Rules:
   * 1. Tenant isolation: if objective.tenantId !== requesterOrgId, return false immediately.
   * 2. SUPERUSER: may see everything.
   * 3. Owner rule: if objective.ownerUserId === requesterUserId, return true.
   * 4. PRIVATE visibility:
   *    - allow if requester is TENANT_OWNER/TENANT_ADMIN of that org,
   *    - allow if requester is explicitly whitelisted (privateWhitelist/execOnlyWhitelist),
   *    - allow if requester is owner,
   *    - otherwise false.
   * 5. All other visibility levels (PUBLIC_TENANT, EXEC_ONLY, etc.): allow true.
   *    - Deprecated values (WORKSPACE_ONLY, TEAM_ONLY, MANAGER_CHAIN, EXEC_ONLY) 
   *      are normalized to PUBLIC_TENANT in migration and treated as globally visible.
   * 6. Default deny.
   * 
   * @param params - { objective, requesterUserId, requesterOrgId }
   * @returns true if user can see the objective, false otherwise
   */
  async canUserSeeObjective(params: {
    objective: {
      id: string;
      ownerId: string;
      tenantId: string;
      visibilityLevel: string;
    };
    requesterUserId: string;
    requesterOrgId: string | null;
  }): Promise<boolean> {
    const { objective, requesterUserId, requesterOrgId } = params;

    // Tenant isolation: if objective.tenantId !== requesterOrgId, deny
    // Exception: SUPERUSER (requesterOrgId === null) can see everything
    if (requesterOrgId !== null && objective.tenantId !== requesterOrgId) {
      return false;
    }

    // Build user context for visibility checks
    const userContext = await this.rbacService.buildUserContext(requesterUserId);

    // SUPERUSER: may see everything
    if (userContext.isSuperuser) {
      return true;
    }

    // Owner rule: if objective.ownerId === requesterUserId, return true
    if (objective.ownerId === requesterUserId) {
      return true;
    }

    // Fetch organization to get whitelist configuration
    const organization = await this.prisma.organization.findUnique({
      where: { id: objective.tenantId },
      select: {
        id: true,
        execOnlyWhitelist: true,
        metadata: true,
      },
    });

    // Build tenant object for visibility policy
    const tenant = organization ? {
      id: organization.id,
      name: '',
      slug: '',
      execOnlyWhitelist: organization.execOnlyWhitelist as string[] | null | undefined,
      metadata: organization.metadata as Record<string, any> | null | undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    } : undefined;

    // Use visibility policy to check access
    const okrEntity = {
      id: objective.id,
      ownerId: objective.ownerId,
      tenantId: objective.tenantId,
      visibilityLevel: objective.visibilityLevel as any,
      isPublished: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return canViewOKR(userContext, okrEntity, tenant);
  }

  /**
   * Check if a user can see a key result.
   * 
   * Key Results inherit visibility from their parent objective.
   * 
   * @param params - { keyResult, parentObjective, requesterUserId, requesterOrgId }
   * @returns true if user can see the key result, false otherwise
   */
  async canUserSeeKeyResult(params: {
    keyResult: {
      id: string;
      ownerId: string;
    };
    parentObjective: {
      id: string;
      ownerId: string;
      tenantId: string;
      visibilityLevel: string;
    };
    requesterUserId: string;
    requesterOrgId: string | null;
  }): Promise<boolean> {
    // Key Results inherit visibility from parent objective
    return this.canUserSeeObjective({
      objective: params.parentObjective,
      requesterUserId: params.requesterUserId,
      requesterOrgId: params.requesterOrgId,
    });
  }

  /**
   * Filter an array of objectives by visibility.
   * 
   * @param params - { objectives, requesterUserId, requesterOrgId }
   * @returns Array of objectives that are visible to the requester
   */
  async filterVisibleObjectives(params: {
    objectives: Array<{
      id: string;
      ownerId: string;
      tenantId: string;
      visibilityLevel: string;
    }>;
    requesterUserId: string;
    requesterOrgId: string | null;
  }): Promise<Array<{
    id: string;
    ownerId: string;
    tenantId: string;
    visibilityLevel: string;
  }>> {
    const { objectives, requesterUserId, requesterOrgId } = params;

    const visibleObjectives = [];

    for (const objective of objectives) {
      const canSee = await this.canUserSeeObjective({
        objective,
        requesterUserId,
        requesterOrgId,
      });

      if (canSee) {
        visibleObjectives.push(objective);
      }
    }

    return visibleObjectives;
  }
}


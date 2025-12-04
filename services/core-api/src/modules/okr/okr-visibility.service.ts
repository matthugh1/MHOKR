import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { canViewOKR } from '../rbac/visibilityPolicy';

/**
 * Organization cache entry
 */
interface OrganizationCacheEntry {
  organization: {
    id: string;
    execOnlyWhitelist: string[] | null | undefined;
    metadata: Record<string, any> | null | undefined;
  };
  timestamp: number;
}

/**
 * In-memory cache for organizations
 * Cache key: tenantId
 * TTL: 10 minutes
 */
const organizationCache = new Map<string, OrganizationCacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Invalidate organization cache (exported function to avoid circular dependencies)
 * 
 * @param tenantId - Organization ID to invalidate (optional, if not provided clears all)
 */
export function invalidateOrganizationCache(tenantId?: string): void {
  if (tenantId) {
    organizationCache.delete(tenantId);
  } else {
    organizationCache.clear();
  }
}

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
  private readonly logger = new Logger(OkrVisibilityService.name);

  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
  ) {}

  /**
   * Get organization with caching
   * 
   * @param tenantId - Organization ID
   * @returns Organization data or null if not found
   */
  private async getOrganization(tenantId: string): Promise<{
    id: string;
    execOnlyWhitelist: string[] | null | undefined;
    metadata: Record<string, any> | null | undefined;
  } | null> {
    // Check cache first
    const cached = organizationCache.get(tenantId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.organization;
    }

    // Fetch from database
    const organization = await this.prisma.organization.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        execOnlyWhitelist: true,
        metadata: true,
      },
    });

    if (organization) {
      // Type cast Prisma JsonValue to expected types
      const orgData = {
        id: organization.id,
        execOnlyWhitelist: organization.execOnlyWhitelist as string[] | null | undefined,
        metadata: organization.metadata as Record<string, any> | null | undefined,
      };
      
      // Cache the result
      organizationCache.set(tenantId, {
        organization: orgData,
        timestamp: Date.now(),
      });
      
      return orgData;
    }

    return null;
  }

  /**
   * Batch fetch organizations for multiple tenant IDs
   * 
   * @param tenantIds - Array of organization IDs
   * @returns Map of tenantId -> organization data
   */
  async batchGetOrganizations(tenantIds: string[]): Promise<Map<string, {
    id: string;
    execOnlyWhitelist: string[] | null | undefined;
    metadata: Record<string, any> | null | undefined;
  } | null>> {
    const result = new Map<string, {
      id: string;
      execOnlyWhitelist: string[] | null | undefined;
      metadata: Record<string, any> | null | undefined;
    } | null>();

    // Check cache for all tenant IDs
    const uncachedIds: string[] = [];
    for (const tenantId of tenantIds) {
      const cached = organizationCache.get(tenantId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        result.set(tenantId, cached.organization);
      } else {
        uncachedIds.push(tenantId);
      }
    }

    // Fetch uncached organizations in batch
    if (uncachedIds.length > 0) {
      const organizations = await this.prisma.organization.findMany({
        where: { id: { in: uncachedIds } },
        select: {
          id: true,
          execOnlyWhitelist: true,
          metadata: true,
        },
      });

      // Cache and add to result
      for (const org of organizations) {
        // Type cast Prisma JsonValue to expected types
        const orgData = {
          id: org.id,
          execOnlyWhitelist: org.execOnlyWhitelist as string[] | null | undefined,
          metadata: org.metadata as Record<string, any> | null | undefined,
        };
        
        organizationCache.set(org.id, {
          organization: orgData,
          timestamp: Date.now(),
        });
        result.set(org.id, orgData);
      }

      // Set null for organizations not found
      for (const tenantId of uncachedIds) {
        if (!result.has(tenantId)) {
          result.set(tenantId, null);
        }
      }
    }

    return result;
  }

  /**
   * Invalidate organization cache
   * 
   * @param tenantId - Organization ID to invalidate (optional, if not provided clears all)
   */
  invalidateOrganizationCache(tenantId?: string): void {
    invalidateOrganizationCache(tenantId);
  }

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
    organization?: {
      id: string;
      execOnlyWhitelist: string[] | null | undefined;
      metadata: Record<string, any> | null | undefined;
    } | null;
    userContext?: any;
  }): Promise<boolean> {
    const { objective, requesterUserId, requesterOrgId, organization: providedOrg, userContext: providedUserContext } = params;

    // Tenant isolation: if objective.tenantId !== requesterOrgId, deny
    // Exception: SUPERUSER (requesterOrgId === null) can see everything
    if (requesterOrgId !== null && objective.tenantId !== requesterOrgId) {
      return false;
    }

    // Build user context for visibility checks (use provided if available)
    const userContext = providedUserContext || await this.rbacService.buildUserContext(requesterUserId);

    // SUPERUSER: may see everything
    if (userContext.isSuperuser) {
      return true;
    }

    // Owner rule: if objective.ownerId === requesterUserId, return true
    if (objective.ownerId === requesterUserId) {
      return true;
    }

    // Fetch organization to get whitelist configuration (use provided if available, otherwise fetch with caching)
    const organization = providedOrg !== undefined 
      ? providedOrg 
      : await this.getOrganization(objective.tenantId);

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
   * @param params - { keyResult, parentObjective, requesterUserId, requesterOrgId, organization, userContext }
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
    organization?: {
      id: string;
      execOnlyWhitelist: string[] | null | undefined;
      metadata: Record<string, any> | null | undefined;
    } | null;
    userContext?: any;
  }): Promise<boolean> {
    // Key Results inherit visibility from parent objective
    return this.canUserSeeObjective({
      objective: params.parentObjective,
      requesterUserId: params.requesterUserId,
      requesterOrgId: params.requesterOrgId,
      organization: params.organization,
      userContext: params.userContext,
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


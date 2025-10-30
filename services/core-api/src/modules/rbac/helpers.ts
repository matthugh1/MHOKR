/**
 * RBAC Helper Functions
 * 
 * Utility functions for common RBAC patterns and context building.
 */

import { PrismaService } from '../../common/prisma/prisma.service';
import { ResourceContext, OKREntity } from './types';

/**
 * Build resource context from OKR ID
 */
export async function buildResourceContextFromOKR(
  prisma: PrismaService,
  okrId: string,
): Promise<ResourceContext> {
  const objective = await prisma.objective.findUnique({
    where: { id: okrId },
    select: {
      id: true,
      organizationId: true,
      workspaceId: true,
      teamId: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
    },
  });

  if (!objective) {
    throw new Error(`OKR ${okrId} not found`);
  }

  const okr: OKREntity = {
    id: objective.id,
    ownerId: objective.ownerId,
    organizationId: objective.organizationId || '',  // Use organizationId, not tenantId
    tenantId: objective.organizationId || '',  // Keep tenantId for backward compatibility
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: objective.visibilityLevel as any,
    isPublished: objective.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Load tenant for config flags
  const tenant = objective.organizationId
    ? await prisma.organization.findUnique({
        where: { id: objective.organizationId },
        select: {
          id: true,
          name: true,
          slug: true,
          allowTenantAdminExecVisibility: true,
          execOnlyWhitelist: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    : null;

  return {
    tenantId: objective.organizationId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    okr,
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          allowTenantAdminExecVisibility: tenant.allowTenantAdminExecVisibility || false,
          execOnlyWhitelist: tenant.execOnlyWhitelist as string[] | null | undefined,
          metadata: tenant.metadata as Record<string, any> | null | undefined,
          createdAt: tenant.createdAt,
          updatedAt: tenant.updatedAt,
        }
      : undefined,
  };
}

/**
 * Build resource context from request parameters
 */
export function buildResourceContextFromRequest(request: any): ResourceContext {
  const params = request.params || {};
  const body = request.body || {};
  const query = request.query || {};

  const tenantId =
    params.tenantId ||
    params.organizationId ||
    body.tenantId ||
    body.organizationId ||
    query.tenantId ||
    query.organizationId;

  if (!tenantId) {
    throw new Error('tenantId is required in resource context');
  }

  return {
    tenantId,
    workspaceId: params.workspaceId || body.workspaceId || query.workspaceId || null,
    teamId: params.teamId || body.teamId || query.teamId || null,
  };
}

/**
 * Build resource context from Key Result ID
 */
export async function buildResourceContextFromKeyResult(
  prisma: PrismaService,
  keyResultId: string,
): Promise<ResourceContext> {
  const keyResult = await prisma.keyResult.findUnique({
    where: { id: keyResultId },
    select: {
      id: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
      objectives: {
        select: {
          objective: {
            select: {
              id: true,
              organizationId: true,
              workspaceId: true,
              teamId: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!keyResult || keyResult.objectives.length === 0) {
    throw new Error(`Key Result ${keyResultId} not found or has no linked objective`);
  }

  const objective = keyResult.objectives[0].objective;

  const okr: OKREntity = {
    id: keyResult.id,
    ownerId: keyResult.ownerId,
    organizationId: objective.organizationId || '',  // Use organizationId, not tenantId
    tenantId: objective.organizationId || '',  // Keep tenantId for backward compatibility
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: keyResult.visibilityLevel as any,
    isPublished: keyResult.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    tenantId: objective.organizationId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    okr,
  };
}

/**
 * Extract tenant ID from various sources
 */
export function extractTenantId(request: any): string {
  const params = request.params || {};
  const body = request.body || {};
  const query = request.query || {};

  return (
    params.tenantId ||
    params.organizationId ||
    body.tenantId ||
    body.organizationId ||
    query.tenantId ||
    ''
  );
}

/**
 * Extract workspace ID from various sources
 */
export function extractWorkspaceId(request: any): string | null {
  const params = request.params || {};
  const body = request.body || {};
  const query = request.query || {};

  return params.workspaceId || body.workspaceId || query.workspaceId || null;
}

/**
 * Extract team ID from various sources
 */
export function extractTeamId(request: any): string | null {
  const params = request.params || {};
  const body = request.body || {};
  const query = request.query || {};

  return params.teamId || body.teamId || query.teamId || null;
}


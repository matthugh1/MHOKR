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
      tenantId: true,
      workspaceId: true,
      teamId: true,
      ownerId: true,
      visibilityLevel: true,
      isPublished: true,
      owners: {
        select: {
          userId: true,
        },
      },
    },
  });

  if (!objective) {
    throw new Error(`OKR ${okrId} not found`);
  }

  // Collect all owner IDs (primary + additional owners)
  const allOwnerIds = new Set<string>([objective.ownerId]);
  objective.owners.forEach(owner => allOwnerIds.add(owner.userId));

  const okr: OKREntity & { allOwnerIds?: string[] } = {
    id: objective.id,
    ownerId: objective.ownerId,
    tenantId: objective.tenantId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: objective.visibilityLevel as any,
    isPublished: objective.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
    allOwnerIds: Array.from(allOwnerIds), // Store all owner IDs for permission checks
  };

  // Load tenant for config flags
  const tenant = objective.tenantId
    ? await prisma.organization.findUnique({
        where: { id: objective.tenantId },
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

  // Load workspace with owner if workspaceId exists
  const workspace = objective.workspaceId
    ? await prisma.workspace.findUnique({
        where: { id: objective.workspaceId },
        select: {
          id: true,
          name: true,
          tenantId: true,
          ownerId: true,
        },
      })
    : null;

  // Load team with owner if teamId exists
  const team = objective.teamId
    ? await prisma.team.findUnique({
        where: { id: objective.teamId },
        select: {
          id: true,
          name: true,
          workspaceId: true,
          ownerId: true,
        },
      })
    : null;

  return {
    tenantId: objective.tenantId || '',
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
    workspace: workspace || undefined,
    team: team || undefined,
  };
}

/**
 * Build resource context from request parameters
 */
export function buildResourceContextFromRequest(request: any): ResourceContext {
  const params = request.params || {};
  const body = request.body || {};
  const query = request.query || {};
  const url = request.url || '';
  const path = request.path || request.route?.path || url.split('?')[0] || '';

  // Check if this is an organization route where params.id is the tenantId
  // Check both URL and path to handle different request formats
  const isOrganizationRoute = 
    url.includes('/organizations/') || 
    url.startsWith('/organizations/') ||
    path.includes('/organizations/') ||
    path.startsWith('/organizations/') ||
    (request.route && request.route.path && request.route.path.includes('/organizations/'));

  // For organization routes, params.id is always the tenantId
  // Check this first before other sources
  let tenantId = params.tenantId;
  
  // If no explicit tenantId param, check if this is an organization route
  if (!tenantId && isOrganizationRoute && params.id) {
    tenantId = params.id;
  }
  
  // Fallback to body or query
  if (!tenantId) {
    tenantId = body.tenantId || query.tenantId;
  }

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
 * 
 * Key Results inherit their RBAC context from their parent Objective.
 * This function builds a ResourceContext using the parent Objective's data.
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
      owners: {
        select: {
          userId: true,
        },
      },
      objectives: {
        select: {
          objective: {
            select: {
              id: true,
              ownerId: true,
              tenantId: true,
              workspaceId: true,
              teamId: true,
              visibilityLevel: true,
              isPublished: true,
              owners: {
                select: {
                  userId: true,
                },
              },
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

  // Collect all owner IDs from both Key Result and Objective (Key Results inherit from Objectives)
  const allOwnerIds = new Set<string>([objective.ownerId, keyResult.ownerId]);
  objective.owners.forEach(owner => allOwnerIds.add(owner.userId));
  keyResult.owners.forEach(owner => allOwnerIds.add(owner.userId));

  // Use parent Objective's data for RBAC context (Key Results inherit from Objectives)
  const okr: OKREntity & { allOwnerIds?: string[] } = {
    id: objective.id, // Use Objective ID for RBAC checks
    ownerId: objective.ownerId,
    tenantId: objective.tenantId || '',
    workspaceId: objective.workspaceId,
    teamId: objective.teamId,
    visibilityLevel: objective.visibilityLevel as any,
    isPublished: objective.isPublished || false,
    createdAt: new Date(),
    updatedAt: new Date(),
    allOwnerIds: Array.from(allOwnerIds), // Store all owner IDs for permission checks
  };

  return {
    tenantId: objective.tenantId || '',
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
    params.tenantId ||
    body.tenantId ||
    body.tenantId ||
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


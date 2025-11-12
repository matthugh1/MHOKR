/**
 * Share Service
 * 
 * Manages share links for OKR objects (Objectives and Key Results).
 * Provides tenant-scoped read-only access with expiry.
 */

import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { RBACService } from '../rbac/rbac.service';
import { OkrVisibilityService } from '../okr/okr-visibility.service';
import { recordShareCreated, recordShareRevoked } from './share.telemetry';

export interface CreateShareLinkParams {
  entityType: 'OBJECTIVE' | 'KEY_RESULT';
  entityId: string;
  expiresAt: Date;
  note?: string;
  createdBy: string;
  tenantId: string | null; // null for superuser
}

export interface ShareLinkResponse {
  shareId: string;
  url: string;
  expiresAt: Date;
  note?: string;
}

@Injectable()
export class ShareService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    private rbacService: RBACService,
    private visibilityService: OkrVisibilityService,
  ) {}

  /**
   * Create a share link for an OKR object.
   * 
   * Security checks:
   * - User must be able to view the object (RBAC + visibility)
   * - User must be owner or tenant admin (for creating share links)
   * - Entity must belong to user's tenant
   * 
   * @param params - Share link creation parameters
   * @returns Share link with URL
   */
  async createShareLink(params: CreateShareLinkParams): Promise<ShareLinkResponse> {
    const { entityType, entityId, expiresAt, note, createdBy, tenantId } = params;

    // Validate expiry is in the future
    if (expiresAt <= new Date()) {
      throw new BadRequestException('Expiry date must be in the future');
    }

    // Fetch entity and verify it exists and belongs to tenant
    let entity: any;
    if (entityType === 'OBJECTIVE') {
      entity = await this.prisma.objective.findUnique({
        where: { id: entityId },
        select: {
          id: true,
          tenantId: true,
          ownerId: true,
          visibilityLevel: true,
        },
      });
    } else if (entityType === 'KEY_RESULT') {
      entity = await this.prisma.keyResult.findUnique({
        where: { id: entityId },
        include: {
          objectives: {
            select: {
              objective: {
                select: {
                  id: true,
                  tenantId: true,
                  ownerId: true,
                  visibilityLevel: true,
                },
              },
            },
            take: 1,
          },
        },
      });
    } else {
      throw new BadRequestException(`Invalid entity type: ${entityType}`);
    }

    if (!entity) {
      throw new NotFoundException(`${entityType} with ID ${entityId} not found`);
    }

    // Get tenant ID from entity (for superuser case where tenantId param might be null)
    const entityTenantId = entityType === 'KEY_RESULT' 
      ? entity.objectives?.[0]?.objective?.tenantId || entity.tenantId
      : entity.tenantId;

    if (!entityTenantId) {
      throw new BadRequestException('Entity does not have a tenant ID');
    }

    // If tenantId param is null (superuser), use entity's tenantId
    const effectiveTenantId = tenantId || entityTenantId;

    // Tenant isolation: verify entity belongs to tenant (unless superuser)
    if (effectiveTenantId !== entityTenantId) {
      throw new ForbiddenException('Entity does not belong to your tenant');
    }

    // Check if user can view the entity (RBAC + visibility)
    const canView = await this.visibilityService.canUserSeeObjective({
      objective: {
        id: entityType === 'OBJECTIVE' ? entity.id : entity.objectives[0].objective.id,
        ownerId: entityType === 'OBJECTIVE' ? entity.ownerId : entity.objectives[0].objective.ownerId,
        tenantId: entityTenantId,
        visibilityLevel: entityType === 'OBJECTIVE' ? entity.visibilityLevel : entity.objectives[0].objective.visibilityLevel,
      },
      requesterUserId: createdBy,
      requesterOrgId: effectiveTenantId,
    });

    if (!canView) {
      throw new ForbiddenException('You do not have permission to view this OKR');
    }

    // Check if user can create share links (owner or tenant admin)
    const isOwner = entityType === 'OBJECTIVE' 
      ? entity.ownerId === createdBy
      : entity.ownerId === createdBy;

    if (!isOwner) {
      // Check if user is tenant admin
      const userContext = await this.rbacService.buildUserContext(createdBy);
      const tenantRoles = userContext.tenantRoles.get(effectiveTenantId) || [];
      const isTenantAdmin = tenantRoles.some(r => r === 'TENANT_OWNER' || r === 'TENANT_ADMIN');
      
      if (!isTenantAdmin) {
        throw new ForbiddenException('Only owners and tenant administrators can create share links');
      }
    }

    // Create share link
    const shareLink = await this.prisma.shareLink.create({
      data: {
        entityType,
        entityId,
        tenantId: effectiveTenantId,
        createdBy,
        expiresAt,
        note: note || null,
      },
    });

    // Build share URL (frontend will handle routing)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const url = `${baseUrl}/share/${shareLink.id}`;

    // Record audit log
    await this.auditLogService.record({
      action: 'SHARE_CREATED',
      actorUserId: createdBy,
      targetId: shareLink.id,
      targetType: 'SHARE_LINK',
      tenantId: effectiveTenantId,
      metadata: {
        entityType,
        entityId,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // Record telemetry
    recordShareCreated({
      entityType,
      tenantId: effectiveTenantId,
      createdBy,
    });

    return {
      shareId: shareLink.id,
      url,
      expiresAt: shareLink.expiresAt,
      note: shareLink.note || undefined,
    };
  }

  /**
   * Revoke a share link.
   * 
   * Security checks:
   * - User must be creator or tenant admin
   * 
   * @param shareId - Share link ID
   * @param userId - User ID revoking the link
   * @param tenantId - User's tenant ID (null for superuser)
   */
  async revokeShareLink(shareId: string, userId: string, tenantId: string | null): Promise<void> {
    const shareLink = await this.prisma.shareLink.findUnique({
      where: { id: shareId },
    });

    if (!shareLink) {
      throw new NotFoundException(`Share link with ID ${shareId} not found`);
    }

    // Tenant isolation: verify share link belongs to tenant (unless superuser)
    if (tenantId && shareLink.tenantId !== tenantId) {
      throw new ForbiddenException('Share link does not belong to your tenant');
    }

    // Check if already revoked
    if (shareLink.revokedAt) {
      throw new BadRequestException('Share link is already revoked');
    }

    // Check if user can revoke (creator or tenant admin)
    const isCreator = shareLink.createdBy === userId;
    if (!isCreator) {
      const effectiveTenantId = tenantId || shareLink.tenantId;
      const userContext = await this.rbacService.buildUserContext(userId);
      const tenantRoles = userContext.tenantRoles.get(effectiveTenantId) || [];
      const isTenantAdmin = tenantRoles.some(r => r === 'TENANT_OWNER' || r === 'TENANT_ADMIN');
      
      if (!isTenantAdmin) {
        throw new ForbiddenException('Only creators and tenant administrators can revoke share links');
      }
    }

    // Revoke share link
    await this.prisma.shareLink.update({
      where: { id: shareId },
      data: {
        revokedAt: new Date(),
      },
    });

    // Record audit log
    await this.auditLogService.record({
      action: 'SHARE_REVOKED',
      actorUserId: userId,
      targetId: shareId,
      targetType: 'SHARE_LINK',
      tenantId: tenantId || shareLink.tenantId,
      metadata: {
        entityType: shareLink.entityType,
        entityId: shareLink.entityId,
      },
    });

    // Record telemetry
    recordShareRevoked({
      entityType: shareLink.entityType,
      tenantId: tenantId || shareLink.tenantId,
      revokedBy: userId,
    });
  }

  /**
   * Resolve a share link to its entity.
   * 
   * Security checks:
   * - Share link must exist
   * - Share link must not be expired
   * - Share link must not be revoked
   * - Requester must be in same tenant (for authenticated users)
   * 
   * @param shareId - Share link ID
   * @param requesterTenantId - Requester's tenant ID (null for public access)
   * @returns Entity data or null if not accessible
   */
  async resolveShareLink(shareId: string, requesterTenantId: string | null | undefined): Promise<{
    entityType: 'OBJECTIVE' | 'KEY_RESULT';
    entityId: string;
    entity: any;
  } | null> {
    const shareLink = await this.prisma.shareLink.findUnique({
      where: { id: shareId },
    });

    if (!shareLink) {
      return null;
    }

    // Check expiry
    if (shareLink.expiresAt < new Date()) {
      return null;
    }

    // Check revocation
    if (shareLink.revokedAt) {
      return null;
    }

    // Tenant isolation: if requester is authenticated, verify same tenant
    // If requesterTenantId is undefined/null, allow access (public share link)
    if (requesterTenantId !== undefined && requesterTenantId !== null) {
      if (shareLink.tenantId !== requesterTenantId) {
        return null;
      }
    }

    // Fetch entity
    let entity: any;
    if (shareLink.entityType === 'OBJECTIVE') {
      entity = await this.prisma.objective.findUnique({
        where: { id: shareLink.entityId },
        include: {
          keyResults: {
            include: {
              keyResult: {
                include: {
                  checkIns: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                  },
                },
              },
            },
          },
          initiatives: true,
          team: true,
          tenant: true,
          workspace: true,
          pillar: {
            select: {
              id: true,
              name: true,
              color: true,
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
      });
    } else if (shareLink.entityType === 'KEY_RESULT') {
      entity = await this.prisma.keyResult.findUnique({
        where: { id: shareLink.entityId },
        include: {
          objectives: {
            include: {
              objective: {
                include: {
                  keyResults: {
                    include: {
                      keyResult: true,
                    },
                  },
                  initiatives: true,
                  team: true,
                  tenant: true,
                  workspace: true,
                  owner: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          checkIns: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      });
    } else {
      return null;
    }

    if (!entity) {
      return null;
    }

    return {
      entityType: shareLink.entityType,
      entityId: shareLink.entityId,
      entity,
    };
  }
}


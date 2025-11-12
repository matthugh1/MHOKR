import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';
import { buildResourceContextFromOKR } from '../rbac/helpers';

/**
 * OKR Governance Service
 * 
 * Centralized service for publish lock, cycle lock, and future "propose change" workflow.
 * 
 * This centralises publish lock / cycle lock checks (currently duplicated in objective.service.ts and key-result.service.ts).
 * 
 * Responsibilities:
 * - Check publish lock (isPublished === true → only admins can edit/delete)
 * - Check cycle lock (cycle.status === LOCKED/ARCHIVED → only admins can edit/delete)
 * - Future: propose change workflow (instead of hard blocking)
 */
@Injectable()
export class OkrGovernanceService {
  constructor(
    private prisma: PrismaService,
    private rbacService: RBACService,
  ) {}

  /**
   * Check if publish lock prevents editing/deleting an objective.
   * 
   * Extracted from objective.service.ts:update() and delete()
   * 
   * Logic:
   * - If objective.state === 'PUBLISHED' or 'COMPLETED' or 'CANCELLED' or 'ARCHIVED':
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Check RBAC: require TENANT_OWNER or TENANT_ADMIN via rbacService.canPerformAction(userId, 'edit_okr', resourceContext)
   *   - Else throw ForbiddenException
   * - If state is DRAFT, no lock
   * 
   * @param params - { objective, actingUser, rbacService }
   * @throws ForbiddenException if locked and user cannot bypass
   */
  async checkPublishLockForObjective(params: {
    objective: { id: string; state?: string; isPublished?: boolean }; // Support both state and legacy isPublished
    actingUser: { id: string; tenantId: string | null };
    rbacService: RBACService;
  }): Promise<void> {
    const { objective, actingUser } = params;
    
    // Determine if published/locked: use state if available, fallback to isPublished for backward compatibility
    const isLocked = objective.state === 'PUBLISHED' || 
                     objective.state === 'COMPLETED' || 
                     objective.state === 'CANCELLED' || 
                     objective.state === 'ARCHIVED' ||
                     (objective.state === undefined && objective.isPublished === true);
    
    // If not published/locked, no lock
    if (!isLocked) {
      return;
    }

    // Superuser cannot edit even published OKRs (read-only)
    if (actingUser.tenantId === null) {
      throw new ForbiddenException('This OKR is published and can only be modified by admin roles');
    }

    // Check if user has elevated role (TENANT_OWNER or TENANT_ADMIN)
    const resourceContext = await buildResourceContextFromOKR(this.prisma, objective.id);
    const canEdit = await this.rbacService.canPerformAction(actingUser.id, 'edit_okr', resourceContext);

    if (!canEdit) {
      throw new ForbiddenException('This OKR is published and can only be modified by admin roles');
    }

    // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
  }

  /**
   * Check if publish lock prevents editing/deleting/checking-in a key result.
   * 
   * Extracted from key-result.service.ts:update(), delete(), and createCheckIn()
   * 
   * Logic:
   * - Checks parent Objective's state
   * - If parentObjective.state === 'PUBLISHED' or 'COMPLETED' or 'CANCELLED' or 'ARCHIVED':
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Check RBAC: require TENANT_OWNER or TENANT_ADMIN via rbacService.canPerformAction(userId, 'edit_okr', resourceContext)
   *   - Else throw ForbiddenException
   * - If state is DRAFT, no lock
   * 
   * @param params - { parentObjective, actingUser, rbacService }
   * @throws ForbiddenException if locked and user cannot bypass
   */
  async checkPublishLockForKeyResult(params: {
    parentObjective: { id: string; state?: string; isPublished?: boolean }; // Support both state and legacy isPublished
    actingUser: { id: string; tenantId: string | null };
    rbacService: RBACService;
  }): Promise<void> {
    const { parentObjective, actingUser } = params;

    // Determine if published/locked: use state if available, fallback to isPublished for backward compatibility
    const isLocked = parentObjective.state === 'PUBLISHED' || 
                     parentObjective.state === 'COMPLETED' || 
                     parentObjective.state === 'CANCELLED' || 
                     parentObjective.state === 'ARCHIVED' ||
                     (parentObjective.state === undefined && parentObjective.isPublished === true);

    // If parent objective not published/locked, no lock
    if (!isLocked) {
      return;
    }

    // Superuser cannot edit even if parent is published (read-only)
    if (actingUser.tenantId === null) {
      throw new ForbiddenException('This Key Result belongs to a published OKR and can only be modified by admin roles');
    }

    // Check if user has elevated role (TENANT_OWNER or TENANT_ADMIN)
    const resourceContext = await buildResourceContextFromOKR(this.prisma, parentObjective.id);
    const canEdit = await this.rbacService.canPerformAction(actingUser.id, 'edit_okr', resourceContext);

    if (!canEdit) {
      throw new ForbiddenException('This Key Result belongs to a published OKR and can only be modified by admin roles');
    }

    // TODO [phase7-hardening]: Future version will allow "propose change" workflow instead of hard blocking
  }

  /**
   * Check if cycle lock prevents editing/deleting an objective.
   * 
   * Extracted from objective.service.ts:checkCycleLock() (private → public)
   * 
   * Logic:
   * - If objective.cycle exists AND cycle.status === 'LOCKED' or 'ARCHIVED':
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Require TENANT_OWNER or TENANT_ADMIN for that org via rbacService.canPerformAction(userId, 'edit_okr', resourceContext)
   *   - Else throw ForbiddenException
   * - DRAFT and ACTIVE cycles allow normal edits
   * 
   * @param params - { objective, actingUser }
   * @throws ForbiddenException if locked and user cannot bypass
   */
  async checkCycleLockForObjective(params: {
    objective: { id: string };
    actingUser: { id: string; tenantId: string | null };
  }): Promise<void> {
    const { objective, actingUser } = params;

    // Load objective with cycle
    const objectiveWithCycle = await this.prisma.objective.findUnique({
      where: { id: objective.id },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            status: true,
            tenantId: true,
          },
        },
      },
    });

    // No cycle assigned, no lock
    if (!objectiveWithCycle?.cycle) {
      return;
    }

    const cycle = objectiveWithCycle.cycle;
    const cycleStatus = cycle.status;

    // DRAFT and ACTIVE cycles allow normal edits
    if (cycleStatus === 'DRAFT' || cycleStatus === 'ACTIVE') {
      return;
    }

    // LOCKED or ARCHIVED cycles require admin override
    if (cycleStatus === 'LOCKED' || cycleStatus === 'ARCHIVED') {
      // Superuser is read-only, cannot bypass cycle lock
      if (actingUser.tenantId === null) {
        throw new ForbiddenException(`This cycle (${cycle.name || 'locked'}) is locked and can only be modified by admin roles`);
      }

      // Check if user has TENANT_OWNER or TENANT_ADMIN role
      const resourceContext = await buildResourceContextFromOKR(this.prisma, objective.id);
      const canEdit = await this.rbacService.canPerformAction(actingUser.id, 'edit_okr', resourceContext);

      if (!canEdit) {
        throw new ForbiddenException(`This cycle (${cycle.name || 'locked'}) is locked and can only be modified by admin roles`);
      }

      // User has admin role, can bypass cycle lock
      return;
    }

    // Unknown status, default to not locked
    return;
  }

  /**
   * Check if cycle lock prevents editing/deleting/checking-in a key result.
   * 
   * Extracted from key-result.service.ts:checkCycleLockForKR() (private → public)
   * 
   * Logic:
   * - Checks cycle status through parent objective
   * - Same logic as checkCycleLockForObjective() but via parent objective
   * - If parent objective.cycle exists AND cycle.status === 'LOCKED' or 'ARCHIVED':
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Require TENANT_OWNER or TENANT_ADMIN for that org
   *   - Else throw ForbiddenException
   * - DRAFT and ACTIVE cycles allow normal edits
   * 
   * @param params - { parentObjective, actingUser }
   * @throws ForbiddenException if locked and user cannot bypass
   */
  async checkCycleLockForKeyResult(params: {
    parentObjective: { id: string };
    actingUser: { id: string; tenantId: string | null };
  }): Promise<void> {
    const { parentObjective, actingUser } = params;

    // Load parent objective with cycle
    const objectiveWithCycle = await this.prisma.objective.findUnique({
      where: { id: parentObjective.id },
      include: {
        cycle: {
          select: {
            id: true,
            name: true,
            status: true,
            tenantId: true,
          },
        },
      },
    });

    // No cycle assigned, no lock
    if (!objectiveWithCycle?.cycle) {
      return;
    }

    const cycle = objectiveWithCycle.cycle;
    const cycleStatus = cycle.status;

    // DRAFT and ACTIVE cycles allow normal edits
    if (cycleStatus === 'DRAFT' || cycleStatus === 'ACTIVE') {
      return;
    }

    // LOCKED or ARCHIVED cycles require admin override
    if (cycleStatus === 'LOCKED' || cycleStatus === 'ARCHIVED') {
      // Superuser is read-only, cannot bypass cycle lock
      if (actingUser.tenantId === null) {
        throw new ForbiddenException(`This cycle (${cycle.name || 'locked'}) is locked and can only be modified by admin roles`);
      }

      // Check if user has TENANT_OWNER or TENANT_ADMIN role via parent objective
      const resourceContext = await buildResourceContextFromOKR(this.prisma, parentObjective.id);
      const canEdit = await this.rbacService.canPerformAction(actingUser.id, 'edit_okr', resourceContext);

      if (!canEdit) {
        throw new ForbiddenException(`This cycle (${cycle.name || 'locked'}) is locked and can only be modified by admin roles`);
      }

      // User has admin role, can bypass cycle lock
      return;
    }

    // Unknown status, default to not locked
    return;
  }

  /**
   * Check all locks for an objective (cycle lock + publish lock).
   * 
   * Convenience method that calls both checkCycleLockForObjective() and checkPublishLockForObjective().
   * 
   * @param params - { objective, actingUser, rbacService }
   * @throws ForbiddenException if any lock prevents the operation
   */
  async checkAllLocksForObjective(params: {
    objective: { id: string; state?: string; isPublished?: boolean }; // Support both state and legacy isPublished
    actingUser: { id: string; tenantId: string | null };
    rbacService: RBACService;
  }): Promise<void> {
    // Check cycle lock first
    await this.checkCycleLockForObjective({
      objective: { id: params.objective.id },
      actingUser: params.actingUser,
    });

    // Then check publish lock
    await this.checkPublishLockForObjective(params);
  }

  /**
   * Check all locks for a key result (cycle lock + publish lock).
   * 
   * Convenience method that calls both checkCycleLockForKeyResult() and checkPublishLockForKeyResult().
   * 
   * @param params - { parentObjective, actingUser, rbacService }
   * @throws ForbiddenException if any lock prevents the operation
   */
  async checkAllLocksForKeyResult(params: {
    parentObjective: { id: string; state?: string; isPublished?: boolean }; // Support both state and legacy isPublished
    actingUser: { id: string; tenantId: string | null };
    rbacService: RBACService;
  }): Promise<void> {
    // Check cycle lock first
    await this.checkCycleLockForKeyResult({
      parentObjective: { id: params.parentObjective.id },
      actingUser: params.actingUser,
    });

    // Then check publish lock
    await this.checkPublishLockForKeyResult(params);
  }

  /**
   * Propose a change to a locked OKR (future workflow).
   * 
   * TODO [phase7-hardening]: Implement "propose change" workflow instead of hard blocking
   * 
   * @param params - Placeholder for future implementation
   * @returns Placeholder response
   */
  async proposeChange(_params: any): Promise<{ allowed: boolean }> {
    // TODO [phase7-hardening]: Future implementation
    return { allowed: false };
  }
}


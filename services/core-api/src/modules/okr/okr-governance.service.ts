import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';

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
 * 
 * TODO Phase 2: Move the following methods from ObjectiveService:
 * - checkCycleLock() (private → public)
 * 
 * TODO Phase 2: Move the following methods from KeyResultService:
 * - checkCycleLockForKR() (private → public)
 * 
 * TODO Phase 2: Extract publish lock logic from:
 * - ObjectiveService.update()
 * - ObjectiveService.delete()
 * - KeyResultService.update()
 * - KeyResultService.delete()
 * - KeyResultService.createCheckIn()
 */
@Injectable()
export class OkrGovernanceService {
  constructor(
    // @ts-expect-error Phase 2: Will be used when implementing lock checks
    private _prisma: PrismaService,
    // @ts-expect-error Phase 2: Will be used when implementing lock checks
    private _rbacService: RBACService,
  ) {}

  /**
   * Check if publish lock prevents editing/deleting an objective.
   * 
   * TODO Phase 2: Extract from objective.service.ts:update() lines 468-482
   * TODO Phase 2: Extract from objective.service.ts:delete() lines 598-612
   * 
   * Logic to copy:
   * - If objective.isPublished === true:
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Check RBAC: require TENANT_OWNER or TENANT_ADMIN via rbacService.canPerformAction(userId, 'edit_okr', resourceContext)
   *   - Else throw ForbiddenException
   * - If not published, no lock
   * 
   * @param objectiveId - The objective ID to check
   * @param userId - The user ID making the request
   * @throws ForbiddenException if locked and user cannot bypass
   */
  async checkPublishLock(_objectiveId: string, _userId: string): Promise<void> {
    // TODO Phase 2: Copy logic from objective.service.ts:update() lines 468-482
    // TODO Phase 2: Copy logic from objective.service.ts:delete() lines 598-612
    // - Load objective with isPublished flag
    // - If published, check RBAC for admin override using buildResourceContextFromOKR() and rbacService.canPerformAction()
    // - Use OkrTenantGuard.assertCanMutateTenant() for superuser check
    return Promise.resolve();
  }

  /**
   * Check if cycle lock prevents editing/deleting an objective.
   * 
   * TODO Phase 2: Move from objective.service.ts:checkCycleLock() lines 188-241 (private → public)
   * 
   * Logic to copy:
   * - If objective.cycle exists AND cycle.status === 'LOCKED' or 'ARCHIVED':
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Require TENANT_OWNER or TENANT_ADMIN for that org via rbacService.canPerformAction(userId, 'edit_okr', resourceContext)
   *   - Else throw ForbiddenException
   * - DRAFT and ACTIVE cycles allow normal edits
   * 
   * @param objectiveId - The objective ID to check
   * @throws ForbiddenException if locked and user cannot bypass
   */
  async checkCycleLock(_objectiveId: string): Promise<void> {
    // TODO Phase 2: Copy implementation from objective.service.ts:checkCycleLock() lines 188-241
    // - Load objective with cycle include
    // - Check cycle status (DRAFT/ACTIVE allow edits, LOCKED/ARCHIVED require admin)
    // - Use OkrTenantGuard.assertCanMutateTenant() for superuser check
    // - Use rbacService.canPerformAction() for admin override check
    return Promise.resolve();
  }

  /**
   * Check if cycle lock prevents editing/deleting a key result.
   * 
   * TODO Phase 2: Move from key-result.service.ts:checkCycleLockForKR() lines 267-331 (private → public)
   * 
   * Logic to copy:
   * - Checks cycle status through parent objective
   * - Same logic as checkCycleLock() but via parent objective
   * - If parent objective.cycle exists AND cycle.status === 'LOCKED' or 'ARCHIVED':
   *   - Superuser (userOrganizationId === null) => reject (read-only)
   *   - Require TENANT_OWNER or TENANT_ADMIN for that org
   *   - Else throw ForbiddenException
   * - DRAFT and ACTIVE cycles allow normal edits
   * 
   * @param keyResultId - The key result ID to check
   * @throws ForbiddenException if locked and user cannot bypass
   */
  async checkCycleLockForKR(_keyResultId: string): Promise<void> {
    // TODO Phase 2: Copy implementation from key-result.service.ts:checkCycleLockForKR() lines 267-331
    // - Load key result with parent objective and cycle (objectives[0].objective.cycle)
    // - Check cycle status via parent objective
    // - Use OkrTenantGuard.assertCanMutateTenant() for superuser check
    // - Use rbacService.canPerformAction() for admin override check
    return Promise.resolve();
  }
}


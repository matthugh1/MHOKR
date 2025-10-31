/**
 * OKR Tenant Guard Utility
 * 
 * Centralized utility for tenant isolation and superuser read-only rules.
 * 
 * Responsibilities:
 * - Build tenant isolation where clauses for Prisma queries
 * - Check if user can mutate (reject superuser, reject no-org)
 * - Assert tenant match between user and resource
 * 
 * Tenant Isolation Rules:
 * - userOrganizationId === null       → superuser (can READ all organisations; cannot write)
 * - userOrganizationId === string     → normal user (can read/write only within that organisation)
 * - userOrganizationId === undefined  → user with no organisation (cannot read or write tenant data)
 * 
 * TODO: Extract tenant isolation logic from:
 * - objective.service.ts:findAll() lines 17-32
 * - objective.service.ts:canEdit() lines 147-175
 * - objective.service.ts:canDelete() lines 247-275
 * - objective.service.ts:getOrgSummary() lines 663-682
 * - objective.service.ts:exportObjectivesCSV() lines 730-761
 * - objective.service.ts:getPillarsForOrg() lines 911-928
 * - objective.service.ts:getActiveCycleForOrg() lines 977-997
 * - objective.service.ts:getPillarCoverageForActiveCycle() lines 1033-1041
 * - objective.service.ts:getUserOwnedObjectives() lines 1126-1140
 * - key-result.service.ts:canEdit() lines 119-179
 * - key-result.service.ts:canDelete() lines 193-253
 * - key-result.service.ts:create() lines 345-379
 * - key-result.service.ts:update() lines 459-498
 * - key-result.service.ts:delete() lines 583-622
 * - key-result.service.ts:createCheckIn() lines 704-743
 * - key-result.service.ts:getRecentCheckInFeed() lines 841-854
 * - key-result.service.ts:getOverdueCheckIns() lines 928-951
 * - key-result.service.ts:getUserOwnedKeyResults() lines 1100-1121
 */

import { ForbiddenException } from '@nestjs/common';

/**
 * OKR Tenant Guard class with static helper methods.
 * 
 * Pure class with static helpers for tenant isolation checks, superuser read-only rules, and org match enforcement.
 * 
 * Centralizes tenant isolation logic extracted from ObjectiveService and KeyResultService.
 */
export class OkrTenantGuard {
  /**
   * Build Prisma where-filter for tenant isolation.
   * 
   * Pattern:
   * - Superuser (null): no org filter (returns all orgs)
   * - Normal user (string): filter by that org
   * - No org (undefined/falsy): return null (caller should return [])
   * 
   * @param userOrganizationId - null for superuser, string for normal user, undefined for no org
   * @returns Prisma where clause object with organizationId filter, or null if superuser (no filter) or no org (caller returns [])
   */
  static buildTenantWhereClause(userOrganizationId: string | null | undefined): { organizationId: string } | null {
    if (userOrganizationId === null) {
      // Superuser: no org filter, return all OKRs
      return null;
    } else if (userOrganizationId && userOrganizationId !== '') {
      // Normal user: filter by that org
      return { organizationId: userOrganizationId };
    } else {
      // User has no org or invalid org → return null (caller should return [])
      return null;
    }
  }

  /**
   * Ensure user can MUTATE a resource (not superuser read-only, has org).
   * 
   * Enforces:
   * - Superuser is read-only (cannot mutate)
   * - User must have an organization
   * 
   * @param userOrganizationId - User's organization ID (null for superuser, string for normal user, undefined for no org)
   * @throws ForbiddenException if user cannot mutate
   */
  static assertCanMutateTenant(userOrganizationId: string | null | undefined): void {
    // Superuser is read-only auditor (cannot mutate)
    if (userOrganizationId === null) {
      throw new ForbiddenException('Superusers are read-only; cannot modify resources.');
    }

    // Users without an organisation cannot mutate
    if (!userOrganizationId || userOrganizationId === '') {
      throw new ForbiddenException('You do not have permission to modify resources without an organization.');
    }
  }

  /**
   * Assert that user's organization matches the resource's organization.
   * 
   * Used for write operations to ensure tenant isolation.
   * 
   * @param resourceOrgId - Resource's organization ID
   * @param userOrgId - User's organization ID
   * @throws ForbiddenException if orgs don't match
   */
  static assertSameTenant(resourceOrgId: string | null | undefined, userOrgId: string | null | undefined): void {
    // If the resource has no organizationId, treat it as system/global data.
    // System/global resources are always read-only. No-one (including superusers) may edit them.
    // This is intentional. Changing this requires an explicit product decision.
    if (!resourceOrgId) {
      throw new ForbiddenException('System/global resources are immutable.');
    }

    // Verify tenant match: user's org must match resource's org
    if (resourceOrgId !== userOrgId) {
      throw new ForbiddenException('You do not have permission to modify resources outside your organization.');
    }
  }
}


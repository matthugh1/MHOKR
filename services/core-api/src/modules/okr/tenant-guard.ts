/**
 * OKR Tenant Guard Utility
 * 
 * Centralized utility for tenant isolation and superuser read-only rules.
 * 
 * Responsibilities:
 * - Build tenant isolation where clauses for Prisma queries
 * - Check if user can mutate (reject superuser, reject no-org)
 * - Assert tenant match between user and resource
 * - Log tenant isolation violations for monitoring
 * 
 * Tenant Isolation Rules:
 * - userOrganizationId === null       → superuser (can READ all organisations; cannot write)
 * - userOrganizationId === string     → normal user (can read/write only within that organisation)
 * - userOrganizationId === undefined  → user with no organisation (cannot read or write tenant data)
 */

import { ForbiddenException, Logger } from '@nestjs/common';

/**
 * OKR Tenant Guard class with static helper methods.
 * 
 * Pure class with static helpers for tenant isolation checks, superuser read-only rules, and org match enforcement.
 * 
 * Centralizes tenant isolation logic extracted from ObjectiveService and KeyResultService.
 */
export class OkrTenantGuard {
  private static readonly logger = new Logger(OkrTenantGuard.name);

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
  static assertCanMutateTenant(userOrganizationId: string | null | undefined, actorUserId?: string): void {
    // Superuser is read-only auditor (cannot mutate)
    if (userOrganizationId === null) {
      this.logTenantIsolationViolation('SUPERUSER_MUTATION', {
        userOrgId: null,
        actorUserId,
      });
      throw new ForbiddenException('Superusers are read-only; cannot modify resources.');
    }

    // Users without an organisation cannot mutate
    if (!userOrganizationId || userOrganizationId === '') {
      this.logTenantIsolationViolation('NO_ORG_MUTATION', {
        userOrgId: userOrganizationId,
        actorUserId,
      });
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
   * @param actorUserId - Optional: User ID for audit logging
   * @throws ForbiddenException if orgs don't match
   */
  static assertSameTenant(
    resourceOrgId: string | null | undefined,
    userOrgId: string | null | undefined,
    actorUserId?: string,
  ): void {
    // If the resource has no organizationId, treat it as system/global data.
    // System/global resources are always read-only. No-one (including superusers) may edit them.
    // This is intentional. Changing this requires an explicit product decision.
    if (!resourceOrgId) {
      throw new ForbiddenException('System/global resources are immutable.');
    }

    // Verify tenant match: user's org must match resource's org
    if (resourceOrgId !== userOrgId) {
      // Log tenant isolation violation attempt for monitoring
      this.logTenantIsolationViolation('CROSS_TENANT_ACCESS', {
        resourceOrgId,
        userOrgId,
        actorUserId,
      });

      throw new ForbiddenException('You do not have permission to modify resources outside your organization.');
    }
  }

  /**
   * Log tenant isolation violation attempt (for monitoring/alerting)
   * 
   * This is called when a tenant isolation violation is detected.
   * Can be extended to send alerts to monitoring systems.
   */
  static logTenantIsolationViolation(
    violationType: 'CROSS_TENANT_ACCESS' | 'SUPERUSER_MUTATION' | 'NO_ORG_MUTATION',
    metadata: {
      resourceOrgId?: string | null;
      userOrgId?: string | null | undefined;
      actorUserId?: string;
      resourceType?: string;
      resourceId?: string;
    },
  ): void {
    this.logger.warn(`[TENANT_ISOLATION_VIOLATION] ${violationType}`, {
      violationType,
      ...metadata,
      timestamp: new Date().toISOString(),
    });

    // TODO: Integrate with external monitoring/alerting service
    // Example: Send to Sentry, Datadog, CloudWatch, etc.
  }
}


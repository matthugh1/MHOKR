/**
 * OKR Tenant Guard Utility
 * 
 * Centralized utility for tenant isolation and superuser read-only rules.
 * 
 * Responsibilities:
 * - Build tenant isolation where clauses for Prisma queries
 * - Check if user can mutate (reject superuser, reject no-tenant)
 * - Assert tenant match between user and resource
 * - Log tenant isolation violations for monitoring
 * 
 * Tenant Isolation Rules:
 * - userTenantId === null       → superuser (can READ all tenants; cannot write)
 * - userTenantId === string     → normal user (can read/write only within that tenant)
 * - userTenantId === undefined  → user with no tenant (cannot read or write tenant data)
 */

import { ForbiddenException, Logger } from '@nestjs/common';

/**
 * OKR Tenant Guard class with static helper methods.
 * 
 * Pure class with static helpers for tenant isolation checks, superuser read-only rules, and tenant match enforcement.
 * 
 * Centralizes tenant isolation logic extracted from ObjectiveService and KeyResultService.
 */
export class OkrTenantGuard {
  private static readonly logger = new Logger(OkrTenantGuard.name);

  /**
   * Build Prisma where-filter for tenant isolation.
   * 
   * Pattern:
   * - Superuser (null): no tenant filter (returns all tenants)
   * - Normal user (string): filter by that tenant
   * - No tenant (undefined/falsy): return null (caller should return [])
   * 
   * @param userTenantId - null for superuser, string for normal user, undefined for no tenant
   * @returns Prisma where clause object with tenantId filter, or null if superuser (no filter) or no tenant (caller returns [])
   */
  static buildTenantWhereClause(userTenantId: string | null | undefined): { tenantId: string } | null {
    if (userTenantId === null) {
      // Superuser: no tenant filter, return all OKRs
      return null;
    } else if (userTenantId && userTenantId !== '') {
      // Normal user: filter by that tenant
      return { tenantId: userTenantId };
    } else {
      // User has no tenant or invalid tenant → return null (caller should return [])
      return null;
    }
  }

  /**
   * Ensure user can MUTATE a resource (not superuser read-only, has tenant).
   * 
   * Enforces:
   * - Superuser is read-only (cannot mutate)
   * - User must have a tenant
   * 
   * @param userTenantId - User's tenant ID (null for superuser, string for normal user, undefined for no tenant)
   * @throws ForbiddenException if user cannot mutate
   */
  static assertCanMutateTenant(userTenantId: string | null | undefined, actorUserId?: string): void {
    // Superuser is read-only auditor (cannot mutate)
    if (userTenantId === null) {
      this.logTenantIsolationViolation('SUPERUSER_MUTATION', {
        userTenantId: null,
        actorUserId,
      });
      throw new ForbiddenException('Superusers are read-only; cannot modify resources.');
    }

    // Users without a tenant cannot mutate
    if (!userTenantId || userTenantId === '') {
      this.logTenantIsolationViolation('NO_TENANT_MUTATION', {
        userTenantId: userTenantId,
        actorUserId,
      });
      throw new ForbiddenException('You do not have permission to modify resources without a tenant.');
    }
  }

  /**
   * Assert that user's tenant matches the resource's tenant.
   * 
   * Used for write operations to ensure tenant isolation.
   * 
   * @param resourceTenantId - Resource's tenant ID
   * @param userTenantId - User's tenant ID
   * @param actorUserId - Optional: User ID for audit logging
   * @throws ForbiddenException if tenants don't match
   */
  static assertSameTenant(
    resourceTenantId: string | null | undefined,
    userTenantId: string | null | undefined,
    actorUserId?: string,
  ): void {
    // If the resource has no tenantId, treat it as system/global data.
    // System/global resources are always read-only. No-one (including superusers) may edit them.
    // This is intentional. Changing this requires an explicit product decision.
    if (!resourceTenantId) {
      throw new ForbiddenException('System/global resources are immutable.');
    }

    // Verify tenant match: user's tenant must match resource's tenant
    if (resourceTenantId !== userTenantId) {
      // Log tenant isolation violation attempt for monitoring
      this.logTenantIsolationViolation('CROSS_TENANT_ACCESS', {
        resourceTenantId,
        userTenantId,
        actorUserId,
      });

      throw new ForbiddenException('You do not have permission to modify resources outside your tenant.');
    }
  }

  /**
   * Log tenant isolation violation attempt (for monitoring/alerting)
   * 
   * This is called when a tenant isolation violation is detected.
   * Can be extended to send alerts to monitoring systems.
   */
  static logTenantIsolationViolation(
    violationType: 'CROSS_TENANT_ACCESS' | 'SUPERUSER_MUTATION' | 'NO_TENANT_MUTATION',
    metadata: {
      resourceTenantId?: string | null;
      userTenantId?: string | null | undefined;
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


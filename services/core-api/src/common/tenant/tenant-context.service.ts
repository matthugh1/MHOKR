/**
 * Tenant Context Service
 * 
 * Centralized service for managing tenant context using AsyncLocalStorage.
 * This provides a clean way to access tenant context throughout the application
 * without passing it through every method call.
 * 
 * Usage:
 * - Set tenant context in guards/interceptors using run()
 * - Access tenant context anywhere using getOrganizationId()
 * - Automatically available to Prisma middleware
 */

import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string | null | undefined;
  userId?: string;
}

@Injectable()
export class TenantContextService {
  private readonly context = new AsyncLocalStorage<TenantContext>();

  /**
   * Run a function with tenant context
   * 
   * @param tenantId - User's tenant ID (null for SUPERUSER, string for normal user, undefined for no tenant)
   * @param userId - Optional: User ID for audit logging
   * @param fn - Function to run with tenant context
   * @returns Result of the function
   */
  run<T>(tenantId: string | null | undefined, fn: () => T, userId?: string): T {
    return this.context.run({ tenantId, userId }, fn);
  }

  /**
   * Get current tenant context
   * 
   * @returns Current tenant context or undefined if not set
   */
  getContext(): TenantContext | undefined {
    return this.context.getStore();
  }

  /**
   * Get current tenant ID from context
   * 
   * @returns Current tenant ID (null for SUPERUSER, string for normal user, undefined if not set)
   */
  getTenantId(): string | null | undefined {
    return this.context.getStore()?.tenantId;
  }

  /**
   * Get current organization ID from context (deprecated - use getTenantId)
   * 
   * @deprecated Use getTenantId() instead
   * @returns Current tenant ID (null for SUPERUSER, string for normal user, undefined if not set)
   */
  getOrganizationId(): string | null | undefined {
    return this.context.getStore()?.tenantId;
  }

  /**
   * Get current user ID from context
   * 
   * @returns Current user ID or undefined if not set
   */
  getUserId(): string | undefined {
    return this.context.getStore()?.userId;
  }

  /**
   * Check if current context is SUPERUSER
   * 
   * @returns true if tenantId is null (SUPERUSER)
   */
  isSuperuser(): boolean {
    return this.context.getStore()?.tenantId === null;
  }

  /**
   * Check if current context has a tenant
   * 
   * @returns true if tenantId is a string (normal user)
   */
  hasTenant(): boolean {
    const tenantId = this.context.getStore()?.tenantId;
    return typeof tenantId === 'string' && tenantId !== '';
  }
}



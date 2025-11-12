/**
 * Tenant Mutation Guard Tests
 * 
 * Tests tenant boundary enforcement for mutation operations.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TenantMutationGuard } from '../tenant-mutation.guard';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

describe('TenantMutationGuard', () => {
  let guard: TenantMutationGuard;
  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantMutationGuard],
    }).compile();

    guard = module.get<TenantMutationGuard>(TenantMutationGuard);
  });

  const createMockContext = (method: string, path: string, request: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  describe('mutation method detection', () => {
    it('should allow GET requests without tenant check', () => {
      const request = {
        method: 'GET',
        path: '/objectives',
        tenantId: undefined,
      };
      const context = createMockContext('GET', '/objectives', request);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should require tenant context for POST requests', () => {
      const request = {
        method: 'POST',
        path: '/objectives',
        tenantId: undefined,
      };
      const context = createMockContext('POST', '/objectives', request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should require tenant context for PATCH requests', () => {
      const request = {
        method: 'PATCH',
        path: '/objectives/:id',
        tenantId: undefined,
      };
      const context = createMockContext('PATCH', '/objectives/:id', request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should require tenant context for DELETE requests', () => {
      const request = {
        method: 'DELETE',
        path: '/objectives/:id',
        tenantId: undefined,
      };
      const context = createMockContext('DELETE', '/objectives/:id', request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('tenant boundary validation', () => {
    it('should allow mutation when tenantId matches payload tenantId', () => {
      const request = {
        method: 'POST',
        path: '/objectives',
        tenantId: 'tenant-123',
        body: { tenantId: 'tenant-123', title: 'Test' },
      };
      const context = createMockContext('POST', '/objectives', request);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow mutation when tenantId matches payload tenantId', () => {
      const request = {
        method: 'POST',
        path: '/objectives',
        tenantId: 'tenant-123',
        body: { tenantId: 'tenant-123', title: 'Test' },
      };
      const context = createMockContext('POST', '/objectives', request);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should reject mutation when tenantId mismatches payload tenantId', () => {
      const request = {
        method: 'POST',
        path: '/objectives',
        tenantId: 'tenant-123',
        body: { tenantId: 'tenant-456', title: 'Test' },
      };
      const context = createMockContext('POST', '/objectives', request);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      try {
        guard.canActivate(context);
      } catch (error: any) {
        expect(error.response.code).toBe('TENANT_BOUNDARY');
      }
    });

    it('should allow mutation when no tenantId in payload', () => {
      const request = {
        method: 'POST',
        path: '/objectives',
        tenantId: 'tenant-123',
        body: { title: 'Test' }, // No tenantId in payload
      };
      const context = createMockContext('POST', '/objectives', request);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('superuser handling', () => {
    it('should allow superuser mutations (but mutations blocked elsewhere)', () => {
      const request = {
        method: 'POST',
        path: '/objectives',
        tenantId: null,
        isSuperuser: true,
        body: { title: 'Test' },
      };
      const context = createMockContext('POST', '/objectives', request);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('public endpoint exclusion', () => {
    it('should allow POST to /auth/login without tenant check', () => {
      const request = {
        method: 'POST',
        path: '/auth/login',
        tenantId: undefined,
      };
      const context = createMockContext('POST', '/auth/login', request);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow GET to /system/status without tenant check', () => {
      const request = {
        method: 'GET',
        path: '/system/status',
        tenantId: undefined,
      };
      const context = createMockContext('GET', '/system/status', request);

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});


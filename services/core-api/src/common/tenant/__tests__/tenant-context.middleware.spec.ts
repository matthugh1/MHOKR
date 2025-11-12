/**
 * Tenant Context Middleware Tests
 * 
 * Tests tenant context resolution from multiple sources.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextMiddleware } from '../../common/tenant/tenant-context.middleware';
import { BadRequestException } from '@nestjs/common';

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantContextMiddleware],
    }).compile();

    middleware = module.get<TenantContextMiddleware>(TenantContextMiddleware);
    mockNext = jest.fn();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('tenantId resolution', () => {
    it('should resolve tenantId from JWT user.tenantId', () => {
      mockRequest = {
        user: { id: 'user-1', tenantId: 'tenant-123' },
        headers: {},
        path: '/objectives',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.tenantId).toBe('tenant-123');
      expect(mockRequest.isSuperuser).toBe(false);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should resolve tenantId from JWT user.tenantId', () => {
      mockRequest = {
        user: { id: 'user-1', tenantId: 'tenant-456' },
        headers: {},
        path: '/objectives',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.tenantId).toBe('tenant-456');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should resolve tenantId from x-tenant-id header', () => {
      mockRequest = {
        user: {},
        headers: { 'x-tenant-id': 'tenant-789' },
        path: '/objectives',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.tenantId).toBe('tenant-789');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should resolve tenantId from subdomain', () => {
      mockRequest = {
        user: {},
        headers: { host: 'tenant-abc.example.com' },
        path: '/objectives',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.tenantId).toBe('tenant-abc');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle superuser (null tenantId)', () => {
      mockRequest = {
        user: { id: 'user-1', tenantId: null },
        headers: {},
        path: '/objectives',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.tenantId).toBe(null);
      expect(mockRequest.isSuperuser).toBe(true);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing tenant context (undefined)', () => {
      mockRequest = {
        user: {},
        headers: {},
        path: '/objectives',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.tenantId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled(); // Doesn't throw - guard handles it
    });
  });

  describe('tenantId → tenantId normalisation', () => {
    it('should normalise tenantId to tenantId in request body', () => {
      mockRequest = {
        user: { id: 'user-1', tenantId: 'tenant-123' },
        body: { tenantId: 'tenant-123', name: 'Test' },
        headers: {},
        path: '/objectives',
        method: 'POST',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.body.tenantId).toBe('tenant-123');
      expect(mockRequest.body.tenantId).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should normalise tenantId to tenantId in request params', () => {
      mockRequest = {
        user: { id: 'user-1', tenantId: 'tenant-123' },
        params: { tenantId: 'tenant-123' },
        headers: {},
        path: '/workspaces/:tenantId',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.params.tenantId).toBe('tenant-123');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should normalise tenantId to tenantId in request query', () => {
      mockRequest = {
        user: { id: 'user-1', tenantId: 'tenant-123' },
        query: { tenantId: 'tenant-123' },
        headers: {},
        path: '/workspaces',
        method: 'GET',
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockRequest.query.tenantId).toBe('tenant-123');
      expect(mockNext).toHaveBeenCalled();
    });
  });
});


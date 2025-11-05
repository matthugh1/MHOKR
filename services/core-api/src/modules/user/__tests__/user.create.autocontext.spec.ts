/**
 * User Creation Auto-Context Tests
 * 
 * Tests for user creation with auto-detected tenant context and optional workspace.
 * Includes tests for dev inspector cross-tenant creation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { UserController } from '../user.controller';
import { UserService } from '../user.service';
import { RBACInspectorService } from '../../rbac/rbac-inspector.service';

describe('UserController - Auto-Context User Creation', () => {
  let controller: UserController;
  let userService: UserService;
  let rbacInspectorService: RBACInspectorService;

  const mockTenantOwner = {
    id: 'tenant-owner-id',
    email: 'owner@tenant.com',
    organizationId: 'tenant-a-id',
  };

  const mockSuperuser = {
    id: 'superuser-id',
    email: 'super@example.com',
    organizationId: null, // SUPERUSER has null organizationId
  };

  const mockTenantOwnerWithInspector = {
    id: 'tenant-owner-with-inspector-id',
    email: 'owner-inspector@tenant.com',
    organizationId: 'tenant-a-id',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: {
            createUser: jest.fn(),
          },
        },
        {
          provide: RBACInspectorService,
          useValue: {
            getInspectorEnabled: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);
    rbacInspectorService = module.get<RBACInspectorService>(RBACInspectorService);
  });

  describe('createUser - Auto-Context', () => {
    it('should auto-inject tenant from context when TENANT_OWNER creates user without organisationId', async () => {
      const req = { user: mockTenantOwner };
      const data = {
        email: 'newuser@tenant.com',
        name: 'New User',
        password: 'password123',
        role: 'MEMBER' as const,
      };

      const expectedPayload = {
        ...data,
        organizationId: 'tenant-a-id',
      };

      jest.spyOn(userService, 'createUser').mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@tenant.com',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await controller.createUser(data, req as any);

      expect(userService.createUser).toHaveBeenCalledWith(
        expectedPayload,
        'tenant-a-id',
        'tenant-owner-id',
      );
    });

    it('should auto-inject tenant from context when TENANT_OWNER creates user with optional workspaceId', async () => {
      const req = { user: mockTenantOwner };
      const data = {
        email: 'newuser@tenant.com',
        name: 'New User',
        password: 'password123',
        workspaceId: 'workspace-1',
        workspaceRole: 'MEMBER' as const,
        role: 'MEMBER' as const,
      };

      const expectedPayload = {
        ...data,
        organizationId: 'tenant-a-id',
      };

      jest.spyOn(userService, 'createUser').mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@tenant.com',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await controller.createUser(data, req as any);

      expect(userService.createUser).toHaveBeenCalledWith(
        expectedPayload,
        'tenant-a-id',
        'tenant-owner-id',
      );
    });

    it('should allow user creation without workspaceId', async () => {
      const req = { user: mockTenantOwner };
      const data = {
        email: 'newuser@tenant.com',
        name: 'New User',
        password: 'password123',
        role: 'MEMBER' as const,
      };

      jest.spyOn(userService, 'createUser').mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@tenant.com',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await controller.createUser(data, req as any);

      expect(userService.createUser).toHaveBeenCalled();
      const callArgs = (userService.createUser as jest.Mock).mock.calls[0][0];
      expect(callArgs.workspaceId).toBeUndefined();
    });

    it('should reject when no tenant context and no organisationId provided', async () => {
      const req = { user: { id: 'user-id', organizationId: undefined } };
      const data = {
        email: 'newuser@tenant.com',
        name: 'New User',
        password: 'password123',
        role: 'MEMBER' as const,
      };

      await expect(controller.createUser(data, req as any)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('createUser - Dev Inspector Cross-Tenant', () => {
    it('should allow SUPERUSER with dev inspector to create user in different tenant', async () => {
      const req = { user: mockSuperuser };
      const data = {
        email: 'newuser@tenantb.com',
        name: 'New User',
        password: 'password123',
        organizationId: 'tenant-b-id',
        role: 'MEMBER' as const,
      };

      jest.spyOn(rbacInspectorService, 'getInspectorEnabled').mockResolvedValue(true);
      jest.spyOn(userService, 'createUser').mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@tenantb.com',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await controller.createUser(data, req as any);

      expect(rbacInspectorService.getInspectorEnabled).toHaveBeenCalledWith('superuser-id');
      expect(userService.createUser).toHaveBeenCalledWith(
        data,
        null,
        'superuser-id',
      );
    });

    it('should reject SUPERUSER without dev inspector attempting cross-tenant creation', async () => {
      const req = { user: mockSuperuser };
      const data = {
        email: 'newuser@tenantb.com',
        name: 'New User',
        password: 'password123',
        organizationId: 'tenant-b-id',
        role: 'MEMBER' as const,
      };

      jest.spyOn(rbacInspectorService, 'getInspectorEnabled').mockResolvedValue(false);

      await expect(controller.createUser(data, req as any)).rejects.toThrow(
        ForbiddenException,
      );
      expect(rbacInspectorService.getInspectorEnabled).toHaveBeenCalledWith('superuser-id');
    });

    it('should require SUPERUSER to provide organisationId explicitly', async () => {
      const req = { user: mockSuperuser };
      const data = {
        email: 'newuser@tenant.com',
        name: 'New User',
        password: 'password123',
        role: 'MEMBER' as const,
      };

      await expect(controller.createUser(data, req as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject non-SUPERUSER attempting cross-tenant creation', async () => {
      const req = { user: mockTenantOwner };
      const data = {
        email: 'newuser@tenantb.com',
        name: 'New User',
        password: 'password123',
        organizationId: 'tenant-b-id',
        role: 'MEMBER' as const,
      };

      await expect(controller.createUser(data, req as any)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow same-tenant creation for non-SUPERUSER', async () => {
      const req = { user: mockTenantOwner };
      const data = {
        email: 'newuser@tenant.com',
        name: 'New User',
        password: 'password123',
        organizationId: 'tenant-a-id',
        role: 'MEMBER' as const,
      };

      jest.spyOn(userService, 'createUser').mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@tenant.com',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await controller.createUser(data, req as any);

      expect(userService.createUser).toHaveBeenCalledWith(
        data,
        'tenant-a-id',
        'tenant-owner-id',
      );
    });
  });

  describe('createUser - Workspace Validation', () => {
    it('should validate workspace belongs to same tenant when provided', async () => {
      const req = { user: mockTenantOwner };
      const data = {
        email: 'newuser@tenant.com',
        name: 'New User',
        password: 'password123',
        organizationId: 'tenant-a-id',
        workspaceId: 'workspace-1',
        workspaceRole: 'MEMBER' as const,
        role: 'MEMBER' as const,
      };

      jest.spyOn(userService, 'createUser').mockResolvedValue({
        id: 'new-user-id',
        email: 'newuser@tenant.com',
        name: 'New User',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await controller.createUser(data, req as any);

      expect(userService.createUser).toHaveBeenCalled();
    });
  });
});



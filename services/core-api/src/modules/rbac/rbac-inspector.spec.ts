/**
 * RBAC Inspector Toggle Tests
 * 
 * Tests for the RBAC Inspector toggle endpoint with tenant isolation and audit logging.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RBACInspectorController } from './rbac-inspector.controller';
import { RBACInspectorService } from './rbac-inspector.service';
import { RBACService } from './rbac.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';

describe('RBACInspectorController', () => {
  let controller: RBACInspectorController;
  let service: RBACInspectorService;
  let rbacService: RBACService;
  let prisma: PrismaService;
  let auditLogService: AuditLogService;

  const mockTenantAdmin = {
    id: 'tenant-admin-id',
    email: 'admin@tenant.com',
    organizationId: 'tenant-a-id',
    isSuperuser: false,
  };

  const mockWorkspaceLead = {
    id: 'workspace-lead-id',
    email: 'lead@tenant.com',
    organizationId: 'tenant-a-id',
    isSuperuser: false,
  };

  const mockTargetUser = {
    id: 'target-user-id',
    email: 'target@tenant.com',
    organizationId: 'tenant-a-id',
    settings: { debug: { rbacInspectorEnabled: false } },
  };

  const mockTargetUserCrossTenant = {
    id: 'target-user-b-id',
    email: 'target@tenantb.com',
    organizationId: 'tenant-b-id',
    settings: { debug: { rbacInspectorEnabled: false } },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RBACInspectorController],
      providers: [
        {
          provide: RBACInspectorService,
          useValue: {
            canManageUsers: jest.fn(),
            getUserTenantId: jest.fn(),
            setInspectorEnabled: jest.fn(),
          },
        },
        {
          provide: RBACService,
          useValue: {
            canPerformAction: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            roleAssignment: {
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            record: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RBACInspectorController>(RBACInspectorController);
    service = module.get<RBACInspectorService>(RBACInspectorService);
    rbacService = module.get<RBACService>(RBACService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  describe('toggleInspector', () => {
    it('should allow TENANT_ADMIN to toggle another user in same tenant', async () => {
      jest.spyOn(service, 'canManageUsers').mockResolvedValue(true);
      jest.spyOn(service, 'getUserTenantId').mockResolvedValue('tenant-a-id');
      jest.spyOn(service, 'setInspectorEnabled').mockResolvedValue();

      const req = { user: mockTenantAdmin };

      await expect(
        controller.toggleInspector(
          { userId: mockTargetUser.id, enabled: true },
          req as any,
        ),
      ).resolves.toEqual({ success: true, enabled: true });

      expect(service.setInspectorEnabled).toHaveBeenCalledWith(
        mockTargetUser.id,
        true,
        mockTenantAdmin.id,
        'tenant-a-id',
      );
    });

    it('should deny WORKSPACE_LEAD (no manage_users) from toggling', async () => {
      jest.spyOn(service, 'canManageUsers').mockResolvedValue(false);

      const req = { user: mockWorkspaceLead };

      await expect(
        controller.toggleInspector(
          { userId: mockTargetUser.id, enabled: true },
          req as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(service.setInspectorEnabled).not.toHaveBeenCalled();
    });

    it('should deny cross-tenant toggle', async () => {
      jest.spyOn(service, 'canManageUsers').mockResolvedValue(true);
      jest.spyOn(service, 'getUserTenantId').mockResolvedValue('tenant-b-id');

      const req = { user: mockTenantAdmin };

      await expect(
        controller.toggleInspector(
          { userId: mockTargetUserCrossTenant.id, enabled: true },
          req as any,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(service.setInspectorEnabled).not.toHaveBeenCalled();
    });

    it('should allow self-toggle if caller has manage_users', async () => {
      jest.spyOn(service, 'canManageUsers').mockResolvedValue(true);
      jest.spyOn(service, 'getUserTenantId').mockResolvedValue('tenant-a-id');
      jest.spyOn(service, 'setInspectorEnabled').mockResolvedValue();

      const req = { user: mockTenantAdmin };

      await expect(
        controller.toggleInspector(
          { userId: mockTenantAdmin.id, enabled: true },
          req as any,
        ),
      ).resolves.toEqual({ success: true, enabled: true });

      expect(service.setInspectorEnabled).toHaveBeenCalled();
    });

    it('should deny self-toggle if caller lacks manage_users', async () => {
      jest.spyOn(service, 'canManageUsers').mockResolvedValue(false);

      const req = { user: mockWorkspaceLead };

      await expect(
        controller.toggleInspector(
          { userId: mockWorkspaceLead.id, enabled: true },
          req as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});



/**
 * Share Service Unit Tests
 * 
 * Tests for share link creation, revocation, and resolution.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ShareService } from '../share.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { RBACService } from '../../rbac/rbac.service';
import { OkrVisibilityService } from '../../okr/okr-visibility.service';

describe('ShareService', () => {
  let service: ShareService;
  let prisma: PrismaService;
  let auditLogService: AuditLogService;
  let rbacService: RBACService;
  let visibilityService: OkrVisibilityService;

  const mockPrismaService = {
    shareLink: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    objective: {
      findUnique: jest.fn(),
    },
    keyResult: {
      findUnique: jest.fn(),
    },
  };

  const mockAuditLogService = {
    record: jest.fn(),
  };

  const mockRBACService = {
    buildUserContext: jest.fn(),
  };

  const mockVisibilityService = {
    canUserSeeObjective: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShareService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: RBACService, useValue: mockRBACService },
        { provide: OkrVisibilityService, useValue: mockVisibilityService },
      ],
    }).compile();

    service = module.get<ShareService>(ShareService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
    rbacService = module.get<RBACService>(RBACService);
    visibilityService = module.get<OkrVisibilityService>(OkrVisibilityService);

    jest.clearAllMocks();
  });

  describe('createShareLink', () => {
    const futureDate = new Date(Date.now() + 86400000); // Tomorrow
    const pastDate = new Date(Date.now() - 86400000); // Yesterday

    const validParams = {
      entityType: 'OBJECTIVE' as const,
      entityId: 'obj-1',
      expiresAt: futureDate,
      createdBy: 'user-1',
      tenantId: 'tenant-1',
    };

    beforeEach(() => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: 'obj-1',
        tenantId: 'tenant-1',
        ownerId: 'user-1',
        visibilityLevel: 'PUBLIC_TENANT',
      });
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(true);
      mockPrismaService.shareLink.create.mockResolvedValue({
        id: 'share-1',
        expiresAt: futureDate,
        note: null,
      });
    });

    it('should create a share link for an objective', async () => {
      const result = await service.createShareLink(validParams);

      expect(result).toHaveProperty('shareId', 'share-1');
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('expiresAt');
      expect(mockPrismaService.shareLink.create).toHaveBeenCalled();
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SHARE_CREATED',
          actorUserId: 'user-1',
        }),
      );
    });

    it('should reject expiry date in the past', async () => {
      await expect(
        service.createShareLink({ ...validParams, expiresAt: pastDate }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-existent entity', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue(null);

      await expect(service.createShareLink(validParams)).rejects.toThrow(NotFoundException);
    });

    it('should reject if user cannot view entity', async () => {
      mockVisibilityService.canUserSeeObjective.mockResolvedValue(false);

      await expect(service.createShareLink(validParams)).rejects.toThrow(ForbiddenException);
    });

    it('should reject if user is not owner or tenant admin', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: 'obj-1',
        tenantId: 'tenant-1',
        ownerId: 'user-2', // Different owner
        visibilityLevel: 'PUBLIC_TENANT',
      });
      mockRBACService.buildUserContext.mockResolvedValue({
        tenantRoles: new Map([['tenant-1', []]]), // No admin role
      });

      await expect(service.createShareLink(validParams)).rejects.toThrow(ForbiddenException);
    });

    it('should allow tenant admin to create share link', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: 'obj-1',
        tenantId: 'tenant-1',
        ownerId: 'user-2', // Different owner
        visibilityLevel: 'PUBLIC_TENANT',
      });
      mockRBACService.buildUserContext.mockResolvedValue({
        tenantRoles: new Map([['tenant-1', ['TENANT_ADMIN']]]),
      });

      const result = await service.createShareLink(validParams);
      expect(result).toHaveProperty('shareId');
    });

    it('should create share link for key result', async () => {
      mockPrismaService.keyResult.findUnique.mockResolvedValue({
        id: 'kr-1',
        tenantId: 'tenant-1',
        ownerId: 'user-1',
        objectives: [{
          objective: {
            id: 'obj-1',
            tenantId: 'tenant-1',
            ownerId: 'user-1',
            visibilityLevel: 'PUBLIC_TENANT',
          },
        }],
      });

      const result = await service.createShareLink({
        ...validParams,
        entityType: 'KEY_RESULT',
        entityId: 'kr-1',
      });

      expect(result).toHaveProperty('shareId');
      expect(mockPrismaService.shareLink.create).toHaveBeenCalled();
    });
  });

  describe('revokeShareLink', () => {
    const shareLink = {
      id: 'share-1',
      entityType: 'OBJECTIVE',
      entityId: 'obj-1',
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      revokedAt: null,
    };

    beforeEach(() => {
      mockPrismaService.shareLink.findUnique.mockResolvedValue(shareLink);
      mockPrismaService.shareLink.update.mockResolvedValue({
        ...shareLink,
        revokedAt: new Date(),
      });
    });

    it('should revoke a share link', async () => {
      await service.revokeShareLink('share-1', 'user-1', 'tenant-1');

      expect(mockPrismaService.shareLink.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'share-1' },
          data: { revokedAt: expect.any(Date) },
        }),
      );
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SHARE_REVOKED',
        }),
      );
    });

    it('should reject non-existent share link', async () => {
      mockPrismaService.shareLink.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeShareLink('share-1', 'user-1', 'tenant-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject already revoked share link', async () => {
      mockPrismaService.shareLink.findUnique.mockResolvedValue({
        ...shareLink,
        revokedAt: new Date(),
      });

      await expect(
        service.revokeShareLink('share-1', 'user-1', 'tenant-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow tenant admin to revoke', async () => {
      mockRBACService.buildUserContext.mockResolvedValue({
        tenantRoles: new Map([['tenant-1', ['TENANT_ADMIN']]]),
      });

      await service.revokeShareLink('share-1', 'user-2', 'tenant-1');

      expect(mockPrismaService.shareLink.update).toHaveBeenCalled();
    });
  });

  describe('resolveShareLink', () => {
    const shareLink = {
      id: 'share-1',
      entityType: 'OBJECTIVE' as const,
      entityId: 'obj-1',
      tenantId: 'tenant-1',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    };

    beforeEach(() => {
      mockPrismaService.shareLink.findUnique.mockResolvedValue(shareLink);
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: 'obj-1',
        title: 'Test Objective',
      });
    });

    it('should resolve a valid share link', async () => {
      const result = await service.resolveShareLink('share-1', 'tenant-1');

      expect(result).not.toBeNull();
      expect(result?.entityType).toBe('OBJECTIVE');
      expect(result?.entityId).toBe('obj-1');
    });

    it('should return null for non-existent share link', async () => {
      mockPrismaService.shareLink.findUnique.mockResolvedValue(null);

      const result = await service.resolveShareLink('share-1', 'tenant-1');

      expect(result).toBeNull();
    });

    it('should return null for expired share link', async () => {
      mockPrismaService.shareLink.findUnique.mockResolvedValue({
        ...shareLink,
        expiresAt: new Date(Date.now() - 86400000),
      });

      const result = await service.resolveShareLink('share-1', 'tenant-1');

      expect(result).toBeNull();
    });

    it('should return null for revoked share link', async () => {
      mockPrismaService.shareLink.findUnique.mockResolvedValue({
        ...shareLink,
        revokedAt: new Date(),
      });

      const result = await service.resolveShareLink('share-1', 'tenant-1');

      expect(result).toBeNull();
    });

    it('should allow public access (null tenant)', async () => {
      const result = await service.resolveShareLink('share-1', null);

      expect(result).not.toBeNull();
    });
  });
});



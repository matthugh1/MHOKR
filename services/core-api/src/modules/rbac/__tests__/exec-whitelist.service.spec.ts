/**
 * ExecWhitelist Service Unit Tests
 * 
 * Tests for whitelist management operations.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExecWhitelistService } from '../exec-whitelist.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { OkrTenantGuard } from '../../okr/tenant-guard';

describe('ExecWhitelistService', () => {
  let service: ExecWhitelistService;
  let prisma: PrismaService;
  let auditLogService: AuditLogService;

  const mockPrismaService = {
    organization: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuditLogService = {
    record: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecWhitelistService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<ExecWhitelistService>(ExecWhitelistService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLogService = module.get<AuditLogService>(AuditLogService);

    jest.clearAllMocks();
  });

  describe('getWhitelist', () => {
    it('should return whitelist for tenant', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: ['user-1', 'user-2'],
      });

      const result = await service.getWhitelist('tenant-1');

      expect(result).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array if whitelist is null', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: null,
      });

      const result = await service.getWhitelist('tenant-1');

      expect(result).toEqual([]);
    });

    it('should throw NotFoundException for non-existent tenant', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(service.getWhitelist('tenant-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addToWhitelist', () => {
    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: [],
      });
      mockPrismaService.organization.update.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: ['user-1'],
      });
    });

    it('should add user to whitelist', async () => {
      const result = await service.addToWhitelist('tenant-1', 'user-1', 'tenant-1', 'actor-1');

      expect(result).toContain('user-1');
      expect(mockPrismaService.organization.update).toHaveBeenCalled();
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ADD_TO_EXEC_WHITELIST',
          targetUserId: 'user-1',
        }),
      );
    });

    it('should not add duplicate user', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: ['user-1'],
      });

      const result = await service.addToWhitelist('tenant-1', 'user-1', 'tenant-1', 'actor-1');

      expect(result).toEqual(['user-1']);
      expect(mockPrismaService.organization.update).not.toHaveBeenCalled();
    });
  });

  describe('removeFromWhitelist', () => {
    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: ['user-1', 'user-2'],
      });
      mockPrismaService.organization.update.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: ['user-2'],
      });
    });

    it('should remove user from whitelist', async () => {
      const result = await service.removeFromWhitelist('tenant-1', 'user-1', 'tenant-1', 'actor-1');

      expect(result).not.toContain('user-1');
      expect(result).toContain('user-2');
      expect(mockPrismaService.organization.update).toHaveBeenCalled();
      expect(mockAuditLogService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'REMOVE_FROM_EXEC_WHITELIST',
          targetUserId: 'user-1',
        }),
      );
    });

    it('should not remove non-existent user', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'tenant-1',
        execOnlyWhitelist: ['user-1'],
      });

      const result = await service.removeFromWhitelist('tenant-1', 'user-2', 'tenant-1', 'actor-1');

      expect(result).toEqual(['user-1']);
      expect(mockPrismaService.organization.update).not.toHaveBeenCalled();
    });
  });
});



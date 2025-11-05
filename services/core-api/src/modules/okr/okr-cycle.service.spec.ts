import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { OkrCycleService } from './okr-cycle.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';

describe('OkrCycleService', () => {
  let service: OkrCycleService;
  let prisma: PrismaService;
  let rbacService: RBACService;

  const mockPrismaService = {
    cycle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    objective: {
      count: jest.fn(),
    },
  };

  const mockRBACService = {
    canPerformAction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OkrCycleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RBACService,
          useValue: mockRBACService,
        },
      ],
    }).compile();

    service = module.get<OkrCycleService>(OkrCycleService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all cycles for organization ordered by startDate DESC', async () => {
      const orgId = 'org-1';
      const mockCycles = [
        { id: 'cycle-1', name: 'Q1 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31'), status: 'DRAFT', organizationId: orgId },
        { id: 'cycle-2', name: 'Q4 2025', startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31'), status: 'ACTIVE', organizationId: orgId },
      ];

      mockPrismaService.cycle.findMany.mockResolvedValue(mockCycles);

      const result = await service.findAll(orgId);

      expect(result).toEqual(mockCycles);
      expect(mockPrismaService.cycle.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        orderBy: { startDate: 'desc' },
      });
    });
  });

  describe('findById', () => {
    it('should return cycle by id', async () => {
      const cycleId = 'cycle-1';
      const orgId = 'org-1';
      const mockCycle = {
        id: cycleId,
        name: 'Q1 2026',
        organizationId: orgId,
        _count: { objectives: 5, keyResults: 10, initiatives: 2 },
      };

      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);

      const result = await service.findById(cycleId, orgId);

      expect(result).toEqual(mockCycle);
      expect(mockPrismaService.cycle.findUnique).toHaveBeenCalledWith({
        where: { id: cycleId },
        include: {
          _count: {
            select: {
              objectives: true,
              keyResults: true,
              initiatives: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if cycle not found', async () => {
      mockPrismaService.cycle.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid-id', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if cycle belongs to different organization', async () => {
      const mockCycle = {
        id: 'cycle-1',
        organizationId: 'org-other',
      };

      mockPrismaService.cycle.findUnique.mockResolvedValue(mockCycle);

      await expect(service.findById('cycle-1', 'org-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    const orgId = 'org-1';
    const validCycleData = {
      name: 'Q1 2026',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      status: 'DRAFT' as const,
    };

    it('should create cycle with valid data', async () => {
      const mockCycle = {
        id: 'cycle-1',
        ...validCycleData,
        organizationId: orgId,
        startDate: new Date(validCycleData.startDate),
        endDate: new Date(validCycleData.endDate),
      };

      mockPrismaService.cycle.findFirst.mockResolvedValue(null); // No overlap
      mockPrismaService.cycle.create.mockResolvedValue(mockCycle);

      const result = await service.create(validCycleData, orgId);

      expect(result).toEqual(mockCycle);
      expect(mockPrismaService.cycle.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if start date >= end date', async () => {
      const invalidData = {
        ...validCycleData,
        startDate: '2026-03-31',
        endDate: '2026-01-01',
      };

      await expect(service.create(invalidData, orgId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if dates overlap with existing cycle', async () => {
      mockPrismaService.cycle.findFirst.mockResolvedValue({
        id: 'existing-cycle',
        name: 'Q4 2025',
        startDate: new Date('2025-10-01'),
        endDate: new Date('2025-12-31'),
      });

      await expect(service.create(validCycleData, orgId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.cycle.findFirst).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid start date', async () => {
      const invalidData = {
        ...validCycleData,
        startDate: 'invalid-date',
      };

      await expect(service.create(invalidData, orgId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const cycleId = 'cycle-1';
    const orgId = 'org-1';
    const existingCycle = {
      id: cycleId,
      name: 'Q1 2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-03-31'),
      status: 'DRAFT' as const,
      organizationId: orgId,
    };

    beforeEach(() => {
      mockPrismaService.cycle.findUnique.mockResolvedValue(existingCycle);
    });

    it('should update cycle with valid data', async () => {
      const updateData = {
        name: 'Q1 2026 Updated',
      };

      const updatedCycle = { ...existingCycle, ...updateData };
      mockPrismaService.cycle.findFirst.mockResolvedValue(null); // No overlap
      mockPrismaService.cycle.update.mockResolvedValue(updatedCycle);

      const result = await service.update(cycleId, updateData, orgId);

      expect(result).toEqual(updatedCycle);
      expect(mockPrismaService.cycle.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const updateData = {
        status: 'ARCHIVED' as const, // Cannot go directly from DRAFT to ARCHIVED
      };

      await expect(service.update(cycleId, updateData, orgId)).rejects.toThrow(BadRequestException);
    });

    it('should allow valid status transition DRAFT -> ACTIVE', async () => {
      const updateData = {
        status: 'ACTIVE' as const,
      };

      const updatedCycle = { ...existingCycle, status: 'ACTIVE' };
      mockPrismaService.cycle.update.mockResolvedValue(updatedCycle);

      const result = await service.update(cycleId, updateData, orgId);

      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('updateStatus', () => {
    const cycleId = 'cycle-1';
    const orgId = 'org-1';

    it('should update status from DRAFT to ACTIVE', async () => {
      const cycle = {
        id: cycleId,
        status: 'DRAFT' as const,
        organizationId: orgId,
      };

      mockPrismaService.cycle.findUnique.mockResolvedValue(cycle);
      mockPrismaService.cycle.update.mockResolvedValue({ ...cycle, status: 'ACTIVE' });

      const result = await service.updateStatus(cycleId, 'ACTIVE', orgId);

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw BadRequestException for invalid status transition', async () => {
      const cycle = {
        id: cycleId,
        status: 'DRAFT' as const,
        organizationId: orgId,
      };

      mockPrismaService.cycle.findUnique.mockResolvedValue(cycle);

      await expect(service.updateStatus(cycleId, 'ARCHIVED', orgId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    const cycleId = 'cycle-1';
    const orgId = 'org-1';

    it('should delete cycle when no objectives are linked', async () => {
      const cycle = {
        id: cycleId,
        organizationId: orgId,
      };

      mockPrismaService.cycle.findUnique.mockResolvedValue(cycle);
      mockPrismaService.objective.count.mockResolvedValue(0);
      mockPrismaService.cycle.delete.mockResolvedValue(cycle);

      await service.delete(cycleId, orgId);

      expect(mockPrismaService.cycle.delete).toHaveBeenCalledWith({
        where: { id: cycleId },
      });
    });

    it('should throw BadRequestException when objectives are linked', async () => {
      const cycle = {
        id: cycleId,
        organizationId: orgId,
      };

      mockPrismaService.cycle.findUnique.mockResolvedValue(cycle);
      mockPrismaService.objective.count.mockResolvedValue(5);

      await expect(service.delete(cycleId, orgId)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.cycle.delete).not.toHaveBeenCalled();
    });
  });

  describe('getSummary', () => {
    const cycleId = 'cycle-1';
    const orgId = 'org-1';

    it('should return cycle summary with objectives count', async () => {
      const cycle = {
        id: cycleId,
        organizationId: orgId,
      };

      mockPrismaService.cycle.findUnique.mockResolvedValue(cycle);
      mockPrismaService.objective.count
        .mockResolvedValueOnce(10) // Total count
        .mockResolvedValueOnce(7); // Published count

      const result = await service.getSummary(cycleId, orgId);

      expect(result).toEqual({
        cycleId,
        objectivesCount: 10,
        publishedCount: 7,
        draftCount: 3,
      });
    });
  });
});



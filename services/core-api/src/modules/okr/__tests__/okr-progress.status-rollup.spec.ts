/**
 * Status Rollup Unit Tests
 * 
 * Unit tests for OkrProgressService status rollup functionality:
 * - Status calculation from Key Results
 * - Status calculation from child Objectives
 * - Status cascade to parent Objectives
 * - Status refresh when Key Result status changes
 * - Edge cases and status priority rules
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OkrProgressService } from '../okr-progress.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('OkrProgressService - Status Rollup', () => {
  let service: OkrProgressService;

  const mockPrismaService = {
    objective: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    objectiveKeyResult: {
      findMany: jest.fn(),
    },
    objectiveProgressSnapshot: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OkrProgressService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OkrProgressService>(OkrProgressService);

    jest.clearAllMocks();
    // Suppress console.error for snapshot failures
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recalculateObjectiveStatus - from Key Results', () => {
    const objectiveId = 'obj-1';

    it('should set status to COMPLETED when all KRs are COMPLETED', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'COMPLETED' } },
          { keyResult: { status: 'COMPLETED' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'COMPLETED' },
      });
    });

    it('should set status to CANCELLED when all KRs are CANCELLED', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'CANCELLED' } },
          { keyResult: { status: 'CANCELLED' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'CANCELLED' },
      });
    });

    it('should set status to ON_TRACK when all KRs are ON_TRACK', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'AT_RISK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'ON_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'ON_TRACK' },
      });
    });

    it('should set status to OFF_TRACK when ≥50% of KRs are OFF_TRACK', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'OFF_TRACK' } },
          { keyResult: { status: 'OFF_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'OFF_TRACK' },
      });
    });

    it('should set status to AT_RISK when <50% of KRs are OFF_TRACK', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'OFF_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'AT_RISK' },
      });
    });

    it('should set status to AT_RISK when ≥50% of KRs are AT_RISK', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'AT_RISK' } },
          { keyResult: { status: 'AT_RISK' } },
          { keyResult: { status: 'ON_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'AT_RISK' },
      });
    });

    it('should set status to AT_RISK when mixed statuses include AT_RISK', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'AT_RISK' } },
          { keyResult: { status: 'ON_TRACK' } },
          { keyResult: { status: 'COMPLETED' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'AT_RISK' },
      });
    });

    it('should not update status if it has not changed', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'ON_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      await service.recalculateObjectiveStatus(objectiveId);

      // Should not call update since status is already ON_TRACK
      expect(mockPrismaService.objective.update).not.toHaveBeenCalled();
    });

    it('should handle null/undefined KR statuses by filtering them out', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'ON_TRACK' } },
          { keyResult: { status: null } },
          { keyResult: { status: undefined } },
        ],
        children: [],
        parent: null,
      });

      await service.recalculateObjectiveStatus(objectiveId);

      // Should not update since only one valid KR with ON_TRACK status
      expect(mockPrismaService.objective.update).not.toHaveBeenCalled();
    });

    it('should cascade status update to parent Objective', async () => {
      const parentId = 'parent-obj-1';

      mockPrismaService.objective.findUnique
        .mockResolvedValueOnce({
          id: objectiveId,
          status: 'ON_TRACK',
          progress: 50,
          keyResults: [
            { keyResult: { status: 'COMPLETED' } },
          ],
          children: [],
          parent: { id: parentId },
        })
        .mockResolvedValueOnce({
          id: parentId,
          status: 'ON_TRACK',
          progress: 50,
          keyResults: [],
          children: [{ id: objectiveId, status: 'COMPLETED' }],
          parent: null,
        });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      // Should update both child and parent
      expect(mockPrismaService.objective.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'COMPLETED' },
      });
      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: parentId },
        data: { status: 'COMPLETED' },
      });
    });

    it('should return early if objective does not exist', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue(null);

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).not.toHaveBeenCalled();
    });
  });

  describe('recalculateObjectiveStatus - from child Objectives', () => {
    const objectiveId = 'obj-1';

    it('should set status to COMPLETED when all children are COMPLETED', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [],
        children: [
          { id: 'child-1', status: 'COMPLETED' },
          { id: 'child-2', status: 'COMPLETED' },
        ],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'COMPLETED' },
      });
    });

    it('should set status to OFF_TRACK when ≥50% of children are OFF_TRACK', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [],
        children: [
          { id: 'child-1', status: 'OFF_TRACK' },
          { id: 'child-2', status: 'OFF_TRACK' },
          { id: 'child-3', status: 'ON_TRACK' },
        ],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'OFF_TRACK' },
      });
    });

    it('should prioritize Key Results over child Objectives', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'COMPLETED' } },
        ],
        children: [
          { id: 'child-1', status: 'AT_RISK' },
        ],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      // Should use KR status (COMPLETED) not child status (AT_RISK)
      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'COMPLETED' },
      });
    });

    it('should leave status unchanged if no KRs or children', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [],
        children: [],
        parent: null,
      });

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objective.update).not.toHaveBeenCalled();
    });
  });

  describe('refreshObjectiveStatusForKeyResult', () => {
    const keyResultId = 'kr-1';
    const objectiveId1 = 'obj-1';
    const objectiveId2 = 'obj-2';

    it('should recalculate status for all linked Objectives', async () => {
      mockPrismaService.objectiveKeyResult.findMany.mockResolvedValue([
        { objectiveId: objectiveId1 },
        { objectiveId: objectiveId2 },
      ]);

      mockPrismaService.objective.findUnique
        .mockResolvedValueOnce({
          id: objectiveId1,
          status: 'ON_TRACK',
          progress: 50,
          keyResults: [
            { keyResult: { status: 'COMPLETED' } },
          ],
          children: [],
          parent: null,
        })
        .mockResolvedValueOnce({
          id: objectiveId2,
          status: 'ON_TRACK',
          progress: 50,
          keyResults: [
            { keyResult: { status: 'COMPLETED' } },
          ],
          children: [],
          parent: null,
        });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.refreshObjectiveStatusForKeyResult(keyResultId);

      expect(mockPrismaService.objectiveKeyResult.findMany).toHaveBeenCalledWith({
        where: { keyResultId },
        select: { objectiveId: true },
      });
      expect(mockPrismaService.objective.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.objective.update).toHaveBeenCalledTimes(2);
    });

    it('should handle Key Result with no linked Objectives', async () => {
      mockPrismaService.objectiveKeyResult.findMany.mockResolvedValue([]);

      await service.refreshObjectiveStatusForKeyResult(keyResultId);

      expect(mockPrismaService.objective.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('refreshObjectiveProgressAndStatusCascade', () => {
    const objectiveId = 'obj-1';

    it('should recalculate both progress and status', async () => {
      mockPrismaService.objective.findUnique
        .mockResolvedValueOnce({
          id: objectiveId,
          status: 'ON_TRACK',
          progress: 50,
          keyResults: [
            { weight: 1.0, keyResult: { progress: 75 } },
          ],
          children: [],
          parent: null,
        })
        .mockResolvedValueOnce({
          id: objectiveId,
          status: 'ON_TRACK',
          progress: 75,
          keyResults: [
            { keyResult: { status: 'COMPLETED' } },
          ],
          children: [],
          parent: null,
        });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.refreshObjectiveProgressAndStatusCascade(objectiveId);

      // Should update progress first, then status
      expect(mockPrismaService.objective.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('Status priority and edge cases', () => {
    const objectiveId = 'obj-1';

    it('should handle exactly 50% threshold for OFF_TRACK (2 out of 4)', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'OFF_TRACK' } },
          { keyResult: { status: 'OFF_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      // 2/4 = 50%, should be OFF_TRACK
      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'OFF_TRACK' },
      });
    });

    it('should handle exactly 50% threshold for AT_RISK (2 out of 4)', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'AT_RISK' } },
          { keyResult: { status: 'AT_RISK' } },
          { keyResult: { status: 'ON_TRACK' } },
          { keyResult: { status: 'ON_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      // 2/4 = 50%, should be AT_RISK
      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'AT_RISK' },
      });
    });

    it('should handle single KR with OFF_TRACK status', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'OFF_TRACK' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      // 1/1 = 100% OFF_TRACK, but <50% threshold logic applies, so AT_RISK
      // Actually, wait - 1 out of 1 is 100%, which is >= 50%, so should be OFF_TRACK
      expect(mockPrismaService.objective.update).toHaveBeenCalledWith({
        where: { id: objectiveId },
        data: { status: 'OFF_TRACK' },
      });
    });

    it('should store progress snapshot when status changes', async () => {
      mockPrismaService.objective.findUnique.mockResolvedValue({
        id: objectiveId,
        status: 'ON_TRACK',
        progress: 50,
        keyResults: [
          { keyResult: { status: 'COMPLETED' } },
        ],
        children: [],
        parent: null,
      });

      mockPrismaService.objective.update.mockResolvedValue({});
      mockPrismaService.objectiveProgressSnapshot.create.mockResolvedValue({});

      await service.recalculateObjectiveStatus(objectiveId);

      expect(mockPrismaService.objectiveProgressSnapshot.create).toHaveBeenCalledWith({
        data: {
          objectiveId,
          progress: 50,
          status: 'COMPLETED',
          triggeredBy: 'STATUS_ROLLUP',
        },
      });
    });
  });
});


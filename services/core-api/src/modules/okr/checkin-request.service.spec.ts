import { Test, TestingModule } from '@nestjs/testing';
import { CheckInRequestService } from './checkin-request.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CheckInRequestService', () => {
  let service: CheckInRequestService;
  let prisma: PrismaService;

  const mockPrismaService = {
    checkInRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    checkInResponse: {
      upsert: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
    },
    cycle: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInRequestService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CheckInRequestService>(CheckInRequestService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRequests', () => {
    it('should create check-in requests for target users', async () => {
      const requesterUserId = 'requester-1';
      const targetUserIds = ['target-1', 'target-2'];
      const dueAt = new Date('2025-01-15T10:00:00Z');
      const userOrganizationId = 'org-1';

      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 'target-1' },
        { id: 'target-2' },
      ]);

      mockPrismaService.checkInRequest.create.mockResolvedValueOnce({
        id: 'request-1',
        requesterUserId,
        targetUserId: 'target-1',
        organizationId: userOrganizationId,
        dueAt,
        status: 'OPEN',
        targetUser: { id: 'target-1', name: 'User 1', email: 'user1@example.com' },
        requester: { id: requesterUserId, name: 'Manager', email: 'manager@example.com' },
      });

      mockPrismaService.checkInRequest.create.mockResolvedValueOnce({
        id: 'request-2',
        requesterUserId,
        targetUserId: 'target-2',
        organizationId: userOrganizationId,
        dueAt,
        status: 'OPEN',
        targetUser: { id: 'target-2', name: 'User 2', email: 'user2@example.com' },
        requester: { id: requesterUserId, name: 'Manager', email: 'manager@example.com' },
      });

      const result = await service.createRequests(
        requesterUserId,
        targetUserIds,
        dueAt,
        userOrganizationId,
      );

      expect(result).toHaveLength(2);
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: targetUserIds },
          OR: expect.arrayContaining([
            expect.objectContaining({
              organizationMembers: expect.any(Object),
            }),
            expect.objectContaining({
              teamMembers: expect.any(Object),
            }),
          ]),
        },
        select: { id: true },
      });
      expect(mockPrismaService.checkInRequest.create).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if target users do not belong to organization', async () => {
      const requesterUserId = 'requester-1';
      const targetUserIds = ['target-1'];
      const dueAt = new Date('2025-01-15T10:00:00Z');
      const userOrganizationId = 'org-1';

      mockPrismaService.user.findMany.mockResolvedValue([]);

      await expect(
        service.createRequests(requesterUserId, targetUserIds, dueAt, userOrganizationId),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrismaService.checkInRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('submitResponse', () => {
    it('should submit a response and update request status', async () => {
      const requestId = 'request-1';
      const userId = 'target-1';
      const userOrganizationId = 'org-1';
      const data = {
        summaryWhatMoved: 'Made progress on feature X',
        summaryBlocked: 'Waiting for API access',
        summaryNeedHelp: 'Need help with deployment',
      };

      const mockRequest = {
        id: requestId,
        targetUserId: userId,
        organizationId: userOrganizationId,
        status: 'OPEN',
        response: null,
      };

      mockPrismaService.checkInRequest.findUnique.mockResolvedValue(mockRequest);
      mockPrismaService.checkInResponse.upsert.mockResolvedValue({
        id: 'response-1',
        requestId,
        targetUserId: userId,
        ...data,
        submittedAt: new Date(),
      });
      mockPrismaService.checkInRequest.update.mockResolvedValue({
        ...mockRequest,
        status: 'SUBMITTED',
      });

      const result = await service.submitResponse(requestId, userId, data, userOrganizationId);

      expect(result).toBeDefined();
      expect(mockPrismaService.checkInResponse.upsert).toHaveBeenCalled();
      expect(mockPrismaService.checkInRequest.update).toHaveBeenCalledWith({
        where: { id: requestId },
        data: { status: 'SUBMITTED' },
      });
    });

    it('should throw NotFoundException if request does not exist', async () => {
      const requestId = 'request-1';
      const userId = 'target-1';
      const userOrganizationId = 'org-1';

      mockPrismaService.checkInRequest.findUnique.mockResolvedValue(null);

      await expect(
        service.submitResponse(requestId, userId, {}, userOrganizationId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user does not match target', async () => {
      const requestId = 'request-1';
      const userId = 'wrong-user';
      const userOrganizationId = 'org-1';

      const mockRequest = {
        id: requestId,
        targetUserId: 'target-1',
        organizationId: userOrganizationId,
        status: 'OPEN',
        response: null,
      };

      mockPrismaService.checkInRequest.findUnique.mockResolvedValue(mockRequest);

      await expect(
        service.submitResponse(requestId, userId, {}, userOrganizationId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // TODO [phase7-hardening]: Add more comprehensive tests for getMyRequests and getRollup
});


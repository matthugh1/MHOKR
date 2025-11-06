import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, BadRequestException } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { OkrCycleService } from './okr-cycle.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RBACGuard } from '../rbac/rbac.guard';

describe('OkrCycleController (Integration)', () => {
  let app: INestApplication;
  let cycleService: OkrCycleService;
  let prisma: PrismaService;

  const mockUser = {
    id: 'user-1',
    email: 'admin@example.com',
    tenantId: 'org-1',
  };

  const mockJwtGuard = {
    canActivate: jest.fn((context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = mockUser;
      return true;
    }),
  };

  const mockRBACGuard = {
    canActivate: jest.fn(() => true),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtGuard)
      .overrideGuard(RBACGuard)
      .useValue(mockRBACGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    cycleService = moduleFixture.get<OkrCycleService>(OkrCycleService);
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /okr/cycles', () => {
    it('should return all cycles for tenant', async () => {
      const mockCycles = [
        {
          id: 'cycle-1',
          name: 'Q1 2026',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-03-31'),
          status: 'DRAFT',
          tenantId: 'org-1',
        },
      ];

      jest.spyOn(cycleService, 'findAll').mockResolvedValue(mockCycles);

      const response = await request(app.getHttpServer())
        .get('/okr/cycles')
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toEqual(mockCycles);
    });

    it('should require manage_workspaces permission', async () => {
      mockRBACGuard.canActivate = jest.fn(() => false);

      await request(app.getHttpServer())
        .get('/okr/cycles')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);

      mockRBACGuard.canActivate = jest.fn(() => true); // Reset
    });
  });

  describe('POST /okr/cycles', () => {
    it('should create cycle with valid data', async () => {
      const createData = {
        name: 'Q1 2026',
        startDate: '2026-01-01',
        endDate: '2026-03-31',
        status: 'DRAFT',
      };

      const mockCycle = {
        id: 'cycle-1',
        ...createData,
        tenantId: 'org-1',
        startDate: new Date(createData.startDate),
        endDate: new Date(createData.endDate),
      };

      jest.spyOn(cycleService, 'create').mockResolvedValue(mockCycle);

      const response = await request(app.getHttpServer())
        .post('/okr/cycles')
        .set('Authorization', 'Bearer fake-token')
        .send(createData)
        .expect(201);

      expect(response.body.name).toBe(createData.name);
    });

    it('should reject invalid date order', async () => {
      const invalidData = {
        name: 'Invalid Cycle',
        startDate: '2026-03-31',
        endDate: '2026-01-01',
      };

      jest.spyOn(cycleService, 'create').mockRejectedValue(
        new BadRequestException('Start date must be before end date')
      );

      await request(app.getHttpServer())
        .post('/okr/cycles')
        .set('Authorization', 'Bearer fake-token')
        .send(invalidData)
        .expect(400);
    });
  });

  describe('PATCH /okr/cycles/:id', () => {
    it('should update cycle', async () => {
      const cycleId = 'cycle-1';
      const updateData = {
        name: 'Q1 2026 Updated',
      };

      const mockCycle = {
        id: cycleId,
        name: updateData.name,
        tenantId: 'org-1',
      };

      jest.spyOn(cycleService, 'update').mockResolvedValue(mockCycle);

      const response = await request(app.getHttpServer())
        .patch(`/okr/cycles/${cycleId}`)
        .set('Authorization', 'Bearer fake-token')
        .send(updateData)
        .expect(200);

      expect(response.body.name).toBe(updateData.name);
    });
  });

  describe('PATCH /okr/cycles/:id/status', () => {
    it('should update cycle status', async () => {
      const cycleId = 'cycle-1';
      const statusData = {
        status: 'ACTIVE',
      };

      const mockCycle = {
        id: cycleId,
        status: 'ACTIVE',
        tenantId: 'org-1',
      };

      jest.spyOn(cycleService, 'updateStatus').mockResolvedValue(mockCycle);

      const response = await request(app.getHttpServer())
        .patch(`/okr/cycles/${cycleId}/status`)
        .set('Authorization', 'Bearer fake-token')
        .send(statusData)
        .expect(200);

      expect(response.body.status).toBe('ACTIVE');
    });

    it('should reject invalid status transitions', async () => {
      const cycleId = 'cycle-1';
      const statusData = {
        status: 'ARCHIVED',
      };

      jest.spyOn(cycleService, 'updateStatus').mockRejectedValue(
        new BadRequestException('Invalid status transition')
      );

      await request(app.getHttpServer())
        .patch(`/okr/cycles/${cycleId}/status`)
        .set('Authorization', 'Bearer fake-token')
        .send(statusData)
        .expect(400);
    });
  });

  describe('DELETE /okr/cycles/:id', () => {
    it('should delete cycle when no linked OKRs', async () => {
      const cycleId = 'cycle-1';

      jest.spyOn(cycleService, 'delete').mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .delete(`/okr/cycles/${cycleId}`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject deletion when OKRs are linked', async () => {
      const cycleId = 'cycle-1';

      jest.spyOn(cycleService, 'delete').mockRejectedValue(
        new BadRequestException('Cannot delete cycle: 5 objective(s) are linked')
      );

      await request(app.getHttpServer())
        .delete(`/okr/cycles/${cycleId}`)
        .set('Authorization', 'Bearer fake-token')
        .expect(400);
    });
  });

  describe('GET /okr/cycles/:id/summary', () => {
    it('should return cycle summary', async () => {
      const cycleId = 'cycle-1';
      const mockSummary = {
        cycleId,
        objectivesCount: 10,
        publishedCount: 7,
        draftCount: 3,
      };

      jest.spyOn(cycleService, 'getSummary').mockResolvedValue(mockSummary);

      const response = await request(app.getHttpServer())
        .get(`/okr/cycles/${cycleId}/summary`)
        .set('Authorization', 'Bearer fake-token')
        .expect(200);

      expect(response.body).toEqual(mockSummary);
    });
  });

  describe('RBAC Enforcement', () => {
    it('should deny access to non-admin users', async () => {
      mockRBACGuard.canActivate = jest.fn(() => false);

      await request(app.getHttpServer())
        .get('/okr/cycles')
        .set('Authorization', 'Bearer fake-token')
        .expect(403);

      await request(app.getHttpServer())
        .post('/okr/cycles')
        .set('Authorization', 'Bearer fake-token')
        .send({ name: 'Test', startDate: '2026-01-01', endDate: '2026-03-31' })
        .expect(403);

      mockRBACGuard.canActivate = jest.fn(() => true); // Reset
    });
  });
});


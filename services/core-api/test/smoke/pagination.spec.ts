import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Pagination Smoke Test', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const mockPrisma = {
    objective: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    roleAssignment: {
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    initiative: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('should return correct page and pageSize for TENANT_ADMIN', async () => {
    const tenantAdminId = 'tenant-admin-1';
    const organizationId = 'org-1';

    mockPrisma.user.findUnique.mockResolvedValue({
      id: tenantAdminId,
      isSuperuser: false,
    });

    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        id: 'ra-1',
        userId: tenantAdminId,
        role: 'TENANT_ADMIN',
        scopeType: 'TENANT',
        scopeId: organizationId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([]);

    const allObjectives = Array.from({ length: 50 }, (_, i) => ({
      id: `obj-${i}`,
      title: `Objective ${i}`,
      organizationId,
      workspaceId: `workspace-${i % 5}`,
      visibilityLevel: 'PUBLIC_TENANT',
      ownerId: `owner-${i}`,
      keyResults: [],
      initiatives: [],
      cycle: { id: 'cycle-1', name: 'Cycle 1', status: 'ACTIVE' },
      owner: { id: `owner-${i}`, name: `Owner ${i}`, email: `owner${i}@example.com` },
    }));

    mockPrisma.objective.findMany.mockResolvedValue(allObjectives);
    mockPrisma.initiative.findMany.mockResolvedValue([]);

    const response = await request(app.getHttpServer())
      .get('/okr/overview')
      .query({ organizationId, page: 2, pageSize: 20 })
      .set('Authorization', `Bearer mock-token-${tenantAdminId}`)
      .expect(200);

    expect(response.body.page).toBe(2);
    expect(response.body.pageSize).toBe(20);
    expect(response.body.objectives.length).toBeLessThanOrEqual(20);
    expect(response.body.totalCount).toBeGreaterThanOrEqual(response.body.objectives.length);
  });
});


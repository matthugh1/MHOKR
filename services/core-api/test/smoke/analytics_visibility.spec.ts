import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Analytics Visibility Smoke Test', () => {
  let app: INestApplication;

  const mockPrisma = {
    objective: {
      findMany: jest.fn(),
      count: jest.fn(),
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

  it('should exclude PRIVATE exec-only objectives from analytics for WORKSPACE_LEAD', async () => {
    const workspaceLeadId = 'workspace-lead-1';
    const workspaceId = 'workspace-1';
    const organizationId = 'org-1';

    mockPrisma.user.findUnique.mockResolvedValue({
      id: workspaceLeadId,
      isSuperuser: false,
    });

    mockPrisma.roleAssignment.findMany.mockResolvedValue([
      {
        id: 'ra-1',
        userId: workspaceLeadId,
        role: 'WORKSPACE_LEAD',
        scopeType: 'WORKSPACE',
        scopeId: workspaceId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockPrisma.user.findMany.mockResolvedValue([]);

    mockPrisma.organization.findUnique.mockResolvedValue({
      id: organizationId,
      execOnlyWhitelist: [],
    });

    const publicObjectives = [
      {
        id: 'obj-1',
        title: 'Public Objective',
        organizationId,
        workspaceId,
        visibilityLevel: 'PUBLIC_TENANT',
        status: 'ON_TRACK',
      },
      {
        id: 'obj-2',
        title: 'Another Public Objective',
        organizationId,
        workspaceId,
        visibilityLevel: 'PUBLIC_TENANT',
        status: 'ON_TRACK',
      },
    ];

    const execOnlyObjectives = [
      {
        id: 'obj-exec-1',
        title: 'Executive Only Objective',
        organizationId,
        workspaceId: 'workspace-exec',
        visibilityLevel: 'EXEC_ONLY',
        status: 'ON_TRACK',
      },
    ];

    mockPrisma.objective.findMany.mockResolvedValue([...publicObjectives, ...execOnlyObjectives]);
    mockPrisma.objective.count.mockResolvedValue(publicObjectives.length);

    const response = await request(app.getHttpServer())
      .get('/reports/analytics/summary')
      .query({ organizationId })
      .set('Authorization', `Bearer mock-token-${workspaceLeadId}`)
      .expect(200);

    const totalObjectives = response.body.totalObjectives || 0;
    const byStatus = response.body.byStatus || {};

    expect(totalObjectives).toBeLessThanOrEqual(publicObjectives.length);
    const execOnlyCount = Object.values(byStatus).reduce((sum: number, count: any) => sum + count, 0);
    expect(execOnlyCount).toBeLessThanOrEqual(publicObjectives.length);
  });
});


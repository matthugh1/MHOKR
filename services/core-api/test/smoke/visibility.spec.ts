import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Visibility Smoke Test', () => {
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

  it('should not return PRIVATE objectives from other workspaces to WORKSPACE_LEAD', async () => {
    const workspaceLeadId = 'user-workspace-lead';
    const workspaceId = 'workspace-1';
    const otherWorkspaceId = 'workspace-2';
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

    mockPrisma.objective.findMany.mockResolvedValue([
      {
        id: 'obj-1',
        title: 'Public Objective',
        organizationId,
        workspaceId,
        visibilityLevel: 'PUBLIC_TENANT',
        ownerId: 'owner-1',
      },
      {
        id: 'obj-2',
        title: 'Private Objective from Other Workspace',
        organizationId,
        workspaceId: otherWorkspaceId,
        visibilityLevel: 'WORKSPACE_ONLY',
        ownerId: 'owner-2',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/okr/overview')
      .query({ organizationId, page: 1, pageSize: 20 })
      .set('Authorization', `Bearer mock-token-${workspaceLeadId}`)
      .expect(200);

    const objectives = response.body.objectives || [];
    const privateObjectiveIds = objectives
      .filter((obj: any) => obj.visibilityLevel === 'WORKSPACE_ONLY' && obj.workspaceId === otherWorkspaceId)
      .map((obj: any) => obj.id);

    expect(privateObjectiveIds).not.toContain('obj-2');
  });
});


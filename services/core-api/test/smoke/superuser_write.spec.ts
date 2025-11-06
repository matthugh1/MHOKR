import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/common/prisma/prisma.service';

describe('Superuser Write Smoke Test', () => {
  let app: INestApplication;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    roleAssignment: {
      findMany: jest.fn(),
    },
    checkInRequest: {
      create: jest.fn(),
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

  it('should return 403 when SUPERUSER attempts to create check-in request', async () => {
    const superuserId = 'superuser-1';

    mockPrisma.user.findUnique.mockResolvedValue({
      id: superuserId,
      isSuperuser: true,
    });

    mockPrisma.roleAssignment.findMany.mockResolvedValue([]);
    mockPrisma.user.findMany.mockResolvedValue([]);

    await request(app.getHttpServer())
      .post('/okr/checkin-requests')
      .set('Authorization', `Bearer mock-token-${superuserId}`)
      .send({
        targetUserIds: ['user-1'],
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      })
      .expect(403);
  });
});


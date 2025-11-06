/**
 * Policy Controller Tests
 * 
 * Tests for the Policy Decision Explorer endpoint.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PolicyController } from '../policy.controller';
import { AuthorisationService } from '../../authorisation.service';
import { RBACService } from '../../rbac/rbac.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { SuperuserService } from '../../superuser/superuser.service';
import { Action } from '../../rbac/types';

describe('PolicyController', () => {
  let controller: PolicyController;
  let authorisationService: jest.Mocked<AuthorisationService>;
  let rbacService: jest.Mocked<RBACService>;
  let prismaService: jest.Mocked<PrismaService>;
  let superuserService: jest.Mocked<SuperuserService>;

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      tenantId: 'org-123',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PolicyController],
      providers: [
        {
          provide: AuthorisationService,
          useValue: {
            can: jest.fn(),
          },
        },
        {
          provide: RBACService,
          useValue: {
            buildUserContext: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            roleAssignment: {
              findFirst: jest.fn(),
            },
            objective: {
              findUnique: jest.fn(),
            },
            keyResult: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: SuperuserService,
          useValue: {
            isSuperuser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PolicyController>(PolicyController);
    authorisationService = module.get(AuthorisationService);
    rbacService = module.get(RBACService);
    prismaService = module.get(PrismaService);
    superuserService = module.get(SuperuserService);

    // Set RBAC_INSPECTOR env flag
    process.env.RBAC_INSPECTOR = 'true';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('decide', () => {
    it('should return 404 if RBAC_INSPECTOR flag is false', async () => {
      process.env.RBAC_INSPECTOR = 'false';

      await expect(
        controller.decide(
          {
            action: 'view_okr',
          },
          mockRequest as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return 403 if user is not superuser', async () => {
      superuserService.isSuperuser.mockResolvedValue(false);

      await expect(
        controller.decide(
          {
            action: 'view_okr',
          },
          mockRequest as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return ALLOW decision for superuser', async () => {
      superuserService.isSuperuser.mockResolvedValue(true);
      rbacService.buildUserContext.mockResolvedValue({
        userId: 'user-123',
        isSuperuser: false,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      });
      authorisationService.can.mockResolvedValue({
        allow: true,
        reason: 'ALLOW',
      });

      const result = await controller.decide(
        {
          action: 'view_okr',
        },
        mockRequest as any,
      );

      expect(result.allow).toBe(true);
      expect(result.reason).toBe('ALLOW');
      expect(result.meta.requestUserId).toBe('user-123');
      expect(result.meta.evaluatedUserId).toBe('user-123');
      expect(result.meta.action).toBe('view_okr');
    });

    it('should return DENY decision with correct reason', async () => {
      superuserService.isSuperuser.mockResolvedValue(true);
      rbacService.buildUserContext.mockResolvedValue({
        userId: 'user-123',
        isSuperuser: false,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      });
      authorisationService.can.mockResolvedValue({
        allow: false,
        reason: 'ROLE_DENY',
      });

      const result = await controller.decide(
        {
          action: 'edit_okr',
          resource: {
            tenantId: 'org-123',
          },
        },
        mockRequest as any,
      );

      expect(result.allow).toBe(false);
      expect(result.reason).toBe('ROLE_DENY');
      expect(result.details.userRoles).toEqual([]);
    });

    it('should evaluate different user when userId provided', async () => {
      superuserService.isSuperuser.mockResolvedValue(true);
      rbacService.buildUserContext.mockResolvedValue({
        userId: 'user-456',
        isSuperuser: false,
        tenantRoles: new Map([['org-123', ['TENANT_ADMIN']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      });
      prismaService.user.findUnique.mockResolvedValue({
        id: 'user-456',
        isSuperuser: false,
      } as any);
      prismaService.roleAssignment.findFirst.mockResolvedValue({
        scopeId: 'org-123',
      } as any);
      authorisationService.can.mockResolvedValue({
        allow: true,
        reason: 'ALLOW',
      });

      const result = await controller.decide(
        {
          userId: 'user-456',
          action: 'view_okr',
        },
        mockRequest as any,
      );

      expect(result.meta.evaluatedUserId).toBe('user-456');
      expect(result.meta.requestUserId).toBe('user-123');
      expect(result.details.userRoles).toContain('TENANT_ADMIN');
    });

    it('should load OKR entity when objectiveId provided', async () => {
      superuserService.isSuperuser.mockResolvedValue(true);
      rbacService.buildUserContext.mockResolvedValue({
        userId: 'user-123',
        isSuperuser: false,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      });
      prismaService.objective.findUnique.mockResolvedValue({
        id: 'obj-123',
        ownerId: 'user-123',
        tenantId: 'org-123',
        tenantId: 'org-123',
        workspaceId: 'ws-123',
        teamId: null,
        visibilityLevel: 'PUBLIC_TENANT',
        isPublished: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      authorisationService.can.mockResolvedValue({
        allow: true,
        reason: 'ALLOW',
      });

      const result = await controller.decide(
        {
          action: 'view_okr',
          resource: {
            objectiveId: 'obj-123',
          },
        },
        mockRequest as any,
      );

      expect(result.details.resourceCtxEcho.okr).toBeDefined();
      expect(result.details.resourceCtxEcho.okr.id).toBe('obj-123');
      expect(prismaService.objective.findUnique).toHaveBeenCalledWith({
        where: { id: 'obj-123' },
        select: expect.any(Object),
      });
    });

    it('should return correct response shape', async () => {
      superuserService.isSuperuser.mockResolvedValue(true);
      rbacService.buildUserContext.mockResolvedValue({
        userId: 'user-123',
        isSuperuser: false,
        tenantRoles: new Map([['org-123', ['TENANT_ADMIN']]]),
        workspaceRoles: new Map([['ws-123', ['WORKSPACE_LEAD']]]),
        teamRoles: new Map(),
        roleAssignments: [],
      });
      authorisationService.can.mockResolvedValue({
        allow: true,
        reason: 'ALLOW',
      });

      const result = await controller.decide(
        {
          action: 'view_okr',
        },
        mockRequest as any,
      );

      expect(result).toHaveProperty('allow');
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('details');
      expect(result).toHaveProperty('meta');
      expect(result.details).toHaveProperty('userRoles');
      expect(result.details).toHaveProperty('scopes');
      expect(result.details).toHaveProperty('resourceCtxEcho');
      expect(result.meta).toHaveProperty('requestUserId');
      expect(result.meta).toHaveProperty('evaluatedUserId');
      expect(result.meta).toHaveProperty('action');
      expect(result.meta).toHaveProperty('timestamp');
    });
  });
});


/**
 * Authorisation Service Tests
 * 
 * Unit tests for the centralised authorisation service.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { AuthorisationService } from '../authorisation.service';
import { OkrGovernanceService } from '../../okr/okr-governance.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RBACService } from '../../rbac/rbac.service';
import { UserContext, ResourceContext, Action } from '../../rbac/types';

describe('AuthorisationService', () => {
  let service: AuthorisationService;
  let governanceService: OkrGovernanceService;
  let prismaService: PrismaService;
  let rbacService: RBACService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthorisationService,
        {
          provide: OkrGovernanceService,
          useValue: {
            checkPublishLockForObjective: jest.fn(),
            checkPublishLockForKeyResult: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            objective: {
              findUnique: jest.fn(),
            },
            keyResult: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: RBACService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthorisationService>(AuthorisationService);
    governanceService = module.get<OkrGovernanceService>(OkrGovernanceService);
    prismaService = module.get<PrismaService>(PrismaService);
    rbacService = module.get<RBACService>(RBACService);
  });

  describe('SUPERUSER Read-Only', () => {
    it('should deny SUPERUSER from creating OKRs', async () => {
      const userContext: UserContext = {
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-1',
      };

      const decision = await service.can(userContext, 'create_okr', resourceContext, null);

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('SUPERUSER_READ_ONLY');
    });

    it('should deny SUPERUSER from editing OKRs', async () => {
      const userContext: UserContext = {
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-1',
        okr: {
          id: 'okr-1',
          ownerId: 'owner-id',
          organizationId: 'org-1',
          tenantId: 'org-1',
          visibilityLevel: 'PUBLIC_TENANT',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const decision = await service.can(userContext, 'edit_okr', resourceContext, null);

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('SUPERUSER_READ_ONLY');
    });

    it('should deny SUPERUSER from deleting OKRs', async () => {
      const userContext: UserContext = {
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-1',
        okr: {
          id: 'okr-1',
          ownerId: 'owner-id',
          organizationId: 'org-1',
          tenantId: 'org-1',
          visibilityLevel: 'PUBLIC_TENANT',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const decision = await service.can(userContext, 'delete_okr', resourceContext, null);

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('SUPERUSER_READ_ONLY');
    });

    it('should deny SUPERUSER from publishing OKRs', async () => {
      const userContext: UserContext = {
        userId: 'superuser-id',
        isSuperuser: true,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-1',
        okr: {
          id: 'okr-1',
          ownerId: 'owner-id',
          organizationId: 'org-1',
          tenantId: 'org-1',
          visibilityLevel: 'PUBLIC_TENANT',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const decision = await service.can(userContext, 'publish_okr', resourceContext, null);

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('SUPERUSER_READ_ONLY');
    });
  });

  describe('Publish Lock', () => {
    it('should deny non-admin roles from editing published OKRs', async () => {
      const userContext: UserContext = {
        userId: 'user-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['WORKSPACE_LEAD']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-1',
        okr: {
          id: 'okr-1',
          ownerId: 'owner-id',
          organizationId: 'org-1',
          tenantId: 'org-1',
          visibilityLevel: 'PUBLIC_TENANT',
          isPublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      jest.spyOn(prismaService.objective, 'findUnique').mockResolvedValue({
        id: 'okr-1',
        isPublished: true,
      } as any);

      jest.spyOn(governanceService, 'checkPublishLockForObjective').mockRejectedValue(
        new Error('This OKR is published and can only be modified by admin roles')
      );

      const decision = await service.can(userContext, 'edit_okr', resourceContext, 'org-1');

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('PUBLISH_LOCK');
    });
  });

  describe('Tenant Boundary', () => {
    it('should deny cross-tenant mutations', async () => {
      const userContext: UserContext = {
        userId: 'user-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_ADMIN']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-2', // Different tenant
      };

      const decision = await service.can(userContext, 'create_okr', resourceContext, 'org-1');

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('TENANT_BOUNDARY');
    });
  });

  describe('PRIVATE Visibility', () => {
    it('should deny non-whitelisted users from viewing PRIVATE OKRs', async () => {
      const userContext: UserContext = {
        userId: 'user-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_ADMIN']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-1',
        okr: {
          id: 'okr-1',
          ownerId: 'other-owner-id',
          organizationId: 'org-1',
          tenantId: 'org-1',
          visibilityLevel: 'PRIVATE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tenant: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          execOnlyWhitelist: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const decision = await service.can(userContext, 'view_okr', resourceContext, 'org-1');

      expect(decision.allow).toBe(false);
      expect(decision.reason).toBe('PRIVATE_VISIBILITY');
    });

    it('should allow TENANT_OWNER to view PRIVATE OKRs', async () => {
      const userContext: UserContext = {
        userId: 'owner-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_OWNER']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const resourceContext: ResourceContext = {
        tenantId: 'org-1',
        okr: {
          id: 'okr-1',
          ownerId: 'other-owner-id',
          organizationId: 'org-1',
          tenantId: 'org-1',
          visibilityLevel: 'PRIVATE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        tenant: {
          id: 'org-1',
          name: 'Test Org',
          slug: 'test-org',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      };

      const decision = await service.can(userContext, 'view_okr', resourceContext, 'org-1');

      expect(decision.allow).toBe(true);
      expect(decision.reason).toBe('ALLOW');
    });
  });
});


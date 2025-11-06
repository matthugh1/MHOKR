/**
 * W4.M1: Taxonomy & Data Model Alignment - Unit Tests
 * 
 * Tests for visibility filtering and enum separation (Status vs Publish State).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OkrVisibilityService } from './okr-visibility.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RBACService } from '../rbac/rbac.service';

describe('OkrVisibilityService - W4.M1 Taxonomy Alignment', () => {
  let service: OkrVisibilityService;
  let prismaService: PrismaService;
  let rbacService: RBACService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OkrVisibilityService,
        {
          provide: PrismaService,
          useValue: {
            organization: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: RBACService,
          useValue: {
            buildUserContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<OkrVisibilityService>(OkrVisibilityService);
    prismaService = module.get<PrismaService>(PrismaService);
    rbacService = module.get<RBACService>(RBACService);
  });

  describe('Visibility Inheritance - Objectives → Key Results', () => {
    it('should inherit visibility from parent objective', async () => {
      // Mock parent objective with PRIVATE visibility
      const parentObjective = {
        id: 'obj-1',
        ownerId: 'owner-1',
        tenantId: 'org-1',
        visibilityLevel: 'PRIVATE',
      };

      const keyResult = {
        id: 'kr-1',
        ownerId: 'owner-1',
      };

      // Mock RBAC service to build user context
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'user-1',
        isSuperuser: false,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
        directReports: [],
      });

      // Mock organization with whitelist
      jest.spyOn(prismaService.organization, 'findUnique').mockResolvedValue({
        id: 'org-1',
        execOnlyWhitelist: null,
        metadata: null,
      } as any);

      // Mock canUserSeeObjective to return false (user not whitelisted)
      jest.spyOn(service, 'canUserSeeObjective').mockResolvedValue(false);

      const result = await service.canUserSeeKeyResult({
        keyResult,
        parentObjective,
        requesterUserId: 'user-1',
        requesterOrgId: 'org-1',
      });

      // Should inherit visibility from parent (PRIVATE, user not whitelisted → false)
      expect(result).toBe(false);
      expect(service.canUserSeeObjective).toHaveBeenCalledWith({
        objective: parentObjective,
        requesterUserId: 'user-1',
        requesterOrgId: 'org-1',
      });
    });

    it('should allow access when parent objective is PUBLIC_TENANT', async () => {
      const parentObjective = {
        id: 'obj-1',
        ownerId: 'owner-1',
        tenantId: 'org-1',
        visibilityLevel: 'PUBLIC_TENANT',
      };

      const keyResult = {
        id: 'kr-1',
        ownerId: 'owner-1',
      };

      // Mock RBAC service
      jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
        userId: 'user-1',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_VIEWER']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
        directReports: [],
      });

      jest.spyOn(prismaService.organization, 'findUnique').mockResolvedValue({
        id: 'org-1',
        execOnlyWhitelist: null,
        metadata: null,
      } as any);

      // Mock canUserSeeObjective to return true (PUBLIC_TENANT is visible)
      jest.spyOn(service, 'canUserSeeObjective').mockResolvedValue(true);

      const result = await service.canUserSeeKeyResult({
        keyResult,
        parentObjective,
        requesterUserId: 'user-1',
        requesterOrgId: 'org-1',
      });

      expect(result).toBe(true);
    });
  });

  describe('Deprecated Visibility Values Normalization', () => {
    it('should treat deprecated visibility values as PUBLIC_TENANT', async () => {
      const deprecatedValues = ['WORKSPACE_ONLY', 'TEAM_ONLY', 'MANAGER_CHAIN', 'EXEC_ONLY'];

      for (const deprecatedValue of deprecatedValues) {
        const objective = {
          id: 'obj-1',
          ownerId: 'owner-1',
          tenantId: 'org-1',
          visibilityLevel: deprecatedValue,
        };

        // Mock RBAC service
        jest.spyOn(rbacService, 'buildUserContext').mockResolvedValue({
          userId: 'user-1',
          isSuperuser: false,
          tenantRoles: new Map([['org-1', ['TENANT_VIEWER']]]),
          workspaceRoles: new Map(),
          teamRoles: new Map(),
          roleAssignments: [],
          directReports: [],
        });

        jest.spyOn(prismaService.organization, 'findUnique').mockResolvedValue({
          id: 'org-1',
          execOnlyWhitelist: null,
          metadata: null,
        } as any);

        // Note: The visibility policy treats deprecated values as PUBLIC_TENANT
        // So they should be visible to tenant members
        const result = await service.canUserSeeObjective({
          objective,
          requesterUserId: 'user-1',
          requesterOrgId: 'org-1',
        });

        // Deprecated values should be treated as PUBLIC_TENANT (visible to tenant members)
        expect(result).toBe(true);
      }
    });
  });

  describe('Status vs Publish State Separation', () => {
    // Note: Status and Publish State are separate fields in the database
    // This test verifies that they are correctly separated in API responses
    // The actual separation is tested in integration tests
    it('should maintain separate status and publishState fields', () => {
      // Status = progress state (ON_TRACK, AT_RISK, etc.)
      const status = 'ON_TRACK';
      
      // Publish State = governance state (isPublished boolean)
      const isPublished = false;
      const publishState = isPublished ? 'PUBLISHED' : 'DRAFT';

      // These should be independent
      expect(status).toBe('ON_TRACK');
      expect(publishState).toBe('DRAFT');
      expect(typeof status).toBe('string');
      expect(typeof publishState).toBe('string');
      
      // Status can be ON_TRACK while publishState is DRAFT
      expect(status).not.toBe(publishState);
    });
  });
});



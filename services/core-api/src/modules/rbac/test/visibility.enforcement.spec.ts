/**
 * Visibility Enforcement Tests
 * 
 * Tests for OKR visibility rules (PRIVATE, EXEC_ONLY, etc.)
 */

import { Test, TestingModule } from '@nestjs/testing';
import { canViewOKR } from '../visibilityPolicy';
import { UserContext, OKREntity, Tenant } from '../types';

describe('Visibility Enforcement', () => {
  describe('PRIVATE OKRs', () => {
    it('should allow owner to view PRIVATE OKR', () => {
      const userContext: UserContext = {
        userId: 'owner-id',
        isSuperuser: false,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const okr: OKREntity = {
        id: 'okr-1',
        ownerId: 'owner-id',
        tenantId: 'org-1',
        tenantId: 'org-1',
        visibilityLevel: 'PRIVATE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(userContext, okr)).toBe(true);
    });

    it('should deny non-owner from viewing PRIVATE OKR', () => {
      const userContext: UserContext = {
        userId: 'other-user-id',
        isSuperuser: false,
        tenantRoles: new Map(),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const okr: OKREntity = {
        id: 'okr-1',
        ownerId: 'owner-id',
        tenantId: 'org-1',
        tenantId: 'org-1',
        visibilityLevel: 'PRIVATE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(userContext, okr)).toBe(false);
    });

    it('should allow TENANT_OWNER to view PRIVATE OKR', () => {
      const userContext: UserContext = {
        userId: 'owner-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_OWNER']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const okr: OKREntity = {
        id: 'okr-1',
        ownerId: 'other-owner-id',
        tenantId: 'org-1',
        tenantId: 'org-1',
        visibilityLevel: 'PRIVATE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tenant: Tenant = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(userContext, okr, tenant)).toBe(true);
    });

    it('should deny TENANT_ADMIN from viewing PRIVATE OKR without whitelist', () => {
      const userContext: UserContext = {
        userId: 'admin-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_ADMIN']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const okr: OKREntity = {
        id: 'okr-1',
        ownerId: 'other-owner-id',
        tenantId: 'org-1',
        tenantId: 'org-1',
        visibilityLevel: 'PRIVATE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tenant: Tenant = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        execOnlyWhitelist: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(userContext, okr, tenant)).toBe(false);
    });

    it('should allow TENANT_ADMIN to view PRIVATE OKR if whitelisted', () => {
      const userContext: UserContext = {
        userId: 'admin-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_ADMIN']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const okr: OKREntity = {
        id: 'okr-1',
        ownerId: 'other-owner-id',
        tenantId: 'org-1',
        tenantId: 'org-1',
        visibilityLevel: 'PRIVATE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const tenant: Tenant = {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        execOnlyWhitelist: ['admin-id'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(userContext, okr, tenant)).toBe(true);
    });
  });

  describe('PUBLIC_TENANT OKRs', () => {
    it('should allow any tenant user to view PUBLIC_TENANT OKR', () => {
      const userContext: UserContext = {
        userId: 'user-id',
        isSuperuser: false,
        tenantRoles: new Map([['org-1', ['TENANT_VIEWER']]]),
        workspaceRoles: new Map(),
        teamRoles: new Map(),
        roleAssignments: [],
      };

      const okr: OKREntity = {
        id: 'okr-1',
        ownerId: 'owner-id',
        tenantId: 'org-1',
        tenantId: 'org-1',
        visibilityLevel: 'PUBLIC_TENANT',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(userContext, okr)).toBe(true);
    });
  });
});


/**
 * Visibility Policy Unit Tests
 */

import { canViewOKR } from './visibilityPolicy';
import { UserContext, OKREntity, Tenant, TenantRole, WorkspaceRole, TeamRole } from './types';

describe('Visibility Policy', () => {
  const baseUserContext: UserContext = {
    userId: 'user-1',
    isSuperuser: false,
    tenantRoles: new Map(),
    workspaceRoles: new Map(),
    teamRoles: new Map(),
    roleAssignments: [],
    directReports: [],
  };

  const baseOKR: OKREntity = {
    id: 'okr-1',
    ownerId: 'owner-1',
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    visibilityLevel: 'PUBLIC_TENANT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('PUBLIC_TENANT', () => {
    it('should allow tenant members to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        tenantRoles: new Map([['tenant-1', ['TENANT_ADMIN' as TenantRole]]]),
      };

      expect(canViewOKR(context, baseOKR)).toBe(true);
    });

    it('should allow workspace members to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        workspaceRoles: new Map([['workspace-1', ['WORKSPACE_MEMBER' as WorkspaceRole]]]),
      };

      expect(canViewOKR(context, baseOKR)).toBe(true);
    });

    it('should deny users not in tenant', () => {
      expect(canViewOKR(baseUserContext, baseOKR)).toBe(false);
    });
  });

  describe('WORKSPACE_ONLY', () => {
    const workspaceOnlyOKR: OKREntity = {
      ...baseOKR,
      visibilityLevel: 'WORKSPACE_ONLY',
    };

    it('should allow workspace members to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        workspaceRoles: new Map([['workspace-1', ['WORKSPACE_MEMBER' as WorkspaceRole]]]),
      };

      expect(canViewOKR(context, workspaceOnlyOKR)).toBe(true);
    });

    it('should allow tenant admin to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        tenantRoles: new Map([['tenant-1', ['TENANT_ADMIN' as TenantRole]]]),
      };

      expect(canViewOKR(context, workspaceOnlyOKR)).toBe(true);
    });

    it('should deny users not in workspace', () => {
      expect(canViewOKR(baseUserContext, workspaceOnlyOKR)).toBe(false);
    });
  });

  describe('TEAM_ONLY', () => {
    const teamOnlyOKR: OKREntity = {
      ...baseOKR,
      visibilityLevel: 'TEAM_ONLY',
    };

    it('should allow team members to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        teamRoles: new Map([['team-1', ['TEAM_CONTRIBUTOR' as TeamRole]]]),
      };

      expect(canViewOKR(context, teamOnlyOKR)).toBe(true);
    });

    it('should allow workspace lead to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        workspaceRoles: new Map([['workspace-1', ['WORKSPACE_LEAD' as WorkspaceRole]]]),
      };

      expect(canViewOKR(context, teamOnlyOKR)).toBe(true);
    });

    it('should allow tenant owner to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        tenantRoles: new Map([['tenant-1', ['TENANT_OWNER' as TenantRole]]]),
      };

      expect(canViewOKR(context, teamOnlyOKR)).toBe(true);
    });
  });

  describe('MANAGER_CHAIN', () => {
    const managerChainOKR: OKREntity = {
      ...baseOKR,
      visibilityLevel: 'MANAGER_CHAIN',
      ownerId: 'employee-1',
    };

    it('should allow owner to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        userId: 'employee-1',
      };

      expect(canViewOKR(context, managerChainOKR)).toBe(true);
    });

    it('should allow manager to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        userId: 'manager-1',
        directReports: ['employee-1'],
      };

      expect(canViewOKR(context, managerChainOKR)).toBe(true);
    });

    it('should allow workspace lead to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        workspaceRoles: new Map([['workspace-1', ['WORKSPACE_LEAD' as WorkspaceRole]]]),
      };

      expect(canViewOKR(context, managerChainOKR)).toBe(true);
    });

    it('should deny peers', () => {
      expect(canViewOKR(baseUserContext, managerChainOKR)).toBe(false);
    });
  });

  describe('EXEC_ONLY', () => {
    const execOnlyOKR: OKREntity = {
      ...baseOKR,
      visibilityLevel: 'EXEC_ONLY',
    };

    it('should allow tenant owner to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        tenantRoles: new Map([['tenant-1', ['TENANT_OWNER' as TenantRole]]]),
      };

      expect(canViewOKR(context, execOnlyOKR)).toBe(true);
    });

    it('should allow whitelisted user to view', () => {
      const context: UserContext = {
        ...baseUserContext,
        userId: 'whitelisted-user',
      };

      const tenant: Tenant = {
        id: 'tenant-1',
        name: 'Test Tenant',
        slug: 'test',
        execOnlyWhitelist: ['whitelisted-user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(context, execOnlyOKR, tenant)).toBe(true);
    });

    it('should deny non-whitelisted users', () => {
      const tenant: Tenant = {
        id: 'tenant-1',
        name: 'Test Tenant',
        slug: 'test',
        execOnlyWhitelist: ['other-user'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(canViewOKR(baseUserContext, execOnlyOKR, tenant)).toBe(false);
    });
  });

  describe('SUPERUSER', () => {
    it('should allow superuser to view any OKR', () => {
      const context: UserContext = {
        ...baseUserContext,
        isSuperuser: true,
      };

      const okr: OKREntity = {
        ...baseOKR,
        visibilityLevel: 'EXEC_ONLY',
      };

      expect(canViewOKR(context, okr)).toBe(true);
    });
  });
});


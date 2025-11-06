/**
 * Custom ESLint Rules for Tenant Isolation and RBAC
 * 
 * These rules help catch tenant isolation violations and RBAC gaps at lint time.
 */

const rbacRule = require('../../scripts/rbac/eslint-no-unguarded-mutation');
const noOrgIdentifierRule = require('../../scripts/eslint-rules/no-org-identifier');
const noUnguardedMutationsRule = require('../../scripts/eslint-rules/no-unguarded-mutations');

module.exports = {
  plugins: {
    'local-rbac': {
      rules: {
        'no-unguarded-mutation': rbacRule,
      },
    },
    'local-tenant': {
      rules: {
        'no-org-identifier': noOrgIdentifierRule,
        'no-unguarded-mutations': noUnguardedMutationsRule,
      },
    },
  },
  rules: {
    // RBAC: Ensure mutations have @RequireAction and RBACGuard
    'local-rbac/no-unguarded-mutation': 'error',
    
    // Tenant canonicalisation: Flag organizationId/organisationId/orgId usage
    'local-tenant/no-org-identifier': 'error',
    
    // Tenant guardrails: Ensure mutations have TenantMutationGuard
    'local-tenant/no-unguarded-mutations': 'warn',
    
    // Custom rule: Ensure findMany() includes tenant filter
    // This would require a custom ESLint plugin to implement
    'tenant-isolation/find-many-requires-tenant-filter': 'warn',
    
    // Custom rule: Ensure findById() validates tenant
    'tenant-isolation/find-by-id-requires-tenant-validation': 'warn',
    
    // Custom rule: Ensure controllers pass organizationId
    'tenant-isolation/controller-must-pass-organization-id': 'warn',
  },
};



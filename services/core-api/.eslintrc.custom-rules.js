/**
 * Custom ESLint Rules for Tenant Isolation
 * 
 * These rules help catch tenant isolation violations at lint time.
 * 
 * Note: Full implementation would require a custom ESLint plugin.
 * For now, these are documented patterns to check manually.
 */

module.exports = {
  rules: {
    // Custom rule: Ensure findMany() includes tenant filter
    // This would require a custom ESLint plugin to implement
    'tenant-isolation/find-many-requires-tenant-filter': 'warn',
    
    // Custom rule: Ensure findById() validates tenant
    'tenant-isolation/find-by-id-requires-tenant-validation': 'warn',
    
    // Custom rule: Ensure controllers pass organizationId
    'tenant-isolation/controller-must-pass-organization-id': 'warn',
  },
};



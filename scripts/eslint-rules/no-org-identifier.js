/**
 * ESLint Rule: No Org Identifier
 * 
 * Ensures organizationId/organisationId/orgId are not used in core-api (except DTO mappers).
 * 
 * Allowed exceptions:
 * - DTO files (*.dto.ts) - for backward compatibility mapping
 * - Test files (*.spec.ts) - for test data
 * - Migration files (*.migration.ts, *.sql) - for database schema
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce tenantId usage instead of organizationId/organisationId/orgId',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noOrgIdentifier: 'Use "tenantId" instead of "{{identifier}}". organizationId/organisationId/orgId are deprecated.',
    },
  },
  create(context) {
    const filename = context.getFilename();
    
    // Allow DTOs, tests, migrations, and seed files
    const isAllowedFile = 
      filename.includes('.dto.ts') ||
      filename.includes('.spec.ts') ||
      filename.includes('.test.ts') ||
      filename.includes('migration') ||
      filename.includes('seed') ||
      filename.includes('factory');
    
    return {
      Identifier(node) {
        if (isAllowedFile) {
          return;
        }
        
        const name = node.name;
        const forbiddenPatterns = [
          /^organizationId$/,
          /^organisationId$/,
          /^orgId$/,
        ];
        
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(name)) {
            // Check if it's a property access (obj.organizationId)
            const parent = node.parent;
            if (parent && (
              parent.type === 'MemberExpression' ||
              parent.type === 'Property' ||
              parent.type === 'PropertyDefinition'
            )) {
              context.report({
                node,
                messageId: 'noOrgIdentifier',
                data: {
                  identifier: name,
                },
              });
            }
          }
        }
      },
    };
  },
};


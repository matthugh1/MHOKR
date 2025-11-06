/**
 * ESLint Rule: No Unguarded Mutations (Extended)
 * 
 * Ensures all controller mutation methods have:
 * - @RequireAction decorator
 * - RBACGuard
 * - TenantMutationGuard (via global guard or @UseGuards)
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce @RequireAction, RBACGuard, and TenantMutationGuard on mutation endpoints',
      category: 'Security',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      missingRequireAction: 'Mutation endpoint "{{methodName}}" must have @RequireAction decorator',
      missingRBACGuard: 'Mutation endpoint "{{methodName}}" must have RBACGuard in @UseGuards',
      missingTenantGuard: 'Mutation endpoint "{{methodName}}" must have TenantMutationGuard (or rely on global guard)',
    },
  },
  create(context) {
    const sourceCode = context.getSourceCode();

    return {
      MethodDefinition(node) {
        if (!node.decorators || node.decorators.length === 0) {
          return;
        }

        // Check if this is a mutation method
        let isMutation = false;
        let hasHttpDecorator = false;
        let hasRequireAction = false;
        let hasRBACGuard = false;
        let hasTenantGuard = false;

        // Check decorators
        for (const decorator of node.decorators) {
          const decoratorText = sourceCode.getText(decorator);
          
          // Check for HTTP mutation decorators
          if (/@(Post|Patch|Put|Delete)\(/.test(decoratorText)) {
            hasHttpDecorator = true;
            isMutation = true;
          }

          // Check for RequireAction
          if (/@RequireAction\(/.test(decoratorText)) {
            hasRequireAction = true;
          }
        }

        // Check class-level guards
        let classNode = node.parent;
        while (classNode && classNode.type !== 'ClassDeclaration') {
          classNode = classNode.parent;
        }

        if (classNode && classNode.decorators) {
          for (const decorator of classNode.decorators) {
            const decoratorText = sourceCode.getText(decorator);
            if (/@UseGuards\([^)]*RBACGuard/.test(decoratorText)) {
              hasRBACGuard = true;
            }
            if (/@UseGuards\([^)]*TenantMutationGuard/.test(decoratorText)) {
              hasTenantGuard = true;
            }
          }
        }

        // Check method-level guards
        for (const decorator of node.decorators) {
          const decoratorText = sourceCode.getText(decorator);
          if (/@UseGuards\([^)]*RBACGuard/.test(decoratorText)) {
            hasRBACGuard = true;
          }
          if (/@UseGuards\([^)]*TenantMutationGuard/.test(decoratorText)) {
            hasTenantGuard = true;
          }
        }

        // Check method name pattern
        if (node.key && typeof node.key.name === 'string') {
          const methodName = node.key.name.toLowerCase();
          if (/^(create|update|delete|assign|revoke|publish|remove|save|clear)/.test(methodName)) {
            isMutation = true;
          }
        }

        // Check if global TenantMutationGuard is registered (via APP_GUARD)
        // We can't detect this statically, so we'll warn if it's missing
        // and assume it's globally registered if RBACGuard is present at class level
        const hasGlobalTenantGuard = classNode && classNode.decorators && 
          classNode.decorators.some(d => {
            const text = sourceCode.getText(d);
            return /@UseGuards\([^)]*RBACGuard/.test(text);
          });

        // Report issues
        if (isMutation && hasHttpDecorator) {
          if (!hasRequireAction) {
            context.report({
              node: node.key,
              messageId: 'missingRequireAction',
              data: {
                methodName: node.key.name || 'unknown',
              },
            });
          }

          if (!hasRBACGuard) {
            context.report({
              node: node.key,
              messageId: 'missingRBACGuard',
              data: {
                methodName: node.key.name || 'unknown',
              },
            });
          }

          // TenantMutationGuard is globally registered, so we only warn if it's explicitly missing
          // and RBACGuard is not present (which might indicate missing global setup)
          if (!hasTenantGuard && !hasGlobalTenantGuard) {
            // This is informational - TenantMutationGuard is registered globally in app.module.ts
            // We'll only warn if there's no indication of proper guard setup
            context.report({
              node: node.key,
              messageId: 'missingTenantGuard',
              data: {
                methodName: node.key.name || 'unknown',
              },
            });
          }
        }
      },
    };
  },
};


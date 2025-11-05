/**
 * ESLint Rule: No Unguarded Mutations
 * 
 * Ensures all controller mutation methods have @RequireAction and RBACGuard.
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce @RequireAction and RBACGuard on mutation endpoints',
      category: 'Security',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      missingRequireAction: 'Mutation endpoint "{{methodName}}" must have @RequireAction decorator',
      missingRBACGuard: 'Mutation endpoint "{{methodName}}" must have RBACGuard in @UseGuards',
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
          }
        }

        // Check method-level guards
        for (const decorator of node.decorators) {
          const decoratorText = sourceCode.getText(decorator);
          if (/@UseGuards\([^)]*RBACGuard/.test(decoratorText)) {
            hasRBACGuard = true;
          }
        }

        // Check method name pattern
        if (node.key && typeof node.key.name === 'string') {
          const methodName = node.key.name.toLowerCase();
          if (/^(create|update|delete|assign|revoke|publish|remove|save|clear)/.test(methodName)) {
            isMutation = true;
          }
        }

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
        }
      },
    };
  },
};


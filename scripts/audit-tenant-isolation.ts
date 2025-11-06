#!/usr/bin/env ts-node

/**
 * Tenant Isolation Audit Script
 * 
 * Scans the codebase for potential tenant isolation violations:
 * - findMany() calls without organizationId filter
 * - findUnique() calls without tenant validation
 * - Controller endpoints that don't validate tenant context
 * 
 * Usage: npm run audit:tenant-isolation
 */

import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  type: 'findMany' | 'findUnique' | 'findFirst' | 'controller' | 'missing_validation';
  severity: 'error' | 'warning';
  message: string;
  code: string;
}

const violations: Violation[] = [];
const serviceFiles: string[] = [];
const controllerFiles: string[] = [];

// Patterns to scan for
const PATTERNS = {
  FIND_MANY: /\.findMany\s*\(/,
  FIND_UNIQUE: /\.findUnique\s*\(/,
  FIND_FIRST: /\.findFirst\s*\(/,
  ORGANIZATION_ID: /organizationId|organization_id/,
  TENANT_GUARD: /OkrTenantGuard|assertSameTenant|buildTenantWhereClause/,
  USER_ORG_ID: /userOrganizationId|req\.user\.organizationId/,
};

// Tenant-scoped models that MUST have tenant filtering
const TENANT_SCOPED_MODELS = [
  'objective',
  'keyResult',
  'workspace',
  'team',
  'organization',
  'cycle',
  'initiative',
  'checkInRequest',
];

// Exceptions - files that are allowed to have tenant-scoped queries without validation
const EXCEPTIONS = [
  'tenant-guard.ts',
  'rbac.service.ts',
  'test',
  'spec.ts',
  '.spec.ts',
  '__tests__',
  'migration',
  'seed',
];

function isException(filePath: string): boolean {
  return EXCEPTIONS.some(exception => filePath.includes(exception));
}

function isTenantScopedModel(modelName: string): boolean {
  return TENANT_SCOPED_MODELS.some(model => 
    modelName.toLowerCase().includes(model.toLowerCase())
  );
}

function scanFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const fileName = path.basename(filePath);

  // Skip exceptions
  if (isException(filePath)) {
    return;
  }

  // Check for findMany() calls
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for findMany without tenant filtering
    if (PATTERNS.FIND_MANY.test(line)) {
      // Check if this is a tenant-scoped model
      const modelMatch = line.match(/(\w+)\.findMany/);
      if (modelMatch && isTenantScopedModel(modelMatch[1])) {
        // Check if tenant filter exists in nearby lines (within 10 lines)
        const contextStart = Math.max(0, index - 5);
        const contextEnd = Math.min(lines.length, index + 10);
        const context = lines.slice(contextStart, contextEnd).join('\n');
        
        const hasTenantFilter = 
          PATTERNS.ORGANIZATION_ID.test(context) ||
          PATTERNS.TENANT_GUARD.test(context) ||
          PATTERNS.USER_ORG_ID.test(context);
        
        if (!hasTenantFilter) {
          violations.push({
            file: filePath,
            line: lineNum,
            type: 'findMany',
            severity: 'error',
            message: `findMany() call on tenant-scoped model '${modelMatch[1]}' without tenant filtering`,
            code: line.trim(),
          });
        }
      }
    }

    // Check for findUnique without tenant validation
    if (PATTERNS.FIND_UNIQUE.test(line)) {
      const modelMatch = line.match(/(\w+)\.findUnique/);
      if (modelMatch && isTenantScopedModel(modelMatch[1])) {
        // Check if tenant validation exists in method (scan rest of method)
        const methodStart = index;
        let methodEnd = index;
        let braceCount = 0;
        let inMethod = false;
        
        for (let i = index; i < Math.min(lines.length, index + 50); i++) {
          const currentLine = lines[i];
          if (currentLine.includes('{')) {
            braceCount++;
            inMethod = true;
          }
          if (currentLine.includes('}')) {
            braceCount--;
            if (braceCount === 0 && inMethod) {
              methodEnd = i;
              break;
            }
          }
        
        const methodBody = lines.slice(methodStart, methodEnd + 1).join('\n');
        const hasTenantValidation = 
          PATTERNS.TENANT_GUARD.test(methodBody) ||
          (PATTERNS.ORGANIZATION_ID.test(methodBody) && PATTERNS.USER_ORG_ID.test(methodBody));
        
        if (!hasTenantValidation) {
          violations.push({
            file: filePath,
            line: lineNum,
            type: 'findUnique',
            severity: 'warning',
            message: `findUnique() call on tenant-scoped model '${modelMatch[1]}' - verify tenant validation exists in method`,
            code: line.trim(),
          });
        }
      }
    }

    // Check for findFirst without tenant filtering
    if (PATTERNS.FIND_FIRST.test(line)) {
      const modelMatch = line.match(/(\w+)\.findFirst/);
      if (modelMatch && isTenantScopedModel(modelMatch[1])) {
        const contextStart = Math.max(0, index - 5);
        const contextEnd = Math.min(lines.length, index + 10);
        const context = lines.slice(contextStart, contextEnd).join('\n');
        
        const hasTenantFilter = 
          PATTERNS.ORGANIZATION_ID.test(context) ||
          PATTERNS.TENANT_GUARD.test(context);
        
        if (!hasTenantFilter) {
          violations.push({
            file: filePath,
            line: lineNum,
            type: 'findFirst',
            severity: 'warning',
            message: `findFirst() call on tenant-scoped model '${modelMatch[1]}' - verify tenant filtering`,
            code: line.trim(),
          });
        }
      }
    }
  });

  // Check controllers for missing tenant validation
  if (fileName.includes('.controller.ts')) {
    const hasRequireAction = content.includes('@RequireAction');
    const hasTenantValidation = 
      PATTERNS.TENANT_GUARD.test(content) ||
      content.includes('req.user.organizationId');
    
    // If controller has endpoints but no tenant validation, flag it
    if (hasRequireAction && !hasTenantValidation && !isException(filePath)) {
      violations.push({
        file: filePath,
        line: 1,
        type: 'controller',
        severity: 'warning',
        message: 'Controller with @RequireAction endpoints - verify tenant validation is implemented',
        code: fileName,
      });
    }
  }
}

function findFiles(dir: string, pattern: RegExp, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFiles(filePath, pattern, fileList);
    } else if (pattern.test(file)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

async function main() {
  console.log('🔍 Scanning for tenant isolation violations...\n');

  const modulesDir = path.join(process.cwd(), 'services/core-api/src/modules');
  
  if (!fs.existsSync(modulesDir)) {
    console.error(`Error: Modules directory not found: ${modulesDir}`);
    process.exit(1);
  }

  const serviceFiles = findFiles(modulesDir, /\.service\.ts$/);
  const controllerFiles = findFiles(modulesDir, /\.controller\.ts$/);

  console.log(`Found ${serviceFiles.length} service files`);
  console.log(`Found ${controllerFiles.length} controller files\n`);

  // Scan all files
  [...serviceFiles, ...controllerFiles].forEach(scanFile);

  // Report results
  console.log('📊 Audit Results:\n');

  const errors = violations.filter(v => v.severity === 'error');
  const warnings = violations.filter(v => v.severity === 'warning');

  if (errors.length > 0) {
    console.log(`❌ ERRORS (${errors.length}):\n`);
    errors.forEach(v => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`  ${v.message}`);
      console.log(`  Code: ${v.code}\n`);
    });
  }

  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS (${warnings.length}):\n`);
    warnings.forEach(v => {
      console.log(`  ${v.file}:${v.line}`);
      console.log(`  ${v.message}`);
      console.log(`  Code: ${v.code}\n`);
    });
  }

  if (violations.length === 0) {
    console.log('✅ No tenant isolation violations found!\n');
  } else {
    console.log(`\n📝 Summary: ${errors.length} errors, ${warnings.length} warnings`);
    console.log('\n⚠️  Please review the above violations and ensure tenant isolation is properly enforced.\n');
  }

  // Exit with error code if there are errors
  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Error running audit:', error);
  process.exit(1);
});


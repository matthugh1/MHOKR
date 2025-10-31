#!/usr/bin/env node

/**
 * Pre-merge Architecture Audit Script
 * 
 * Lightweight static audit to verify architecture boundaries are intact.
 * This script checks for violations of our refactored architecture patterns.
 */

const fs = require('fs');
const path = require('path');

const VIOLATIONS = [];

function checkFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    VIOLATIONS.push(`[VIOLATION] ${description} - File not found: ${filePath}`);
  }
}

function checkFileContent(filePath, description, shouldContain, shouldNotContain = []) {
  if (!fs.existsSync(filePath)) {
    VIOLATIONS.push(`[VIOLATION] ${description} - File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (shouldContain && !content.includes(shouldContain)) {
    VIOLATIONS.push(`[VIOLATION] ${description} - File should contain: "${shouldContain}"`);
  }

  shouldNotContain.forEach((pattern) => {
    if (content.includes(pattern)) {
      VIOLATIONS.push(`[VIOLATION] ${description} - File should NOT contain: "${pattern}"`);
    }
  });
}

function checkFileDoesNotContain(filePath, description, patterns) {
  if (!fs.existsSync(filePath)) {
    // File doesn't exist, so no violation
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  patterns.forEach((pattern) => {
    if (content.includes(pattern)) {
      VIOLATIONS.push(`[VIOLATION] ${description} - File contains: "${pattern}"`);
    }
  });
}

function findAllFiles(dir, extension, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and dist directories
      if (!file.includes('node_modules') && !file.includes('dist')) {
        findAllFiles(filePath, extension, fileList);
      }
    } else if (filePath.endsWith(extension)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Main audit checks

console.log('🔍 Running pre-merge architecture audit...\n');

const repoRoot = path.resolve(__dirname, '..');

// Check 1: ObjectiveService and KeyResultService should NOT contain legacy tenant isolation
// We check for manual where clause building without using OkrTenantGuard.buildTenantWhereClause
const objectiveServicePath = path.join(repoRoot, 'services/core-api/src/modules/okr/objective.service.ts');
const keyResultServicePath = path.join(repoRoot, 'services/core-api/src/modules/okr/key-result.service.ts');

// Check for manual where clause building patterns (violations)
if (fs.existsSync(objectiveServicePath)) {
  const content = fs.readFileSync(objectiveServicePath, 'utf8');
  // Check for patterns like: where: { organizationId: userOrganizationId } without using OkrTenantGuard
  const manualWherePattern = /where:\s*\{[^}]*organizationId:\s*userOrganizationId[^}]*\}/;
  if (manualWherePattern.test(content) && !content.includes('OkrTenantGuard.buildTenantWhereClause')) {
    VIOLATIONS.push('[VIOLATION] ObjectiveService contains manual tenant isolation in where clause. Must use OkrTenantGuard.buildTenantWhereClause().');
  }
}

if (fs.existsSync(keyResultServicePath)) {
  const content = fs.readFileSync(keyResultServicePath, 'utf8');
  const manualWherePattern = /where:\s*\{[^}]*organizationId:\s*userOrganizationId[^}]*\}/;
  if (manualWherePattern.test(content) && !content.includes('OkrTenantGuard.buildTenantWhereClause')) {
    VIOLATIONS.push('[VIOLATION] KeyResultService contains manual tenant isolation in where clause. Must use OkrTenantGuard.buildTenantWhereClause().');
  }
}

// Check 2: ObjectiveService and KeyResultService should NOT contain inline lock checks
checkFileDoesNotContain(
  objectiveServicePath,
  'ObjectiveService contains inline cycle lock checks. Must use OkrGovernanceService.',
  ['checkCycleLock(', 'checkCycleLockForKR(']
);

checkFileDoesNotContain(
  keyResultServicePath,
  'KeyResultService contains inline cycle lock checks. Must use OkrGovernanceService.',
  ['checkCycleLock(', 'checkCycleLockForKR(']
);

// Check 3: Only OkrReportingController should declare /reports routes
const reportingControllerPath = path.join(repoRoot, 'services/core-api/src/modules/okr/okr-reporting.controller.ts');
const objectiveControllerPath = path.join(repoRoot, 'services/core-api/src/modules/okr/objective.controller.ts');
const keyResultControllerPath = path.join(repoRoot, 'services/core-api/src/modules/okr/key-result.controller.ts');

checkFileContent(
  reportingControllerPath,
  'OkrReportingController must exist and contain /reports routes',
  '@Controller(\'reports\')'
);

checkFileDoesNotContain(
  objectiveControllerPath,
  'ObjectiveController should not contain /reports routes. Use OkrReportingController.',
  ['@Get(\'/reports', '@Get(\'reports']
);

checkFileDoesNotContain(
  keyResultControllerPath,
  'KeyResultController should not contain /reports routes. Use OkrReportingController.',
  ['@Get(\'/reports', '@Get(\'reports']
);

// Check 4: Only ActivityController should declare /activity routes
const activityControllerPath = path.join(repoRoot, 'services/core-api/src/modules/activity/activity.controller.ts');

checkFileContent(
  activityControllerPath,
  'ActivityController must exist and contain /activity routes',
  '@Controller(\'activity\')'
);

checkFileDoesNotContain(
  objectiveControllerPath,
  'ObjectiveController should not contain /activity routes. Use ActivityController.',
  ['@Get(\'/activity', '@Get(\'activity']
);

checkFileDoesNotContain(
  keyResultControllerPath,
  'KeyResultController should not contain /activity routes. Use ActivityController.',
  ['@Get(\'/activity', '@Get(\'activity']
);

// Check 5: Frontend okrs/page.tsx should use useTenantPermissions, not useTenantAdmin
const okrsPagePath = path.join(repoRoot, 'apps/web/src/app/dashboard/okrs/page.tsx');

checkFileContent(
  okrsPagePath,
  'okrs/page.tsx should import useTenantPermissions',
  'useTenantPermissions'
);

checkFileDoesNotContain(
  okrsPagePath,
  'okrs/page.tsx should not import useTenantAdmin. Use useTenantPermissions instead.',
  ['useTenantAdmin', 'from \'@/hooks/useTenantAdmin']
);

// Check 6: Frontend analytics/page.tsx should import StatCard from components/ui
const analyticsPagePath = path.join(repoRoot, 'apps/web/src/app/dashboard/analytics/page.tsx');

checkFileContent(
  analyticsPagePath,
  'analytics/page.tsx should import StatCard from components/ui',
  'from \'@/components/ui/StatCard\''
);

// Check that it doesn't define StatCard inline (should be a function definition check, but we'll check for common patterns)
checkFileDoesNotContain(
  analyticsPagePath,
  'analytics/page.tsx should not define StatCard inline. Use shared component.',
  ['const StatCard =', 'function StatCard', 'export const StatCard']
);

// Check 7: StatusBadge component must exist
const statusBadgePath = path.join(repoRoot, 'apps/web/src/components/ui/StatusBadge.tsx');
checkFileExists(statusBadgePath, 'StatusBadge component must exist in components/ui');

// Check 8: Builder pages should use useTenantPermissions, not useTenantAdmin or raw role checks
const builderDir = path.join(repoRoot, 'apps/web/src/app/dashboard/builder');
if (fs.existsSync(builderDir)) {
  const builderFiles = findAllFiles(builderDir, '.tsx');
  builderFiles.forEach((filePath) => {
    // Skip test files
    if (filePath.includes('__tests__') || filePath.includes('.test.')) {
      return;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for useTenantAdmin import (violation)
    if (content.includes('useTenantAdmin') || content.includes('from \'@/hooks/useTenantAdmin\'')) {
      VIOLATIONS.push(`[VIOLATION] Builder file should not import useTenantAdmin. Use useTenantPermissions instead: ${filePath}`);
    }
    
    // Check for raw role checks (isTenantAdmin, isTenantOwner, etc.) without useTenantPermissions
    const rawRoleCheckPatterns = [
      /isTenantAdmin\s*\(/,
      /isTenantOwner\s*\(/,
      /canAdministerTenant\s*\(/,
    ];
    const hasRawRoleCheck = rawRoleCheckPatterns.some(pattern => pattern.test(content));
    const hasUseTenantPermissions = content.includes('useTenantPermissions');
    
    if (hasRawRoleCheck && !hasUseTenantPermissions) {
      VIOLATIONS.push(`[VIOLATION] Builder file contains raw role checks without useTenantPermissions. Must use useTenantPermissions hook: ${filePath}`);
    }
  });
}

// Check 9: Contributing and Coding Standards docs must exist
const contributingPath = path.join(repoRoot, 'CONTRIBUTING.md');
const codingStandardsPath = path.join(repoRoot, 'CODING_STANDARDS.md');

checkFileExists(contributingPath, 'CONTRIBUTING.md must exist in repo root');
checkFileExists(codingStandardsPath, 'CODING_STANDARDS.md must exist in repo root');

// Check 10: Verify BuildStamp is imported in dashboard page files
const expectedBuildStampPages = [
  path.join(repoRoot, 'apps/web/src/app/dashboard/analytics/page.tsx'),
  path.join(repoRoot, 'apps/web/src/app/dashboard/okrs/page.tsx'),
  path.join(repoRoot, 'apps/web/src/app/dashboard/ai/page.tsx'),
  path.join(repoRoot, 'apps/web/src/app/dashboard/builder/page.tsx'),
];

expectedBuildStampPages.forEach((filePath) => {
  checkFileContent(
    filePath,
    `BuildStamp must be imported in ${path.basename(filePath)}`,
    'from \'@/components/ui/BuildStamp\''
  );
});

// Check 11: Verify BuildStamp is imported in ActivityDrawer
const activityDrawerPath = path.join(repoRoot, 'apps/web/src/components/ui/ActivityDrawer.tsx');

checkFileContent(
  activityDrawerPath,
  'BuildStamp must be imported in ActivityDrawer.tsx',
  'from \'./BuildStamp\''
);

// Report results
console.log(`\n📊 Audit complete. Found ${VIOLATIONS.length} violation(s).\n`);

if (VIOLATIONS.length > 0) {
  console.log('⚠️  VIOLATIONS DETECTED:\n');
  VIOLATIONS.forEach((violation, index) => {
    console.log(`${index + 1}. ${violation}`);
  });
  console.log('\n❌ Architecture boundaries violated. Please fix before merging to main.\n');
  process.exit(1);
} else {
  console.log('✅ All architecture boundaries intact. Ready for merge.\n');
  process.exit(0);
}


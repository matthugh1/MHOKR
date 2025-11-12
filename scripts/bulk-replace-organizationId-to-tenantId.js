#!/usr/bin/env node
/**
 * Bulk Replace Script: organizationId → tenantId
 * 
 * This script performs bulk find/replace across the codebase.
 * 
 * Usage:
 *   node scripts/bulk-replace-organizationId-to-tenantId.js
 * 
 * What it does:
 * - Finds all .ts files in services/core-api/src
 * - Replaces organizationId → tenantId (with context-aware replacements)
 * - Preserves Organization model/table names
 * - Updates variable names intelligently
 * 
 * Run this AFTER updating Prisma schema and BEFORE running migration.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '../../services/core-api/src');
const EXCLUDE_PATTERNS = [
  'node_modules',
  '__tests__',
  '*.spec.ts',
  '*.test.ts',
];

// Patterns to replace
const REPLACEMENTS = [
  // Property access patterns
  { pattern: /\borganizationId\b/g, replacement: 'tenantId' },
  // Variable names (but keep 'organization' as entity name)
  { pattern: /\buserOrganizationId\b/g, replacement: 'userTenantId' },
  { pattern: /\bresourceOrganizationId\b/g, replacement: 'resourceTenantId' },
  { pattern: /\borganizationId:\s*([^,}]+)/g, replacement: 'tenantId: $1' },
  // Method parameters
  { pattern: /\(organizationId:/g, replacement: '(tenantId:' },
  // Comments
  { pattern: /\/\/.*organizationId/g, replacement: (match) => match.replace('organizationId', 'tenantId') },
];

function shouldProcessFile(filePath) {
  if (!filePath.endsWith('.ts')) return false;
  if (filePath.includes('node_modules')) return false;
  if (filePath.includes('__tests__')) return false;
  if (filePath.includes('.spec.ts')) return false;
  if (filePath.includes('.test.ts')) return false;
  return true;
}

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Skip if file contains 'Organization' model references (keep those)
  // But replace organizationId field references
  
  for (const { pattern, replacement } of REPLACEMENTS) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
    return true;
  }
  return false;
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (shouldProcessFile(filePath)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function main() {
  console.log('Starting bulk replacement: organizationId → tenantId');
  console.log(`Scanning: ${ROOT_DIR}`);
  
  const files = walkDir(ROOT_DIR);
  console.log(`Found ${files.length} files to process`);
  
  let updatedCount = 0;
  files.forEach(file => {
    if (replaceInFile(file)) {
      updatedCount++;
    }
  });
  
  console.log(`\nComplete! Updated ${updatedCount} files.`);
  console.log('\nNext steps:');
  console.log('1. Review changes with: git diff');
  console.log('2. Run tests: npm test');
  console.log('3. Run migration: npx prisma migrate deploy');
}

if (require.main === module) {
  main();
}

module.exports = { replaceInFile, walkDir };


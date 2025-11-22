#!/usr/bin/env ts-node
/**
 * Static Analysis: Enforce No Script Imports in Runtime Code
 * 
 * This script ensures that runtime application code never imports or requires
 * files from script directories. Scripts are for operational/maintenance purposes
 * and must not be part of the production runtime.
 * 
 * Exit codes:
 * - 0: No violations found
 * - 1: Violations found or error occurred
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Runtime code roots - directories containing application code that is built
 * and shipped as part of the running application.
 */
const RUNTIME_ROOTS = [
  'apps/*/src',
  'services/*/src',
  'packages/*/src',
];

/**
 * Script roots - directories containing operational/maintenance scripts
 * that should never be imported by runtime code.
 */
const SCRIPT_ROOTS = [
  'scripts',
  // Note: services/core-api/scripts/ has been emptied - all scripts moved to scripts/
  // Root-level script files (e.g., create-superuser.ts) are now in scripts/
  // These will be detected by checking if file is in root and matches script patterns
];

/**
 * File extensions to check for imports
 */
const RUNTIME_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/**
 * File extensions that indicate scripts (to detect root-level scripts)
 */
const SCRIPT_EXTENSIONS = ['.ts', '.js', '.mjs'];

/**
 * Path aliases that are allowed (these resolve to packages, not scripts)
 */
const ALLOWED_PATH_ALIASES = [
  '@okr-nexus/types',
  '@okr-nexus/utils',
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a file path is within a runtime root
 */
function isRuntimeFile(filePath: string, repoRoot: string): boolean {
  const relativePath = path.relative(repoRoot, filePath);
  
  for (const rootPattern of RUNTIME_ROOTS) {
    // Handle wildcard patterns like 'apps/*/src'
    if (rootPattern.includes('*')) {
      const [prefix, suffix] = rootPattern.split('*');
      if (relativePath.startsWith(prefix) && relativePath.includes(suffix)) {
        return true;
      }
    } else if (relativePath.startsWith(rootPattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if a directory or file is a script root
 */
function isScriptPath(targetPath: string, repoRoot: string): boolean {
  const relativePath = path.relative(repoRoot, targetPath);
  
  // Check against known script directories
  for (const scriptRoot of SCRIPT_ROOTS) {
    if (relativePath.startsWith(scriptRoot)) {
      return true;
    }
  }
  
  // Check if it's a root-level script file
  const pathParts = relativePath.split(path.sep);
  if (pathParts.length === 1 || (pathParts.length === 2 && pathParts[0] === '..')) {
    const ext = path.extname(relativePath);
    if (SCRIPT_EXTENSIONS.includes(ext)) {
      // Additional check: not a config file (like tsconfig.json, package.json)
      const basename = path.basename(relativePath, ext);
      const configFiles = ['tsconfig', 'package', 'jest.config', 'next.config'];
      if (!configFiles.some(cfg => basename.startsWith(cfg))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Resolve an import path relative to the importing file
 */
function resolveImportPath(
  importPath: string,
  importingFile: string,
  _repoRoot: string
): string | null {
  // Skip node_modules imports (npm packages)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    // If it starts with @, it's either a scoped npm package or a path alias
    if (importPath.startsWith('@')) {
      // Skip known path aliases (these are packages, not scripts)
      if (ALLOWED_PATH_ALIASES.some(alias => importPath.startsWith(alias))) {
        return null;
      }
      // Skip scoped npm packages (e.g., @nestjs/*, @prisma/*, @testing-library/*, @tanstack/*)
      // These are external dependencies, not scripts
      return null;
    }
    // All other non-relative imports are npm packages
    return null;
  }
  
  // Resolve relative imports
  if (importPath.startsWith('.')) {
    const importingDir = path.dirname(importingFile);
    const resolved = path.resolve(importingDir, importPath);
    
    // Try with and without extensions
    const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '/index.ts', '/index.js'];
    for (const ext of extensions) {
      const candidate = resolved + ext;
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    
    // If directory exists, check for index file
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];
      for (const indexFile of indexFiles) {
        const candidate = path.join(resolved, indexFile);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
    
    return resolved;
  }
  
  // Absolute paths (shouldn't happen in this codebase, but handle it)
  if (importPath.startsWith('/')) {
    return importPath;
  }
  
  return null;
}

/**
 * Extract import/require statements from a file
 */
function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const imports: string[] = [];
  
  // Match ES6 imports: import ... from '...'
  const es6ImportRegex = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6ImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match require statements: require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  // Match dynamic imports: import('...')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Find all runtime files in the repository
 */
function findRuntimeFiles(repoRoot: string): string[] {
  const runtimeFiles: string[] = [];
  
  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      // Skip node_modules, dist, build, .next, etc.
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build' ||
          entry.name === '.next' ||
          entry.name === 'coverage') {
        continue;
      }
      
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (RUNTIME_EXTENSIONS.includes(ext)) {
          if (isRuntimeFile(fullPath, repoRoot)) {
            runtimeFiles.push(fullPath);
          }
        }
      }
    }
  }
  
  // Walk through runtime roots
  for (const rootPattern of RUNTIME_ROOTS) {
    if (rootPattern.includes('*')) {
      // Handle wildcard: apps/*/src
      const [prefix, suffix] = rootPattern.split('*');
      const prefixPath = path.join(repoRoot, prefix);
      if (fs.existsSync(prefixPath)) {
        const dirs = fs.readdirSync(prefixPath, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => path.join(prefixPath, d.name, suffix));
        
        for (const dir of dirs) {
          if (fs.existsSync(dir)) {
            walkDir(dir);
          }
        }
      }
    } else {
      const rootPath = path.join(repoRoot, rootPattern);
      if (fs.existsSync(rootPath)) {
        walkDir(rootPath);
      }
    }
  }
  
  return runtimeFiles;
}

// ============================================================================
// Main Logic
// ============================================================================

interface Violation {
  runtimeFile: string;
  importPath: string;
  scriptPath: string;
  line?: number;
}

function main(): void {
  const repoRoot = path.resolve(__dirname, '..');
  const violations: Violation[] = [];
  
  console.log('🔍 Scanning runtime files for script imports...\n');
  
  const runtimeFiles = findRuntimeFiles(repoRoot);
  console.log(`Found ${runtimeFiles.length} runtime files to check\n`);
  
  for (const runtimeFile of runtimeFiles) {
    try {
      const imports = extractImports(runtimeFile);
      
      for (const importPath of imports) {
        const resolved = resolveImportPath(importPath, runtimeFile, repoRoot);
        
        if (resolved && isScriptPath(resolved, repoRoot)) {
          violations.push({
            runtimeFile: path.relative(repoRoot, runtimeFile),
            importPath,
            scriptPath: path.relative(repoRoot, resolved),
          });
        }
      }
    } catch (error) {
      console.error(`Error processing ${runtimeFile}:`, error);
    }
  }
  
  // Report results
  if (violations.length === 0) {
    console.log('✅ No violations found. Runtime code does not import scripts.\n');
    process.exit(0);
  } else {
    console.error(`❌ Found ${violations.length} violation(s):\n`);
    
    for (const violation of violations) {
      console.error(`  Runtime file: ${violation.runtimeFile}`);
      console.error(`  Import:       ${violation.importPath}`);
      console.error(`  Script path:  ${violation.scriptPath}`);
      console.error('');
    }
    
    console.error('❌ Violations found. Runtime code must not import scripts.\n');
    console.error('Please refactor so that:');
    console.error('  1. Shared logic is moved to packages/*/src');
    console.error('  2. Scripts remain independent operational tools');
    console.error('  3. Runtime code uses stable APIs, not script modules\n');
    
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}


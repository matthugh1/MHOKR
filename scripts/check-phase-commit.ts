#!/usr/bin/env node

/**
 * Pre-commit hook: Check phase tags in staged files
 * 
 * Validates:
 * 1. No TODOs contain :done tags (these should be removed from code)
 * 2. Detects which phase tags were resolved (removed from code)
 * 3. Writes resolved tags to .git/.phase-tags.json for commit-msg hook
 */

import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
const PHASE_TAG_REGEX = /(phase[0-9]+-[a-zA-Z0-9_-]+)/g;
const PHASE_TAG_DONE_REGEX = /(phase[0-9]+-[a-zA-Z0-9_-]+:done)/g;

function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMRT', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  } catch (error) {
    console.error('❌ Failed to get staged files:', error);
    process.exit(1);
  }
}

function isCodeFile(filePath: string): boolean {
  return CODE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

function getFileContent(revision: string, filePath: string): string | null {
  try {
    const command = `git show ${revision}:${filePath}`;
    return execSync(command, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    // File doesn't exist in this revision (e.g., new file)
    return null;
  }
}

function extractPhaseTags(content: string): Set<string> {
  const tags = new Set<string>();
  const matches = content.matchAll(PHASE_TAG_REGEX);
  for (const match of matches) {
    tags.add(match[1]);
  }
  return tags;
}

function checkForDoneTags(content: string): { found: boolean; lineNumbers: number[] } {
  const lines = content.split('\n');
  const lineNumbers: number[] = [];
  
  lines.forEach((line, index) => {
    if (PHASE_TAG_DONE_REGEX.test(line)) {
      lineNumbers.push(index + 1);
    }
  });
  
  return {
    found: lineNumbers.length > 0,
    lineNumbers,
  };
}

function main() {
  const stagedFiles = getStagedFiles();
  const codeFiles = stagedFiles.filter(isCodeFile);
  
  if (codeFiles.length === 0) {
    console.log('✓ No code files staged. Skipping phase tag checks.');
    process.exit(0);
  }
  
  console.log(`Checking ${codeFiles.length} staged code file(s)...`);
  
  const resolvedTags = new Set<string>();
  const errors: Array<{ file: string; lines: number[] }> = [];
  
  for (const filePath of codeFiles) {
    // Get staged version
    const stagedContent = getFileContent(':', filePath);
    if (!stagedContent) {
      console.warn(`⚠ Warning: Could not read staged content for ${filePath}`);
      continue;
    }
    
    // Check for :done tags in staged content
    const doneCheck = checkForDoneTags(stagedContent);
    if (doneCheck.found) {
      errors.push({
        file: filePath,
        lines: doneCheck.lineNumbers,
      });
    }
    
    // Get HEAD version to detect resolved tags
    const headContent = getFileContent('HEAD', filePath);
    if (headContent) {
      const headTags = extractPhaseTags(headContent);
      const stagedTags = extractPhaseTags(stagedContent);
      
      // Tags that existed in HEAD but not in staged = resolved
      for (const tag of headTags) {
        if (!stagedTags.has(tag)) {
          resolvedTags.add(tag);
        }
      }
    }
  }
  
  // Block commit if :done tags found
  if (errors.length > 0) {
    console.error('\n❌ ERROR: Found TODO comments with :done tags in staged files.');
    console.error('These should be REMOVED from code once the task is complete.\n');
    
    for (const error of errors) {
      console.error(`  ${error.file}:`);
      error.lines.forEach((line) => {
        console.error(`    Line ${line}: Contains phase tag with :done`);
      });
    }
    
    console.error('\nPlease remove these TODO comments before committing.');
    process.exit(1);
  }
  
  // Write resolved tags to temp file for commit-msg hook
  const gitDir = join(process.cwd(), '.git');
  const tagsFile = join(gitDir, '.phase-tags.json');
  
  try {
    if (!existsSync(gitDir)) {
      console.error('❌ ERROR: .git directory not found.');
      process.exit(1);
    }
    
    const tagsData = {
      resolvedTags: Array.from(resolvedTags).sort(),
    };
    
    writeFileSync(tagsFile, JSON.stringify(tagsData, null, 2), 'utf-8');
    
    // Print summary
    console.log('✓ Phase tag checks passed.');
    
    if (resolvedTags.size > 0) {
      console.log(`\n📋 Phase tags resolved in this commit:`);
      Array.from(resolvedTags).sort().forEach((tag) => {
        console.log(`   - ${tag}`);
      });
      console.log('\n💡 Remember to include at least one of these tags in your commit message,');
      console.log('   e.g., [phase5-core:done] or [phase6-polish]');
    }
    
    console.log('\n✓ OK to commit.');
  } catch (error) {
    console.error('❌ ERROR: Failed to write .git/.phase-tags.json:', error);
    process.exit(1);
  }
}

main();



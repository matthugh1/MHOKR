#!/usr/bin/env node

/**
 * TODO / FIXME / HACK / NOTE Compliance Audit Script
 * 
 * Scans the repository for TODO-style comments and enforces allowed formats.
 * Only specific phase tags are allowed: [phase6-polish], [phase7-hardening], [phase7-performance]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// Directories to include
const INCLUDE_DIRS = ['apps', 'services', 'scripts', 'docs', '.github'];

// Patterns to exclude
const EXCLUDE_PATTERNS = [
  'node_modules',
  'dist',
  'build',
  '.turbo',
  'coverage',
  '.next',
];

const EXCLUDE_EXTENSIONS = ['.lock', '.svg', '.png', '.jpg', '.jpeg', '.ico'];

// Patterns to match
const MATCH_PATTERNS = ['TODO', 'FIXME', 'HACK', 'NOTE:'];

// Allowed phase tags
const ALLOWED_PHASE_TAGS = [
  '[phase6-polish]',
  '[phase7-hardening]',
  '[phase7-performance]',
];

const matches = {
  allowedPhaseTag: [],
  note: [],
  unapproved: [],
};

function shouldExcludeFile(filePath) {
  // Exclude the generated report file itself (circular reference)
  if (filePath.includes('docs/TODO_AUDIT_REPORT.md')) {
    return true;
  }

  // Exclude JSON data files (like TODO_REGISTER.json) - they contain TODO text as data, not code comments
  if (filePath.endsWith('.json')) {
    return true;
  }

  // Exclude markdown documentation files - they may mention "TODO" in prose but aren't actual TODO comments
  // Only scan markdown files in .github/ directory (which may contain actual TODO lists)
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.md' && !filePath.includes('.github/')) {
    return true;
  }

  // Check exclude patterns in path
  for (const pattern of EXCLUDE_PATTERNS) {
    if (filePath.includes(pattern)) {
      return true;
    }
  }

  // Check exclude extensions
  if (EXCLUDE_EXTENSIONS.includes(ext)) {
    return true;
  }

  return false;
}

function shouldIncludeDirectory(dirPath) {
  const relativePath = path.relative(REPO_ROOT, dirPath);
  
  // Always include root directory (empty relative path)
  if (!relativePath || relativePath === '.' || relativePath === '') {
    return true;
  }
  
  const topLevelDir = relativePath.split(path.sep)[0];
  
  // Include if it's one of our target directories
  if (INCLUDE_DIRS.includes(topLevelDir)) {
    return true;
  }
  
  // Include if we're already inside one of the target directories
  for (const includeDir of INCLUDE_DIRS) {
    if (relativePath.startsWith(includeDir + path.sep) || relativePath === includeDir) {
      return true;
    }
  }
  
  return false;
}

function classifyMatch(lineText) {
  // Check if it's a NOTE-only comment (without TODO/FIXME/HACK)
  const trimmed = lineText.trim();
  const hasNoteMarker = trimmed.startsWith('NOTE:') || trimmed.startsWith('// NOTE:') || trimmed.startsWith('/* NOTE:') || trimmed.startsWith('* NOTE:') || trimmed.includes('{/* NOTE:');
  const hasTodoMarker = lineText.includes('TODO') || lineText.includes('FIXME') || lineText.includes('HACK');
  
  // If it's a NOTE without TODO/FIXME/HACK, classify as note (these are allowed)
  if (hasNoteMarker && !hasTodoMarker) {
    return 'note';
  }

  // Check if it contains an allowed phase tag
  for (const tag of ALLOWED_PHASE_TAGS) {
    if (lineText.includes(tag)) {
      return 'allowed-phase-tag';
    }
  }

  // Otherwise it's unapproved (TODO/FIXME/HACK without allowed tag)
  return 'unapproved';
}

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Skip binary files (check for null bytes)
    if (content.includes('\0')) {
      return;
    }

    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Skip HTML comments in markdown files (they're documentation, not code TODOs)
      if (filePath.endsWith('.md') && (line.trim().startsWith('<!--') || line.trim().endsWith('-->') || line.includes('<!--'))) {
        return;
      }

      // Skip markdown headings that mention TODO (they're documentation, not code TODOs)
      if (filePath.endsWith('.md') && line.trim().startsWith('##') && line.includes('TODO')) {
        return;
      }

      // Skip the script's own internal strings and comments that mention TODO/FIXME/HACK in documentation
      // Also skip workflow files that mention "TODO compliance audit" as step names
      if (filePath.includes('scripts/todo-audit.js')) {
        // Skip all lines in this file - it's the audit script itself
        return;
      }
      if (filePath.includes('.github/workflows/') && line.includes('TODO compliance audit')) {
        // Skip workflow step names that mention TODO compliance audit
        return;
      }

      // Check if line contains any of our match patterns
      for (const pattern of MATCH_PATTERNS) {
        if (line.includes(pattern)) {
          const classification = classifyMatch(line);
          const match = {
            filePath: path.relative(REPO_ROOT, filePath),
            lineNumber: index + 1,
            lineText: line.trim(),
          };

          if (classification === 'allowed-phase-tag') {
            matches.allowedPhaseTag.push(match);
          } else if (classification === 'note') {
            matches.note.push(match);
          } else {
            matches.unapproved.push(match);
          }
          
          // Only need to match once per line
          break;
        }
      }
    });
  } catch (error) {
    // Skip files that can't be read (binary files, permissions, etc.)
    // Silently continue
  }
}

function scanDirectory(dirPath) {
  if (!shouldIncludeDirectory(dirPath)) {
    return;
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (shouldExcludeFile(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        scanFile(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

function getGitSha() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

function generateMarkdownReport() {
  const timestamp = new Date().toISOString();
  const gitSha = getGitSha();
  
  const totalFound = matches.allowedPhaseTag.length + matches.note.length + matches.unapproved.length;
  const allowedPhaseTagCount = matches.allowedPhaseTag.length;
  const noteCount = matches.note.length;
  const unapprovedCount = matches.unapproved.length;

  let report = `# TODO / FIXME / NOTE Audit\n\n`;
  report += `- Timestamp: ${timestamp}\n`;
  report += `- Git SHA: ${gitSha}\n\n`;
  report += `## Summary\n\n`;
  report += `- Total matches: ${totalFound}\n`;
  report += `- Allowed phase-tag TODOs: ${allowedPhaseTagCount}\n`;
  report += `- Notes: ${noteCount}\n`;
  report += `- Unapproved TODOs / FIXMEs / HACKs: ${unapprovedCount}\n\n`;

  // Unapproved section
  report += `## Unapproved TODOs (BLOCKERS)\n\n`;
  if (unapprovedCount === 0) {
    report += `*None found. ✅*\n\n`;
  } else {
    report += `\`\`\`text\n`;
    matches.unapproved.forEach((match) => {
      report += `${match.filePath}:${match.lineNumber}  ${match.lineText}\n`;
    });
    report += `\`\`\`\n\n`;
  }

  // Allowed phase tags section
  report += `## All Allowed Phase TODOs\n\n`;
  if (allowedPhaseTagCount === 0) {
    report += `*None found.*\n\n`;
  } else {
    report += `\`\`\`text\n`;
    matches.allowedPhaseTag.forEach((match) => {
      report += `${match.filePath}:${match.lineNumber}  ${match.lineText}\n`;
    });
    report += `\`\`\`\n\n`;
  }

  // Notes section
  report += `## All Notes\n\n`;
  if (noteCount === 0) {
    report += `*None found.*\n\n`;
  } else {
    report += `\`\`\`text\n`;
    matches.note.forEach((match) => {
      report += `${match.filePath}:${match.lineNumber}  ${match.lineText}\n`;
    });
    report += `\`\`\`\n\n`;
  }

  return report;
}

// Main execution
console.error('🔍 Scanning repository for TODO / FIXME / HACK / NOTE comments...\n');

// Start scanning from repo root
scanDirectory(REPO_ROOT);

// Build summary
const totalFound = matches.allowedPhaseTag.length + matches.note.length + matches.unapproved.length;
const summary = {
  totalFound,
  allowedPhaseTagCount: matches.allowedPhaseTag.length,
  noteCount: matches.note.length,
  unapprovedCount: matches.unapproved.length,
  unapprovedExamples: matches.unapproved.slice(0, 20),
};

// Output JSON to stdout
const output = {
  summary,
  matches: {
    allowedPhaseTag: matches.allowedPhaseTag,
    note: matches.note,
    unapproved: matches.unapproved,
  },
};

console.log(JSON.stringify(output, null, 2));

// Generate and write markdown report
const reportPath = path.join(REPO_ROOT, 'docs', 'TODO_AUDIT_REPORT.md');
const reportDir = path.dirname(reportPath);

// Ensure docs directory exists
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

const markdownReport = generateMarkdownReport();
fs.writeFileSync(reportPath, markdownReport, 'utf8');

console.error(`\n📄 Report written to: ${reportPath}`);

// Print summary table by tag
const phase6PolishCount = matches.allowedPhaseTag.filter(m => m.lineText.includes('[phase6-polish]')).length;
const phase7HardeningCount = matches.allowedPhaseTag.filter(m => m.lineText.includes('[phase7-hardening]')).length;
const phase7PerformanceCount = matches.allowedPhaseTag.filter(m => m.lineText.includes('[phase7-performance]')).length;

console.error(`\n📊 Summary by Tag:`);
console.error(`   [phase6-polish]:      ${phase6PolishCount}`);
console.error(`   [phase7-hardening]:   ${phase7HardeningCount}`);
console.error(`   [phase7-performance]: ${phase7PerformanceCount}`);
console.error(`   NOTE comments:        ${matches.note.length}`);
console.error(`   ─────────────────────────`);
console.error(`   Total:                ${totalFound}`);

// Exit with error code if unapproved TODOs found
if (summary.unapprovedCount > 0) {
  console.error(`\n❌ Found ${summary.unapprovedCount} unapproved TODO/FIXME/HACK comment(s). These must be fixed before proceeding.`);
  process.exit(1);
} else {
  console.error(`\n✅ All TODO comments are compliant.`);
  process.exit(0);
}


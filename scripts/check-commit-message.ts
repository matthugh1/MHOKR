#!/usr/bin/env node

/**
 * Commit-msg hook: Validate commit message format
 * 
 * Validates:
 * 1. Conventional Commit format (feat|fix|refactor|chore|docs|test)
 * 2. No "WIP" allowed
 * 3. If phase tags were resolved, commit message must reference at least one
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const CONVENTIONAL_COMMIT_REGEX = /^(feat|fix|refactor|chore|docs|test)(\([^)]+\))?: .+/;
const WIP_REGEX = /WIP/i;
const PHASE_TAG_IN_MESSAGE_REGEX = /\[(phase[0-9]+-[a-zA-Z0-9_-]+)(:done)?\]/g;

interface PhaseTagsData {
  resolvedTags: string[];
}

function readCommitMessage(messagePath: string): string {
  try {
    return readFileSync(messagePath, 'utf-8').trim();
  } catch (error) {
    console.error(`❌ ERROR: Could not read commit message file: ${messagePath}`);
    process.exit(1);
  }
}

function readPhaseTags(): PhaseTagsData | null {
  const gitDir = join(process.cwd(), '.git');
  const tagsFile = join(gitDir, '.phase-tags.json');
  
  if (!existsSync(tagsFile)) {
    return null;
  }
  
  try {
    const content = readFileSync(tagsFile, 'utf-8');
    return JSON.parse(content) as PhaseTagsData;
  } catch (error) {
    console.warn(`⚠ Warning: Could not parse .git/.phase-tags.json: ${error}`);
    return null;
  }
}

function extractPhaseTagsFromMessage(message: string): Set<string> {
  const tags = new Set<string>();
  const matches = message.matchAll(PHASE_TAG_IN_MESSAGE_REGEX);
  for (const match of matches) {
    tags.add(match[1]); // Extract tag without :done suffix
  }
  return tags;
}

function main() {
  const commitMessagePath = process.argv[2];
  
  if (!commitMessagePath) {
    console.error('❌ ERROR: Commit message file path not provided.');
    console.error('Usage: check-commit-message.ts <commit-message-file>');
    process.exit(1);
  }
  
  const commitMessage = readCommitMessage(commitMessagePath);
  const phaseTagsData = readPhaseTags();
  
  // Validation 1: Conventional Commit format
  if (!CONVENTIONAL_COMMIT_REGEX.test(commitMessage)) {
    console.error('❌ ERROR: Commit message does not follow Conventional Commits format.');
    console.error('\nExpected format:');
    console.error('  <type>(<scope>): <description> [phaseX-scope(:done)?]');
    console.error('\nValid types: feat, fix, refactor, chore, docs, test');
    console.error('\nExamples:');
    console.error('  feat(okr): add async update workflow [phase6-polish]');
    console.error('  fix(api): expose KR ownerId in okr overview [phase5-core:done]');
    console.error('\nYour message:');
    console.error(`  ${commitMessage.split('\n')[0]}`);
    process.exit(1);
  }
  
  // Validation 2: No WIP
  if (WIP_REGEX.test(commitMessage)) {
    console.error('❌ ERROR: Commit message contains "WIP".');
    console.error('Please write a proper commit message instead of using "WIP".');
    process.exit(1);
  }
  
  // Validation 3: Phase tags (if resolved)
  if (phaseTagsData && phaseTagsData.resolvedTags.length > 0) {
    const messageTags = extractPhaseTagsFromMessage(commitMessage);
    const resolvedTagsSet = new Set(phaseTagsData.resolvedTags);
    
    // Check if at least one resolved tag is referenced in the message
    let foundMatch = false;
    for (const messageTag of messageTags) {
      if (resolvedTagsSet.has(messageTag)) {
        foundMatch = true;
        break;
      }
    }
    
    if (!foundMatch) {
      console.error('❌ ERROR: Commit message must reference at least one resolved phase tag.');
      console.error('\nPhase tags resolved in this commit:');
      phaseTagsData.resolvedTags.forEach((tag) => {
        console.error(`  - ${tag}`);
      });
      console.error('\nYour commit message must include at least one of these tags in square brackets.');
      console.error('\nExamples:');
      console.error(`  feat(okr): add feature [${phaseTagsData.resolvedTags[0]}:done]`);
      console.error(`  fix(api): fix bug [${phaseTagsData.resolvedTags[0]}]`);
      console.error('\nYour message:');
      console.error(`  ${commitMessage.split('\n')[0]}`);
      process.exit(1);
    }
  }
  
  // All validations passed
  console.log('✓ Commit message validation passed.');
  process.exit(0);
}

main();



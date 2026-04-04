#!/usr/bin/env node
/**
 * Enforce roadmap workflow hygiene on code-changing sessions.
 *
 * Rules:
 * - If code files changed, require updates to:
 *   - docs/planning/langgraph-roadmap-status.md
 *   - docs/planning/langgraph-session-handoff.md
 * - Decision log is strongly recommended (warning only).
 *
 * Bypass:
 * - ROADMAP_LOOP_BYPASS=1
 */

const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

const STATUS_FILE = 'docs/planning/langgraph-roadmap-status.md';
const HANDOFF_FILE = 'docs/planning/langgraph-session-handoff.md';
const DECISION_FILE = 'docs/planning/langgraph-decision-log.md';

const CODE_PREFIXES = ['src/', 'web/', 'tests/', 'scripts/', 'packages/', 'drizzle/'];

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function unique(arr) {
  return Array.from(new Set(arr));
}

function getChangedFiles(stagedOnly) {
  const fromStaged = run('git diff --name-only --cached');
  if (stagedOnly) {
    return unique(fromStaged.split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
  }

  const sources = [fromStaged];
  sources.push(run('git diff --name-only HEAD'));
  sources.push(run('git ls-files --others --exclude-standard'));

  if (process.env.CI) {
    // Fallback for CI where working tree is clean.
    sources.push(run('git show --pretty="" --name-only HEAD'));
  }

  return unique(
    sources
      .flatMap((s) => s.split(/\r?\n/))
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isCodeFile(file) {
  return CODE_PREFIXES.some((prefix) => file.startsWith(prefix));
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function main() {
  if (process.env.ROADMAP_LOOP_BYPASS === '1') {
    console.log('roadmap-loop: bypass enabled (ROADMAP_LOOP_BYPASS=1)');
    process.exit(0);
  }

  const stagedOnly = process.argv.includes('--staged');
  const files = getChangedFiles(stagedOnly);

  if (files.length === 0) {
    console.log('roadmap-loop: no changed files detected');
    process.exit(0);
  }

  const codeChanged = files.some(isCodeFile);
  if (!codeChanged) {
    console.log('roadmap-loop: no code files changed, skipping planning file checks');
    process.exit(0);
  }

  const today = new Date().toISOString().slice(0, 10);
  const statusText = readText(STATUS_FILE);
  const handoffText = readText(HANDOFF_FILE);
  const decisionText = readText(DECISION_FILE);

  const missingRequired = [];
  if (!statusText) {
    missingRequired.push(`${STATUS_FILE} (missing or unreadable)`);
  } else if (!statusText.includes(today)) {
    missingRequired.push(`${STATUS_FILE} (must include today's date: ${today})`);
  }

  if (!handoffText) {
    missingRequired.push(`${HANDOFF_FILE} (missing or unreadable)`);
  } else if (!handoffText.includes(today)) {
    missingRequired.push(`${HANDOFF_FILE} (must include today's date: ${today})`);
  }

  if (missingRequired.length > 0) {
    console.error('roadmap-loop: FAILED');
    console.error('Code files changed but planning freshness checks failed:');
    for (const file of missingRequired) {
      console.error(`- ${file}`);
    }
    console.error('');
    console.error('Update those files with today\'s session details or bypass explicitly:');
    console.error('ROADMAP_LOOP_BYPASS=1 npm run check:roadmap-loop');
    process.exit(1);
  }

  if (!decisionText || !decisionText.includes(today)) {
    console.warn('roadmap-loop: warning - decision log not updated');
    console.warn(`Consider adding a ${today} entry to ${DECISION_FILE} if decisions were made.`);
  }

  console.log('roadmap-loop: PASS');
  process.exit(0);
}

main();

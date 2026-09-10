#!/usr/bin/env node
'use strict';
// Removes the global harness-setup install. Requires --yes since this deletes
// files outside the repo (~/.harness-setup, and the two skill entrypoints).
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();
const targets = [
  path.join(HOME, '.harness-setup'),
  path.join(HOME, '.claude', 'skills', 'harness-setup'),
  path.join(HOME, '.codex', 'skills', 'harness-setup'),
  path.join(HOME, '.agents', 'skills', 'harness-setup'),
];

if (!process.argv.includes('--yes')) {
  console.log('This would remove:');
  for (const t of targets) console.log(`  ${t}`);
  console.log('\nRe-run with --yes to actually delete. Project-level files (AGENTS.md/CLAUDE.md blocks, .claude/.codex skills, .harness-setup.json) are never touched by this and must be removed per-project by hand if wanted.');
  process.exit(0);
}

for (const t of targets) {
  if (fs.existsSync(t)) {
    fs.rmSync(t, { recursive: true, force: true });
    console.log(`removed ${t}`);
  }
}

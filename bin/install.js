#!/usr/bin/env node
'use strict';
// Installs harness-setup for the current user:
//   ~/.harness-setup/engine     <- copied from this repo's engine/ (self-contained)
//   ~/.claude/skills/harness-setup/SKILL.md
//   ~/.codex/skills/harness-setup/SKILL.md (+ agents/openai.yaml)   [deprecated Codex user-scope path, kept for back-compat]
//   ~/.agents/skills/harness-setup/SKILL.md (+ agents/openai.yaml)  [current Codex user-scope path]
//
// Safe to re-run. Everything under ~/.harness-setup and the two skill
// entrypoints is fully generated, never hand-edited by a user, so it's always
// safe to overwrite on reinstall.
//
// Default: COPY. The install must not depend on this source directory still
// existing afterwards — this is what lets `npx github:<owner>/harness-setup`
// work directly from GitHub (npx's checkout is a temp/cache dir that can be
// pruned any time) and what lets a local clone be deleted post-install
// without breaking the global setup.
//
// --link opts into a directory junction/symlink instead, ONLY useful when
// actively developing this repo locally: edits then apply immediately
// without re-running install.js. Do not use --link for a one-off/CI install
// or anything you intend to delete afterwards.
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const HOME = os.homedir();
const HS_HOME = path.join(HOME, '.harness-setup');
const wantLink = process.argv.includes('--link');

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function linkOrCopyEngine() {
  fs.mkdirSync(HS_HOME, { recursive: true });
  const target = path.join(HS_HOME, 'engine');
  const isLinked = fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink();

  if (wantLink) {
    const alreadyLinkedHere = isLinked
      && path.resolve(fs.readlinkSync(target)) === path.resolve(path.join(REPO_ROOT, 'engine'));
    if (alreadyLinkedHere) return 'kept (already linked, dev mode)';
    rmrf(target);
    fs.symlinkSync(path.join(REPO_ROOT, 'engine'), target, 'junction');
    return 'linked (dev mode: edits in this repo apply immediately — do not delete this repo)';
  }

  // Default path: always a fresh, self-contained copy. Safe even if `target`
  // was previously a link (rmrf removes the link, not its former source).
  rmrf(target);
  copyDir(path.join(REPO_ROOT, 'engine'), target);
  return 'copied (self-contained; safe to delete the source afterwards. Re-run this installer to pick up source changes)';
}

function installEntrypoint(name, files) {
  // files: [{ from: repo-relative, to: absolute }]
  for (const f of files) {
    fs.mkdirSync(path.dirname(f.to), { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, f.from), f.to);
  }
  return files.map((f) => f.to);
}

function main() {
  fs.mkdirSync(HS_HOME, { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, 'VERSION.json'), path.join(HS_HOME, 'VERSION.json'));
  const engineStatus = linkOrCopyEngine();

  const claudeFiles = installEntrypoint('claude', [
    { from: 'adapters/claude-code/SKILL.md', to: path.join(HOME, '.claude', 'skills', 'harness-setup', 'SKILL.md') },
  ]);
  // Installed to both: `~/.codex/skills` is deprecated but still read for
  // backward compatibility by current Codex CLI versions; `~/.agents/skills`
  // is the current user-scope location. Writing both means the entry point
  // is found regardless of which Codex version/build resolves skills.
  const codexFiles = installEntrypoint('codex', [
    { from: 'adapters/codex/SKILL.md', to: path.join(HOME, '.codex', 'skills', 'harness-setup', 'SKILL.md') },
    { from: 'adapters/codex/agents/openai.yaml', to: path.join(HOME, '.codex', 'skills', 'harness-setup', 'agents', 'openai.yaml') },
    { from: 'adapters/codex/SKILL.md', to: path.join(HOME, '.agents', 'skills', 'harness-setup', 'SKILL.md') },
    { from: 'adapters/codex/agents/openai.yaml', to: path.join(HOME, '.agents', 'skills', 'harness-setup', 'agents', 'openai.yaml') },
  ]);

  console.log('harness-setup install');
  console.log(`  engine: ${path.join(HS_HOME, 'engine')} -> ${engineStatus}`);
  console.log('  claude entrypoint:');
  for (const f of claudeFiles) console.log(`    ${f}`);
  console.log('  codex entrypoint:');
  for (const f of codexFiles) console.log(`    ${f}`);
  console.log('\nOpen any project and run /harness-setup (Claude Code) or $harness-setup (Codex).');
  if (!wantLink) console.log('(pass --link instead if you are actively developing this repo and want edits to apply without reinstalling)');
}

main();

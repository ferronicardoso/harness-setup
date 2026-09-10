'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const IGNORE_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'bin', 'obj',
  '.venv', 'venv', '__pycache__', '.next', '.nuxt', 'target',
  'vendor', '.harness-setup-cache', 'coverage', '.turbo', '.cache',
]);

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function isDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

// Shallow-ish walk with a depth cap and directory ignore list. Cheap on purpose:
// this is a discovery signal scan, not a full repository index.
function walk(root, { maxDepth = 3, maxEntries = 4000 } = {}) {
  const results = [];
  let count = 0;
  function inner(dir, depth) {
    if (depth > maxDepth || count > maxEntries) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (count > maxEntries) return;
      count++;
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name) || e.name.startsWith('.') && !['.github', '.codex', '.claude'].includes(e.name)) {
          continue;
        }
        results.push({ rel, dir: true });
        inner(full, depth + 1);
      } else {
        results.push({ rel, dir: false });
      }
    }
  }
  inner(root, 0);
  return results;
}

function sh(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch {
    return null;
  }
}

function which(bin) {
  const cmd = process.platform === 'win32' ? `where ${bin}` : `command -v ${bin}`;
  const out = sh(cmd);
  if (!out) return null;
  return out.split(/\r?\n/)[0].trim() || null;
}

module.exports = { exists, isDir, readFile, writeFile, walk, sh, which, IGNORE_DIRS };

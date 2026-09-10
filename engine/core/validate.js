'use strict';
const { readFile, exists } = require('./fsutil');
const markers = require('./markers');

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b[A-Za-z0-9_\-]*api[_-]?key\b\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
  /\bsecret\b\s*[:=]\s*["']?[A-Za-z0-9_\-]{12,}/i,
  /\bpassword\b\s*[:=]\s*["']?\S{6,}/i,
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id shape
];

function scanForSecrets(content) {
  const hits = [];
  for (const re of SECRET_PATTERNS) {
    if (re.test(content)) hits.push(re.toString());
  }
  return hits;
}

function validateFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { ok: false, error: 'missing YAML frontmatter block' };
  const hasName = /^name:\s*\S+/m.test(m[1]);
  const hasDescription = /^description:\s*\S+/m.test(m[1]);
  if (!hasName || !hasDescription) return { ok: false, error: 'frontmatter missing name/description' };
  return { ok: true };
}

// filesWritten: [{file, kind}] from the reconcile step (only files this run touched)
function validate(root, filesWritten) {
  const checks = [];
  let ok = true;

  for (const { file } of filesWritten) {
    if (!exists(file)) { checks.push({ file, ok: false, note: 'expected file missing after apply' }); ok = false; continue; }
    const content = readFile(file) || '';

    const secretHits = scanForSecrets(content);
    if (secretHits.length) { checks.push({ file, ok: false, note: `possible secret pattern: ${secretHits[0]}` }); ok = false; continue; }

    if (file.endsWith('AGENTS.md') || file.endsWith('CLAUDE.md')) {
      const m = markers.countMarkers(content);
      if (!m.balanced) { checks.push({ file, ok: false, note: 'unbalanced harness-setup markers' }); ok = false; continue; }
    }

    if (file.endsWith('SKILL.md')) {
      const fm = validateFrontmatter(content);
      if (!fm.ok) { checks.push({ file, ok: false, note: fm.error }); ok = false; continue; }
    }

    checks.push({ file, ok: true });
  }

  return { ok, checks };
}

module.exports = { validate, scanForSecrets, validateFrontmatter };

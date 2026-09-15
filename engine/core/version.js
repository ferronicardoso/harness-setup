'use strict';
// Deterministic bump-version core: find the file(s) that carry the project's
// version, compute the next semver, rewrite it in place. Mirrors the
// detect-by-filename approach in discovery.js SIGNALS, but scoped to the
// handful of manifests that actually carry a version field. Ambiguity (zero
// or more than one candidate) is reported, never guessed — the human (or the
// bump-version skill, one layer up) decides which file is authoritative.
const path = require('path');
const fs = require('fs');
const { walk, readFile } = require('./fsutil');

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)(.*)$/;

function parseSemver(v) {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], rest: m[4] || '' };
}

function nextVersion(current, type) {
  const parsed = parseSemver(current);
  if (!parsed) return null;
  const { major, minor, patch } = parsed;
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  if (type === 'patch') return `${major}.${minor}.${patch + 1}`;
  return null;
}

function jsonVersionRead(content) {
  try {
    const obj = JSON.parse(content);
    return typeof obj.version === 'string' ? obj.version : null;
  } catch { return null; }
}
function jsonVersionWrite(content, next) {
  const m = content.match(/("version"\s*:\s*")([^"]*)(")/);
  if (!m) return null;
  return content.slice(0, m.index) + m[1] + next + m[3] + content.slice(m.index + m[0].length);
}

function tomlVersionRead(content) {
  const m = content.match(/^\s*version\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}
function tomlVersionWrite(content, next) {
  const m = content.match(/^(\s*version\s*=\s*")([^"]+)(")/m);
  if (!m) return null;
  return content.slice(0, m.index) + m[1] + next + m[3] + content.slice(m.index + m[0].length);
}

function xmlVersionRead(content) {
  const m = content.match(/<Version>([^<]+)<\/Version>/);
  return m ? m[1] : null;
}
function xmlVersionWrite(content, next) {
  const m = content.match(/(<Version>)([^<]+)(<\/Version>)/);
  if (!m) return null;
  return content.slice(0, m.index) + m[1] + next + m[3] + content.slice(m.index + m[0].length);
}

// filename/pattern must match the file's basename. Order is not a priority
// order — every match on disk becomes a candidate, ties are never broken
// silently.
const DETECTORS = [
  { id: 'npm', filename: 'package.json', read: jsonVersionRead, write: jsonVersionWrite },
  { id: 'version-json', filename: 'VERSION.json', read: jsonVersionRead, write: jsonVersionWrite },
  { id: 'python', filename: 'pyproject.toml', read: tomlVersionRead, write: tomlVersionWrite },
  { id: 'rust', filename: 'Cargo.toml', read: tomlVersionRead, write: tomlVersionWrite },
  { id: 'dotnet-shared', filename: 'Directory.Build.props', read: xmlVersionRead, write: xmlVersionWrite },
  { id: 'dotnet-project', pattern: /\.csproj$/, read: xmlVersionRead, write: xmlVersionWrite },
];

function detectorFor(rel) {
  const base = path.basename(rel);
  return DETECTORS.find((d) => (d.filename && d.filename === base) || (d.pattern && d.pattern.test(base)));
}

// Cheap, depth-limited scan (mirrors discovery.js) — not a full repo index,
// just enough to find plausible version-carrying files.
function findCandidates(root) {
  const entries = walk(root, { maxDepth: 4 }).filter((e) => !e.dir);
  const candidates = [];
  for (const e of entries) {
    const detector = detectorFor(e.rel);
    if (!detector) continue;
    const abs = path.join(root, e.rel);
    const content = readFile(abs);
    if (content == null) continue;
    const current = detector.read(content);
    if (current == null) continue;
    candidates.push({ file: e.rel, absPath: abs, detectorId: detector.id, current });
  }
  return candidates;
}

function bump(root, type) {
  if (!['patch', 'minor', 'major'].includes(type)) {
    return { ok: false, status: 'invalid-type', message: `unknown bump type "${type}" (expected patch|minor|major)` };
  }
  const candidates = findCandidates(root);
  if (candidates.length === 0) {
    return {
      ok: false, status: 'none-found',
      message: 'no recognized version file found (package.json, pyproject.toml, Cargo.toml, .csproj/Directory.Build.props, VERSION.json)',
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false, status: 'ambiguous',
      message: 'multiple version files found; this looks like a multi-project repo, so nothing was guessed at — point at the right one explicitly',
      candidates: candidates.map(({ file, current, detectorId }) => ({ file, current, detectorId })),
    };
  }

  const [candidate] = candidates;
  const next = nextVersion(candidate.current, type);
  if (!next) {
    return {
      ok: false, status: 'unparseable-version',
      message: `version "${candidate.current}" in ${candidate.file} is not plain semver (major.minor.patch); refusing to guess`,
      candidates: [{ file: candidate.file, current: candidate.current, detectorId: candidate.detectorId }],
    };
  }

  const detector = DETECTORS.find((d) => d.id === candidate.detectorId);
  const content = readFile(candidate.absPath);
  const written = detector.write(content, next);
  if (written == null) {
    return {
      ok: false, status: 'write-failed',
      message: `could not locate the version field to rewrite in ${candidate.file}`,
      candidates: [{ file: candidate.file, current: candidate.current, detectorId: candidate.detectorId }],
    };
  }
  fs.writeFileSync(candidate.absPath, written, 'utf8');

  return { ok: true, status: 'bumped', file: candidate.file, from: candidate.current, to: next, type };
}

module.exports = { bump, findCandidates, nextVersion, parseSemver, DETECTORS };

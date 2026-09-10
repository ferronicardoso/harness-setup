'use strict';
// Turns raw discovery signals into judgment calls: how mature is this project,
// what's the stack summary, and which optional capabilities (skills) are
// actually justified. Deliberately conservative: silence in a category means
// "no evidence", not "assume defaults".

function projectKind(project) {
  if (project.isEmpty) return 'empty';
  const substantial = project.hasCI || project.hasTests || project.markerFiles.length >= 5;
  return substantial ? 'existing' : 'new';
}

function stackSummary(project) {
  const cats = ['language', 'runtime', 'frontend', 'monorepo', 'infra', 'iac', 'ci'];
  const items = [];
  for (const c of cats) {
    if (project.signals[c]) items.push(...project.signals[c]);
  }
  return [...new Set(items)];
}

const { AUTO_SKILL_IDS } = require('./catalog');

const AUTO_SKILL_REASONS = {
  'architecture-review': 'codebase has enough structure (CI/tests/multiple modules) to benefit from a repeatable architecture-consistency pass before merging non-trivial changes',
  'security-review': 'non-trivial codebase; a repeatable pre-merge security pass (secrets, injection, authZ) is broadly applicable regardless of stack',
};

function proposeSkills(project) {
  const kind = projectKind(project);
  if (kind !== 'existing') return [];

  // Always return every candidate, even if already installed — the adapter
  // (which actually checks the filesystem) is what decides CREATE vs KEEP.
  // Filtering here would make an already-installed skill invisible in the
  // report instead of showing up as "already satisfied".
  return AUTO_SKILL_IDS.map((id) => ({ id, reason: AUTO_SKILL_REASONS[id] }));
}

function decisions(discovery) {
  const { project, existing } = discovery;
  const out = {};

  out.mcp = existing.mcp.projectMcpJsonExists || existing.claude.settingsExists
    ? { action: 'keep', reason: 'existing MCP-related configuration detected; left untouched' }
    : { action: 'skip', reason: 'no concrete tool/integration requirement identified in the repo' };

  out.hooks = { action: 'skip', reason: 'no repo signal (e.g. required pre-commit formatting enforced by the harness) that justifies a hook' };

  out.agents = { action: 'skip', reason: 'no evidence of a workflow needing isolated context, parallelism, or different permissions than the main agent' };

  out.commands = {
    action: 'skip',
    reason: 'Claude Code skills and Codex skills are both directly invocable (/name, $name) in current versions, so a separate commands/prompts adapter would only duplicate the skill under another name',
  };

  return out;
}

function analyze(discovery) {
  const kind = projectKind(discovery.project);
  return {
    kind,
    stack: stackSummary(discovery.project),
    proposedSkills: proposeSkills(discovery.project),
    decisions: decisions(discovery),
  };
}

module.exports = { analyze, projectKind, stackSummary, proposeSkills, decisions, AUTO_SKILL_IDS };

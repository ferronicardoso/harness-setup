'use strict';
const path = require('path');
const fs = require('fs');
const markers = require('../core/markers');
const { renderProjectContext } = require('../core/content');
const { exists } = require('../core/fsutil');
const catalog = require('../core/catalog');

const BLOCK_ID = 'project-context';
const TEMPLATES_ROOT = path.join(__dirname, '..', 'templates', 'skills');

function planActions(root, discovery, analysis, opts = {}) {
  const actions = [];
  const agentsMdPath = path.join(root, 'AGENTS.md');
  const body = renderProjectContext(discovery, analysis);
  const info = markers.classify(agentsMdPath, BLOCK_ID, body);

  if (info.status === 'foreign') {
    actions.push({
      id: 'codex:project-context', harness: 'codex', file: agentsMdPath,
      kind: 'UPDATE', risk: 'high',
      reason: 'AGENTS.md exists with user-authored content and no harness-setup markers; appending requires confirmation',
      apply: () => markers.appendApproved(agentsMdPath, BLOCK_ID, body),
    });
  } else if (info.status === 'managed-current') {
    actions.push({ id: 'codex:project-context', harness: 'codex', file: agentsMdPath, kind: 'KEEP', risk: 'low', reason: 'already up to date' });
  } else {
    actions.push({
      id: 'codex:project-context', harness: 'codex', file: agentsMdPath,
      kind: info.status === 'missing' ? 'CREATE' : 'UPDATE', risk: 'low',
      reason: info.status === 'missing' ? 'no AGENTS.md yet' : 'managed block drifted from desired content (project signals changed)',
      apply: () => markers.upsert(agentsMdPath, BLOCK_ID, body, '# Project Instructions\n\nCustom, human-authored guidance can go above or below the managed block. AGENTS.override.md at this level always wins over this file if present.'),
    });
  }

  for (const proposal of analysis.proposedSkills) {
    const srcDir = path.join(TEMPLATES_ROOT, proposal.id);
    const dstDir = path.join(root, '.codex', 'skills', proposal.id);
    const dstFile = path.join(dstDir, 'SKILL.md');
    if (!exists(path.join(srcDir, 'SKILL.md'))) continue;
    if (exists(dstFile)) {
      actions.push({ id: `codex:skill:${proposal.id}`, harness: 'codex', file: dstFile, kind: 'KEEP', risk: 'low', reason: 'skill already present' });
      continue;
    }
    actions.push({
      id: `codex:skill:${proposal.id}`, harness: 'codex', file: dstFile,
      kind: 'CREATE', risk: 'low', reason: proposal.reason,
      apply: () => fs.readFileSync(path.join(srcDir, 'SKILL.md'), 'utf8'),
    });
  }

  const addSkills = opts.addSkills || new Set();
  for (const id of addSkills) {
    const entry = catalog.SKILL_CATALOG.find((s) => s.id === id);
    const srcFile = path.join(catalog.SKILLS_DIR, id, 'SKILL.md');
    if (!entry || !exists(srcFile)) {
      actions.push({ id: `codex:skill:${id}`, harness: 'codex', file: srcFile, kind: 'SKIP', risk: 'low', reason: `unknown catalog skill id "${id}"` });
      continue;
    }
    const dstDir = path.join(root, '.codex', 'skills', id);
    const dstFile = path.join(dstDir, 'SKILL.md');
    if (exists(dstFile)) {
      actions.push({ id: `codex:skill:${id}`, harness: 'codex', file: dstFile, kind: 'KEEP', risk: 'low', reason: 'skill already present' });
      continue;
    }
    actions.push({
      id: `codex:skill:${id}`, harness: 'codex', file: dstFile,
      kind: 'CREATE', risk: 'low', reason: 'requested via --add-skill',
      apply: () => {
        const openaiSrc = path.join(catalog.SKILLS_DIR, id, 'agents', 'openai.yaml');
        if (exists(openaiSrc)) {
          const openaiDst = path.join(dstDir, 'agents', 'openai.yaml');
          fs.mkdirSync(path.dirname(openaiDst), { recursive: true });
          fs.copyFileSync(openaiSrc, openaiDst);
        }
        return fs.readFileSync(srcFile, 'utf8');
      },
    });
  }

  // Codex CLI does support named custom agent roles (.codex/agents/<id>.toml
  // + a [agents.<id>] block in config.toml) — this tool just doesn't
  // implement that path yet. Report why instead of silently ignoring the
  // request or (worse) claiming it's technically impossible.
  const addAgents = opts.addAgents || new Set();
  for (const id of addAgents) {
    actions.push({
      id: `codex:agent:${id}`, harness: 'codex', file: path.join(root, '.codex', 'agents', `${id}.toml`),
      kind: 'SKIP', risk: 'low', reason: 'catalog agents are Claude-Code-only for now — Codex CLI does support named agent roles (.codex/agents/*.toml), just not implemented in this tool yet',
    });
  }

  return actions;
}

module.exports = { planActions, BLOCK_ID };

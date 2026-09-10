'use strict';
const path = require('path');
const fs = require('fs');
const markers = require('../core/markers');
const { renderProjectContext, renderAgentMemoryBlock } = require('../core/content');
const { exists } = require('../core/fsutil');
const catalog = require('../core/catalog');

const BLOCK_ID = 'project-context';
const TEMPLATES_ROOT = path.join(__dirname, '..', 'templates', 'skills');

function planActions(root, discovery, analysis, opts = {}) {
  const actions = [];
  const claudeMdPath = path.join(root, 'CLAUDE.md');
  const body = renderProjectContext(discovery, analysis);
  const info = markers.classify(claudeMdPath, BLOCK_ID, body);

  if (info.status === 'foreign') {
    actions.push({
      id: 'claude:project-context', harness: 'claude', file: claudeMdPath,
      kind: 'UPDATE', risk: 'high',
      reason: 'CLAUDE.md exists with user-authored content and no harness-setup markers; appending requires confirmation',
      apply: () => markers.appendApproved(claudeMdPath, BLOCK_ID, body),
    });
  } else if (info.status === 'managed-current') {
    actions.push({ id: 'claude:project-context', harness: 'claude', file: claudeMdPath, kind: 'KEEP', risk: 'low', reason: 'already up to date' });
  } else {
    actions.push({
      id: 'claude:project-context', harness: 'claude', file: claudeMdPath,
      kind: info.status === 'missing' ? 'CREATE' : 'UPDATE', risk: 'low',
      reason: info.status === 'missing' ? 'no CLAUDE.md yet' : 'managed block drifted from desired content (project signals changed)',
      apply: () => markers.upsert(claudeMdPath, BLOCK_ID, body, '# Project Instructions\n\nCustom, human-authored guidance can go above or below the managed block.'),
    });
  }

  for (const proposal of analysis.proposedSkills) {
    const srcDir = path.join(TEMPLATES_ROOT, proposal.id);
    const dstDir = path.join(root, '.claude', 'skills', proposal.id);
    const dstFile = path.join(dstDir, 'SKILL.md');
    if (!exists(path.join(srcDir, 'SKILL.md'))) continue;
    if (exists(dstFile)) {
      actions.push({ id: `claude:skill:${proposal.id}`, harness: 'claude', file: dstFile, kind: 'KEEP', risk: 'low', reason: 'skill already present' });
      continue;
    }
    actions.push({
      id: `claude:skill:${proposal.id}`, harness: 'claude', file: dstFile,
      kind: 'CREATE', risk: 'low', reason: proposal.reason,
      apply: () => fs.readFileSync(path.join(srcDir, 'SKILL.md'), 'utf8'),
    });
  }

  // Opt-in catalog: only materialized when explicitly requested this run
  // (--add-skill / --add-agent). The explicit request IS the confirmation,
  // so these are low-risk once requested — never proposed automatically.
  const addSkills = opts.addSkills || new Set();
  for (const id of addSkills) {
    const entry = catalog.SKILL_CATALOG.find((s) => s.id === id);
    const srcFile = path.join(catalog.SKILLS_DIR, id, 'SKILL.md');
    if (!entry || !exists(srcFile)) {
      actions.push({ id: `claude:skill:${id}`, harness: 'claude', file: srcFile, kind: 'SKIP', risk: 'low', reason: `unknown catalog skill id "${id}"` });
      continue;
    }
    const dstFile = path.join(root, '.claude', 'skills', id, 'SKILL.md');
    if (exists(dstFile)) {
      actions.push({ id: `claude:skill:${id}`, harness: 'claude', file: dstFile, kind: 'KEEP', risk: 'low', reason: 'skill already present' });
      continue;
    }
    actions.push({
      id: `claude:skill:${id}`, harness: 'claude', file: dstFile,
      kind: 'CREATE', risk: 'low', reason: 'requested via --add-skill',
      apply: () => fs.readFileSync(srcFile, 'utf8'),
    });
  }

  const addAgents = opts.addAgents || new Set();
  for (const id of addAgents) {
    const srcFile = path.join(catalog.AGENTS_DIR, `${id}.md`);
    if (!exists(srcFile)) {
      actions.push({ id: `claude:agent:${id}`, harness: 'claude', file: srcFile, kind: 'SKIP', risk: 'low', reason: `unknown catalog agent id "${id}"` });
      continue;
    }
    const dstFile = path.join(root, '.claude', 'agents', `${id}.md`);
    const memoryDir = path.join(root, '.claude', 'agent-memory', id);
    if (exists(dstFile)) {
      actions.push({ id: `claude:agent:${id}`, harness: 'claude', file: dstFile, kind: 'KEEP', risk: 'low', reason: 'agent already present' });
      continue;
    }
    actions.push({
      id: `claude:agent:${id}`, harness: 'claude', file: dstFile,
      kind: 'CREATE', risk: 'low', reason: 'requested via --add-agent (with project-scoped memory)',
      apply: () => {
        fs.mkdirSync(memoryDir, { recursive: true });
        const gitkeep = path.join(memoryDir, '.gitkeep');
        if (!exists(gitkeep)) fs.writeFileSync(gitkeep, '');
        const persona = fs.readFileSync(srcFile, 'utf8');
        return persona.replace(/\n$/, '') + '\n' + renderAgentMemoryBlock(id, memoryDir);
      },
    });
  }

  return actions;
}

module.exports = { planActions, BLOCK_ID };

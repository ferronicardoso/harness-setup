#!/usr/bin/env node
'use strict';
const path = require('path');
const discovery = require('./core/discovery');
const analysisMod = require('./core/analysis');
const reconcileMod = require('./core/reconcile');
const validateMod = require('./core/validate');
const manifest = require('./core/manifest');
const catalog = require('./core/catalog');
const claudeAdapter = require('./adapters/claude-code');
const codexAdapter = require('./adapters/codex');

function parseArgs(argv) {
  const args = {
    root: process.cwd(), target: 'all', mode: 'setup', approve: new Set(),
    addAgents: new Set(), addSkills: new Set(),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--inspect') args.mode = 'inspect';
    else if (a === '--dry-run') args.mode = 'dry-run';
    else if (a === '--update') args.mode = 'update';
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--approve') String(argv[++i] || '').split(',').filter(Boolean).forEach((x) => args.approve.add(x));
    else if (a === '--approve-all-pending') args.approveAllPending = true;
    else if (a === '--add-agent') String(argv[++i] || '').split(',').filter(Boolean).forEach((x) => args.addAgents.add(x));
    else if (a === '--add-skill') String(argv[++i] || '').split(',').filter(Boolean).forEach((x) => args.addSkills.add(x));
    else if (a === '--json') args.json = true;
  }
  return args;
}

function mark(cond) { return cond ? '✓' : '-'; }

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = args.root;

  const env = discovery.detectEnv(root);
  const project = discovery.detectProject(root);
  const existing = discovery.detectExisting(root);
  const disc = { env, project, existing };
  const analysis = analysisMod.analyze(disc);

  const wantCodex = args.target === 'all' || args.target === 'codex';
  const wantClaude = args.target === 'all' || args.target === 'claude';
  const catalogOpts = { addAgents: args.addAgents, addSkills: args.addSkills };

  let actions = [];
  if (wantClaude) actions = actions.concat(claudeAdapter.planActions(root, disc, analysis, catalogOpts));
  if (wantCodex) actions = actions.concat(codexAdapter.planActions(root, disc, analysis, catalogOpts));

  const lines = [];
  lines.push('Harness Setup');
  lines.push('');
  lines.push('Project');
  lines.push(`  kind: ${analysis.kind}`);
  if (analysis.stack.length) lines.push(`  stack: ${analysis.stack.join(', ')}`);
  if (project.commands.build) lines.push(`  build: ${project.commands.build}`);
  if (project.commands.test) lines.push(`  test: ${project.commands.test}`);
  if (project.hasCI) lines.push('  ci: detected');
  lines.push('');
  lines.push('Detected');
  lines.push(`  ${mark(env.hasGit)} Git${env.hasGit ? ` (branch ${env.branch || '?'}, ${env.dirty ? 'dirty' : 'clean'})` : ''}`);
  lines.push(`  ${mark(env.codexAvailable)} Codex`);
  lines.push(`  ${mark(env.claudeAvailable)} Claude Code`);
  lines.push(`  ${mark(existing.agentsMd.status !== 'inexistente')} AGENTS.md (${existing.agentsMd.status})`);
  lines.push(`  ${mark(existing.claudeMd.status !== 'inexistente')} CLAUDE.md (${existing.claudeMd.status})`);

  // Installed inventory: every skill/agent actually found on disk, tagged by
  // provenance so "why didn't this get re-created/updated" is answerable
  // from the report alone instead of requiring a filesystem dig.
  const fmtInstalled = (id) => `${id} [${catalog.classify(id, 'skill')}]`;
  const fmtInstalledAgent = (id) => `${id} [${catalog.classify(id, 'agent')}]`;
  lines.push('');
  lines.push('Installed');
  lines.push(`  Claude skills: ${existing.claude.skills.length ? existing.claude.skills.map((s) => fmtInstalled(s.name)).join(', ') : '(none)'}`);
  lines.push(`  Codex skills: ${existing.codex.skills.length ? existing.codex.skills.map((s) => fmtInstalled(s.name)).join(', ') : '(none)'}`);
  lines.push(`  Claude agents: ${existing.claude.agents.length ? existing.claude.agents.map(fmtInstalledAgent).join(', ') : '(none)'}`);
  lines.push('  [auto] = auto-proposed review skill, [catalog] = opt-in from this tool, [unmanaged] = present but not managed by harness-setup (left alone).');

  // Opt-in catalog: shown in every mode, never auto-applied. installedIds
  // covers both harnesses' skill dirs plus Claude's agent dir so an item
  // already present anywhere doesn't get relisted as available.
  const installedSkillIds = new Set([...existing.claude.skills, ...existing.codex.skills].map((s) => s.name));
  const installedAgentIds = new Set(existing.claude.agents);
  const availableSkills = catalog.listSkills(disc, analysis).filter((s) => !installedSkillIds.has(s.id));
  const availableAgents = catalog.listAgents(disc, analysis).filter((a) => !installedAgentIds.has(a.id));
  lines.push('');
  lines.push('Available (opt-in — never applied automatically)');
  lines.push('  Skills (Claude Code + Codex):');
  for (const s of availableSkills) lines.push(`    - ${s.id}${s.matched ? '' : ' (generic)'} — ${s.description}`);
  lines.push('  Agents (Claude Code only, with project-scoped memory):');
  for (const a of availableAgents) lines.push(`    - ${a.id}${a.matched ? ' (recommended for this project)' : ''}`);
  lines.push('  Add with --add-skill <id,id> and/or --add-agent <id,id>.');

  if (args.mode === 'inspect') {
    console.log(lines.join('\n'));
    if (args.json) console.log(JSON.stringify({ env, project, existing, analysis, actions: actions.map(({ apply, ...a }) => a) }, null, 2));
    return;
  }

  const dryRun = args.mode === 'dry-run';
  const approvedIds = args.approveAllPending ? new Set(actions.map((a) => a.id)) : args.approve;
  const { applied, pending, kept, skipped } = reconcileMod.reconcile(actions, { dryRun, approvedIds });

  lines.push('');
  lines.push(dryRun ? 'Would apply' : 'Applied');
  if (applied.length === 0) lines.push('  (none)');
  for (const a of applied) lines.push(`  ✓ [${a.harness}] ${a.kind} ${path.relative(root, a.file)} - ${a.reason}`);

  lines.push('');
  lines.push('Kept (already satisfied)');
  if (kept.length === 0) lines.push('  (none)');
  for (const a of kept) lines.push(`  ✓ [${a.harness}] ${path.relative(root, a.file)} - ${a.reason}`);

  lines.push('');
  lines.push('Skipped (no concrete benefit identified)');
  for (const [name, d] of Object.entries(analysis.decisions)) {
    if (d.action === 'skip') lines.push(`  - ${name}: ${d.reason}`);
  }
  for (const a of skipped) lines.push(`  - [${a.harness}] ${a.id}: ${a.reason}`);

  if (pending.length) {
    lines.push('');
    lines.push('Needs confirmation (high risk / not auto-applied)');
    for (const a of pending) lines.push(`  ? [${a.id}] [${a.harness}] ${path.relative(root, a.file)} - ${a.reason}`);
    lines.push('  Re-run with --approve <id,id,...> once the user has confirmed which of these to apply.');
  }

  if (!dryRun) {
    const filesForValidation = applied.map((a) => ({ file: a.file, kind: a.kind }));
    const result = validateMod.validate(root, filesForValidation);
    lines.push('');
    lines.push('Validation');
    if (filesForValidation.length === 0) {
      lines.push('  (nothing written this run)');
    } else {
      for (const c of result.checks) lines.push(`  ${mark(c.ok)} ${path.relative(root, c.file)}${c.note ? ' - ' + c.note : ''}`);
    }

    const m = manifest.read(root) || manifest.empty();
    m.targets = [...new Set([...(m.targets || []), ...(wantClaude ? ['claude'] : []), ...(wantCodex ? ['codex'] : [])])];
    m.managed = m.managed || {};
    m.managed['project-instructions'] = true;
    m.managed.skills = [...new Set([...(m.managed.skills || []), ...applied.filter((a) => a.id.includes(':skill:')).map((a) => a.id.split(':skill:')[1])])];
    m.managed.agents = [...new Set([...(m.managed.agents || []), ...applied.filter((a) => a.id.includes(':agent:')).map((a) => a.id.split(':agent:')[1])])];
    m.decisions = Object.fromEntries(Object.entries(analysis.decisions).map(([k, v]) => [k, v.action]));
    manifest.write(root, m);
    lines.push('');
    lines.push(`Manifest updated: ${manifest.MANIFEST_NAME}`);

    if (!result.ok) process.exitCode = 1;
  }

  console.log(lines.join('\n'));
}

main();

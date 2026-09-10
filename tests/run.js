#!/usr/bin/env node
'use strict';
// Runs harness-setup against each fixture and asserts:
//  - it never crashes
//  - re-running with no changes is a true no-op (idempotency)
//  - it never silently rewrites foreign (user-owned, unmarked) content
//  - generated files pass validate()
// This is the reproducible version of the manual scenario testing done
// during development; run before every publish.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { buildFixtures } = require('./fixtures');

const CLI = path.join(__dirname, '..', 'engine', 'cli.js');
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-setup-tests-'));

function run(root, args = []) {
  const res = spawnSync(process.execPath, [CLI, '--root', root, ...args], { encoding: 'utf8' });
  if (res.status !== 0 && !args.includes('--dry-run')) {
    // status 1 is only expected from a failed validation; surface stderr either way
    if (res.stderr) console.error(res.stderr);
  }
  return res;
}

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`  ok   - ${label}`);
  } else {
    failures++;
    console.log(`  FAIL - ${label}${detail ? ` (${detail})` : ''}`);
  }
}

function readIfExists(p) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }

function main() {
  const dirs = buildFixtures(BASE);
  const [empty, newNode, existingPartial, withCodex, withClaude, withBoth] = dirs;

  console.log(`fixtures at ${BASE}\n`);

  // --- empty: nothing invented, run twice is idempotent ---
  console.log('empty');
  run(empty);
  const r2 = run(empty);
  check('exits 0', r2.status === 0);
  check('second run applies nothing', /Applied\s*\n\s*\(none\)/.test(r2.stdout), r2.stdout);
  check('no stack invented for an empty project', !/Stack:/.test(readIfExists(path.join(empty, 'CLAUDE.md')) || ''));

  // --- new-node: detects real commands, idempotent ---
  console.log('new-node');
  run(newNode);
  const nn2 = run(newNode);
  check('second run applies nothing', /Applied\s*\n\s*\(none\)/.test(nn2.stdout), nn2.stdout);
  const claudeMd = readIfExists(path.join(newNode, 'CLAUDE.md')) || '';
  check('build command detected', claudeMd.includes('npm run build'));
  check('test command detected', claudeMd.includes('npm test'));

  // --- existing-partial: hostile AGENTS.md must not be silently rewritten ---
  console.log('existing-partial');
  const before = readIfExists(path.join(existingPartial, 'AGENTS.md'));
  const ep1 = run(existingPartial);
  const afterFirstRun = readIfExists(path.join(existingPartial, 'AGENTS.md'));
  check('foreign AGENTS.md left untouched until approved', afterFirstRun === before, 'content changed without approval');
  check('reports a pending confirmation for it', /Needs confirmation/.test(ep1.stdout) && /codex:project-context/.test(ep1.stdout));
  check('low-risk skills still applied', fs.existsSync(path.join(existingPartial, '.claude', 'skills', 'architecture-review', 'SKILL.md')));

  const ep2 = run(existingPartial, ['--approve', 'codex:project-context']);
  const afterApproval = readIfExists(path.join(existingPartial, 'AGENTS.md'));
  check('approval appends without deleting the original text', afterApproval.includes(before.trim()) && afterApproval.includes('harness-setup:start'));
  const ep3 = run(existingPartial);
  check('idempotent after approval', /Applied\s*\n\s*\(none\)/.test(ep3.stdout), ep3.stdout);

  // --- with-codex: dry-run must not write, third-party skill must survive ---
  console.log('with-codex');
  const wc1 = run(withCodex, ['--dry-run', '--target', 'codex']);
  check('dry-run creates no AGENTS.md', !fs.existsSync(path.join(withCodex, 'AGENTS.md')));
  check('dry-run creates no new skill dirs', !fs.existsSync(path.join(withCodex, '.codex', 'skills', 'architecture-review')));
  run(withCodex);
  const thirdParty = readIfExists(path.join(withCodex, '.codex', 'skills', 'db-migration-helper', 'SKILL.md'));
  check('pre-existing third-party skill untouched', thirdParty && thirdParty.includes('user-authored, unrelated'));
  check('target=all did not touch CLAUDE.md incorrectly', fs.existsSync(path.join(withCodex, 'CLAUDE.md')));
  const wcInspect = run(withCodex, ['--inspect']);
  check('Installed section classifies third-party skill as unmanaged', /db-migration-helper \[unmanaged\]/.test(wcInspect.stdout), wcInspect.stdout);

  // --- with-claude: drift correction, existing skill kept not recreated ---
  console.log('with-claude');
  const wcl1 = run(withClaude);
  const claudeMd2 = readIfExists(path.join(withClaude, 'CLAUDE.md'));
  check('stale stack line replaced', claudeMd2.includes('Python') && !claudeMd2.includes('old, stale content'));
  check('reports pre-existing architecture-review as Kept, not silently invisible', /Kept \(already satisfied\)\n(?:.*\n)*?.*architecture-review.*already present/.test(wcl1.stdout), wcl1.stdout);
  check('Installed section classifies it as auto, not catalog/unmanaged', /Claude skills: architecture-review \[auto\]/.test(wcl1.stdout), wcl1.stdout);
  const wcl2 = run(withClaude);
  check('idempotent on second run', /Applied\s*\n\s*\(none\)/.test(wcl2.stdout), wcl2.stdout);

  // --- with-both: both harnesses at once, idempotent ---
  console.log('with-both');
  run(withBoth);
  const wb2 = run(withBoth);
  check('idempotent for both harnesses at once', /Applied\s*\n\s*\(none\)/.test(wb2.stdout), wb2.stdout);
  check('manifest written', fs.existsSync(path.join(withBoth, '.harness-setup.json')));
  const manifest = JSON.parse(readIfExists(path.join(withBoth, '.harness-setup.json')));
  check('manifest lists both targets', manifest.targets.includes('claude') && manifest.targets.includes('codex'));

  // --- catalog: opt-in skills + agents, never auto-applied ---
  console.log('catalog (opt-in skills/agents)');
  const beforeCatalog = run(withBoth, ['--inspect']);
  check('catalog section always shown', /Available \(opt-in/.test(beforeCatalog.stdout));
  check('nothing from the catalog applied without being asked', !fs.existsSync(path.join(withBoth, '.claude', 'agents')));

  const addRun = run(withBoth, ['--add-skill', 'adr,brainstorm', '--add-agent', 'react-nextjs-frontend-expert']);
  check('adr skill created for claude', fs.existsSync(path.join(withBoth, '.claude', 'skills', 'adr', 'SKILL.md')));
  check('adr skill created for codex too', fs.existsSync(path.join(withBoth, '.codex', 'skills', 'adr', 'SKILL.md')));
  check('codex openai.yaml sidecar copied', fs.existsSync(path.join(withBoth, '.codex', 'skills', 'adr', 'agents', 'openai.yaml')));
  check('agent persona created for claude', fs.existsSync(path.join(withBoth, '.claude', 'agents', 'react-nextjs-frontend-expert.md')));
  check('agent memory dir created', fs.existsSync(path.join(withBoth, '.claude', 'agent-memory', 'react-nextjs-frontend-expert', '.gitkeep')));
  const agentBody = readIfExists(path.join(withBoth, '.claude', 'agents', 'react-nextjs-frontend-expert.md'));
  check('agent file carries a memory-instructions block', agentBody.includes('Persistent Agent Memory') && agentBody.includes('agent-memory'));
  check('codex reports the agent request as not implemented, does not silently drop it', /codex.*not implemented in this tool yet/i.test(addRun.stdout));
  check('agent NOT created under .codex', !fs.existsSync(path.join(withBoth, '.codex', 'agents')));

  const addRun2 = run(withBoth, ['--add-skill', 'adr,brainstorm', '--add-agent', 'react-nextjs-frontend-expert']);
  check('re-adding the same catalog items is idempotent', /Applied\s*\n\s*\(none\)/.test(addRun2.stdout), addRun2.stdout);

  const manifest2 = JSON.parse(readIfExists(path.join(withBoth, '.harness-setup.json')));
  check('manifest records the added skill', manifest2.managed.skills.includes('adr'));
  check('manifest records the added agent', manifest2.managed.agents.includes('react-nextjs-frontend-expert'));

  const badId = run(withBoth, ['--add-skill', 'not-a-real-skill']);
  check('unknown catalog id is reported, not silently ignored', /unknown catalog skill id/.test(badId.stdout));

  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} (${failures} failing check${failures === 1 ? '' : 's'})`);
  process.exit(failures === 0 ? 0 : 1);
}

main();

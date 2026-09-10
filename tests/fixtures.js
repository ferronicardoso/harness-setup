'use strict';
// Builds the six scenario fixtures used to validate harness-setup:
//   empty, new-node, existing-partial (with a hostile pre-existing AGENTS.md),
//   with-codex (pre-existing Codex project skill), with-claude (stale managed
//   CLAUDE.md), with-both (both harnesses already partially set up).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function gitInit(dir) {
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['add', '-A'], { cwd: dir });
    execFileSync('git', ['-c', 'user.email=test@test.local', '-c', 'user.name=test', 'commit', '-q', '-m', 'init'], { cwd: dir });
  } catch {
    // git not available: discovery just reports hasGit:false, which is fine for these tests
  }
}

function buildFixtures(baseDir) {
  fs.rmSync(baseDir, { recursive: true, force: true });
  fs.mkdirSync(baseDir, { recursive: true });

  // 1. empty
  fs.mkdirSync(path.join(baseDir, 'empty'), { recursive: true });

  // 2. new-node
  {
    const d = path.join(baseDir, 'new-node');
    write(path.join(d, 'package.json'), JSON.stringify({ name: 'demo', scripts: { build: 'tsc', test: 'vitest' } }, null, 2));
    write(path.join(d, 'src', 'index.js'), "console.log('hi')\n");
    gitInit(d);
  }

  // 3. existing-partial (.NET + CI + tests + a hostile AGENTS.md)
  {
    const d = path.join(baseDir, 'existing-partial');
    write(path.join(d, 'MySolution.sln'), 'Microsoft Visual Studio Solution File\n');
    write(path.join(d, 'src', 'Api', 'Api.csproj'), '<Project Sdk="Microsoft.NET.Sdk.Web"></Project>\n');
    write(path.join(d, 'tests', 'Api.Tests', 'Api.Tests.csproj'), '<Project Sdk="Microsoft.NET.Sdk"></Project>\n');
    write(path.join(d, '.github', 'workflows', 'ci.yml'), 'name: CI\non: [push]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: dotnet build\n');
    write(path.join(d, 'AGENTS.md'), '# Team notes\n\nPlease always run `dotnet format` before committing. This repo uses Clean Architecture,\ndo not put business logic in controllers.\n');
    gitInit(d);
  }

  // 4. with-codex (pre-existing project config + a third-party codex skill)
  {
    const d = path.join(baseDir, 'with-codex');
    write(path.join(d, '.codex', 'config.toml'), 'module = "x"\n');
    write(path.join(d, '.codex', 'skills', 'db-migration-helper', 'SKILL.md'), '---\nname: db-migration-helper\ndescription: user-authored, unrelated to harness-setup\n---\nBody.\n');
    write(path.join(d, 'go.mod'), 'module example.com/demo\ngo 1.22\n');
    write(path.join(d, 'src', 'main.go'), 'package main\n');
    write(path.join(d, 'tests', 'main_test.go'), 'package main\n');
    write(path.join(d, '.github', 'workflows', 'ci.yml'), 'name: CI\non: [push]\n');
    gitInit(d);
  }

  // 5. with-claude (stale managed CLAUDE.md + an existing project skill)
  {
    const d = path.join(baseDir, 'with-claude');
    write(path.join(d, 'pyproject.toml'), '[project]\nname = "demo"\n');
    write(path.join(d, 'src', 'app.py'), 'print(1)\n');
    write(path.join(d, 'tests', 'test_app.py'), 'def test_x(): pass\n');
    write(path.join(d, '.github', 'workflows', 'ci.yml'), 'name: CI\non: [push]\n');
    write(path.join(d, 'CLAUDE.md'), '# Project Instructions\n\n<!-- harness-setup:start project-context -->\nStack: Python (old, stale content to test drift).\n<!-- harness-setup:end project-context -->\n');
    const archSkillDst = path.join(d, '.claude', 'skills', 'architecture-review', 'SKILL.md');
    fs.mkdirSync(path.dirname(archSkillDst), { recursive: true });
    fs.copyFileSync(path.join(__dirname, '..', 'engine', 'templates', 'skills', 'architecture-review', 'SKILL.md'), archSkillDst);
    gitInit(d);
  }

  // 6. with-both
  {
    const d = path.join(baseDir, 'with-both');
    write(path.join(d, 'package.json'), JSON.stringify({ name: 'both-demo', scripts: { build: 'tsc', test: 'jest', lint: 'eslint .' } }, null, 2));
    write(path.join(d, 'src', 'index.ts'), 'export const x = 1\n');
    write(path.join(d, 'tests', 'index.test.ts'), 'test("x", () => {})\n');
    write(path.join(d, '.github', 'workflows', 'ci.yml'), 'name: CI\non: [push]\n');
    gitInit(d);
  }

  return ['empty', 'new-node', 'existing-partial', 'with-codex', 'with-claude', 'with-both']
    .map((name) => path.join(baseDir, name));
}

module.exports = { buildFixtures };

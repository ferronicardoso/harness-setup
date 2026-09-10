'use strict';
const path = require('path');
const os = require('os');
const fsutil = require('./fsutil');
const { exists, isDir, readFile, walk, sh, which } = fsutil;

function detectEnv(root) {
  const gitRoot = sh('git rev-parse --show-toplevel', root);
  const hasGit = !!gitRoot;
  return {
    platform: process.platform,
    shell: process.env.SHELL || process.env.ComSpec || (process.platform === 'win32' ? 'powershell' : 'sh'),
    cwd: root,
    gitRoot: gitRoot || null,
    hasGit,
    branch: hasGit ? sh('git branch --show-current', root) : null,
    dirty: hasGit ? (sh('git status --porcelain', root) || '').length > 0 : null,
    codexAvailable: !!which('codex') || isDir(path.join(os.homedir(), '.codex')),
    claudeAvailable: !!which('claude') || isDir(path.join(os.homedir(), '.claude')),
    nodeVersion: process.version,
    home: os.homedir(),
  };
}

// [regex over the file's repo-relative path, tag, category]
const SIGNALS = [
  [/(^|\/)package\.json$/, 'node', 'runtime'],
  [/(^|\/)pnpm-workspace\.yaml$/, 'pnpm-workspace', 'monorepo'],
  [/(^|\/)nx\.json$/, 'nx', 'monorepo'],
  [/(^|\/)lerna\.json$/, 'lerna', 'monorepo'],
  [/(^|\/)turbo\.json$/, 'turborepo', 'monorepo'],
  [/(^|\/)angular\.json$/, 'Angular', 'frontend'],
  [/(^|\/)vite\.config\.[jt]s$/, 'Vite', 'frontend'],
  [/(^|\/)next\.config\.[jt]s$/, 'Next.js', 'frontend'],
  [/(^|\/)nuxt\.config\.[jt]s$/, 'Nuxt', 'frontend'],
  [/\.csproj$/, '.NET', 'language'],
  [/\.sln$/, '.NET solution', 'solution'],
  [/(^|\/)global\.json$/, '.NET SDK pin', 'sdk'],
  [/(^|\/)Directory\.Build\.props$/, '.NET shared build props', 'build'],
  [/(^|\/)pyproject\.toml$/, 'Python', 'language'],
  [/(^|\/)requirements.*\.txt$/, 'Python (pip)', 'packageManager'],
  [/(^|\/)go\.mod$/, 'Go', 'language'],
  [/(^|\/)pom\.xml$/, 'Java (Maven)', 'language'],
  [/(^|\/)build\.gradle(\.kts)?$/, 'Java/Kotlin (Gradle)', 'language'],
  [/(^|\/)Cargo\.toml$/, 'Rust', 'language'],
  [/(^|\/)Dockerfile$/i, 'Docker', 'infra'],
  [/(^|\/)docker-compose.*\.ya?ml$/i, 'Docker Compose', 'infra'],
  [/\.tf$/, 'Terraform', 'iac'],
  [/(^|\/)Makefile$/, 'Makefile', 'build'],
  [/(^|\/)\.github\/workflows\/.+\.ya?ml$/, 'GitHub Actions', 'ci'],
  [/(^|\/)azure-pipelines\.ya?ml$/, 'Azure Pipelines', 'ci'],
  [/(^|\/)\.gitlab-ci\.ya?ml$/, 'GitLab CI', 'ci'],
  [/(^|\/)\.eslintrc.*$/, 'ESLint', 'lint'],
  [/(^|\/)\.prettierrc.*$/, 'Prettier', 'format'],
  [/(^|\/)ruff\.toml$/, 'Ruff', 'lint'],
  [/(^|\/)\.editorconfig$/, 'EditorConfig', 'style'],
  [/(^|\/)pubspec\.yaml$/, 'Flutter/Dart', 'language'],
  [/(^|\/)wrangler\.toml$/, 'Cloudflare Workers', 'infra'],
  [/(^|\/)Chart\.yaml$/, 'Helm', 'infra'],
  [/\.razor$/, 'Blazor', 'frontend'],
  [/\.xaml$/, 'WPF/WinForms (XAML)', 'desktop'],
];

// Package-manager manifests worth peeking inside for dependency names, beyond
// the filename-only signals above. Kept tiny and best-effort on purpose.
const DEPENDENCY_HINTS = [
  { names: ['react'], tag: 'React', cat: 'frontend' },
  { names: ['@angular/core'], tag: 'Angular', cat: 'frontend' },
  { names: ['vue'], tag: 'Vue', cat: 'frontend' },
  { names: ['pg', 'postgres'], tag: 'PostgreSQL', cat: 'database' },
  { names: ['mysql', 'mysql2'], tag: 'MySQL', cat: 'database' },
  { names: ['mongodb', 'mongoose'], tag: 'MongoDB', cat: 'database' },
  { names: ['mssql', 'tedious'], tag: 'SQL Server', cat: 'database' },
];

// Substrings worth grep-ing for inside a small XML/config file's raw text —
// cheaper and less fragile than parsing the file for this purpose.
const CSPROJ_CONTENT_HINTS = [
  { re: /Npgsql/i, tag: 'PostgreSQL', cat: 'database' },
  { re: /MySql\.(Data|EntityFrameworkCore)|Pomelo\.EntityFrameworkCore/i, tag: 'MySQL', cat: 'database' },
  { re: /MongoDB\.Driver/i, tag: 'MongoDB', cat: 'database' },
  { re: /Microsoft\.Data\.SqlClient|System\.Data\.SqlClient/i, tag: 'SQL Server', cat: 'database' },
  { re: /<UseWPF>true<\/UseWPF>/i, tag: 'WPF', cat: 'desktop' },
  { re: /<UseWindowsForms>true<\/UseWindowsForms>/i, tag: 'WinForms', cat: 'desktop' },
];

const DOCKER_COMPOSE_DB_HINTS = [
  { re: /postgres/i, tag: 'PostgreSQL' },
  { re: /mariadb|mysql/i, tag: 'MySQL' },
  { re: /mongo/i, tag: 'MongoDB' },
  { re: /mssql|sqlserver/i, tag: 'SQL Server' },
];

const TEST_DIR_HINTS = /(^|\/)(tests?|__tests__|spec|specs)(\/|$)/i;
const MIGRATION_HINTS = /(^|\/)(migrations|db\/migrate)(\/|$)/i;
const MOBILE_HINTS = /(^|\/)(android|ios)(\/|$)|\.xcodeproj$|\.xcworkspace$/i;

function detectProject(root) {
  const entries = walk(root, { maxDepth: 4 });
  const topLevel = entries.filter((e) => !e.rel.includes('/'));
  const isEmpty = topLevel.filter((e) => !['.git', '.harness-setup.json'].includes(e.rel)).length === 0;

  const found = new Map(); // category -> Set(tag)
  const add = (cat, tag) => {
    if (!found.has(cat)) found.set(cat, new Set());
    found.get(cat).add(tag);
  };
  const markerFiles = [];
  let hasTests = false, hasMigrations = false, hasMobile = false, hasAzureDevOps = false, hasKubernetes = false;

  for (const e of entries) {
    if (e.dir) {
      if (e.rel === '.azure' || e.rel.startsWith('.azure/')) hasAzureDevOps = true;
      if (/(^|\/)(k8s|kubernetes)$/.test(e.rel)) hasKubernetes = true;
      continue;
    }
    for (const [re, tag, cat] of SIGNALS) {
      if (re.test(e.rel)) { add(cat, tag); markerFiles.push(e.rel); }
    }
    if (TEST_DIR_HINTS.test(e.rel)) hasTests = true;
    if (MIGRATION_HINTS.test(e.rel)) hasMigrations = true;
    if (MOBILE_HINTS.test(e.rel)) hasMobile = true;

    if (/\.csproj$/.test(e.rel)) {
      const content = readFile(path.join(root, e.rel)) || '';
      for (const hint of CSPROJ_CONTENT_HINTS) if (hint.re.test(content)) add(hint.cat, hint.tag);
    }
    if (/(^|\/)docker-compose.*\.ya?ml$/i.test(e.rel)) {
      const content = readFile(path.join(root, e.rel)) || '';
      for (const hint of DOCKER_COMPOSE_DB_HINTS) if (hint.re.test(content)) add('database', hint.tag);
    }
  }
  if (hasAzureDevOps) add('ci', 'Azure DevOps');
  if (hasKubernetes) add('infra', 'Kubernetes');

  const pkgJsonPath = path.join(root, 'package.json');
  let pkg = null;
  if (exists(pkgJsonPath)) {
    try { pkg = JSON.parse(readFile(pkgJsonPath)); } catch { pkg = { __parseError: true }; }
  }
  if (pkg && !pkg.__parseError) {
    const deps = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
    for (const hint of DEPENDENCY_HINTS) {
      if (hint.names.some((n) => deps.includes(n))) add(hint.cat, hint.tag);
    }
  }

  const commands = { build: null, test: null, lint: null, format: null };
  if (pkg && pkg.scripts) {
    if (pkg.scripts.build) commands.build = 'npm run build';
    if (pkg.scripts.test) commands.test = 'npm test';
    if (pkg.scripts.lint) commands.lint = 'npm run lint';
    if (pkg.scripts.format) commands.format = 'npm run format';
  }
  if (found.has('solution') || found.has('language') && [...found.get('language')].includes('.NET')) {
    commands.build = commands.build || 'dotnet build';
    commands.test = commands.test || 'dotnet test';
  }
  if (found.has('language') && [...found.get('language')].includes('Go')) {
    commands.build = commands.build || 'go build ./...';
    commands.test = commands.test || 'go test ./...';
  }
  if (found.has('language') && [...found.get('language')].includes('Python')) {
    commands.test = commands.test || 'pytest';
  }
  if (found.has('language') && [...found.get('language')].some((t) => t.includes('Gradle'))) {
    commands.build = commands.build || './gradlew build';
    commands.test = commands.test || './gradlew test';
  }
  if (found.has('language') && [...found.get('language')].some((t) => t.includes('Maven'))) {
    commands.build = commands.build || 'mvn install';
    commands.test = commands.test || 'mvn test';
  }
  if (found.has('build') && [...found.get('build')].includes('Makefile')) {
    commands.build = commands.build || 'make build';
    commands.test = commands.test || 'make test';
  }

  return {
    isEmpty,
    entryCount: entries.length,
    signals: Object.fromEntries([...found.entries()].map(([k, v]) => [k, [...v]])),
    hasTests,
    hasMigrations,
    hasMobile,
    hasDocker: found.has('infra') && [...found.get('infra')].some((t) => t.includes('Docker')),
    hasCI: found.has('ci'),
    hasIaC: found.has('iac'),
    markerFiles,
    commands,
    packageJson: pkg && !pkg.__parseError ? { name: pkg.name, hasScripts: !!pkg.scripts } : null,
  };
}

function readSkillFrontmatter(skillMdPath) {
  const content = readFile(skillMdPath);
  if (!content) return null;
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { hasFrontmatter: false };
  const name = (m[1].match(/^name:\s*(.+)$/m) || [])[1];
  const description = (m[1].match(/^description:\s*(.+)$/m) || [])[1];
  const managedBy = content.includes('managed-by: harness-setup');
  return { hasFrontmatter: true, name, description, managedBy };
}

function listSkillDirs(skillsRoot) {
  if (!isDir(skillsRoot)) return [];
  const fs = require('fs');
  return fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name);
}

function classifyManagedFile(filePath) {
  if (!exists(filePath)) return 'inexistente';
  const content = readFile(filePath) || '';
  if (content.trim() === '') return 'existente mas incompleto';
  if (content.includes('<!-- harness-setup:start')) return 'existente e compatível';
  return 'existente com possível conflito';
}

function detectExisting(root) {
  const home = os.homedir();
  const agentsMd = path.join(root, 'AGENTS.md');
  const agentsOverrideMd = path.join(root, 'AGENTS.override.md');
  const claudeMd = path.join(root, 'CLAUDE.md');
  const projectClaudeSkills = path.join(root, '.claude', 'skills');
  const projectClaudeAgents = path.join(root, '.claude', 'agents');
  const projectClaudeCommands = path.join(root, '.claude', 'commands');
  const projectClaudeSettings = path.join(root, '.claude', 'settings.json');
  const projectCodexSkills = path.join(root, '.codex', 'skills');
  const projectCodexConfig = path.join(root, '.codex', 'config.toml');
  const mcpJson = path.join(root, '.mcp.json');

  return {
    agentsMd: { path: agentsMd, status: classifyManagedFile(agentsMd) },
    agentsOverrideMd: { path: agentsOverrideMd, status: exists(agentsOverrideMd) ? 'existente e compatível' : 'inexistente' },
    claudeMd: { path: claudeMd, status: classifyManagedFile(claudeMd) },
    claude: {
      settingsExists: exists(projectClaudeSettings),
      skills: listSkillDirs(projectClaudeSkills).map((n) => ({ name: n, ...readSkillFrontmatter(path.join(projectClaudeSkills, n, 'SKILL.md')) })),
      agents: exists(projectClaudeAgents) ? require('fs').readdirSync(projectClaudeAgents).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : [],
      commands: exists(projectClaudeCommands) ? require('fs').readdirSync(projectClaudeCommands).filter((f) => f.endsWith('.md')) : [],
    },
    codex: {
      projectConfigExists: exists(projectCodexConfig),
      skills: listSkillDirs(projectCodexSkills).map((n) => ({ name: n, ...readSkillFrontmatter(path.join(projectCodexSkills, n, 'SKILL.md')) })),
    },
    mcp: { projectMcpJsonExists: exists(mcpJson) },
    globalClaudeSkillsDir: path.join(home, '.claude', 'skills'),
    globalCodexSkillsDir: path.join(home, '.codex', 'skills'),
    manifest: require('./manifest').read(root),
  };
}

module.exports = { detectEnv, detectProject, detectExisting, SIGNALS };

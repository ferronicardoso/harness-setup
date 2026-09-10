'use strict';
// Opt-in catalog: agents (Claude Code only) and workflow skills that are
// never auto-applied, no matter how strong the match — the user asked for
// choice here, not another auto-heuristic. `match(discovery)` just changes
// how an item is annotated (recommended vs generic); every item can still be
// added explicitly via --add-agent/--add-skill even when unmatched.
const path = require('path');
const { exists } = require('./fsutil');

function has(discovery, cat, tag) {
  const arr = discovery.project.signals[cat];
  return !!arr && arr.includes(tag);
}

const AGENTS_DIR = path.join(__dirname, '..', 'templates', 'agents');

// id must match templates/agents/<id>.md. match: null => generic, offered
// whenever the project isn't empty; a function => stack-specific, offered
// only when it returns true (but always addable by explicit id regardless).
const AGENT_CATALOG = [
  { id: 'dotnet-expert-consultant', match: (d) => has(d, 'language', '.NET') },
  { id: 'dotnet-angular-architect', match: (d) => has(d, 'language', '.NET') && has(d, 'frontend', 'Angular') },
  { id: 'dotnet-blazor-architect', match: (d) => has(d, 'language', '.NET') && has(d, 'frontend', 'Blazor') },
  { id: 'dotnet-windows-architect', match: (d) => has(d, 'language', '.NET') && (has(d, 'desktop', 'WPF') || has(d, 'desktop', 'WinForms')) },
  { id: 'react-nextjs-frontend-expert', match: (d) => has(d, 'frontend', 'Next.js') || has(d, 'frontend', 'React') },
  { id: 'frontend-ui-ux-specialist', match: (d) => !!d.project.signals.frontend },
  { id: 'flutter-mobile-architect', match: (d) => has(d, 'language', 'Flutter/Dart') || d.project.hasMobile },
  { id: 'postgresql-database-architect', match: (d) => has(d, 'database', 'PostgreSQL') },
  { id: 'mysql-mariadb-dba', match: (d) => has(d, 'database', 'MySQL') },
  { id: 'mongodb-nosql-expert', match: (d) => has(d, 'database', 'MongoDB') },
  { id: 'sql-server-dba-expert', match: (d) => has(d, 'database', 'SQL Server') },
  { id: 'container-orchestration-expert', match: (d) => d.project.hasDocker || has(d, 'infra', 'Kubernetes') || has(d, 'infra', 'Helm') },
  { id: 'cloudflare-infrastructure-expert', match: (d) => has(d, 'infra', 'Cloudflare Workers') },
  { id: 'azure-devops-git-specialist', match: (d) => has(d, 'ci', 'Azure DevOps') || has(d, 'ci', 'Azure Pipelines') },
  { id: 'c4-plantuml-architect', match: null },
  { id: 'command-line-shell-expert', match: null },
  { id: 'linux-expert', match: null },
  { id: 'project-management-advisor', match: null },
  { id: 'software-architect-advisor', match: null },
  { id: 'technical-documentation-specialist', match: null },
  { id: 'ai-tools-integration-expert', match: null },
  { id: 'cybersecurity-ethical-hacker', match: null },
];

const SKILLS_DIR = path.join(__dirname, '..', 'templates', 'skills');

// The two skills every "existing" project is auto-proposed (engine/core/analysis.js)
// — kept here so the report layer has one place to classify a skill id as
// auto-proposed vs opt-in-catalog vs a third-party skill of the same name.
const AUTO_SKILL_IDS = ['architecture-review', 'security-review'];

const SKILL_CATALOG = [
  { id: 'adr', description: 'Architecture Decision Records — document a significant technical decision with context, decision and consequences.' },
  { id: 'prd', description: 'Product Requirements Document — capture what a feature must do and why before building it.' },
  { id: 'trd', description: 'Technical Requirements Document — capture how a feature will be built: architecture, interfaces, constraints.' },
  { id: 'brainstorm', description: 'Structured ideation on a topic, with rationale and practical next steps per idea.' },
];

function listAgents(discovery, analysis) {
  return AGENT_CATALOG
    .filter((a) => exists(path.join(AGENTS_DIR, `${a.id}.md`)))
    .map((a) => ({
      id: a.id,
      kind: 'agent',
      matched: a.match ? !!a.match(discovery) : analysis.kind !== 'empty',
      generic: !a.match,
    }));
}

function listSkills(discovery, analysis) {
  return SKILL_CATALOG
    .filter((s) => exists(path.join(SKILLS_DIR, s.id, 'SKILL.md')))
    .map((s) => ({ id: s.id, kind: 'skill', description: s.description, matched: analysis.kind !== 'empty', generic: true }));
}

// Classifies an already-installed skill/agent id for the "Installed" report
// section: 'auto' (one of the two review skills every existing project is
// offered), 'catalog' (an opt-in skill/agent from this tool's catalog), or
// 'unmanaged' (present under the same directory convention but not ours —
// never touched, just reported so its presence isn't a silent mystery).
function classify(id, kind) {
  if (kind === 'skill') {
    if (AUTO_SKILL_IDS.includes(id)) return 'auto';
    if (SKILL_CATALOG.some((s) => s.id === id)) return 'catalog';
    return 'unmanaged';
  }
  if (AGENT_CATALOG.some((a) => a.id === id)) return 'catalog';
  return 'unmanaged';
}

module.exports = { AGENT_CATALOG, SKILL_CATALOG, AUTO_SKILL_IDS, AGENTS_DIR, SKILLS_DIR, listAgents, listSkills, classify };

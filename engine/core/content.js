'use strict';
// Renders the small, harness-agnostic "project context" managed block shared
// by AGENTS.md and CLAUDE.md. Kept deliberately short: this is loaded on
// every turn in both harnesses, so it references the repo instead of
// restating documentation that already lives there.

function renderProjectContext(discovery, analysis) {
  const { project } = discovery;
  const lines = [];

  if (analysis.stack.length) {
    lines.push(`Stack: ${analysis.stack.join(', ')}.`);
  }

  const cmds = project.commands || {};
  const cmdLines = [];
  if (cmds.build) cmdLines.push(`- Build: \`${cmds.build}\``);
  if (cmds.test) cmdLines.push(`- Test: \`${cmds.test}\``);
  if (cmds.lint) cmdLines.push(`- Lint: \`${cmds.lint}\``);
  if (cmds.format) cmdLines.push(`- Format: \`${cmds.format}\``);
  if (cmdLines.length) {
    lines.push('\nCommands (detected from the repo, verify before relying on them):');
    lines.push(cmdLines.join('\n'));
  }

  lines.push('\nBefore considering a task done: run the commands above that apply to the change, and leave the working tree in the state the project\'s own tooling expects (no ad-hoc formatting rules invented here).');
  lines.push('\nThis block is managed by harness-setup. Re-running it only rewrites the content between the markers; anything you add elsewhere in this file is preserved.');

  return lines.join('\n');
}

// Appended to a catalog agent's persona body when materialized. Convention
// borrowed from a real in-repo agent-memory setup: memory lives inside the
// project (versioned, shared with the team) rather than in a per-user global
// location, since a subagent's usefulness compounds across sessions on THIS
// project specifically.
function renderAgentMemoryBlock(agentId, absMemoryDir) {
  return `
# Persistent Agent Memory

You have a persistent, file-based memory system at \`${absMemoryDir}\`. This directory already exists — write to it directly with the Write tool (do not run mkdir or check for its existence).

Build this up over time so future sessions working with this agent on this project have the context it needs: what you learned, decisions made, patterns that held up. This memory is versioned with the repo — write it as you would any other project file, not as scratch notes.

## Types of memory

- **user** — who's asking, their role, and preferences relevant to this agent's domain.
- **feedback** — corrections or confirmations about how to do this agent's job on this project specifically.
- **project** — facts, decisions, or recurring patterns in this project that this agent's domain work should account for.

## How to save

Write a file \`<short-kebab-case-slug>.md\` in this directory:

\`\`\`markdown
---
name: <slug>
description: <one-line summary>
metadata:
  type: user|feedback|project
---

<content — for feedback/project, lead with the fact/rule, then a **Why:** line and a **How to apply:** line>
\`\`\`

Then add a one-line pointer to it in this directory's \`MEMORY.md\` (create it if missing). Don't write duplicate memories — check \`MEMORY.md\` first.

Read \`MEMORY.md\` in this directory at the start of a session before assuming you have no prior context here.
`;
}

module.exports = { renderProjectContext, renderAgentMemoryBlock };

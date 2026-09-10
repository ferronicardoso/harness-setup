---
name: harness-setup
description: Bootstrap and reconcile AI coding-agent configuration (Claude Code, Codex) for the current project — AGENTS.md/CLAUDE.md project context, and reusable project skills. Use when the user runs /harness-setup, asks to "set up the harness", "configure Claude Code and Codex for this repo", or wants to check/update that setup.
allowed-tools: Bash(node:*)
---
<!-- managed-by: harness-setup -->

# Harness Setup

Deterministic discovery/plan/reconcile/validate engine, shared with the Codex adapter of this same capability. Do not reimplement its logic inline — call it, then narrate its output. The engine never overwrites user-owned content silently; your job is to relay its report and, when it reports a `Needs confirmation` section, get the user's decision before re-running with `--approve`.

## 1. Locate the engine

The canonical engine lives at `~/.harness-setup/engine/cli.js` (a single global install shared by every project — do not copy it into this repo). Resolve `~` to the user's home directory for the current OS before running it. This install is self-contained (copied, not linked to any source checkout) unless the user explicitly chose `--link` dev mode, so it should not go missing on its own.

If the file is missing, tell the user the global install seems broken or was removed, and give them the fix instead of just stopping:

```
npx github:ferronicardoso/harness-setup
```

(or, if they have a local clone: `node <clone-path>/bin/install.js`). Do not try to recreate the engine from memory — reinstalling is a one-line command.

Requires Node.js on PATH. If `node --version` fails, tell the user Node.js is required and stop.

## 2. Map the user's request to flags

Run from the project root (or pass `--root <path>` if the user names a different directory):

- Plain `/harness-setup`, "set up the harness", "reconcile" → no extra flags (discovers, plans, auto-applies everything low-risk, validates).
- "just look / inspect / what would you find" → add `--inspect` (read-only, no writes).
- "dry run / show me what would change without applying" → add `--dry-run` (computes the plan, writes nothing).
- "update" / re-run after notable project changes → same as plain run; the engine is idempotent and detects drift on its own.
- "only Codex" / "only Claude" → add `--target codex` or `--target claude` (default is `all`).

Command shape:

```
node "<home>/.harness-setup/engine/cli.js" --root "<project-root>" [flags]
```

## 3. Run it, then report

Run the command, then summarize its stdout for the user in your own words — don't just dump the raw output — following the report shape it already gives you (Project / Detected / Applied / Kept / Skipped / Needs confirmation / Validation).

If the output has a **Needs confirmation** section, that means the engine found user-owned content it refuses to touch without a decision (e.g. an existing AGENTS.md/CLAUDE.md with no harness-setup markers, so appending to it needs sign-off). Ask the user, for each pending item shown, whether to append the block. Never guess this for them or bundle it into a single "approve everything" gesture unless they explicitly say to approve all of it. Once you have their answer, re-run:

```
node "<home>/.harness-setup/engine/cli.js" --root "<project-root>" --approve <id1>,<id2>
```

(or `--approve-all-pending` only if the user explicitly approved every pending item at once).

Do not ask the user anything the engine's own output already answers (stack, existing files, etc.) — those come from real discovery, not guesses.

## 4. Opt-in catalog (skills and agents)

Every run's output includes an **Available (opt-in — never applied automatically)** section listing:
- workflow skills (`adr`, `prd`, `trd`, `brainstorm`) — cross-compatible, installed into both `.claude/skills/` and `.codex/skills/`;
- persona agents (Claude Code only — Codex has no equivalent for a named custom subagent) — each gets its own project-scoped memory directory at `.claude/agent-memory/<agent-id>/`, committed with the repo, so the agent accumulates project context across sessions instead of starting cold every time.

These are never applied unless requested — matching an agent to the detected stack ("recommended for this project") is just an annotation, not an auto-apply signal. Only add one when the user actually asks for it (or explicitly says yes when you point one out) — don't proactively install the whole catalog just because a run is happening anyway:

```
node "<home>/.harness-setup/engine/cli.js" --root "<project-root>" --add-skill <id1>,<id2> --add-agent <id1>,<id2>
```

If the user asks "what agents/skills are available" without wanting to run a full reconcile, `--inspect` still computes and prints this section (nothing is written).

## 5. What this does NOT do

It never touches application code, dependencies, CI pipelines, or configures MCP servers/secrets — only agent-harness plumbing (project-context blocks in AGENTS.md/CLAUDE.md, the two stack-agnostic review skills when the project is substantial enough to benefit, and whatever catalog items were explicitly requested). If the user wants more than that (a custom skill not in the catalog, a hook, an MCP server), that's a separate, explicit request — don't fold it into this run.

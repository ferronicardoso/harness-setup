# harness-setup

![status](https://img.shields.io/badge/status-pre--release-orange)
![node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![platforms](https://img.shields.io/badge/platform-windows%20%7C%20macos%20%7C%20linux-lightgrey)
![claude code](https://img.shields.io/badge/Claude%20Code-compatible-5A32FB)
![codex](https://img.shields.io/badge/Codex-compatible-10A37F)
![license](https://img.shields.io/badge/license-MIT-blue)

Bootstraps and reconciles AI coding-agent configuration — currently [Codex](https://developers.openai.com/codex) and [Claude Code](https://code.claude.com/docs) — for any project, new or existing. Install it once per user; every project then gets `/harness-setup` (Claude Code) or `$harness-setup` (Codex).

## What it does

Run it inside a project and it will:

1. Discover the environment (git, OS, which harnesses are installed) and the project (language/framework/build/test signals — cheap, depth-limited file scanning, not a full index).
2. Discover what agent configuration already exists (`AGENTS.md`, `CLAUDE.md`, project skills, settings) and classify it: missing, already managed by this tool, drifted, or foreign (user-owned).
3. Plan the smallest set of changes that would help, and apply the low-risk ones automatically:
   - a small, managed `<!-- harness-setup:start project-context -->` block inside `AGENTS.md` and `CLAUDE.md` with the detected stack and build/test/lint commands — everything else in those files is left exactly as the user wrote it;
   - two stack-agnostic review skills (`architecture-review`, `security-review`) as project skills, but only for projects substantial enough to benefit (real CI/tests/module count), never one skill per technology.
4. Anything higher-risk — most commonly, appending to an `AGENTS.md`/`CLAUDE.md` that already has user content and no markers — is reported under **Needs confirmation** instead of applied, so a human decides before anything gets touched.
5. Validate what it wrote (frontmatter parses, markers balanced, no secret-looking patterns) and record a small `.harness-setup.json` manifest.

It never touches application code, dependencies, CI pipelines, or configures MCP servers/secrets — see [Known limitations](#known-limitations).

## Opt-in catalog: skills and agents

Every run also prints an **Installed** inventory (every skill/agent actually found on disk, tagged `[auto]`/`[catalog]`/`[unmanaged]` so an already-present item is never silently invisible in the report) and an **Available (opt-in)** catalog — nothing in the latter is ever applied automatically, no matter how well it matches the project:

- **Workflow skills** — `adr`, `prd`, `trd`, `brainstorm`. Cross-compatible, installed into both `.claude/skills/` and `.codex/skills/` like the two auto-proposed review skills.
- **Persona agents** (Claude Code only — Codex has no equivalent for a named custom subagent) — a curated set of ~20 technology-specific consultants (`.NET`, React/Next.js, PostgreSQL, Kubernetes, etc.) plus a few generalists (architecture, docs, project management). Annotated "recommended" when the project's detected stack matches, but still opt-in either way.

Add with:

```bash
node ~/.harness-setup/engine/cli.js --root . --add-skill adr,brainstorm --add-agent react-nextjs-frontend-expert
```

Each agent gets its own project-scoped memory directory, `.claude/agent-memory/<agent-id>/`, committed with the repo — the agent's persona is instructed to read/write there, so it accumulates real context about this project across sessions instead of starting cold every time.

## Why this exists

Codex and Claude Code both settled on the same open Skill format (`SKILL.md` with `name` + `description` frontmatter). Because of that, the project skills this tool creates are literally copied as-is into both `.claude/skills/` and `.codex/skills/` from one template — no runtime "include" trick, no framework, just small generated duplication, which is cheaper to reason about than a fragile abstraction. Where the two harnesses genuinely differ (`AGENTS.md` vs `CLAUDE.md`, Codex's optional `agents/openai.yaml`), there are separate thin adapters instead of a forced common format.

All of the mechanics that need to be reliable across reruns — classifying a file, merging a managed block, deciding what's low-risk — are plain deterministic Node code (`engine/core/*.js`), not model judgment re-derived every run. The judgment calls that genuinely need discretion (which skills to propose, whether to touch a foreign file) are either a small conservative heuristic or explicitly deferred to a human via the `Needs confirmation` list.

## Install

Requires Node.js >= 18.

**Directly from GitHub, no clone needed (recommended):**

```bash
npx github:ferronicardoso/harness-setup
```

This downloads the repo into npx's own cache, runs the installer from there, and copies everything it needs into `~/.harness-setup/`. The result does **not** depend on that cache or on any local checkout still existing afterwards — you can run this on any machine with Node and nothing is left behind to maintain.

**From a local clone (for developing this project):**

```bash
git clone https://github.com/ferronicardoso/harness-setup.git
cd harness-setup
npm run install-global          # copies engine/ into ~/.harness-setup (self-contained)
# or, while actively editing this repo:
npm run install-global:link     # links instead of copying — edits apply immediately, but do NOT delete this clone
```

Either way it installs the two thin entry-point skills into `~/.claude/skills/harness-setup/` and `~/.codex/skills/harness-setup/`. Re-run any time; it's idempotent — everything under `~/.harness-setup` and the two skill entrypoints is fully generated, so reinstalling always safely overwrites it. `npm run uninstall-global -- --yes` (or `node bin/uninstall.js --yes` if you installed via `npx`) removes all of it.

By default the install is a **copy**: safe to delete the source afterwards, and the only mode that makes sense for the `npx github:...` flow (its cache is temporary). `--link` is an explicit opt-in for local development only — it creates a directory junction/symlink instead, so edits to this repo apply without reinstalling, at the cost of the global install breaking if you delete this clone.

## Usage

Inside any project:

```
/harness-setup                      # Claude Code
$harness-setup                      # Codex
```

Or call the engine directly:

```bash
node ~/.harness-setup/engine/cli.js --root . --inspect      # discovery + plan only, no writes
node ~/.harness-setup/engine/cli.js --root . --dry-run       # show what would be written
node ~/.harness-setup/engine/cli.js --root .                 # apply low-risk changes, report the rest
node ~/.harness-setup/engine/cli.js --root . --target codex  # restrict to one harness
node ~/.harness-setup/engine/cli.js --root . --approve <id>  # apply a specific pending high-risk action
node ~/.harness-setup/engine/cli.js --root . --add-skill adr,prd,trd,brainstorm
node ~/.harness-setup/engine/cli.js --root . --add-agent postgresql-database-architect
```

## Layout

```
engine/
  cli.js                 entry point: discover -> analyze -> plan -> reconcile -> validate
  core/                  discovery, analysis, catalog (opt-in skills/agents), markers (managed-block merge), manifest, reconcile, validate
  adapters/
    claude-code.js        plans CLAUDE.md + .claude/skills actions + catalog agents/skills
    codex.js               plans AGENTS.md + .codex/skills actions (agents: reports "no equivalent")
  templates/
    skills/                 auto-proposed + opt-in catalog skill bodies (architecture-review, security-review, adr, prd, trd, brainstorm)
    agents/                 opt-in catalog agent personas (Claude Code only)
adapters/
  claude-code/SKILL.md    the /harness-setup entry point installed into ~/.claude/skills/harness-setup/
  codex/SKILL.md          the $harness-setup entry point, installed to BOTH ~/.codex/skills/ (deprecated, back-compat) and ~/.agents/skills/ (current)
  codex/agents/openai.yaml
bin/
  install.js              installs the above for the current user
  uninstall.js
tests/
  fixtures.js             builds 6 scenario projects (empty/new/existing/with-codex/with-claude/with-both)
  run.js                  runs the engine against each and asserts idempotency + no silent overwrites
```

## Testing

```bash
npm test
```

Builds six fixture projects in a temp dir (empty, new, existing-with-CI, pre-existing Codex config, pre-existing stale Claude config, both) and asserts: no crash, idempotent reruns, foreign user content is never silently rewritten, and generated files validate.

## Known limitations

- The skill-proposal heuristic is intentionally narrow (two generic review skills, only for structurally "existing" projects) — it does not try to infer domain-specific workflows.
- Catalog agents are Claude-Code-only for now. This is a scope choice, not a hard technical limit: the `codex` CLI (Rust) does support named custom agent roles via `.codex/agents/<id>.toml` + a `[agents.<id>]` block in `config.toml` (confirmed against the `openai/codex` source) — `engine/adapters/codex.js` currently reports "no equivalent" for every `--add-agent` request rather than implementing that path. Real Codex agent support (including translating the same project-scoped memory convention into `developer_instructions`) is a reasonable future addition, deferred for now.
- Stack-to-agent/skill matching in `engine/core/catalog.js` and `engine/core/discovery.js` (e.g. database engine sniffing from `docker-compose.yml`/`.csproj` content) is heuristic and best-effort — it can miss or over-match on unusual project layouts. Any catalog item can still be added explicitly by id regardless of whether it was "recommended".

## Contributing

Issues and PRs welcome once this repo is public. See [Layout](#layout) for where things live and `npm test` for the check to run before submitting.

## License

[MIT](LICENSE) © ferronicardoso

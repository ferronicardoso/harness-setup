---
name: bump-version
description: "Bump the project's version (patch/minor/major) in whichever version file the project's stack actually uses — package.json, pyproject.toml, Cargo.toml, .csproj/Directory.Build.props, or VERSION.json. Suggests the bump type from Conventional Commits since the last tag, but always confirms before writing. Trigger on: \"bump the version\", \"bump version\", \"release a new version\", \"prepare a patch/minor/major release\", or similar."
---
<!-- managed-by: harness-setup -->

# Bump Version

Bumps the version field in the one file that actually carries it for this project's stack. Detection and the semver arithmetic are deterministic (delegated to the engine, not re-derived here); the only judgment call this skill makes is *which* bump type to suggest, and that suggestion always needs your confirmation before anything is written.

## Workflow

### 1 — Determine the bump type

Find the last version tag:

```
git describe --tags --abbrev=0
```

If a tag exists, read commits since it (`git log <tag>..HEAD --oneline`). Classify by Conventional Commits prefix:

- `feat:` → **minor**
- `fix:`, `perf:`, `refactor:`, `chore:`, `docs:`, etc. → **patch**
- Any commit with `!` after the type (`feat!:`) or a `BREAKING CHANGE:` footer → **major**

The suggested bump type is the highest-severity one found (major > minor > patch). If there's no tag, or commits don't follow Conventional Commits, say so plainly and ask the user for the bump type instead of guessing.

**Always state the suggested type and why (which commits drove it), and get explicit confirmation before proceeding.** Never apply a bump the user hasn't confirmed.

### 2 — Apply the bump

Once confirmed, call the engine — it detects the version file for this project's stack, computes the next semver, and rewrites it in place:

```
node ~/.harness-setup/engine/cli.js --root . --bump <patch|minor|major>
```

Two outcomes need to be handled explicitly, not worked around:

- **`ambiguous`** — more than one version file was found (monorepo, multi-project .NET solution, Cargo workspace). The engine does not guess which one is authoritative; it lists every candidate. Ask the user which file(s) to bump, then edit that specific file directly (there is no per-file `--bump` flag) mirroring the same major/minor/patch arithmetic.
- **`none-found`** — no recognized version file exists. Ask the user where the project's version actually lives before inventing one.

### 3 — Stop there

This skill only edits the version file. It does **not**:
- update a `CHANGELOG.md` — do that only if separately asked;
- create a git commit or tag — bumping a file and publishing that change are different actions; committing/tagging requires the user's explicit, separate request, same as any other write to shared history.

## Expected Output

A one-line summary of what changed (`file: from -> to`), the bump type used and why, and — if the file was ambiguous or not found — a clear explanation of what's missing instead of a silent guess.

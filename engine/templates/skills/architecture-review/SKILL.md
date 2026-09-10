---
name: architecture-review
description: Review a set of pending changes (or a given diff/PR) for architectural consistency with the rest of this repository — layering, module boundaries, naming, and dependency direction. Use when asked to review architecture, check consistency, or before merging a non-trivial change.
---
<!-- managed-by: harness-setup -->

# Architecture Review

Review the current changes (default: `git diff` against the base branch, or the diff/PR the user names) for architectural consistency with the existing codebase — not for style nits or bugs (those belong to other reviews).

## Method

1. Identify what part of the existing architecture the change touches (layers, modules, services, boundaries visible in the repo's own structure — do not assume a textbook pattern that isn't actually used here).
2. Compare the change against how neighboring code already solves the same kind of problem: naming, where logic lives, dependency direction, error handling, how state is passed around.
3. Flag only concrete deviations you can point at with a file/line and an existing counter-example from this repo — not stylistic preferences or hypothetical future problems.
4. If the change introduces a genuinely new pattern, note it explicitly and ask whether it's intentional rather than assuming it's wrong.

## Output

A short list of findings, each with: file/line, what deviates, and the existing pattern it deviates from. If nothing of substance is found, say so plainly instead of inventing findings.

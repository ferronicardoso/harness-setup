---
name: prd
description: "Use this skill when creating a Product Requirements Document (PRD) for a new feature or product change. Applies to: defining what a feature must do and why, before technical design starts. Trigger on: \"write a PRD\", \"PRD for...\", \"document the requirements for...\", \"what should this feature do\", or any similar request."
---
<!-- managed-by: harness-setup -->

## When to Trigger

- "Write a PRD for..."
- "Document the requirements for this feature"
- "What should this feature do — write it up"
- "PRD for the [X] feature"

## Overview

A Product Requirements Document captures **what** a feature must do and **why**, from the user/business perspective — before anyone commits to a technical design. It is the input to a TRD (technical requirements), not a replacement for one: keep implementation detail out of it.

A PRD is warranted when a feature is non-trivial enough that "what we're building and why" needs to be agreed before "how" — new user-facing capability, a change affecting multiple teams, or anything where the cost of building the wrong thing is high.

## Workflow

### 1 — Gather the essentials before writing

Do not invent answers to these — ask if they aren't already clear from the conversation:
- Who is this for (user/persona), and what problem do they have today?
- What does success look like — a measurable outcome, not just "it works"?
- What's explicitly out of scope for this version?

### 2 — Determine where it lives

Store PRDs in `docs/prd/`, one file per feature: `docs/prd/<feature-slug>.md`. If that directory doesn't exist, create it.

### 3 — Write the PRD

Use this format:

```markdown
# PRD — <Feature Name>

**Status:** Draft | Approved | Superseded by <link>
**Date:** YYYY-MM-DD
**Owner:** <who is accountable for this feature's outcome>

## Problem

What problem does this solve, for whom, and why does it matter now? Include evidence if available (data, user feedback, support volume) — not just assertion.

## Goals

What does this feature need to achieve? State outcomes, not implementation ("reduce time-to-checkout" not "add a progress bar").

## Non-Goals

What this explicitly will NOT do in this version. This is as important as the goals — it's what keeps scope honest.

## Users & Use Cases

Who uses this, and the concrete scenarios ("as a <role>, I want to <action>, so that <outcome>").

## Requirements

Numbered, testable statements of required behavior. Each one should be verifiable — a reviewer should be able to say yes/no whether it's met.

1. ...
2. ...

## Success Metrics

How will we know this worked, after it ships? Specific and measurable where possible.

## Open Questions

Anything still undecided that blocks moving to technical design.
```

### 4 — Handoff

Once a PRD is Approved, it becomes the input to a TRD (technical requirements) and/or ADRs for any significant technical decisions it forces. Reference the PRD from those documents; don't duplicate its content into them.

## Expected Output

A single `docs/prd/<feature-slug>.md` file with all sections above filled in — no section left as a placeholder. If a section genuinely doesn't apply, say so explicitly rather than deleting it silently.

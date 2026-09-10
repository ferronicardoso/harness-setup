---
name: trd
description: "Use this skill when creating a Technical Requirements Document (TRD) describing how a feature will be built. Applies to: architecture, interfaces, data model, and constraints for a feature already defined at the product level. Trigger on: \"write a TRD\", \"TRD for...\", \"technical design for...\", \"how should we build this\", or any similar request."
---
<!-- managed-by: harness-setup -->

## When to Trigger

- "Write a TRD for..."
- "Technical design for this feature"
- "How should we build this — write it up"
- "TRD for the [X] feature"

## Overview

A Technical Requirements Document captures **how** a feature will be built: architecture, interfaces, data model, and constraints. It assumes the product-level "what and why" is already settled (see the `prd` skill) — don't re-litigate scope here, reference the PRD instead.

A TRD is warranted when a feature touches multiple components/services, introduces a new integration or data model, or has technical trade-offs significant enough that reviewers need to weigh in before implementation starts.

## Workflow

### 1 — Ground it in the existing codebase, not a blank slate

Before writing, identify how the codebase already solves adjacent problems — existing layering, naming, and patterns (see how neighboring features are structured). A TRD proposing a new pattern should say so explicitly and why the existing pattern doesn't fit, not silently diverge.

### 2 — Determine where it lives

Store TRDs in `docs/trd/`, one file per feature: `docs/trd/<feature-slug>.md`. If a PRD exists for the same feature, link to it. If `docs/trd/` doesn't exist, create it.

### 3 — Write the TRD

Use this format:

```markdown
# TRD — <Feature Name>

**Status:** Draft | Approved | Superseded by <link>
**Date:** YYYY-MM-DD
**Related PRD:** <link, or "none">

## Summary

One paragraph: what is being built, technically, in plain language.

## Architecture

How this fits into the existing system — components touched, new components introduced, data flow. Prefer a short diagram (even ASCII) over a long paragraph when it's clearer.

## Interfaces

APIs, events, or contracts this feature exposes or consumes — request/response shapes, error cases, versioning implications if any.

## Data Model

New or changed entities/tables/schemas. Include migration considerations if this touches existing data.

## Alternatives Considered

What other approaches were considered and why they were rejected. If a choice here is significant enough to outlive this document, it belongs in its own ADR — link it instead of duplicating the reasoning.

## Constraints & Risks

Performance, security, backward-compatibility, or operational constraints that shape the design. What could go wrong, and what would trigger revisiting this design.

## Rollout Plan

Feature flags, migration steps, backward compatibility during rollout, and how to roll back if needed.

## Open Questions

Anything still undecided that blocks implementation.
```

### 4 — Significant decisions get their own ADR

If the TRD contains a decision with long-term impact and real trade-offs (e.g. choice of message broker, multi-tenancy model), don't bury it in prose here — use the `adr` skill for that decision and link it from the Alternatives Considered section.

## Expected Output

A single `docs/trd/<feature-slug>.md` file with all sections filled in and grounded in the actual codebase (real component/file names, not placeholders) — not a generic template left unfilled.

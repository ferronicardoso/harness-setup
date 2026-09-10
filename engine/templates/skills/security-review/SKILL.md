---
name: security-review
description: Review pending changes (or a given diff/PR) for security issues — injection, authZ/authN gaps, secrets, unsafe deserialization, SSRF, path traversal — before merging. Use when asked for a security review or before merging changes that touch input handling, auth, or external calls.
---
<!-- managed-by: harness-setup -->

# Security Review

Review the current changes (default: `git diff` against the base branch, or the diff/PR the user names) for concrete, exploitable security issues. This is not a general code review — skip style and architecture concerns.

## Checklist (apply what's relevant to the diff; skip what isn't)

- **Secrets**: no credentials, tokens, keys, or connection strings committed, including in test fixtures or config defaults.
- **Injection**: SQL/NoSQL/command/template injection wherever user input reaches a query, shell command, or template engine.
- **AuthZ/AuthN**: every new endpoint or handler enforces the same access checks as its neighbors; no new implicit trust boundary.
- **Deserialization / parsing**: untrusted input isn't deserialized or parsed in a way that allows code execution or resource exhaustion.
- **SSRF / path traversal**: any new outbound request or file path built from user input is validated against an allowlist, not a denylist.
- **Dependency changes**: new dependencies are from a legitimate source and don't obviously widen the attack surface for no reason tied to the task.

## Output

A short list of findings, each with: file/line, the concrete attack scenario (input → effect), and severity. If nothing of substance is found, say so plainly instead of inventing findings.

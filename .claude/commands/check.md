---
description: Run the repo quality gate — ESLint + strict TypeScript typecheck — and fix what breaks
allowed-tools: Bash(npm run lint:*), Bash(npx tsc:*), Read, Edit
---

This repo has **no test runner** (no jest/vitest, no test script). The quality gate is ESLint plus the strict TypeScript compiler. Run both, then fix every error.

ESLint (`next/core-web-vitals`):
!`npm run lint`

Strict typecheck (no emit):
!`npx tsc --noEmit`

Now:
- If both are clean, say so and stop.
- Otherwise, fix each reported error at its source. Only touch files implicated by the output; do not reformat or "improve" unrelated code.
- Respect the CLAUDE.md **Do NOT** rules while fixing — no Tailwind, no axios, no new abstractions, and do not add comments/docstrings to code you didn't change.
- Re-run the failing check after editing to confirm it passes.

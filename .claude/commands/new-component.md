---
description: Scaffold a new client component the repo's way (folder + CSS Module + design tokens)
argument-hint: <ComponentName> [one-line purpose]
allowed-tools: Read, Write, Edit, Bash(ls:*)
---

Scaffold a new UI component named **$1** ($ARGUMENTS). Follow this repo's existing structure exactly — study a sibling like @src/components/UrlInput/UrlInput.tsx and @src/components/UrlInput/UrlInput.module.css first, then mirror their conventions.

Rules for this repo:
- Create `src/components/$1/$1.tsx` and `src/components/$1/$1.module.css`.
- The `.tsx` starts with `'use client';` if it uses state, effects, refs, or browser APIs; omit it for a pure presentational server component.
- Default-export the component. Type props with a local `interface Props { ... }` (see UrlInput's pattern). No `React.FC`.
- Import styles as `import styles from './$1.module.css';` — **CSS Modules only**. Do NOT use Tailwind, inline style objects for theming, or any CSS-in-JS.
- Style exclusively with the design tokens in `globals.css` (`var(--bg-surface)`, `var(--text-primary)`, `var(--accent)`, `var(--border-subtle)`, `var(--section-py)`, `var(--max-w)`, etc.). Do not hardcode hex colors that duplicate a token.
- Match the typographic patterns: eyebrows uppercase `letter-spacing: 0.18em` in `var(--accent)`; headlines `var(--font-display)`; buttons uppercase `letter-spacing: 0.08em`.
- Keep it simple — no speculative props or abstractions. Do not add comments/docstrings.

After writing both files, tell me where to wire the component in (e.g. `src/app/page.tsx`) but do not modify unrelated files unless I ask.

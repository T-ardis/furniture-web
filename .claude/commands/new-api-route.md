---
description: Scaffold a new server-side BFF route under src/app/api/ following the repo's conventions
argument-hint: <route-name> [what it does / why it must be server-side]
allowed-tools: Read, Write, Edit, Bash(ls:*)
---

Scaffold a new App Router BFF route at `src/app/api/$1/route.ts` ($ARGUMENTS). Study an existing sibling like @src/app/api/gate/route.ts first and mirror its shape.

This BFF layer exists ONLY for work that must run server-side — CORS/hotlink evasion, injecting server-only secrets, or serving clients that can't send custom headers (e.g. iOS AR Quick Look). Before writing, confirm this route genuinely needs the server; if the browser could call the tardis backend directly (CORS is open `*`), it probably shouldn't be a route.

Conventions to follow:
- Export the matching HTTP handler (`export async function GET`/`POST`) typed with `NextRequest` / `NextResponse` from `next/server`.
- Validate input and return proper status codes (400 on bad input, 429 passed through from the backend, 500 on failure). Return JSON via `NextResponse.json(...)`.
- Read secrets from `process.env` (`GEMINI_API_KEY`, `NOTION_API_KEY`, `NOTION_DATABASE_ID`) server-side only — never leak them to the client. `NEXT_PUBLIC_API_KEY` is intentionally read server-side in the download proxy to inject `X-API-Key`.
- Do NOT send `X-API-Key` to the backend `/gate` endpoint — it is public.
- `getDownloadUrl` is asymmetric: USDZ is proxied same-origin, GLB is direct. Preserve that if you touch download logic.
- Keep user-facing error strings free of internal ops/infra detail.
- Use native `fetch` (no axios). No new abstractions. No comments/docstrings on code you didn't change.
- If this route fetches an arbitrary user-supplied URL (like `/api/scrape` or `/api/image-proxy`), note that it is an open server-side fetch (SSRF surface) and flag it to me — do not silently ship it.

After writing, remind me which env vars must be set and where the client calls this route from.

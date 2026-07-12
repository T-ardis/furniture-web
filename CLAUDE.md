# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**furniture-web** (product name "TARDIS Furniture") is the browser companion to the TARDIS iOS app. A user pastes a furniture product URL (or enters a name + uploads a photo), the app scrapes/enriches the product, generates an AI 3D model, previews it in their room, opens it in AR (iOS AR Quick Look / Android Scene Viewer), and finds similar items across retailers.

It is a Next.js app, but **not** purely frontend: it has a real server-side BFF layer (`src/app/api/*`) that does scraping, secret injection, and Notion lead capture. Heavy AI work (3D generation, room compositing, similar-item search) lives in the separate **tardis backend** at `../tardis/backend/` (FastAPI, shared with iOS), which furniture-web calls over HTTP.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript strict
- **Styling**: CSS Modules + CSS custom properties (no Tailwind, no CSS-in-JS)
- **Fonts**: Space Grotesk (`--font-display`) + Inter (`--font-body`) via `next/font/google`
- **Animations**: GSAP + ScrollTrigger (dynamic import), Lenis smooth scroll
- **3D/AR**: `@google/model-viewer` web component
- **HTTP**: native `fetch` (no axios)
- **Server deps**: `@notionhq/client` (waitlist), Gemini REST (scrape enrichment) — server routes only

## Architecture: end-to-end flow

`src/app/page.tsx` is a single client-side orchestrator. It holds two decoupled concerns:

1. **Generation state machine** — lives in `src/hooks/useGeneration.ts` as `GenerationPhase` (`idle → submitting → generating → downloading → ready | failed`). `page.tsx` reads `gen.phase` to conditionally render `ProductCard` / `GenerationStatus` / `ModelViewer` / `RoomPreview` / `SimilarItems`.
2. **Email/waitlist gating** — an ad-hoc pre-flight gate in `page.tsx`, not part of the state machine.

The real flow:

1. User submits via `UrlInput`. If a URL is given, the client POSTs it to `/api/scrape` (server-side scrape + Gemini enrichment) to build a product (name/category/dimensions/images). Users can also enter details + a photo directly.
2. If not authenticated, the submission is stashed in `pendingInputRef` and `EmailGate` opens. Once an email is captured/authed, a `useEffect` auto-replays the pending submission.
3. `handleSubmit` calls `canGenerate(email)` (backend quota, see gating), converts the chosen image to base64 (`imageToBase64` / `urlToBase64`, resized to **512px** JPEG q0.85), then `gen.generate(base64)`.
4. `useGeneration` → `POST /generate/async` → poll `GET /status/{task_id}` every 5s → on `finished`, download the model.
5. **Download is asymmetric by format** (see below): GLB is fetched as a blob for the `<model-viewer>` `src`; USDZ is exposed as a same-origin proxy URL (`/api/download/{id}?format=usdz`) used directly as the `ios-src` for AR Quick Look.
6. On `ready`: `incrementGenerationCount(email)` and `addToHistory(...)` (localStorage).
7. In parallel once `productBase64` exists: `RoomPreview` (→ `/preview/room`) and `SimilarItems` (→ `/research/similar` or the SSE stream) mount.

## Server routes (BFF layer) — `src/app/api/*`

These exist because work must happen server-side (CORS, secrets, or clients that can't send headers). **Note: the old "no scraping on frontend" rule is obsolete — scraping happens here.**

| Route | Why it exists |
|-------|---------------|
| `POST /api/scrape` | Fetches an arbitrary product URL server-side (spoofed UA), parses HTML/JSON-LD for title/price/images/category/dimensions, then optionally refines via **Gemini 2.5-flash-lite** (`GEMINI_API_KEY`). Falls back to heuristics if Gemini is unset/fails. ~500 lines; open server-side fetch (no URL allowlist — SSRF surface). |
| `GET /api/download/[taskId]?format=…` | Proxies the tardis backend `/download`, injecting `X-API-Key` server-side. Required because iOS AR Quick Look fetches `ios-src` with no ability to attach custom headers. Sets correct `Content-Type` (`model/vnd.usdz+zip` / `model/gltf-binary`) + 24h cache. |
| `GET /api/image-proxy?url=…` | Re-serves an arbitrary retailer image same-origin (spoofed UA, 24h cache) to dodge CORS/hotlink/canvas-taint when scraped images need to be drawn to canvas or rendered. Also an open proxy. |
| `POST /api/gate` | Checks whether an email already exists in the Notion waitlist DB (`NOTION_API_KEY`) via Notion Search — returning-user detection. |
| `POST /api/waitlist` | Creates a Notion page (email, signup date, UTM fields, referrer) in `NOTION_DATABASE_ID`. Lead capture. Unlike sibling landing-web, it does NOT infer UTM source from referrer — it defaults attribution to `furniture-web`/`product`. |

## Client data layer

- **`src/lib/api.ts`** — typed `fetch` client to the tardis backend (`generate` / `status` / `download` / `preview/room` / `research/similar` + SSE `research/similar/stream`) plus base64 resize utils. `headers()` injects `X-API-Key` (this replaces the never-built `useApi.ts` hook the old docs mentioned).
  - `getDownloadUrl(taskId, format)` is **asymmetric**: `usdz` → same-origin proxy `/api/download/...`; `glb`/default → raw backend URL. Do not assume both formats resolve the same way.
  - `downloadModel` has a 3-tier fallback that sniffs the glTF magic bytes to verify a real GLB, retrying the no-format URL, then throwing. Its final error string mentions an internal ops command — keep such infra detail out of user-facing UI.
  - `findSimilarStream` is a hand-rolled SSE reader over `fetch`+`ReadableStream` (not `EventSource`): parses `data:`, `event: done`, `event: error`. Fragile to server line-ordering changes.
- **`src/lib/gate.ts`** — access-control + attribution: `checkEmailInWaitlist` / `autoSignupEmail` proxy through `/api/gate` + `/api/waitlist` (Notion); `canGenerate` / `incrementGenerationCount` call the backend `/gate` endpoint **directly** (no proxy, and note: they send NO `X-API-Key`). `captureUtmParams` persists UTM to `sessionStorage`. These fail **closed** — any network error silently blocks generation. Duplicates the `NEXT_PUBLIC_API_URL` fallback constant that also lives in `api.ts`.
- **`src/lib/history.ts`** — localStorage generation history (key `tardis_furniture_history`, cap 20, dedupe-by-id). No backend. Selecting a history item shows the `ProductCard` but does NOT re-run generation (no cached model), so `ModelViewer` won't reappear.
- **`src/lib/demo.ts`** — static `DEMO_PRODUCT` (hardcoded sofa, local `/demo/*` assets) for a canned example flow.

### Gating notes
- Two gate UIs exist. **`EmailGate`** (soft gate: auto-signs-up any email, then authenticates) is the one wired into `page.tsx`. **`WaitlistGate`** (strict, no signup path) is **orphaned/dead** — not imported anywhere. If asked about "the waitlist gate", clarify which.
- Auto-auth-from-URL: `page.tsx` reads `?email=` (from landing-web signup), verifies via `checkEmailInWaitlist`, stores + strips the param. `page.tsx` returns `null` until `authChecked` resolves → brief blank flash for those visitors.

## AR / model-viewer

`ModelViewer` is a thin wrapper around the raw `<model-viewer>` web component (dynamic import for SSR safety; `@ts-expect-error` since it's not a typed JSX element). Platform branching is delegated entirely to model-viewer via `ar-modes="webxr scene-viewer quick-look"` + `ios-src` (USDZ) / `src` (GLB):

- **iOS Safari**: AR Quick Look with USDZ (LiDAR surface detection/occlusion when available).
- **Android Chrome**: Scene Viewer with GLB via intent (ARCore devices).
- **Desktop/unsupported**: interactive 3D viewer (orbit/zoom/pan), no AR button.

AR-support text hints use a heuristic (`ar-status` event + a 1s `canActivateAR` fallback poll) that can race and stay `false` even when AR works — cosmetic only; model-viewer always renders the AR button itself.

## SEO subsystem

Undocumented in the old file but material:
- `src/app/(seo)/` route group (parens = no URL segment) holds 3 static marketing landing pages (`3d-furniture-model-generator`, `ar-furniture-viewer`, `room-visualizer`), each with its own `Metadata` export, sharing `seo.module.css` and the real `Nav`/`Footer`.
- `src/app/jsonld.ts` — WebSite / WebApplication / Organization / FAQPage JSON-LD, rendered once in `layout.tsx` `<head>` for ALL pages (the JSON-LD FAQ is separate from and can drift from each landing page's own FAQ copy).
- `src/app/robots.ts` + `src/app/sitemap.ts` are metadata route handlers. The production base URL `https://app.tardis-ai.com` is **hardcoded in ~15 occurrences across 7 files** (`sitemap.ts`, `robots.ts`, `layout.tsx` metadataBase + OG, `jsonld.ts` (×5), and each `(seo)` page's `openGraph.url`) — there is no single base-URL constant, so a domain change must touch all of them. `sitemap.ts` uses `new Date()` for `lastModified`.
- Assets: `src/app/favicon.ico`, `public/og.png` (1200×630, also the JSON-LD screenshot).

## Backend API contract (tardis backend)

Base URL `NEXT_PUBLIC_API_URL`; auth `X-API-Key` header. CORS is fully open (`*`), so the browser could call it directly — the Next proxies exist for secrets/header constraints, not CORS. Every endpoint requires the key except `/health` and `/gate`. Backend enforces per-feature **daily rate limits → 429** (generation/preview/research/room); handle 429 distinctly.

| Method | Path | Purpose / response |
|--------|------|--------------------|
| `POST` | `/generate/async` | Submit 3D job. Body `{ image (base64, no data-URI prefix), steps=5, seed=1234, face_count=40000 }` → `{ task_id }` |
| `GET` | `/status/{task_id}` | `{ task_id, status, progress, error }`. Statuses `pending → processing → finished \| failed`. Poll 5s. |
| `GET` | `/download/{task_id}?format=glb\|usdz` | Model stream. Default (no `format`) serves the native extension (may be USDZ, not GLB). `?format=glb` 404s if only a `.usdz` exists. |
| `POST` | `/preview/room` | Room composite. Body `{ room_image, product_image, product_name }` → `{ preview_image }` (base64 JPEG). ~5–15s, synchronous. |
| `POST` | `/research/similar` | Similar items → `{ results: ResearchResultItem[] }`, item = `{ title, url, image_url, price, retailer, source, snippet }`. Can take **up to 5 min** (waits for all retailers). |
| `POST` | `/research/similar/stream` | **SSE** variant. Each `data:` event = a JSON array of result items per retailer as it completes; terminates with `event: done`; `event: error` on failure. Consumed by `findSimilarStream`. |
| `POST` | `/gate` | **Public (no API key)** email quota gate. Body `{ action: 'check'\|'increment', email }` → `{ allowed, remaining }`. Free limit ~1 generation/email. Called directly from the browser. |
| `GET` | `/health` | `{ status: 'ok' }`, no auth. |

There is also a `/rooms/*` router (multi-photo room reconstruction → `.spz` Gaussian splat, via World Labs Marble) and `GET /` (server info / daily usage). furniture-web does **not** currently integrate these.

### How the backend runs (context for generation issues)
- The backend is a stateless-ish FastAPI orchestrator (in-memory job dict, ephemeral `tempfile.mkdtemp` output dir). **Job state and files are lost on restart/redeploy and don't survive multi-instance** — a `task_id` polled after a restart returns 404.
- Real 3D work runs on **Modal** (serverless A10G GPU, Hunyuan3D shape + Paint texture → returns `{usdz_b64, glb_b64}`). Cold starts add latency on top of the 2–5 min generation. A `runpod_handler` exists but is legacy/unwired (shape-only, GLB-only — would break iOS USDZ). Room preview uses Fal.ai; similar-items uses TinyFish.
- `MOCK_MODE=true` on the backend returns fast fake results for local frontend dev without real API keys.

## Environment variables

Client (`NEXT_PUBLIC_*`, exposed in the browser bundle):
```env
NEXT_PUBLIC_API_URL=http://localhost:8080   # tardis backend base URL
NEXT_PUBLIC_API_KEY=…                        # X-API-Key for backend calls
NEXT_PUBLIC_LANDING_URL=https://www.tardis-ai.com  # only used by the orphaned WaitlistGate
```
Server-only (used by BFF routes; never sent to the client):
```env
GEMINI_API_KEY=…        # /api/scrape enrichment (optional — falls back to heuristics)
NOTION_API_KEY=…        # /api/gate + /api/waitlist
NOTION_DATABASE_ID=…    # /api/waitlist target DB
```
`NEXT_PUBLIC_API_KEY` is also read server-side in `/api/download` to inject the header for AR Quick Look — intentional despite the `PUBLIC` naming.

## Design System (matches `../landing-web/`'s pre-rebrand tokens)

Design tokens live in `globals.css` as CSS custom properties. (Note: sibling landing-web has since rebranded to Archivo/`--gold #D2B07E`; furniture-web still uses the original tokens below and Space Grotesk/Inter. The two apps are separate repos with no shared package — do not assume brand parity or that you can import across them.)

```
--bg-void:     #080808   (deepest black — hero, CTA)
--bg-dark:     #0d0d0d   (main body bg)
--bg-surface:  #111111   (cards, inputs)
--bg-elevated: #181818   (hover, modals)

--text-primary:   #f0ede8
--text-secondary: #8a8a8a
--text-muted:     #2a2a2a

--accent:      #c8a97e   (gold — buttons, highlights, links)
--accent-hover:#d4b990
--accent-dim:  rgba(200,169,126,0.10)

--border-subtle:  rgba(255,255,255,0.05)
--border-visible: rgba(255,255,255,0.10)
```

### Typography
- Eyebrows: `--text-xs`, uppercase, `letter-spacing: 0.18em`, `color: var(--accent)`
- Headlines: `var(--font-display)`, `700`, `letter-spacing: -0.03em`
- Body: `var(--font-body)`, `400`
- Buttons: uppercase, `letter-spacing: 0.08em`, `600`

### Component patterns
- Sections: `padding-block: var(--section-py)`, inner `max-width: var(--max-w)`
- Primary button: `background: var(--accent); color: #0a0a0a`
- Ghost button: `border: 1px solid var(--border-visible); color: var(--text-secondary)`
- Inputs: `background: var(--bg-surface); border: 1px solid var(--border-visible)`
- Cards: `background: var(--bg-surface); border: 1px solid var(--border-subtle)`

`layout.tsx` wraps everything in a bespoke `ToastProvider` (the app's only React Context; success/error/info) + `SmoothScroll` (Lenis, but skipped on touch devices via `matchMedia('(hover: none) and (pointer: coarse)')`).

## Commands

```bash
npm run dev     # dev server (port 3000)
npm run build   # production build
npm run start   # production server
npm run lint    # ESLint
```

**There is no test runner** — no jest/vitest, no test script, no `__tests__`. (Sibling landing-web does have Jest; if asked to add tests here, a harness must be bootstrapped from scratch.)

## Do NOT

- Do not use Tailwind CSS — CSS Modules + custom properties only.
- Do not use axios — native `fetch`.
- Do not assume `getDownloadUrl`'s formats resolve to the same origin (USDZ is proxied, GLB is direct).
- Do not send `X-API-Key` to the backend `/gate` endpoint — it is public.
- Do not add unnecessary abstractions; keep it simple.
- Do not add comments/docstrings to code you didn't change.
- Do not create README.md unless asked.

# TARDIS Furniture Web — CLAUDE.md

## Project Overview

**furniture-web** is the web companion to the TARDIS iOS app. It lets users paste a furniture product URL, generate an AI-powered 3D model, preview it in their room, view it in AR (iPhone LiDAR / Android Scene Viewer), and discover similar items across retailers — all from the browser.

The backend already exists at `../tardis/backend/` and is shared with the iOS app. This project is a **frontend-only** Next.js app that calls those API endpoints.

## Tech Stack

- **Framework**: Next.js 16 (App Router) — same version as `../landing-web/`
- **React**: 19
- **Styling**: CSS Modules (no Tailwind, no CSS-in-JS)
- **Fonts**: Space Grotesk (display/headings) + Inter (body) via `next/font/google`
- **Animations**: GSAP + ScrollTrigger (dynamic import), Lenis smooth scroll
- **3D/AR**: `@google/model-viewer` web component for 3D preview + native AR
- **HTTP**: Native `fetch` — no axios
- **TypeScript**: Strict mode

## Design System (matches `../landing-web/`)

All design tokens are defined in `globals.css` as CSS custom properties:

```
--bg-void:     #080808        (deepest black — hero, CTA)
--bg-dark:     #0d0d0d        (main body bg)
--bg-surface:  #111111        (cards, inputs)
--bg-elevated: #181818        (hover states, modals)

--text-primary:   #f0ede8     (headings, primary text)
--text-secondary: #8a8a8a     (body, captions)
--text-muted:     #2a2a2a     (disabled)

--accent:      #c8a97e        (gold — buttons, highlights, links)
--accent-hover:#d4b990
--accent-dim:  rgba(200,169,126,0.10)

--border-subtle:  rgba(255,255,255,0.05)
--border-visible: rgba(255,255,255,0.10)
```

### Typography Conventions
- Eyebrows: `--text-xs`, uppercase, `letter-spacing: 0.18em`, `color: var(--accent)`
- Headlines: `font-family: var(--font-display)`, `font-weight: 700`, tight `letter-spacing: -0.03em`
- Body: `font-family: var(--font-body)`, `font-weight: 400`
- Buttons: uppercase, `letter-spacing: 0.08em`, `font-weight: 600`

### Component Patterns
- Every section has `padding-block: var(--section-py)` and `max-width: var(--max-w)` inner container
- Primary buttons: `background: var(--accent); color: #0a0a0a`
- Ghost buttons: `border: 1px solid var(--border-visible); color: var(--text-secondary)`
- Inputs: `background: var(--bg-surface); border: 1px solid var(--border-visible)`
- Cards: `background: var(--bg-surface); border: 1px solid var(--border-subtle)`

## Backend API Reference (tardis backend)

Base URL is configured via `NEXT_PUBLIC_API_URL` env var. Auth via `X-API-Key` header (`NEXT_PUBLIC_API_KEY`).

### Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/generate/async` | Submit 3D generation job (base64 image) → `{ task_id }` |
| `GET` | `/status/{task_id}` | Poll job status → `{ status, progress }` |
| `GET` | `/download/{task_id}` | Download USDZ/GLB model file |
| `POST` | `/preview/room` | AI room preview (room photo + product photo → base64 JPEG) |
| `POST` | `/research/similar` | Find similar furniture (image + name + category → results[]) |
| `GET` | `/health` | Health check (no auth) |

### Key Schema Notes
- `GenerateRequest`: `{ image: string (base64), steps?: number, seed?: number, face_count?: number }`
- `RoomPreviewRequest`: `{ room_image: string (base64), product_image: string (base64), product_name: string }`
- `ResearchRequest`: `{ image: string (base64), name: string, category: string }`
- Job statuses: `pending` → `processing` → `finished` | `failed`
- Poll interval: 5 seconds recommended
- 3D generation takes 2-5 minutes; room preview takes 5-15 seconds

## AR Implementation

Uses `@google/model-viewer` web component which handles both platforms:

- **iOS (iPhone 12 Pro+)**: Opens AR Quick Look with USDZ file. Automatically uses LiDAR for surface detection and occlusion when available. Works on Safari.
- **Android**: Opens Scene Viewer with GLB file via intent. Works on Chrome with ARCore-capable devices.
- **Desktop/unsupported**: Shows interactive 3D viewer (orbit, zoom, pan) — no AR button.

The backend already serves both USDZ (primary) and GLB formats from `/download/{task_id}`.

## Project Structure

```
furniture-web/
├── CLAUDE.md
├── PLAN.md
├── .env.local               # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_API_KEY
├── package.json
├── next.config.ts
├── tsconfig.json
└── src/
    ├── app/
    │   ├── layout.tsx        # Root layout (fonts, SmoothScroll, globals.css)
    │   ├── globals.css       # Design tokens + reset (copied from landing-web)
    │   └── page.tsx          # Home: URL input → product flow
    ├── components/
    │   ├── Nav/              # Fixed nav bar with logo + menu
    │   ├── UrlInput/         # URL input hero section
    │   ├── ProductCard/      # Product info (name, price, images, dimensions)
    │   ├── ModelViewer/      # 3D model viewer + AR button (wraps model-viewer)
    │   ├── RoomPreview/      # Room photo upload + AI preview result
    │   ├── SimilarItems/     # Grid of similar furniture from retailers
    │   ├── GenerationStatus/ # Progress indicator during 3D generation
    │   ├── ImageGallery/     # Product image selector (multiple scraped images)
    │   ├── Footer/           # Footer (same style as landing-web)
    │   └── SmoothScroll/     # Lenis smooth scroll (reuse from landing-web)
    ├── hooks/
    │   ├── useApi.ts         # Fetch wrapper with auth headers
    │   ├── useGeneration.ts  # Submit + poll + download 3D model
    │   └── useRevealOnScroll.ts  # GSAP scroll reveal (reuse from landing-web)
    └── lib/
        └── api.ts            # API client (typed fetch calls to backend)
```

## Environment Variables

```env
# Backend API (the tardis backend)
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_API_KEY=your_api_key_here
```

## Key Implementation Notes

1. **No scraping on frontend** — the web app does NOT scrape URLs itself. The iOS app uses `LinkScraperService` + `GeminiService` for that. For the web MVP, users either:
   - Manually enter product name + upload a photo, OR
   - We add a new `/scrape` endpoint to the backend (Phase 2)

2. **model-viewer is a web component** — import via `<script>` in layout or use `@google/model-viewer` npm package. Needs `"use client"` and dynamic import to avoid SSR issues.

3. **Base64 image handling** — use `FileReader` + canvas for resize before sending to backend. Max 512px for generation, 1024px for room preview.

4. **Polling** — use `setInterval` with cleanup in `useEffect`, or a custom hook with AbortController. Show progress percentage from `/status` response.

5. **Mobile-first** — the AR feature is primarily for phones. Responsive design must prioritize mobile viewport.

## Commands

```bash
npm run dev     # Start dev server (port 3000)
npm run build   # Production build
npm run start   # Start production server
npm run lint    # ESLint
```

## Do NOT

- Do not use Tailwind CSS — this project uses CSS Modules with CSS custom properties
- Do not use axios — use native fetch
- Do not add unnecessary abstractions — keep it simple
- Do not add comments or docstrings to code you didn't change
- Do not create README.md unless asked

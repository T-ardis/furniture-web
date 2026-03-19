# TARDIS Furniture Web — Implementation Plan

## Goal

Build a web app where users can:
1. Enter/upload furniture product info (image, name, dimensions)
2. Generate an AI 3D model from the product image
3. View the 3D model in-browser (orbit, zoom, pan)
4. Place the model in AR — iPhone uses LiDAR via AR Quick Look, Android uses Scene Viewer
5. Upload a room photo → get AI-generated preview with furniture placed inside
6. Discover similar furniture across real retailers (IKEA, Wayfair, West Elm, CB2, etc.)

All backed by the existing **tardis backend** — no new server needed.

---

## Phase 1 — Project Scaffold + Core Layout

### 1.1 Initialize Next.js project
- `npx create-next-app@latest` with TypeScript, App Router, CSS Modules, no Tailwind
- Match package versions to landing-web: Next 16, React 19
- Add deps: `gsap`, `lenis`, `@google/model-viewer`
- Copy design system from landing-web: `globals.css` (tokens, reset), fonts config in `layout.tsx`
- Copy `SmoothScroll` component from landing-web
- Set up `.env.local` with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`

### 1.2 Nav + Footer
- Reuse Nav pattern from landing-web (fixed bar, logo, menu overlay)
- Adapt links for furniture-web pages
- Footer: same brand/copyright/email pattern

### 1.3 API Client (`src/lib/api.ts`)
- Typed functions for each backend endpoint
- Auto-attach `X-API-Key` header from env var
- Types matching backend Pydantic schemas

---

## Phase 2 — Product Input + Image Upload

### 2.1 Hero / URL Input Section
- Large hero with the dark aesthetic + accent
- Input field for pasting a furniture product URL (phase 2 backend feature)
- OR manual mode: name input + image upload + category dropdown + dimensions
- For MVP: focus on **manual mode** (image upload + metadata)

### 2.2 Product Card Component
- Displays: product name, price, category, dimensions (W×H×D cm)
- Image gallery: thumbnails row, click to select active image
- Editable dimensions (sliders or number inputs)
- "Generate 3D Model" primary CTA button

### 2.3 Image Upload + Processing
- Drag & drop zone or file picker
- Client-side resize to 512px max before base64 encoding
- Preview thumbnail after upload

---

## Phase 3 — 3D Generation + Model Viewer

### 3.1 Generation Hook (`src/hooks/useGeneration.ts`)
- `submitJob(imageBase64)` → returns taskId
- `pollStatus(taskId)` → polls every 5s, returns status + progress
- `downloadModel(taskId)` → fetches USDZ/GLB binary
- Manages state: `idle` | `submitting` | `generating` | `downloading` | `ready` | `failed`
- Stores model blob URL for `<model-viewer>`

### 3.2 Generation Status Component
- Shows current phase: "Submitting..." → "Generating 3D model (42%)" → "Downloading..."
- Animated progress bar with accent color
- Estimated time remaining based on typical 2-5 min generation

### 3.3 Model Viewer Component
- Wraps `<model-viewer>` web component
- Props: `src` (blob URL or download URL), `ar` (boolean), `poster` (product image as fallback)
- Features:
  - Auto-rotate on load
  - Orbit controls (drag to rotate, scroll to zoom, two-finger pan)
  - AR button (shows only on supported devices)
  - Loading indicator while model loads
- Dynamic import with `"use client"` to avoid SSR

### 3.4 AR Integration
- `<model-viewer ar ar-modes="webxr scene-viewer quick-look">` handles platform detection
- For iOS: serves USDZ via `ios-src` attribute → AR Quick Look → LiDAR if available
- For Android: serves GLB → Scene Viewer via ARCore
- Fallback: 3D viewer only on desktop/unsupported devices
- "View in Your Space" button styled as primary CTA

---

## Phase 4 — Room Preview

### 4.1 Room Photo Upload
- "Preview in Your Room" section below the 3D viewer
- Upload or camera capture (mobile) for room photo
- Client-side resize to 1024px max
- Shows the room photo as preview while generating

### 4.2 Room Preview Generation
- Calls `POST /preview/room` with room_image + product_image + product_name
- Takes 5-15 seconds — show skeleton/spinner with "AI is placing your furniture..."
- Returns base64 JPEG — display full-width below the upload area
- Side-by-side before/after comparison (original room vs AI preview)

---

## Phase 5 — Similar Items Discovery

### 5.1 Research Request
- "Find Similar" button triggers `POST /research/similar`
- Sends product image + name + category
- Takes 30-90 seconds — show loading state with retailer logos appearing as results come in

### 5.2 Similar Items Grid
- Card grid (2 cols mobile, 3-4 cols desktop)
- Each card: product image, title, price, retailer badge, "View" link
- Retailer badges: IKEA, Wayfair, West Elm, CB2, Amazon, eBay
- Cards link directly to retailer product pages (external links)

---

## Phase 6 — Full Page Flow + Polish

### 6.1 Single-Page Product Flow
The home page (`/`) is the entire experience — no routing needed for MVP:

```
┌──────────────────────────────┐
│         Nav (fixed)          │
├──────────────────────────────┤
│     Hero: Input Section      │  ← Upload image + enter details
│     (dark, accent glow)      │
├──────────────────────────────┤
│     Product Card             │  ← Shows after input, editable
│     + Image Gallery          │
├──────────────────────────────┤
│     3D Model Viewer          │  ← After generation complete
│     + AR Button              │
│     + Generation Progress    │
├──────────────────────────────┤
│     Room Preview             │  ← Upload room photo → AI preview
├──────────────────────────────┤
│     Similar Items            │  ← Grid of similar products
├──────────────────────────────┤
│         Footer               │
└──────────────────────────────┘
```

Sections reveal progressively as the user completes each step.

### 6.2 Animations
- GSAP scroll reveals for each section (reuse `useRevealOnScroll`)
- Smooth transitions when sections appear (generation complete, preview ready)
- Scramble text effect on eyebrow labels
- Model viewer entrance animation

### 6.3 Mobile Optimization
- Touch-friendly controls, large tap targets
- Camera capture for room photo (not just file upload)
- AR button prominent on mobile (this is the killer feature)
- Bottom sheet pattern for generation status on mobile

---

## Phase 7 — Enhancements (Post-MVP)

- **URL scraping**: Add `POST /scrape` endpoint to backend for auto-extracting product data from URLs
- **History/saved items**: LocalStorage for recently generated models
- **Share**: Generate shareable links for 3D models
- **Multiple items**: Support placing multiple furniture items in one room
- **Texture customization**: Color/material variants for generated models

---

## Implementation Order

1. **Phase 1** — Scaffold, design system, nav, footer, API client
2. **Phase 2** — Product input (manual mode: image upload + metadata)
3. **Phase 3** — 3D generation + model-viewer + AR
4. **Phase 4** — Room preview
5. **Phase 5** — Similar items
6. **Phase 6** — Polish, animations, mobile optimization

Each phase is independently demoable. Phase 3 (3D + AR) is the core value prop and should be prioritized.

---

## AR Technical Details

### How `<model-viewer>` AR Works

```html
<model-viewer
  src="/model.glb"           <!-- GLB for viewer + Android AR -->
  ios-src="/model.usdz"      <!-- USDZ for iOS AR Quick Look -->
  ar                          <!-- Enable AR button -->
  ar-modes="webxr scene-viewer quick-look"
  camera-controls              <!-- Orbit/zoom/pan -->
  auto-rotate                  <!-- Spin on load -->
  shadow-intensity="1"         <!-- Ground shadow -->
  environment-image="neutral"  <!-- Lighting -->
>
  <button slot="ar-button" class="ar-btn">
    View in Your Space
  </button>
</model-viewer>
```

### iOS AR Quick Look (LiDAR)
- Triggered automatically when user taps AR button on Safari
- Uses `.usdz` file format (already generated by the backend)
- On iPhone 12 Pro+ / iPad Pro: LiDAR provides instant surface detection, object occlusion, and accurate scale
- On older iPhones: Falls back to ARKit plane detection (slower but still works)
- No app install needed — native Safari feature

### Android Scene Viewer
- Triggered via intent on Chrome
- Uses `.glb` file format
- Requires ARCore-capable device
- Shows "View in your space" button in Scene Viewer UI

### Desktop Fallback
- No AR available — shows full 3D viewer only
- User can orbit, zoom, pan the model
- Poster image shown while model loads

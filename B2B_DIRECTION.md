# TARDIS — B2B Direction (one-pager)

*Date: 2026-07-03 · Status: **direction aligned, no design yet** · For: Illia + design/retail partners*

---

## TL;DR

We're turning TARDIS from a consumer web app into a **B2B embeddable AR layer**: a retailer drops one button on their product page; a shopper taps it and sees the product **in their own space** — a 3D model for furniture, or **live, in-camera wall AR** for wall coverings. We generate and host the models; the client manages everything through our platform. Our edge: we **auto-generate the 3D/surface asset from a photo or URL**, the exact step competitors do by hand and charge a fortune for.

---

## What we're building

A retailer installs a small `<script>` snippet → it renders a "View in your room" button on their product pages → tapping it opens **our popup** over their page with:

- **`object` mode** — furniture, décor, lighting → a generated **3D model** + place-in-room AR.
- **`surface` mode** — wallpaper, paint, tile, flooring → **live, in-camera AR** mapping the pattern/colour onto the shopper's actual wall or floor.

The two modes are **the same product with a purpose switch** — and **the pricing tiers**. A client selling both categories gets one integration and pays more for more capability.

## Why this, why now

- **Proven category, expensive incumbent bottleneck.** Roomvo already powers **6,000+ retailer sites** for surfaces; Threekit / Cylindo / Levar do 3D objects. Demand is established. Their cost problem is **manual 3D asset creation** per SKU.
- **Our wedge:** we already run an auto-generation pipeline (Hunyuan3D on serverless GPU) that turns a product photo into a 3D model. One embed that covers **both** objects *and* surfaces, with the assets generated for pennies, is a real gap in the market.

## How the AR actually works (the honest part)

| Mode | Experience | Reality |
|---|---|---|
| **object** (furniture) | Native AR Quick Look (iOS) + Scene Viewer (Android) | **Solved, high quality.** We largely have this. |
| **surface** (wall coverings) | Live in-camera wall/floor retexturing | **Harder.** iPhone Safari has *no* working web AR for surfaces, so real-time wall AR needs our own computer vision. |

**Decision — we chose the premium-quality path ("Path B"), degrading gracefully by device:**

| Where the shopper is | Surface AR they get |
|---|---|
| iPhone, normal Safari | **Native App Clip** (no install) — ARKit + LiDAR occlusion + Metal retexture = **native-grade** |
| iPhone, inside Instagram/TikTok browser | Web camera-tracking (Mattercraft) — **preview-grade, still live** |
| Android Chrome | Web camera-tracking (Mattercraft) — **preview-grade, live** |
| Desktop / unsupported | Flat swatch render or 3D view |

- **Web engine: Zappar Mattercraft** (~$3,060/yr) — the maintained successor to 8th Wall (which Niantic shut down Feb 2026). We build on this, **not** the abandoned 8th Wall code.
- **Why the premium path is affordable for us:** our existing native iOS app (`Vastra`) *already* has ARKit, LiDAR depth scanning, and Metal texture rendering. The App Clip is a **carve-out of code we've written**, not a new native app from scratch.

## What we can honestly promise a client (v1)

- ✅ Live, in-camera, **no-app** AR preview of their product on the shopper's real wall/floor — iPhone Safari **and** Android Chrome.
- ⚠️ "Preview-grade" on web (accurate colour/pattern; lighting & edges below native paint apps); **native-grade** on iPhone via the App Clip tier.
- ❌ Not photorealistic on web, not LiDAR-perfect occlusion on iOS web. Native-grade fidelity is the **premium upgrade tier**, not the default.

## The pieces

1. **Embed SDK** *(new)* — the button + cross-origin popup on the client's site.
2. **Web viewer** *(reuse + new)* — existing 3D viewer for objects; Mattercraft for surface AR.
3. **iOS App Clip** *(new, carved from the `Vastra` app)* — premium surface AR.
4. **Management platform** *(new)* — client accounts, product→model catalog, generation, embed config, per-client keys, analytics, billing.
5. **Backend** *(reuse)* — the existing generation pipeline, hardened for multi-tenant B2B.
6. **Current consumer site** → becomes the **demo / sales site**.

## Decided vs. open

- **Decided:** B2B embed; two modes as pricing tiers; Path B (App Clip + web fallback); Mattercraft; universal snippet first, Shopify app later; reuse backend; consumer app → demo.
- **Open (next):** backend B2B-readiness (durable model storage + CDN, per-client keys, per-domain allow-listing), pricing specifics, first design/retail partner, and the v1 scope.

## Suggested first step

Prove the **end-to-end embed loop** before building any platform: one real generated model, on a demo product page, button → popup → 3D + AR. That single demo is what we show a design partner to close them.

---

*AR feasibility sources: [WebXR on iOS — Variant Launch](https://launch.variant3d.com/blog/23-06-state-webxr-on-ios-beyond) · [Zappar Mattercraft](https://zap.works/mattercraft/) · [8th Wall open-sourced — Road to VR](https://roadtovr.com/niantic-webar-platform-8th-wall-open-source/) · [WebGPU on iOS 26](https://web.dev/blog/webgpu-supported-major-browsers) · [App Clips — Apple](https://developer.apple.com/help/app-store-connect/offer-app-clip-experiences/overview-of-app-clips/) · [Roomvo](https://get.roomvo.com/)*
